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
import { ICollectionService } from '@application/services/index.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import {
  ITransactionManager,
  TransactionOperationType,
} from '@domain/repositories/ITransactionManager.js';
import { Logger, EnhancedLogger, LogTag } from '@logging/logger.js';
import { AppError } from '@api/contracts/Error.js';
import { CollectionAggregate } from '@domain/aggregates/index.js';
import { ICollectionAggregateRepository } from '@domain/repositories/index.js';
import { IEventPublisher } from '@domain/events/index.js';
import { CollectionIdGenerator } from '@domain/value-objects/index.js';

/**
 * 集合服务实现类
 *
 * 负责管理文档集合的创建、查询、更新和删除操作。
 * 提供集合级别的业务逻辑，包括级联删除文档和向量数据的功能。
 * 使用聚合和领域服务完成业务操作，处理跨聚合的协调工作。
 *
 * @example
 * ```typescript
 * const collectionService = new CollectionService(collectionRepository, qdrantRepo, eventPublisher, logger, transactionManager);
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
   * @param collectionRepository - 集合聚合仓储实例
   * @param qdrantRepo - Qdrant 向量数据库仓储实例，用于向量数据管理
   * @param eventPublisher - 事件发布器实例
   * @param logger - 日志记录器实例
   * @param transactionManager - 可选的事务管理器，用于支持嵌套事务操作
   * @param enhancedLogger - 可选的增强日志记录器实例
   */
  constructor(
    private collectionRepository: ICollectionAggregateRepository,
    private qdrantRepo: IQdrantRepo, // Add QdrantRepo for cascade deletion
    private eventPublisher: IEventPublisher,
    private readonly logger: Logger,
    private transactionManager?: ITransactionManager, // Add TransactionManager for nested transaction support
    private readonly enhancedLogger?: EnhancedLogger, // Add enhanced logger
  ) {}

  /**
   * 创建集合
   * @param name 集合名称
   * @param description 集合描述
   * @returns {Promise<Collection>} 返回创建的集合
   */
  async createCollection(
    name: string,
    description?: string,
  ): Promise<Collection> {
    const startTime = Date.now();

    // 使用增强日志记录集合创建过程
    const collectionLogger = this.enhancedLogger?.withTag(LogTag.COLLECTION);

    // 检查集合名称是否已存在
    const nameExists = await this.collectionRepository.existsByName(name);
    if (nameExists) {
      collectionLogger?.error('集合名称已存在', undefined, {
        name,
      });
      throw new Error(`Collection with name '${name}' already exists`);
    }

    // 生成集合ID
    const collectionId = CollectionIdGenerator.generate();

    collectionLogger?.info('开始创建集合', undefined, {
      collectionId,
      name,
      description,
    });

    // 使用聚合创建集合
    const aggregate = CollectionAggregate.create(
      collectionId,
      name,
      description,
    );

    // 验证聚合状态
    const validation = aggregate.validate();
    if (!validation.isValid) {
      collectionLogger?.error('集合数据验证失败', undefined, {
        collectionId,
        name,
        errors: validation.errors,
      });
      throw new Error(
        `Invalid collection data: ${validation.errors.join(', ')}`,
      );
    }

    // 保存聚合
    await this.collectionRepository.save(aggregate);

    collectionLogger?.debug('集合聚合已保存', undefined, {
      collectionId,
      name,
    });

    // 发布领域事件
    await this.eventPublisher.publishBatch(aggregate.getDomainEvents());
    aggregate.clearDomainEvents();

    collectionLogger?.debug('集合领域事件已发布', undefined, {
      collectionId,
      eventCount: aggregate.getDomainEvents().length,
    });

    this.logger.info('Collection created successfully', {
      collectionId,
      name,
      description,
    });

    collectionLogger?.info('集合创建成功', undefined, {
      collectionId,
      name,
      description,
      duration: Date.now() - startTime,
    });

    return {
      id: aggregate.id,
      collectionId: aggregate.id,
      name: aggregate.name,
      description: aggregate.description,
      status: 'active' as const, // 新创建的集合默认为active状态
      created_at: aggregate.createdAt,
      updated_at: aggregate.updatedAt,
    };
  }

  /**
   * 获取所有集合
   * @returns {Promise<Collection[]>} 返回所有集合列表
   */
  async listAllCollections(): Promise<Collection[]> {
    const aggregates = await this.collectionRepository.findAll();
    return aggregates.map((aggregate) => ({
      id: aggregate.id,
      collectionId: aggregate.id,
      name: aggregate.name,
      description: aggregate.description,
      status: 'active' as const, // 默认状态为active
      created_at: aggregate.createdAt,
      updated_at: aggregate.updatedAt,
    }));
  }

  /**
   * 分页获取集合列表
   * @param query 分页查询参数
   * @returns {Promise<PaginatedResponse<Collection>>} 返回分页的集合列表
   */
  async listCollectionsPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Collection>> {
    const result = await this.collectionRepository.findPaginated(query);
    return {
      data: result.data.map((aggregate) => ({
        id: aggregate.id,
        collectionId: aggregate.id,
        name: aggregate.name,
        description: aggregate.description,
        status: 'active' as const, // 默认状态为active
        created_at: aggregate.createdAt,
        updated_at: aggregate.updatedAt,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * 根据集合ID获取集合信息
   * @param collectionId 集合ID
   * @returns {Promise<Collection | null>} 返回集合信息，如果不存在则返回null
   */
  async getCollectionById(
    collectionId: CollectionId,
  ): Promise<Collection | null> {
    const aggregate = await this.collectionRepository.findById(collectionId);
    return aggregate
      ? {
          id: aggregate.id,
          collectionId: aggregate.id,
          name: aggregate.name,
          description: aggregate.description,
          status: 'active' as const, // 默认状态为active
          created_at: aggregate.createdAt,
          updated_at: aggregate.updatedAt,
        }
      : null;
  }

  /**
   * 更新集合信息
   * @param collectionId 集合ID
   * @param name 新的集合名称
   * @param description 新的集合描述
   * @param status 新的集合状态
   * @returns {Promise<Collection>} 返回更新后的集合
   */
  async updateCollection(
    collectionId: CollectionId,
    name?: string,
    description?: string,
    status?: 'active' | 'inactive' | 'archived',
  ): Promise<Collection> {
    const startTime = Date.now();

    // 使用增强日志记录集合更新过程
    const collectionLogger = this.enhancedLogger?.withTag(LogTag.COLLECTION);

    collectionLogger?.info('开始更新集合', undefined, {
      collectionId,
      name,
      description,
      status,
    });

    // 获取集合聚合
    const aggregate = await this.collectionRepository.findById(collectionId);
    if (!aggregate) {
      collectionLogger?.error('集合不存在', undefined, {
        collectionId,
      });
      throw AppError.createNotFoundError(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // 如果提供了新名称，检查名称是否已被其他集合使用
    if (name && name !== aggregate.name) {
      const nameExists = await this.collectionRepository.existsByName(
        name,
        collectionId,
      );
      if (nameExists) {
        collectionLogger?.error('集合名称已存在', undefined, {
          collectionId,
          name,
        });
        throw new Error(`Collection with name '${name}' already exists`);
      }
    }

    // 更新聚合（使用不可变操作）
    let updatedAggregate = aggregate;
    if (name !== undefined && name !== aggregate.name) {
      updatedAggregate = updatedAggregate.withName(name);
    }

    if (description !== undefined) {
      updatedAggregate = updatedAggregate.withDescription(description);
    }

    // 验证聚合状态
    const validation = aggregate.validate();
    if (!validation.isValid) {
      collectionLogger?.error('集合数据验证失败', undefined, {
        collectionId,
        errors: validation.errors,
      });
      throw new Error(
        `Invalid collection data: ${validation.errors.join(', ')}`,
      );
    }

    // 保存聚合（这会更新name和description）
    await this.collectionRepository.save(updatedAggregate);

    collectionLogger?.debug('集合聚合已更新', undefined, {
      collectionId,
    });

    // 如果需要更新状态，单独调用updateCollection方法
    if (status !== undefined) {
      try {
        const updatedAggregate =
          await this.collectionRepository.updateCollection(collectionId, {
            status,
          });

        if (!updatedAggregate) {
          throw new Error('Failed to update collection status');
        }

        collectionLogger?.debug('集合状态更新成功', undefined, {
          collectionId,
          status,
        });

        // 发布领域事件
        await this.eventPublisher.publishBatch(
          updatedAggregate.getDomainEvents(),
        );
        updatedAggregate.clearDomainEvents();

        this.logger.info('Collection updated successfully', {
          collectionId,
          name,
          description,
          status,
        });

        collectionLogger?.info('集合更新成功', undefined, {
          collectionId,
          name,
          description,
          status,
          duration: Date.now() - startTime,
        });

        return {
          id: updatedAggregate.id,
          collectionId: updatedAggregate.id,
          name: updatedAggregate.name,
          description: updatedAggregate.description,
          status: status, // 使用传入的状态值
          created_at: updatedAggregate.createdAt,
          updated_at: updatedAggregate.updatedAt,
        };
      } catch (error) {
        collectionLogger?.error('集合状态更新失败', undefined, {
          collectionId,
          status,
          error: (error as Error).message,
        });
        throw error;
      }
    }

    // 发布领域事件
    await this.eventPublisher.publishBatch(updatedAggregate.getDomainEvents());
    updatedAggregate.clearDomainEvents();

    collectionLogger?.debug('集合领域事件已发布', undefined, {
      collectionId,
      eventCount: aggregate.getDomainEvents().length,
    });

    this.logger.info('Collection updated successfully', {
      collectionId,
      name,
      description,
    });

    collectionLogger?.info('集合更新成功', undefined, {
      collectionId,
      name,
      description,
      duration: Date.now() - startTime,
    });

    return {
      id: updatedAggregate.id,
      collectionId: updatedAggregate.id,
      name: updatedAggregate.name,
      description: updatedAggregate.description,
      status: 'active' as const, // 默认状态
      created_at: updatedAggregate.createdAt,
      updated_at: updatedAggregate.updatedAt,
    };
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
    const startTime = Date.now();

    // 使用增强日志记录集合删除过程
    const collectionLogger = this.enhancedLogger?.withTag(LogTag.COLLECTION);

    collectionLogger?.info('开始删除集合', undefined, {
      collectionId,
    });

    // 获取集合聚合
    const aggregate = await this.collectionRepository.findById(collectionId);
    if (!aggregate) {
      // 集合不存在，抛出错误而不是静默返回
      this.logger.info('[DeleteAudit] Collection not found', {
        collectionId,
      });
      collectionLogger?.error('集合不存在', undefined, {
        collectionId,
      });
      throw AppError.createNotFoundError(
        `Collection with ID ${collectionId} not found`,
      );
    }

    // 检查集合是否可以被删除
    if (!aggregate.canBeDeleted()) {
      collectionLogger?.error('集合不能被删除', undefined, {
        collectionId,
      });
      throw new Error(`Collection ${collectionId} cannot be deleted`);
    }

    // 获取集合中的所有文档，用于级联删除
    const documents = aggregate.getDocuments();
    const allPointIds: PointId[] = [];

    // 收集所有文档的所有块ID，用于从Qdrant删除
    // 注意：这里需要从仓储获取实际的块数据
    // 在实际实现中，可能需要在聚合中添加获取块的方法
    // 或者通过文档聚合获取块信息
    for (const doc of documents) {
      // 这里需要通过文档仓储获取块信息
      // 暂时跳过，实际实现中需要获取块ID
    }

    collectionLogger?.info('集合删除信息', undefined, {
      collectionId,
      documentCount: documents.length,
      pointCount: allPointIds.length,
    });

    // ����������������ʹ���������������Ƕ������
    if (this.transactionManager) {
      try {
        await this.deleteCollectionWithTransactionManager(
          aggregate,
          allPointIds,
          startTime,
        );
        return;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes(
            'cannot start a transaction within a transaction',
          )
        ) {
          this.logger.warn(
            'Transaction manager unavailable, falling back to non-transactional deletion',
            {
              collectionId,
              reason: error.message,
            },
          );
        } else {
          throw error;
        }
      }
    }

    // 回退到原始实现
    await this.deleteCollectionWithoutTransactionManager(
      aggregate,
      allPointIds,
      startTime,
    );
  }

  /**
   * 使用事务管理器删除集合（支持嵌套事务）
   * @param aggregate 集合聚合
   * @param allPointIds 所有点ID列表
   * @param startTime 开始时间
   */
  private async deleteCollectionWithTransactionManager(
    aggregate: CollectionAggregate,
    allPointIds: PointId[],
    startTime: number,
  ): Promise<void> {
    const collectionId = aggregate.id;
    const t0 = Date.now();

    // 使用增强日志记录事务删除过程
    const collectionLogger = this.enhancedLogger?.withTag(LogTag.COLLECTION);

    await this.transactionManager!.executeInTransaction(
      async (context) => {
        // 创建保存点以便在需要时回滚
        const savepointId = await this.transactionManager!.createSavepoint(
          context.transactionId,
          `delete-collection-${collectionId}`,
          {
            collectionId,
            docsCount: aggregate.getDocumentCount(),
            chunksCount: allPointIds.length,
          },
        );

        try {
          this.logger.info('[DeleteAudit] Collection deletion start', {
            collectionId,
            docsCount: aggregate.getDocumentCount(),
            chunksCount: allPointIds.length,
          });

          collectionLogger?.info('开始事务删除集合', undefined, {
            collectionId,
            transactionId: context.transactionId,
            savepointId,
            documentCount: aggregate.getDocumentCount(),
            pointCount: allPointIds.length,
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

            collectionLogger?.info('Qdrant向量点删除完成', undefined, {
              collectionId,
              pointCount: allPointIds.length,
              duration: Date.now() - tq0,
            });
          }

          // 2. 从聚合仓储删除集合
          await this.collectionRepository.delete(collectionId);

          collectionLogger?.debug('集合聚合已删除', undefined, {
            collectionId,
          });

          this.logger.info('[DeleteAudit] SQLite cascade deletion completed', {
            collectionId,
            docsCount: aggregate.getDocumentCount(),
            chunksCount: allPointIds.length,
          });

          this.logger.info('[DeleteAudit] Collection deletion completed', {
            collectionId,
            totalElapsedMs: Date.now() - t0,
          });

          collectionLogger?.info('集合事务删除完成', undefined, {
            collectionId,
            totalDuration: Date.now() - startTime,
            transactionDuration: Date.now() - t0,
          });

          // 释放保存点
          await this.transactionManager!.releaseSavepoint(
            context.transactionId,
            savepointId,
          );
        } catch (error) {
          this.logger.error(
            '[DeleteAudit] Error during cascade deletion of collection',
            {
              collectionId,
              error: error instanceof Error ? error.message : String(error),
            },
          );

          collectionLogger?.error('集合事务删除失败', undefined, {
            collectionId,
            transactionId: context.transactionId,
            savepointId,
            error: (error as Error).message,
            stack: (error as Error).stack,
          });

          // 回滚到保存点
          try {
            await this.transactionManager!.rollbackToSavepoint(
              context.transactionId,
              savepointId,
            );

            collectionLogger?.info('事务已回滚到保存点', undefined, {
              collectionId,
              savepointId,
            });
          } catch (rollbackError) {
            console.error('Failed to rollback to savepoint:', rollbackError);
            collectionLogger?.error('回滚到保存点失败', undefined, {
              collectionId,
              savepointId,
              rollbackError: (rollbackError as Error).message,
            });
          }

          throw error;
        }
      },
      { operation: 'deleteCollection', collectionId },
    );
  }

  /**
   * 不使用事务管理器删除集合（原始实现）
   * @param aggregate 集合聚合
   * @param allPointIds 所有点ID列表
   * @param startTime 开始时间
   */
  private async deleteCollectionWithoutTransactionManager(
    aggregate: CollectionAggregate,
    allPointIds: PointId[],
    startTime: number,
  ): Promise<void> {
    const collectionId = aggregate.id;
    const t0 = Date.now();

    // 使用增强日志记录非事务删除过程
    const collectionLogger = this.enhancedLogger?.withTag(LogTag.COLLECTION);

    // 先删除Qdrant中的向量，再在本地开启同步事务删除数据库记录
    this.logger.info('[DeleteAudit] Collection deletion start', {
      collectionId,
      docsCount: aggregate.getDocumentCount(),
      chunksCount: allPointIds.length,
    });

    collectionLogger?.info('开始非事务删除集合', undefined, {
      collectionId,
      documentCount: aggregate.getDocumentCount(),
      pointCount: allPointIds.length,
    });

    if (allPointIds.length > 0) {
      const tq0 = Date.now();
      await this.qdrantRepo.deletePoints(collectionId, allPointIds);
      this.logger.info('[DeleteAudit] Qdrant points deleted', {
        collectionId,
        points: allPointIds.length,
        elapsedMs: Date.now() - tq0,
      });

      collectionLogger?.info('Qdrant向量点删除完成', undefined, {
        collectionId,
        pointCount: allPointIds.length,
        duration: Date.now() - tq0,
      });
    } else {
      this.logger.info('[DeleteAudit] No Qdrant points to delete', {
        collectionId,
      });

      collectionLogger?.info('没有Qdrant向量点需要删除', undefined, {
        collectionId,
      });
    }

    // 从聚合仓储删除集合
    await this.collectionRepository.delete(collectionId);

    collectionLogger?.debug('集合聚合已删除', undefined, {
      collectionId,
    });

    this.logger.info('[DeleteAudit] SQLite cascade deletion completed', {
      collectionId,
      docsCount: aggregate.getDocumentCount(),
      chunksCount: allPointIds.length,
    });
    this.logger.info('[DeleteAudit] Collection deletion completed', {
      collectionId,
      totalElapsedMs: Date.now() - t0,
    });

    collectionLogger?.info('集合非事务删除完成', undefined, {
      collectionId,
      totalDuration: Date.now() - startTime,
      deletionDuration: Date.now() - t0,
    });
  }
}
