import {
  Collection,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  DocId,
  PointId,
  Doc,
  ChunkMeta,
} from '@domain/entities/types.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import {
  ITransactionManager,
  TransactionOperationType,
} from '@domain/repositories/ITransactionManager.js';
import { Logger } from '@logging/logger.js';
import { AppError } from '@api/contracts/error.js';

/**
 * 块数据的类型定义
 *
 * 表示从数据库返回的块数据格式，包含块的基本信息和内容。
 * 用于在集合服务中处理文档块的映射和转换操作。
 */
interface ChunkData {
  pointId: PointId;
  docId: DocId;
  collectionId: CollectionId;
  chunkIndex: number;
  title?: string;
  content: string;
}

/**
 * 集合服务实现类
 *
 * 负责管理文档集合的创建、查询、更新和删除操作。
 * 提供集合级别的业务逻辑，包括级联删除文档和向量数据的功能。
 *
 * @example
 * ```typescript
 * const collectionService = new CollectionService(sqliteRepo, qdrantRepo, transactionManager);
 * const collection = await collectionService.createCollection({
 *   name: 'My Collection',
 *   description: 'A sample collection'
 * });
 * ```
 */
export class CollectionService implements ICollectionService {
  /**
   * 构造函数
   *
   * @param sqliteRepo - SQLite 数据库仓储实例，用于本地数据持久化
   * @param qdrantRepo - Qdrant 向量数据库仓储实例，用于向量数据管理
   * @param transactionManager - 可选的事务管理器，用于支持嵌套事务操作
   */
  constructor(
    private sqliteRepo: ISQLiteRepo,
    private qdrantRepo: IQdrantRepo, // Add QdrantRepo for cascade deletion
    private readonly logger: Logger,
    private transactionManager?: ITransactionManager, // Add TransactionManager for nested transaction support
  ) {}

  /**
   *
   * @param name
   * @param description
   */
  createCollection(name: string, description?: string): Collection {
    const collectionId = this.sqliteRepo.collections.create({
      name,
      description,
    });
    return this.sqliteRepo.collections.getById(collectionId)!;
  }

  /**
   *
   */
  listAllCollections(): Collection[] {
    return this.sqliteRepo.collections.listAll();
  }

  /**
   *
   * @param query
   */
  listCollectionsPaginated(
    query: PaginationQuery,
  ): PaginatedResponse<Collection> {
    return this.sqliteRepo.collections.listPaginated(query);
  }

  /**
   *
   * @param collectionId
   */
  getCollectionById(collectionId: CollectionId): Collection | undefined {
    return this.sqliteRepo.collections.getById(collectionId);
  }

