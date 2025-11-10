import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { Doc } from '../entities/Doc.js';
import { Chunk } from '../entities/Chunk.js';
import { DocRepository } from './DocRepository.js';
import { ChunkRepository } from './ChunkRepository.js';
import {
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  PointId,
} from '@domain/entities/types.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { IDocumentAggregateRepository } from '@domain/repositories/IAggregateRepository.js';
import { Collection } from '../entities/Collection.js';
import { Doc as DomainDoc, DocStatus } from '@domain/entities/Doc.js';
import { Chunk as DomainChunk, ChunkStatus } from '@domain/entities/Chunk.js';

/**
 * 文档聚合仓储实现
 * 基于TypeORM实现文档聚合的持久化操作
 */
export class DocumentAggregateRepository
  implements IDocumentAggregateRepository
{
  private docRepository: DocRepository;
  private chunkRepository: ChunkRepository;

  /**
   * 构造函数
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    // 验证数据源是否已初始化
    if (!dataSource.isInitialized) {
      this.logger.warn('DocumentAggregateRepository: DataSource未初始化');
    }
    this.docRepository = new DocRepository(dataSource, logger);
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 保存文档聚合
   * @param aggregate 文档聚合
   */
  async save(aggregate: DocumentAggregate): Promise<void> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('保存文档聚合失败: DataSource未初始化', {
          docId: aggregate.id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      await this.dataSource.transaction(async (manager) => {
        // 保存文档实体
        const docEntity = this.mapAggregateToDocEntity(aggregate);
        await manager.save(docEntity);

        // 保存块实体
        const chunkEntities = this.mapAggregateToChunkEntities(aggregate);
        if (chunkEntities.length > 0) {
          await this.chunkRepository.createBatchWithManager(
            manager,
            chunkEntities,
          );
        }

        this.logger.debug('文档聚合保存成功', {
          docId: aggregate.id,
          collectionId: aggregate.collectionId,
          chunkCount: chunkEntities.length,
        });
      });
    } catch (error) {
      this.logger.error('保存文档聚合失败', {
        docId: aggregate.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据ID查找文档聚合
   * @param id 文档ID
   * @returns 文档聚合或null
   */
  async findById(id: DocId): Promise<DocumentAggregate | null> {
    try {
      const docEntity = await this.docRepository.findById(id as string);
      if (!docEntity) {
        return null;
      }

      // 获取文档的块
      const chunkEntities = await this.chunkRepository.findByDocId(id);

      // 创建聚合
      return this.mapEntitiesToAggregate(docEntity, chunkEntities);
    } catch (error) {
      this.logger.error('查找文档聚合失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和键值查找文档聚合
   * @param collectionId 集合ID
   * @param key 文档键值
   * @returns 文档聚合或null
   */
  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<DocumentAggregate | null> {
    try {
      const docEntity = await this.docRepository.findByCollectionAndKey(
        collectionId,
        key,
      );
      if (!docEntity) {
        return null;
      }

      // 获取文档的块
      const chunkEntities = await this.chunkRepository.findByDocId(
        docEntity.id as DocId,
      );

      // 创建聚合
      return this.mapEntitiesToAggregate(docEntity, chunkEntities);
    } catch (error) {
      this.logger.error('根据集合和键查找文档聚合失败', {
        collectionId,
        key,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查文档键是否已存在于集合中
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param excludeId 排除的文档ID（用于更新时检查）
   * @returns 是否存在
   */
  async existsByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
    excludeId?: DocId,
  ): Promise<boolean> {
    try {
      const doc = await this.docRepository.findByCollectionAndKey(
        collectionId,
        key,
      );
      return doc !== null && doc.id !== excludeId;
    } catch (error) {
      this.logger.error('检查文档键是否存在失败', {
        collectionId,
        key,
        excludeId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找文档聚合
   * @param collectionId 集合ID
   * @returns 文档聚合数组
   */
  async findByCollectionId(
    collectionId: CollectionId,
  ): Promise<DocumentAggregate[]> {
    try {
      const docEntities =
        await this.docRepository.findByCollectionId(collectionId);

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('根据集合ID查找文档聚合失败', {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID分页查找文档聚合
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @returns 分页的文档聚合响应
   */
  async findByCollectionIdPaginated(
    collectionId: CollectionId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>> {
    try {
      const { page = 1, limit = 20 } = query;

      // 获取分页的文档实体
      const result = await this.docRepository.findByCollectionIdPaginated(
        collectionId,
        { page, limit },
      );
      const entities = result.items ?? result.data;
      const total = result.pagination.total;

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of entities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      const totalPages = Math.ceil(total / limit);

      return {
        data: aggregates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('分页查找文档聚合失败', {
        collectionId,
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据状态查找文档聚合
   * @param status 文档状态
   * @returns 文档聚合数组
   */
  async findByStatus(status: string): Promise<DocumentAggregate[]> {
    try {
      const allowedStatuses = [
        'new',
        'processing',
        'completed',
        'failed',
      ] as const;
      if (
        !allowedStatuses.includes(status as (typeof allowedStatuses)[number])
      ) {
        throw new Error(`Unsupported document status: ${status}`);
      }
      const targetStatus = status as (typeof allowedStatuses)[number];
      const docEntities = await this.docRepository.findByStatus(targetStatus);

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('根据状态查找文档聚合失败', {
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和状态查找文档聚合
   * @param collectionId 集合ID
   * @param status 文档状态
   * @returns 文档聚合数组
   */
  async findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<DocumentAggregate[]> {
    try {
      const docEntities = await this.docRepository.findByCollectionIdAndStatus(
        collectionId,
        status,
      );

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('根据集合ID和状态查找文档聚合失败', {
        collectionId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找可处理的文档聚合
   * @param collectionId 集合ID（可选）
   * @param limit 限制数量
   * @returns 可处理的文档聚合数组
   */
  async findProcessable(
    collectionId?: CollectionId,
    limit?: number,
  ): Promise<DocumentAggregate[]> {
    try {
      const docEntities = collectionId
        ? await this.docRepository.findProcessable(collectionId, limit)
        : [];

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找可处理文档聚合失败', {
        collectionId,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找已删除的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 已删除的文档聚合数组
   */
  async findDeleted(collectionId?: CollectionId): Promise<DocumentAggregate[]> {
    try {
      const docEntities = await this.docRepository.findDeleted(collectionId);

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找已删除文档聚合失败', {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找处理失败的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 处理失败的文档聚合数组
   */
  async findFailed(collectionId?: CollectionId): Promise<DocumentAggregate[]> {
    try {
      const docEntities = collectionId
        ? await this.docRepository.findFailed(collectionId)
        : [];

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找处理失败文档聚合失败', {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找处理完成的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 处理完成的文档聚合数组
   */
  async findCompleted(
    collectionId?: CollectionId,
  ): Promise<DocumentAggregate[]> {
    try {
      const docEntities = collectionId
        ? await this.docRepository.findCompleted(collectionId)
        : [];

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of docEntities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找处理完成文档聚合失败', {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取文档聚合
   * @param query 分页查询参数
   * @returns 分页的文档聚合响应
   */
  async findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>> {
    try {
      const { page = 1, limit = 20 } = query;

      // 获取分页的文档实体
      const result = await this.docRepository.findPaginated(page, limit);
      const entities = result.items ?? result.data;
      const total = result.pagination.total;

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of entities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(this.mapEntitiesToAggregate(docEntity, chunkEntities));
      }

      const totalPages = Math.ceil(total / limit);

      return {
        data: aggregates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('分页获取文档聚合失败', {
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 删除文档聚合
   * @param id 文档ID
   * @returns 是否成功删除
   */
  async delete(id: DocId): Promise<boolean> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('删除文档聚合失败: DataSource未初始化', {
          docId: id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      await this.dataSource.transaction(async (manager) => {
        // 删除文档的块
        await this.chunkRepository.deleteByDocIdWithManager(id, manager as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        // 删除文档
        await this.docRepository.deleteWithManager(id, manager as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        this.logger.info('文档聚合删除成功', {
          docId: id,
        });
      });

      return true;
    } catch (error) {
      this.logger.error('删除文档聚合失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 软删除文档聚合
   * @param id 文档ID
   * @returns 是否成功软删除
   */
  async softDelete(id: DocId): Promise<boolean> {
    try {
      await this.docRepository.softDelete(id);

      this.logger.info('文档聚合软删除成功', {
        docId: id,
      });

      return true;
    } catch (error) {
      this.logger.error('文档聚合软删除失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 恢复已删除的文档聚合
   * @param id 文档ID
   * @returns 是否成功恢复
   */
  async restore(id: DocId): Promise<boolean> {
    try {
      await this.docRepository.restore(id);

      this.logger.info('文档聚合恢复成功', {
        docId: id,
      });

      return true;
    } catch (error) {
      this.logger.error('文档聚合恢复失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查文档是否可以被删除
   * @param id 文档ID
   * @returns 是否可以删除
   */
  async canBeDeleted(id: DocId): Promise<boolean> {
    try {
      const doc = await this.docRepository.findById(id as string);
      if (!doc) {
        return false;
      }

      // 可以添加其他业务规则检查
      return true;
    } catch (error) {
      this.logger.error('检查文档是否可以删除失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的块数量
   * @param id 文档ID
   * @returns 块数量
   */
  async getChunkCount(id: DocId): Promise<number> {
    try {
      return await this.chunkRepository.countByDocId(id);
    } catch (error) {
      this.logger.error('获取文档块数量失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的已完成块数量
   * @param id 文档ID
   * @returns 已完成块数量
   */
  async getCompletedChunkCount(id: DocId): Promise<number> {
    try {
      return await this.chunkRepository.countCompletedByDocId(id);
    } catch (error) {
      this.logger.error('获取文档已完成块数量失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的失败块数量
   * @param id 文档ID
   * @returns 失败块数量
   */
  async getFailedChunkCount(id: DocId): Promise<number> {
    try {
      return await this.chunkRepository.countFailedByDocId(id);
    } catch (error) {
      this.logger.error('获取文档失败块数量失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 更新结果
   */
  async batchUpdateStatus(ids: DocId[], status: string): Promise<number> {
    try {
      const allowedStatuses = [
        'new',
        'processing',
        'completed',
        'failed',
      ] as const;
      if (
        !allowedStatuses.includes(status as (typeof allowedStatuses)[number])
      ) {
        throw new Error(`Unsupported document status: ${status}`);
      }
      const targetStatus = status as (typeof allowedStatuses)[number];
      const result = await this.docRepository.batchUpdateStatus(
        ids,
        targetStatus,
      );
      const updatedCount =
        typeof result === 'object'
          ? (result.updated ?? result.success)
          : result;

      this.logger.info('批量更新文档状态成功', {
        count: updatedCount,
        status,
      });

      return updatedCount;
    } catch (error) {
      this.logger.error('批量更新文档状态失败', {
        ids,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 将聚合映射为文档实体
   * @param aggregate 文档聚合
   * @returns 文档实体
   */
  private mapAggregateToDocEntity(aggregate: DocumentAggregate): Doc {
    const entity = new Doc();
    entity.id = aggregate.id;
    entity.collectionId = aggregate.collectionId;
    entity.key = aggregate.key;
    entity.name = aggregate.name || '';
    entity.size_bytes = aggregate.document.sizeBytes || 0;
    entity.mime = aggregate.document.mime || '';
    entity.content = aggregate.content?.getValue() || '';
    entity.deleted = aggregate.isDeleted;
    entity.status = aggregate.status as
      | 'new'
      | 'processing'
      | 'completed'
      | 'failed';
    entity.created_at = aggregate.createdAt;
    entity.updated_at = aggregate.updatedAt;
    return entity;
  }

  /**
   * 将聚合映射为块实体数组
   * @param aggregate 文档聚合
   * @returns 块实体数组
   */
  private mapAggregateToChunkEntities(aggregate: DocumentAggregate): Chunk[] {
    return aggregate.getChunks().map(
      (chunk) =>
        ({
          id: chunk.pointId as unknown as string,
          pointId: chunk.pointId as unknown as string,
          docId: chunk.docId as unknown as string,
          collectionId: chunk.collectionId as unknown as string,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.contentValue,
          created_at: chunk.createdAt,
          updated_at: chunk.updatedAt,
          chunkMeta: undefined,
          chunkFullText: undefined,
        }) as unknown as Chunk,
    );
  }

  /**
   * 将实体映射为聚合
   * @param docEntity 文档实体
   * @param chunkEntities 块实体数组
   * @returns 文档聚合
   */
  /**
   * 将实体映射为聚合
   * @param docEntity 文档实体
   * @param chunkEntities 块实体数组
   * @returns 文档聚合
   */
  private mapEntitiesToAggregate(
    docEntity: Doc,
    chunkEntities: Chunk[],
  ): DocumentAggregate {
    // 首先将基础设施实体转换为领域实体
    const domainDoc = DomainDoc.reconstitute(
      docEntity.id as DocId,
      docEntity.collectionId as CollectionId,
      docEntity.key,
      docEntity.name,
      docEntity.size_bytes,
      docEntity.mime,
      this.mapDocStatus(docEntity.status),
      docEntity.deleted,
      typeof docEntity.created_at === 'number'
        ? docEntity.created_at
        : Date.now(),
      typeof docEntity.updated_at === 'number'
        ? docEntity.updated_at
        : Date.now(),
    );

    // 然后使用领域实体创建聚合
    // 将基础设施层的Chunk实体转换为领域层的Chunk实体
    const domainChunks = chunkEntities.map((chunkEntity) => {
      const domainChunk = DomainChunk.reconstitute(
        chunkEntity.pointId as PointId,
        chunkEntity.docId as DocId,
        chunkEntity.collectionId as CollectionId,
        chunkEntity.chunkIndex,
        chunkEntity.content || '',
        chunkEntity.title,
        undefined, // embedding
        undefined, // titleChain
        undefined, // contentHash
        ChunkStatus.NEW, // status - default to NEW since Chunk entity doesn't store status
        typeof chunkEntity.created_at === 'number'
          ? chunkEntity.created_at
          : Date.now(),
        typeof chunkEntity.updated_at === 'number'
          ? chunkEntity.updated_at
          : Date.now(),
      );
      return domainChunk;
    });

    return DocumentAggregate.reconstitute(domainDoc, domainChunks);
  }

  /**
   * 将基础设施层的 Doc 状态转换为领域层的 DocStatus
   * @param status 基础设施层的文档状态
   * @returns 领域层的文档状态
   */
  private mapDocStatus(
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): DocStatus {
    const statusMap: Record<
      'new' | 'processing' | 'completed' | 'failed',
      DocStatus
    > = {
      new: DocStatus.NEW,
      processing: DocStatus.PROCESSING,
      completed: DocStatus.COMPLETED,
      failed: DocStatus.FAILED,
    };
    return statusMap[status] || DocStatus.NEW;
  }
}
