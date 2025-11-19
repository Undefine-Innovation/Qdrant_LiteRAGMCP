import { Logger } from '@logging/logger.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

export class SQLiteInitialization {
  constructor(
    private readonly query: (sql: string, params?: unknown[]) => Promise<unknown>,
    private readonly logger: Logger,
  ) {}

  async performDatabaseInitialization(): Promise<void> {
    try {
      await this.query('PRAGMA foreign_keys = ON');
      await this.query('PRAGMA journal_mode = WAL');
      await this.query('PRAGMA synchronous = NORMAL');
      await this.query('PRAGMA cache_size = -64000');
      await this.query('PRAGMA temp_store = MEMORY');

      await this.createIndexes();
      await this.createFTSTables();

      this.logger.info('SQLite特定初始化完成');
    } catch (error) {
      this.logger.error('SQLite初始化失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_chunks_doc_collection ON chunks(doc_id, collection_id)',
      'CREATE INDEX IF NOT EXISTS idx_docs_collection_deleted ON docs(collection_id, deleted)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_point_id ON chunks(point_id)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id)',
      'CREATE INDEX IF NOT EXISTS idx_docs_id ON docs(id)',
      'CREATE INDEX IF NOT EXISTS idx_collections_id ON collections(id)',
    ];

    for (const indexSql of indexes) {
      try {
        await this.query(indexSql);
        this.logger.debug(`创建SQLite索引成功`, {
          index: indexSql.split('idx_')[1]?.split(' ')[0],
        });
      } catch (error) {
        this.logger.warn(`创建SQLite索引失败`, {
          index: indexSql,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async createFTSTables(): Promise<void> {
    try {
      await this.query(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
          content, 
          title,
          content='chunks',
          content_rowid='rowid'
        )
      `);

      await this.query(`
        CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON chunks BEGIN
          INSERT INTO chunks_fts(rowid, content, title) VALUES (new.rowid, new.content, new.title);
        END
      `);

      await this.query(`
        CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON chunks BEGIN
          INSERT INTO chunks_fts(chunks_fts, rowid, content, title) VALUES('delete', old.rowid, old.content, old.title);
        END
      `);

      await this.query(`
        CREATE TRIGGER IF NOT EXISTS chunks_fts_update AFTER UPDATE ON chunks BEGIN
          INSERT INTO chunks_fts(chunks_fts, rowid, content, title) VALUES('delete', old.rowid, old.content, old.title);
          INSERT INTO chunks_fts(rowid, content, title) VALUES (new.rowid, new.content, new.title);
        END
      `);

      this.logger.debug(`创建SQLite全文搜索表成功`);
    } catch (error) {
      this.logger.error(`创建SQLite全文搜索表失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateFTSTable(
    chunks: Array<{ chunkIndex: number; content: string; title?: string }>,
  ): Promise<void> {
    try {
      for (const chunk of chunks) {
        await this.query(
          'INSERT INTO chunks_fts(rowid, content, title) VALUES (?, ?, ?)',
          [chunk.chunkIndex, chunk.content, chunk.title],
        );
      }
    } catch (error) {
      this.logger.error(`更新全文搜索表失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