  /**
   *
   * @param collectionId
   * @param name
   * @param description
   */
  updateCollection(
    collectionId: CollectionId,
    name?: string,
    description?: string,
  ): Collection {
    // 检查集合是否存在
    const existingCollection =
      this.sqliteRepo.collections.getById(collectionId);
    if (!existingCollection) {
      throw AppError.createNotFoundError(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // 如果提供了新名称，检查名称是否已被其他集合使用
    if (name && name !== existingCollection.name) {
      const existingByName = this.sqliteRepo.collections.getByName(name);
      if (existingByName) {
        throw new Error(`Collection with name '${name}' already exists`);
      }
    }

    // 更新集合
    this.sqliteRepo.collections.update(collectionId, {
      name: name || existingCollection.name,
      description:
        description !== undefined
          ? description
          : existingCollection.description,
    });

    // 返回更新后的集合
    return this.sqliteRepo.collections.getById(collectionId)!;
  }

  /**
   * 删除集合及其所有关联的文档和块（级联删除）
   * 此操作会同时从SQLite数据库和Qdrant向量数据库中删除相关数据
   * 支持嵌套事务和保存点机制
   * @param {CollectionId} collectionId - 要删除的集合ID
   * @returns {Promise<void>}
   * @throws {Error} 当集合不存在或删除失败时抛出错误
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    // 如果有事务管理器，使用事务管理器处理嵌套事务
    if (this.transactionManager) {
      return this.deleteCollectionWithTransactionManager(collectionId);
    }

    // 回退到原始实现
    return this.deleteCollectionWithoutTransactionManager(collectionId);
  }

  /**
   * 使用事务管理器删除集合（支持嵌套事务）
   * @param collectionId 集合ID
   */
  private async deleteCollectionWithTransactionManager(
    collectionId: CollectionId,
  ): Promise<void> {
    const t0 = Date.now();
    await this.transactionManager!.executeInTransaction(
      async (context) => {
        // 获取集合信息用于日志记录
        const collection = this.sqliteRepo.collections.getById(collectionId);
        if (!collection) {
          // 幂等删除：目标不存在视为已删除
          this.logger.info('[DeleteAudit] Collection not found, no-op', {
            collectionId,
          });
          return;
        }

        // 获取集合中的所有文档
        const docs = this.sqliteRepo.docs.listByCollection(collectionId);
        const docIds = docs.map((doc: Doc) => doc.docId);

        // 收集所有文档的所有块ID，用于从Qdrant删除
        const allPointIds: PointId[] = [];
        for (const doc of docs) {
          const chunks = this.sqliteRepo.chunks.getByDocId(doc.docId);
          allPointIds.push(...chunks.map((chunk: ChunkData) => chunk.pointId));
        }

        // 创建保存点以便在需要时回滚
        const savepointId = await this.transactionManager!.createSavepoint(
          context.transactionId,
          `delete-collection-${collectionId}`,
          {
            collectionId,
            docsCount: docs.length,
            chunksCount: allPointIds.length,
          },
        );

        try {
          this.logger.info('[DeleteAudit] Collection deletion start', {
            collectionId,
            docsCount: docs.length,
            // chunksCount will be allPointIds.length below but not yet computed
          });
          // 1. 从Qdrant向量数据库删除所有相关向量点
          if (allPointIds.length > 0) {
            const tq0 = Date.now();
            await this.qdrantRepo.deletePoints(collectionId, allPointIds);
            this.logger.info('[DeleteAudit] Qdrant points deleted', {
              collectionId,
              points: allPointIds.length,
              elapsedMs: Date.now() - tq0,
            });
          }

          // 2. 从SQLite数据库删除集合及其所有相关文档和块
          // 使用嵌套事务避免与外部事务冲突
          await this.transactionManager!.executeInNestedTransaction(
            context.transactionId,
            async (nestedContext) => {
              // 记录删除操作到嵌套事务
              await this.transactionManager!.executeOperation(
                nestedContext.transactionId,
                {
                  type: TransactionOperationType.DELETE,
                  target: 'collection',
                  targetId: collectionId,
                  data: { collection, docs, allPointIds },
                },
              );

              // 执行实际的删除操作
              this.sqliteRepo.deleteCollection(collectionId);
            },
            { operation: 'deleteCollectionSQLite', collectionId },
          );

          this.logger.info('[DeleteAudit] SQLite cascade deletion completed', {
            collectionId,
            docsCount: docs.length,
            chunksCount: allPointIds.length,
          });

          this.logger.info('[DeleteAudit] Collection deletion completed', {
            collectionId,
            totalElapsedMs: Date.now() - t0,
          });

          // 释放保存点
          await this.transactionManager!.releaseSavepoint(
            context.transactionId,
            savepointId,
          );
        } catch (error) {
          this.logger.error(
            '[DeleteAudit] Error during cascade deletion of collection',
            { collectionId, error: error instanceof Error ? error.message : String(error) },
          );

          // 回滚到保存点
          try {
            await this.transactionManager!.rollbackToSavepoint(
              context.transactionId,
              savepointId,
            );
          } catch (rollbackError) {
            console.error('Failed to rollback to savepoint:', rollbackError);
          }

          throw error;
        }
      },
      { operation: 'deleteCollection', collectionId },
    );
  }

  /**
   * 不使用事务管理器删除集合（原始实现）
   * @param collectionId 集合ID
   */
  private async deleteCollectionWithoutTransactionManager(
    collectionId: CollectionId,
  ): Promise<void> {
    const t0 = Date.now();
    // 获取集合信息用于日志记录
    const collection = this.sqliteRepo.collections.getById(collectionId);
    if (!collection) {
      // 幂等删除：目标不存在视为已删除
      this.logger.info('[DeleteAudit] Collection not found, no-op', {
        collectionId,
      });
      return;
    }

    // 获取集合中的所有文档
    const docs = this.sqliteRepo.docs.listByCollection(collectionId);
    const docIds = docs.map((doc: Doc) => doc.docId);

    // 收集所有文档的所有块ID，用于从Qdrant删除
    const allPointIds: PointId[] = [];
    for (const doc of docs) {
      const chunks = this.sqliteRepo.chunks.getByDocId(doc.docId);
      allPointIds.push(...chunks.map((chunk: ChunkData) => chunk.pointId));
    }

    // 先删除Qdrant中的向量，再在本地开启同步事务删除数据库记录
    this.logger.info('[DeleteAudit] Collection deletion start', {
      collectionId,
      docsCount: docs.length,
      chunksCount: allPointIds.length,
    });
    if (allPointIds.length > 0) {
      const tq0 = Date.now();
      await this.qdrantRepo.deletePoints(collectionId, allPointIds);
      this.logger.info('[DeleteAudit] Qdrant points deleted', {
        collectionId,
        points: allPointIds.length,
        elapsedMs: Date.now() - tq0,
      });
    } else {
      this.logger.info('[DeleteAudit] No Qdrant points to delete', {
        collectionId,
      });
    }

    this.sqliteRepo.transaction(() => {
      // CollectionManager.deleteCollection 已处理级联删除
      this.sqliteRepo.deleteCollection(collectionId);
    });
    this.logger.info('[DeleteAudit] SQLite cascade deletion completed', {
      collectionId,
      docsCount: docs.length,
      chunksCount: allPointIds.length,
    });
    this.logger.info('[DeleteAudit] Collection deletion completed', {
      collectionId,
      totalElapsedMs: Date.now() - t0,
    });
  }
}
