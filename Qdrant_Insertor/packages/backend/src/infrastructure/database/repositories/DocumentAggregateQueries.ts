/**
 * 文档聚合查询模块
 * 包含所有查询相关的方法
 */

import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { DocRepository } from './DocRepository.js';
import { ChunkRepository } from './ChunkRepository.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { Doc as DomainDoc } from '@domain/entities/Doc.js';
import { DocumentAggregateCore } from './DocumentAggregateCore.js';

/**
 * 文档聚合查询模块
 * 包含所有查询相关的方法
 */
export class DocumentAggregateQueries {
  /**
   * 创建文档聚合查询模块实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @param docRepository 文档仓库
   * @param chunkRepository 块仓库
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    private readonly docRepository: DocRepository,
    private readonly chunkRepository: ChunkRepository,
  ) {}  /**
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
      return DocumentAggregateCore.mapEntitiesToAggregate(
        docEntity,
        chunkEntities,
      );
    } catch (error) {
      this.logger.error('查找文档聚合失败', {
        id,
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
      return DocumentAggregateCore.mapEntitiesToAggregate(
        docEntity,
        chunkEntities,
      );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
      const { page = 1, limit = 20, sort, order } = query;

      // 构建排序选项，添加表别名并映射API字段名到数据库字段名
      const orderBy: Record<string, 'ASC' | 'DESC'> | undefined = sort
        ? {
            [`doc.${sort === 'size' ? 'size_bytes' : sort}`]: (
              order || 'asc'
            ).toUpperCase() as 'ASC' | 'DESC',
          }
        : undefined;

      // 获取分页的文档实体
      const result =
        await this.docRepository.findByCollectionIdPaginatedWithSorting(
          collectionId,
          { page, limit },
          orderBy,
        );
      const entities = result.items ?? result.data;
      const total = result.pagination.total;

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of entities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
      const { page = 1, limit = 20, sort, order } = query;

      // 构建排序选项，添加表别名（字段映射已在服务层完成）
      const orderBy: Record<string, 'ASC' | 'DESC'> | undefined = sort
        ? { [`doc.${sort}`]: (order || 'asc').toUpperCase() as 'ASC' | 'DESC' }
        : undefined;

      // 获取分页的文档实体
      const result = await this.docRepository.findPaginated(
        page,
        limit,
        orderBy,
      );
      const entities = result.items ?? result.data;
      const total = result.pagination.total;

      // 为每个文档获取块
      const aggregates: DocumentAggregate[] = [];
      for (const docEntity of entities) {
        const chunkEntities = await this.chunkRepository.findByDocId(
          docEntity.id as DocId,
        );
        aggregates.push(
          DocumentAggregateCore.mapEntitiesToAggregate(
            docEntity,
            chunkEntities,
          ),
        );
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
   * 获取文档的块数量
   * @param id 文档ID
   * @returns 块数量
   */
  async getChunkCount(id: DocId): Promise<number> {
    try {
      return await this.chunkRepository.countByDocId(id);
    } catch (error) {
      this.logger.error('获取文档块数量失败', {
        id,
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
        id,
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
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
