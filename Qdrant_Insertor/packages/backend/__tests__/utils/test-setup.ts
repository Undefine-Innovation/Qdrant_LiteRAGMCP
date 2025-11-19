/**
 * 简化的测试设置和清理逻辑
 * 提供统一的测试环境管理，减少重复代码
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@infrastructure/config/config.js';
import {
  Collection,
  Doc,
  Chunk,
  ChunkMeta,
  ChunkFullText,
  SystemMetrics,
  AlertRules,
  AlertHistory,
  SystemHealth,
  ScrapeResults,
  Event,
} from '@infrastructure/database/entities/index.js';

/**
 * 测试环境配置
 */
interface TestEnvironmentConfig {
  useInMemoryDatabase?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  enablePerformanceLogging?: boolean;
  enableTraceId?: boolean;
  autoCleanup?: boolean;
}

/**
 * 测试环境管理器
 */
export class TestEnvironmentManager {
  private static instance: TestEnvironmentManager;
  private dataSource: DataSource | null = null;
  private config: TestEnvironmentConfig;
  private isInitialized = false;

  private constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      useInMemoryDatabase: true,
      logLevel: 'error',
      enablePerformanceLogging: false,
      enableTraceId: false,
      autoCleanup: true,
      ...config,
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: TestEnvironmentConfig): TestEnvironmentManager {
    if (!TestEnvironmentManager.instance) {
      TestEnvironmentManager.instance = new TestEnvironmentManager(config);
    }
    return TestEnvironmentManager.instance;
  }

  /**
   * 初始化测试环境
   */
  async initialize(): Promise<DataSource> {
    if (this.isInitialized) {
      return this.dataSource!;
    }

    try {
      this.dataSource = await this.createTestDataSource();
      await this.setupDatabase();
      this.isInitialized = true;
      return this.dataSource;
    } catch (error) {
      console.error('Failed to initialize test environment:', error);
      throw error;
    }
  }

  /**
   * 清理测试环境
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized || !this.dataSource) {
      return;
    }

    try {
      if (this.config.autoCleanup) {
        await this.resetDatabase();
      }

      await this.dataSource.destroy();
      this.dataSource = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to cleanup test environment:', error);
      throw error;
    }
  }

  /**
   * 重置数据库数据
   */
  async resetDatabase(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return;
    }

    try {
      const tableNames = [
        'events',
        'scrape_results',
        'system_health',
        'alert_history',
        'alert_rules',
        'system_metrics',
        'chunks_fulltext',
        'chunk_meta',
        'chunks',
        'docs',
        'collections',
      ];

      for (const tableName of tableNames) {
        try {
          await this.dataSource.query(`DELETE FROM ${tableName}`);
        } catch (error) {
          // 表可能不存在，忽略错误
        }
      }
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * 获取数据源
   */
  getDataSource(): DataSource {
    if (!this.dataSource || !this.isInitialized) {
      throw new Error(
        'Test environment not initialized. Call initialize() first.',
      );
    }
    return this.dataSource;
  }

  /**
   * 获取测试配置
   */
  getTestConfig(): AppConfig {
    return {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        model: 'text-embedding-ada-002',
      },
      db: {
        type: 'sqlite',
        path: ':memory:',
      },
      qdrant: {
        url: 'http://localhost:6333',
        collection: 'test-collection',
        vectorSize: 1536,
      },
      embedding: {
        batchSize: 200,
      },
      api: {
        port: 0,
      },
      log: {
        level: this.config.logLevel,
        enableTraceId: this.config.enableTraceId,
        enablePerformanceLogging: this.config.enablePerformanceLogging,
      },
      gc: {
        intervalHours: 24,
      },
    };
  }

  /**
   * 获取测试日志记录器
   */
  getTestLogger(): Logger {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
  }

  /**
   * 创建测试数据源
   */
  private async createTestDataSource(): Promise<DataSource> {
    const { DataSource } = await import('typeorm');

    return new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      dropSchema: false,
      logging: false,
      entities: [
        Collection,
        Doc,
        Chunk,
        ChunkMeta,
        ChunkFullText,
        SystemMetrics,
        AlertRules,
        AlertHistory,
        SystemHealth,
        ScrapeResults,
        Event,
      ],
    });
  }

  /**
   * 设置数据库结构
   */
  private async setupDatabase(): Promise<void> {
    if (!this.dataSource) {
      throw new Error('DataSource not initialized');
    }

    await this.dataSource.initialize();

    // 启用外键约束
    if (this.dataSource.options.type === 'sqlite') {
      await this.dataSource.query('PRAGMA foreign_keys = ON');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // 创建表结构
      await this.createTables(queryRunner);
      await this.createIndexes(queryRunner);
      await this.createForeignKeys(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 创建表结构
   */
  private async createTables(queryRunner: any): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS collections (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        collectionId VARCHAR UNIQUE NOT NULL,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active' NOT NULL,
        config TEXT,
        documentCount INTEGER DEFAULT 0,
        chunkCount INTEGER DEFAULT 0,
        lastSyncAt BIGINT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS docs (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        docId VARCHAR UNIQUE,
        collectionId VARCHAR NOT NULL,
        key VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        title VARCHAR(500),
        content TEXT NOT NULL,
        size_bytes INTEGER,
        mime VARCHAR(255),
        content_hash VARCHAR(64),
        status VARCHAR(20),
        contentLength INTEGER DEFAULT 0,
        tokenCount INTEGER,
        chunkCount INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        processingStatus VARCHAR(20) DEFAULT 'pending',
        processedAt BIGINT,
        processing_started_at BIGINT,
        processing_completed_at BIGINT,
        processing_duration_ms INTEGER,
        processing_error TEXT,
        error TEXT,
        metadata TEXT,
        last_sync_at BIGINT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS chunks (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        pointId VARCHAR UNIQUE NOT NULL,
        docId VARCHAR NOT NULL,
        collectionId VARCHAR NOT NULL,
        chunkIndex INTEGER NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        contentLength INTEGER NOT NULL,
        tokenCount INTEGER,
        embeddingStatus VARCHAR(20) DEFAULT 'pending',
        embeddedAt BIGINT,
        syncStatus VARCHAR(20) DEFAULT 'pending',
        syncedAt BIGINT,
        error TEXT,
        metadata TEXT,
        chunkMetaId VARCHAR,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS chunk_meta (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        pointId VARCHAR(255) UNIQUE NOT NULL,
        docId VARCHAR NOT NULL,
        collectionId VARCHAR NOT NULL,
        chunkIndex INTEGER NOT NULL,
        startOffset INTEGER,
        endOffset INTEGER,
        contentLength INTEGER,
        tokenCount INTEGER,
        charCount INTEGER,
        embeddingStatus VARCHAR(20) DEFAULT 'pending',
        embeddedAt BIGINT,
        retryCount INTEGER DEFAULT 0,
        lastRetryAt BIGINT,
        headingLevel INTEGER,
        headingText TEXT,
        titleChain TEXT,
        contentHash VARCHAR(64),
        syncedAt BIGINT,
        error TEXT,
        tags TEXT,
        metadata TEXT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS chunks_fulltext (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        chunkId VARCHAR NOT NULL,
        docId VARCHAR NOT NULL,
        collectionId VARCHAR NOT NULL,
        chunkIndex INTEGER NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        searchVector TEXT,
        language VARCHAR(20) DEFAULT 'english',
        contentLength INTEGER NOT NULL,
        tokenCount INTEGER,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS system_metrics (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        metric_name VARCHAR(255) NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit VARCHAR(50),
        metric_type VARCHAR(20) DEFAULT 'gauge' NOT NULL,
        tags TEXT,
        timestamp BIGINT NOT NULL,
        source VARCHAR(100),
        description TEXT,
        sample_rate REAL,
        quantile VARCHAR(10),
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS alert_rules (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        metric_name VARCHAR(255) NOT NULL,
        condition_operator VARCHAR(10) NOT NULL,
        threshold_value REAL NOT NULL,
        severity VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        cooldown_minutes INTEGER DEFAULT 5 NOT NULL,
        notification_channels TEXT,
        rule_type VARCHAR(20) DEFAULT 'threshold' NOT NULL,
        evaluation_interval_seconds INTEGER DEFAULT 60 NOT NULL,
        duration_seconds INTEGER DEFAULT 300 NOT NULL,
        last_evaluated_at BIGINT,
        last_triggered_at BIGINT,
        rule_expression TEXT,
        rule_parameters TEXT,
        tags TEXT,
        created_by VARCHAR(100),
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS alert_history (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        rule_id VARCHAR NOT NULL,
        metric_value REAL NOT NULL,
        threshold_value REAL NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        message TEXT,
        triggered_at BIGINT NOT NULL,
        resolved_at BIGINT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS system_health (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        component VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        last_check BIGINT NOT NULL,
        response_time_ms INTEGER,
        error_message TEXT,
        details TEXT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS scrape_results (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        title VARCHAR(500),
        content TEXT,
        contentLength INTEGER,
        metadata TEXT,
        scrapedAt BIGINT,
        error TEXT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS events (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        eventId VARCHAR(36) UNIQUE NOT NULL,
        eventType VARCHAR(100) NOT NULL,
        aggregateId VARCHAR(255) NOT NULL,
        aggregateType VARCHAR(100) NOT NULL,
        occurredOn BIGINT NOT NULL,
        metadata TEXT,
        eventData TEXT NOT NULL,
        processedAt BIGINT,
        processingStatus VARCHAR(20) DEFAULT 'pending' NOT NULL,
        processingError TEXT,
        retryCount INTEGER DEFAULT 0 NOT NULL,
        source VARCHAR(100),
        priority INTEGER DEFAULT 5 NOT NULL,
        tags TEXT,
        created_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at BIGINT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
    ];

    for (const createTableSql of tables) {
      await queryRunner.query(createTableSql);
    }
  }

  /**
   * 创建索引
   */
  private async createIndexes(queryRunner: any): Promise<void> {
    const indexes = [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_collectionId ON collections(collectionId)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_name ON collections(name)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_docId ON docs(docId)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_collection_key ON docs(collectionId, key)',
      'CREATE INDEX IF NOT EXISTS idx_docs_collection_status ON docs(collectionId, status)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_pointId ON chunks(pointId)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_doc_collection ON chunks(docId, collectionId)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_chunk_meta_pointId ON chunk_meta(pointId)',
      'CREATE INDEX IF NOT EXISTS idx_events_type ON events(eventType)',
      'CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregateType, aggregateId)',
    ];

    for (const indexSql of indexes) {
      try {
        await queryRunner.query(indexSql);
      } catch (error) {
        // 索引可能已存在，忽略错误
        console.warn('Index creation warning:', error);
      }
    }
  }

  /**
   * 创建外键约束
   */
  private async createForeignKeys(queryRunner: any): Promise<void> {
    const foreignKeys = [
      'ALTER TABLE docs ADD CONSTRAINT fk_docs_collection FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE',
      'ALTER TABLE chunks ADD CONSTRAINT fk_chunks_doc FOREIGN KEY (docId) REFERENCES docs(id) ON DELETE CASCADE',
      'ALTER TABLE chunks ADD CONSTRAINT fk_chunks_collection FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE',
      'ALTER TABLE chunk_meta ADD CONSTRAINT fk_chunk_meta_doc FOREIGN KEY (docId) REFERENCES docs(id) ON DELETE CASCADE',
      'ALTER TABLE chunk_meta ADD CONSTRAINT fk_chunk_meta_collection FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE',
      'ALTER TABLE chunks_fulltext ADD CONSTRAINT fk_chunks_fulltext_chunk FOREIGN KEY (chunkId) REFERENCES chunks(id) ON DELETE CASCADE',
      'ALTER TABLE chunks_fulltext ADD CONSTRAINT fk_chunks_fulltext_doc FOREIGN KEY (docId) REFERENCES docs(id) ON DELETE CASCADE',
      'ALTER TABLE chunks_fulltext ADD CONSTRAINT fk_chunks_fulltext_collection FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE',
    ];

    for (const fkSql of foreignKeys) {
      try {
        await queryRunner.query(fkSql);
      } catch (error) {
        // 外键可能已存在，忽略错误
        console.warn('Foreign key creation warning:', error);
      }
    }
  }
}

/**
 * 测试工具函数
 */
export class TestHelpers {
  /**
   * 等待指定时间
   */
  static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 在事务中执行函数
   */
  static async withTransaction<T>(
    dataSource: DataSource,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await dataSource.transaction(async (manager) => {
      return await fn();
    });
  }

  /**
   * 创建测试数据
   */
  static async createTestData<T>(
    dataSource: DataSource,
    dataFactory: () => Promise<T>,
  ): Promise<T> {
    return await this.withTransaction(dataSource, dataFactory);
  }

  /**
   * 验证数据库状态
   */
  static async validateDatabaseState(
    dataSource: DataSource,
    validator: () => Promise<boolean>,
  ): Promise<boolean> {
    return await validator();
  }
}

/**
 * 全局测试设置函数
 */
export function setupGlobalTestEnvironment(
  config?: TestEnvironmentConfig,
): void {
  const envManager = TestEnvironmentManager.getInstance(config);

  beforeAll(async () => {
    await envManager.initialize();
  }, 30000);

  afterAll(async () => {
    await envManager.cleanup();
  }, 10000);

  beforeEach(async () => {
    await envManager.resetDatabase();
  }, 10000);
}

/**
 * 获取全局测试环境管理器
 */
export function getTestEnvironmentManager(): TestEnvironmentManager {
  return TestEnvironmentManager.getInstance();
}
