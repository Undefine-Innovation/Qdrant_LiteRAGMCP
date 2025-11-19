import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DocRepository, ChunkRepository } from './index.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * PostgreSQL搜索操作管理器
 * 负责搜索相关操作
 */
export class PostgreSQLSearchOperations {
  private readonly docRepository: DocRepository;
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLSearchOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.docRepository = new DocRepository(dataSource, logger);
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 搜索文档
   * @param query 搜索查询参数
   * @param query.keyword 搜索关键词
   * @param query.collectionId 集合ID
   * @param query.limit 结果限制数量
   * @returns 搜索结果
   */
  async searchDocs(query: {
    keyword?: string;
    collectionId?: CollectionId;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    try {
      let docs = (await this.docRepository.findAll()) as Array<Record<string, unknown>>;

      // 应用过滤条件
      if (query.keyword) {
        const kw = query.keyword.toLowerCase();
        docs = docs.filter((doc) => {
          const name = String(doc['name'] ?? '');
          const content = String(doc['content'] ?? '');
          return name.toLowerCase().includes(kw) || content.toLowerCase().includes(kw);
        });
      }

      if (query.collectionId) {
        docs = docs.filter((doc) => String(doc['collectionId'] ?? '') === String(query.collectionId));
      }

      if (query.limit && query.limit > 0) {
        docs = docs.slice(0, query.limit);
      }

      return docs;
    } catch (error) {
      this.logger.error(`搜索文档失败`, {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 搜索文档块
   * @param query 搜索查询参数
   * @param query.keyword 搜索关键词
   * @param query.docId 文档ID
   * @param query.limit 结果限制数量
   * @returns 搜索结果
   */
  async searchChunks(query: {
    keyword?: string;
    docId?: DocId;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    try {
      let chunks = (await this.chunkRepository.findAll()) as Array<Record<string, unknown>>;

      // 应用过滤条件
      if (query.keyword) {
        const kw = query.keyword.toLowerCase();
        chunks = chunks.filter((chunk) => {
          const title = String(chunk['title'] ?? '');
          const content = String(chunk['content'] ?? '');
          return title.toLowerCase().includes(kw) || content.toLowerCase().includes(kw);
        });
      }

      if (query.docId) {
        chunks = chunks.filter((chunk) => String(chunk['docId'] ?? '') === String(query.docId));
      }

      if (query.limit && query.limit > 0) {
        chunks = chunks.slice(0, query.limit);
      }

      return chunks;
    } catch (error) {
      this.logger.error(`搜索文档块失败`, {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
