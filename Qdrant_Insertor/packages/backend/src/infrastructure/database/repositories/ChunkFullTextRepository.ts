import { DataSource, FindOptionsWhere, In } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { ChunkFullText } from '../entities/ChunkFullText.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

/**
 * 块全文搜索Repository
 * 提供PostgreSQL全文搜索相关的数据库操作
 */
export class ChunkFullTextRepository extends BaseRepository<ChunkFullText> {
  /**
   * 创建ChunkFullTextRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, ChunkFullText, logger);
  }

  /**
   * 执行全文搜索
   * @param query 搜索查询
   * @param collectionId 可选的集合ID
   * @param limit 结果限制
   * @param language 搜索语言
   * @returns 搜索结果数组
   */
  async searchFullText(
    query: string,
    collectionId?: CollectionId,
    limit: number = 10,
    language: string = 'english',
  ): Promise<Array<ChunkFullText & { relevanceScore: number }>> {
    try {
      // 构建基础查询
      let queryBuilder = this.repository
        .createQueryBuilder('chunkFullText')
        .select([
          'chunkFullText.*',
          `ts_rank(chunkFullText.searchVector, plainto_tsquery('${language}', :query)) as relevanceScore`,
        ])
        .where(
          `chunkFullText.searchVector @@ plainto_tsquery('${language}', :query)`,
          { query },
        )
        .orderBy('relevanceScore', 'DESC')
        .limit(limit);

      // 如果指定了集合ID，添加过滤条件
      if (collectionId) {
        queryBuilder = queryBuilder.andWhere(
          'chunkFullText.collectionId = :collectionId',
          {
            collectionId: collectionId as unknown as string,
          },
        );
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`全文搜索完成`, {
        query,
        collectionId,
        language,
        resultCount: results.length,
        limit,
      });

      // 添加relevanceScore属性到结果中
      return results.map((result) => {
        const chunkFullText = result as ChunkFullText;
        return Object.assign(chunkFullText, {
          relevanceScore:
            (result as unknown as { relevanceScore?: number }).relevanceScore ||
            0,
        });
      });
    } catch (error) {
      this.logger.error(`全文搜索失败`, {
        query,
        collectionId,
        language,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 执行模糊全文搜索
   * @param query 搜索查询
   * @param collectionId 可选的集合ID
   * @param limit 结果限制
   * @param language 搜索语言
   * @returns 搜索结果数组
   */
  async searchFuzzyFullText(
    query: string,
    collectionId?: CollectionId,
    limit: number = 10,
    language: string = 'english',
  ): Promise<Array<ChunkFullText & { relevanceScore: number }>> {
    try {
      // 使用PostgreSQL的模糊搜索功能
      let queryBuilder = this.repository
        .createQueryBuilder('chunkFullText')
        .select([
          'chunkFullText.*',
          `word_similarity(chunkFullText.content, :query) as relevanceScore`,
        ])
        .where(`word_similarity(chunkFullText.content, :query) > 0.3`, {
          query,
        })
        .orderBy('relevanceScore', 'DESC')
        .limit(limit);

      // 如果指定了集合ID，添加过滤条件
      if (collectionId) {
        queryBuilder = queryBuilder.andWhere(
          'chunkFullText.collectionId = :collectionId',
          {
            collectionId: collectionId as unknown as string,
          },
        );
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`模糊全文搜索完成`, {
        query,
        collectionId,
        language,
        resultCount: results.length,
        limit,
      });

      // 添加relevanceScore属性到结果中
      return results.map((result) => {
        const chunkFullText = result as ChunkFullText;
        return Object.assign(chunkFullText, {
          relevanceScore:
            (result as unknown as { relevanceScore?: number }).relevanceScore ||
            0,
        });
      });
    } catch (error) {
      this.logger.error(`模糊全文搜索失败`, {
        query,
        collectionId,
        language,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量创建全文搜索索引
   * @param data 要索引的数据数组
   * @param language 搜索语言
   * @returns 创建的记录数组
   */
  async createIndexBatch(
    data: Array<{
      pointId: PointId;
      content: string;
      title?: string;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
    }>,
    language: string = 'english',
  ): Promise<ChunkFullText[]> {
    try {
      const entities = data.map((item) => {
        const entity = this.repository.create({
          chunkId: item.pointId as unknown as string,
          docId: item.docId as unknown as string,
          collectionId: item.collectionId as unknown as string,
          chunkIndex: item.chunkIndex,
          title: item.title,
          content: item.content,
          language,
          // 手动生成searchVector以避免NOT NULL约束失败
          searchVector: ChunkFullText.createSearchVector(
            item.title,
            item.content,
            language,
          ),
        });
        // 手动调用generateIds方法以确保ID生成
        if (typeof entity.generateIds === 'function') {
          entity.generateIds();
        }
        return entity;
      });

      const results = await this.repository.save(entities);

      this.logger.debug(`批量创建全文搜索索引成功`, {
        count: results.length,
        language,
      });

      return results;
    } catch (error) {
      this.logger.error(`批量创建全文搜索索引失败`, {
        count: data.length,
        language,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID删除全文搜索索引
   * @param docId 文档ID
   * @returns 删除的记录数量
   */
  async deleteByDocId(docId: DocId): Promise<number> {
    try {
      const result = await this.repository.delete({
        docId: docId as unknown as string,
      });
      const deletedCount = result.affected || 0;

      this.logger.debug(`根据文档ID删除全文搜索索引成功`, {
        docId,
        count: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`根据文档ID删除全文搜索索引失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID删除全文搜索索引
   * @param collectionId 集合ID
   * @returns 删除的记录数量
   */
  async deleteByCollectionId(collectionId: CollectionId): Promise<number> {
    try {
      const result = await this.repository.delete({
        collectionId: collectionId as unknown as string,
      });
      const deletedCount = result.affected || 0;

      this.logger.debug(`根据集合ID删除全文搜索索引成功`, {
        collectionId,
        count: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`根据集合ID删除全文搜索索引失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量删除全文搜索索引
   * @param pointIds 点ID数组
   * @returns 删除的记录数量
   */
  async deleteBatch(pointIds: PointId[]): Promise<number> {
    try {
      if (pointIds.length === 0) {
        return 0;
      }

      const result = await this.repository.delete({
        chunkId: In(pointIds.map((id) => id as unknown as string)),
      });
      const deletedCount = result.affected || 0;

      this.logger.debug(`批量删除全文搜索索引成功`, {
        count: pointIds.length,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`批量删除全文搜索索引失败`, {
        count: pointIds.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 重建全文搜索索引
   * @param language 搜索语言
   */
  async rebuildIndex(language: string = 'english'): Promise<void> {
    try {
      // 更新所有记录的searchVector字段
      await this.repository
        .createQueryBuilder()
        .update(ChunkFullText)
        .set({
          searchVector: () =>
            `to_tsvector('${language}', COALESCE(title, '') || ' ' || content)`,
        })
        .where('language = :language', { language })
        .execute();

      this.logger.info(`全文搜索索引重建完成`, { language });
    } catch (error) {
      this.logger.error(`全文搜索索引重建失败`, {
        language,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 优化全文搜索索引
   */
  async optimizeIndex(): Promise<void> {
    try {
      // 执行PostgreSQL的VACUUM和ANALYZE命令优化索引
      await this.dataSource.query('VACUUM ANALYZE chunks_fulltext');

      this.logger.info(`全文搜索索引优化完成`);
    } catch (error) {
      this.logger.error(`全文搜索索引优化失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取搜索统计信息
   * @returns 搜索统计信息对象
   */
  async getSearchStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    try {
      // 获取总文档数
      const totalDocuments = await this.repository
        .createQueryBuilder('chunkFullText')
        .select('COUNT(DISTINCT chunkFullText.docId)')
        .getRawOne()
        .then((result) => parseInt(Object.values(result)[0] as string));

      // 获取总块数
      const totalChunks = await this.repository.count();

      // 获取索引大小（近似值）
      const indexSizeResult = await this.dataSource.query(`
        SELECT pg_size_pretty(pg_total_relation_size('chunks_fulltext')) as size
      `);
      const indexSize = parseInt(
        indexSizeResult[0]?.size?.replace(/[^0-9]/g, '') || '0',
      );

      // 获取最后更新时间
      const lastUpdatedResult = await this.repository
        .createQueryBuilder('chunkFullText')
        .select('MAX(chunkFullText.updatedAt)', 'lastUpdated')
        .getRawOne();
      const lastUpdated = new Date(
        Object.values(lastUpdatedResult)[0] as string,
      );

      return {
        totalDocuments,
        totalChunks,
        indexSize,
        lastUpdated,
      };
    } catch (error) {
      this.logger.error(`获取搜索统计信息失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
