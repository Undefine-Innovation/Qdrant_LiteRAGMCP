import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建全文搜索相关的表和索引
 * 支持PostgreSQL全文搜索功能
 */
export class CreateFullTextSearch1641234567890 implements MigrationInterface {
  name = 'CreateFullTextSearch1641234567890';

  /**
   * 执行迁移
   * @param queryRunner 查询运行器
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 检查数据库类型
    const databaseType = queryRunner.connection.options.type;

    if (databaseType === 'sqlite') {
      // SQLite兼容的表创建
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chunks_fulltext (
          id TEXT PRIMARY KEY,
          chunkId TEXT NOT NULL,
          docId TEXT NOT NULL,
          collectionId TEXT NOT NULL,
          chunkIndex INTEGER NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          searchVector TEXT NOT NULL,
          language TEXT DEFAULT 'english',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_chunk_id
        ON chunks_fulltext (chunkId)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_doc_id
        ON chunks_fulltext (docId)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_collection_id
        ON chunks_fulltext (collectionId)
      `);

      // SQLite不支持全文搜索索引，使用普通索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_search_vector
        ON chunks_fulltext (searchVector)
      `);

      // SQLite不支持触发器和全文搜索配置，跳过
    } else {
      // PostgreSQL原有的表创建
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chunks_fulltext (
          id SERIAL PRIMARY KEY,
          chunkId VARCHAR(255) NOT NULL,
          docId VARCHAR(255) NOT NULL,
          collectionId VARCHAR(255) NOT NULL,
          chunkIndex INTEGER NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          searchVector TSVECTOR NOT NULL,
          language VARCHAR(10) DEFAULT 'english',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_chunk_id
        ON chunks_fulltext (chunkId)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_doc_id
        ON chunks_fulltext (docId)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_collection_id
        ON chunks_fulltext (collectionId)
      `);

      // 创建PostgreSQL全文搜索索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_fulltext_search_vector
        ON chunks_fulltext USING GIN (searchVector)
      `);

      // 创建触发器，自动更新searchVector
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.searchVector :=
            setweight(to_tsvector(COALESCE(NEW.language, 'english'), COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector(COALESCE(NEW.language, 'english'), NEW.content), 'B');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await queryRunner.query(`
        DROP TRIGGER IF EXISTS trigger_update_search_vector ON chunks_fulltext
      `);

      await queryRunner.query(`
        CREATE TRIGGER trigger_update_search_vector
          BEFORE INSERT OR UPDATE ON chunks_fulltext
          FOR EACH ROW EXECUTE FUNCTION update_search_vector()
      `);

      // 创建全文搜索配置
      await queryRunner.query(`
        CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS chinese (COPY = simple)
      `);

      await queryRunner.query(`
        CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS enhanced_english (
          COPY = english,
          PARSER = default
        )
      `);
    }
  }

  /**
   * 回滚迁移
   * @param queryRunner 查询运行器
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除触发器
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_update_search_vector ON chunks_fulltext
    `);

    // 删除函数
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_search_vector()
    `);

    // 删除索引
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chunks_fulltext_search_vector
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chunks_fulltext_collection_id
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chunks_fulltext_doc_id
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chunks_fulltext_chunk_id
    `);

    // 删除表
    await queryRunner.query(`
      DROP TABLE IF EXISTS chunks_fulltext
    `);

    // 删除全文搜索配置
    await queryRunner.query(`
      DROP TEXT SEARCH CONFIGURATION IF EXISTS enhanced_english
    `);

    await queryRunner.query(`
      DROP TEXT SEARCH CONFIGURATION IF EXISTS chinese
    `);
  }
}
