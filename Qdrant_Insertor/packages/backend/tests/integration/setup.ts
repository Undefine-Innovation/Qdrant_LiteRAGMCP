/**
 * 集成测试设置文件
 * 提供测试数据库初始化和清理功能
 */

import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { createTypeORMDataSource } from '@infrastructure/database/config.js';
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
 * 获取测试数据库配置（每次调用生成新的配置）
 */
function createTestConfig(): AppConfig {
  return {
    db: {
      type: 'sqlite',
      path: ':memory:', // 使用内存数据库避免文件锁定问题
    },
    qdrant: {
      host: 'localhost',
      port: 6333,
      apiKey: '',
    },
    embedding: {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'text-embedding-ada-002',
      dimensions: 1536,
    },
    logging: {
      level: 'error', // 测试时只记录错误
    },
    log: {
      enableTraceId: false, // 测试环境中禁用追踪ID
      enablePerformanceLogging: false, // 测试环境中禁用性能日志
    },
    api: {
      port: 0, // 随机端口
      cors: {
        enabled: true,
        origins: ['*'],
      },
    },
  } as AppConfig;
}/**
 * 测试日志记录器
 */
const testLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * 测试数据源实例
 */
let testDataSource: DataSource | null = null;

/**
 * 初始化测试数据库
 * @returns Promise<DataSource> 初始化的数据源
 */
export async function initializeTestDatabase(): Promise<DataSource> {
  // 如果已有连接，先关闭
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
    testDataSource = null;
  }

  // 创建测试数据源，使用内存数据库并禁用同步
  const { DataSource } = await import('typeorm');
  testDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:', // 每次都是全新的内存数据库
    synchronize: false,   // 完全禁用自动同步
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

  // 初始化数据源
  await testDataSource.initialize();

  const baseQueryFn = testDataSource.query.bind(testDataSource);
  Object.defineProperty(baseQueryFn, '__TEST_BASE_QUERY__', {
    value: true,
    configurable: false,
    writable: false,
  });
  let overrideQueryFn:
    | ((
        query: string,
        parameters?: unknown[],
        next?: (
          query: string,
          parameters?: unknown[],
          useStructuredResult?: boolean,
        ) => Promise<unknown>,
      ) => Promise<unknown>)
    | null = null;

  Object.defineProperty(testDataSource, 'query', {
    configurable: true,
    get() {
      return overrideQueryFn ?? baseQueryFn;
    },
    set(value: typeof baseQueryFn | null) {
      const isBaseQuery =
        value === baseQueryFn ||
        Boolean((value as Record<string, unknown> | null)?.__TEST_BASE_QUERY__);
      if (isBaseQuery || value == null) {
        overrideQueryFn = null;
        return;
      }

      overrideQueryFn = value;
    },
  });

  const originalCreateQueryRunner = testDataSource.createQueryRunner.bind(
    testDataSource,
  );
  testDataSource.createQueryRunner = (...args) => {
    const queryRunner = originalCreateQueryRunner(...args);
    const originalQueryRunnerQuery = queryRunner.query.bind(queryRunner);

    queryRunner.query = async (
      query: string,
      parameters?: unknown[],
      useStructuredResult?: boolean,
    ): Promise<unknown> => {
      if (overrideQueryFn) {
        return await overrideQueryFn(
          query,
          parameters,
          (nextQuery, nextParams, nextStructuredResult) =>
            originalQueryRunnerQuery(
              nextQuery,
              nextParams,
              nextStructuredResult ?? useStructuredResult,
            ),
        );
      }

      return await originalQueryRunnerQuery(
        query,
        parameters,
        useStructuredResult,
      );
    };

    return queryRunner;
  };


  // 在测试环境暴露全局数据源，供应用初始化逻辑复用，避免重复建表/建索引
  ;(globalThis as any).__TEST_DATASOURCE = testDataSource;

  // 禁用外键约束检查（对于测试环境）
  if (testDataSource.options.type === 'sqlite') {
    await testDataSource.query('PRAGMA foreign_keys = OFF');
  }

  // 手动创建表结构，完全跳过索引创建
  const queryRunner = testDataSource.createQueryRunner();
  
  try {
    await queryRunner.connect();
    
    // 先清理所有表以避免结构冲突
    const dropTables = [
      'DROP TABLE IF EXISTS collections',
      'DROP TABLE IF EXISTS docs', 
      'DROP TABLE IF EXISTS chunks',
      'DROP TABLE IF EXISTS chunk_meta',
      'DROP TABLE IF EXISTS chunks_fulltext',
      'DROP TABLE IF EXISTS system_metrics',
      'DROP TABLE IF EXISTS alert_rules',
      'DROP TABLE IF EXISTS alert_history',
      'DROP TABLE IF EXISTS system_health',
      'DROP TABLE IF EXISTS scrape_results',
      'DROP TABLE IF EXISTS events'
    ];

    for (const dropSql of dropTables) {
      await queryRunner.query(dropSql);
    }

    // 手动创建基础表结构，不创建索引
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS chunks_fulltext (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        chunkId VARCHAR NOT NULL,
        content TEXT NOT NULL,
        contentLength INTEGER NOT NULL,
        tokenCount INTEGER,
        rank REAL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS system_metrics (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        metricType VARCHAR(50) NOT NULL,
        value REAL NOT NULL,
        unit VARCHAR(20),
        tags TEXT,
        timestamp BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS alert_rules (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        metricType VARCHAR(50) NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        severity VARCHAR(20) DEFAULT 'warning',
        isEnabled BOOLEAN DEFAULT TRUE,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS alert_history (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        ruleId VARCHAR NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        value REAL,
        isResolved BOOLEAN DEFAULT FALSE,
        resolvedAt BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
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
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS events (
        id VARCHAR PRIMARY KEY,
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at BIGINT,
        version INTEGER DEFAULT 1 NOT NULL,
        eventType VARCHAR(50) NOT NULL,
        aggregateType VARCHAR(50) NOT NULL,
        aggregateId VARCHAR NOT NULL,
        eventData TEXT NOT NULL,
        eventMetadata TEXT,
        eventVersion INTEGER NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`
    ];

    // 依次执行表创建语句
    for (const createTableSql of tables) {
      await queryRunner.query(createTableSql);
    }
  } finally {
    await queryRunner.release();
  }
  
  // 验证表是否创建成功
  const tables = await testDataSource.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Created tables:', tables.map((t: any) => t.name));

  return testDataSource;
}

/**
 * 清理测试数据库
 * @returns Promise<void>
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (testDataSource) {
    try {
      if (testDataSource.isInitialized) {
        // 强制执行 SQLite 检查点以确保WAL文件被清空
        const queryRunner = testDataSource.createQueryRunner();
        try {
          await queryRunner.connect();
          await queryRunner.query('PRAGMA wal_checkpoint(TRUNCATE)');
          await queryRunner.query('PRAGMA optimize');
        } catch (pragmaError) {
          // WAL命令可能在内存数据库中失败，忽略
        } finally {
          await queryRunner.release();
        }

        // 等待任何挂起的事务完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 关闭所有活动连接
        await testDataSource.destroy();
        
        // 再次等待确保连接完全关闭
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error destroying test datasource:', error);
      // 强制清理，即使有错误
      try {
        if (testDataSource && testDataSource.manager) {
          (testDataSource as any).manager = null;
        }
      } catch (forceError) {
        // 忽略强制清理错误
      }
    } finally {
      testDataSource = null;
      // 强制垃圾收集（如果可用）
      if (global.gc) {
        global.gc();
      }
    }
  }
}

/**
 * 重置测试数据库（清空所有表数据但保留表结构）
 * @returns Promise<void>
 */
export async function resetTestDatabase(): Promise<void> {
  // 首先检查全局测试数据源
  let dataSource = (globalThis as any).__TEST_DATASOURCE;
  
  // 如果没有全局数据源，使用本地的
  if (!dataSource) {
    dataSource = testDataSource;
  }
  
  if (!dataSource || !dataSource.isInitialized) {
    // 如果数据源不可用，跳过重置
    console.warn('Test database not available for reset');
    return;
  }

  // 获取所有实体
  const entities = [
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
  ];

  try {
    // 清理所有表数据 - 使用TRUNCATE而不是clear()
    const tableNames = [
      'events', 'scrape_results', 'system_health', 'alert_history', 
      'alert_rules', 'system_metrics', 'chunks_fulltext',
      'chunk_meta', 'chunks', 'docs', 'collections'
    ];
    
    for (const tableName of tableNames) {
      try {
        await dataSource.query(`DELETE FROM ${tableName}`);
      } catch (error) {
        // 表可能不存在，忽略错误
      }
    }
  } catch (error) {
    console.error('Error resetting test database:', error);
    // 继续运行测试，即使重置失败
  }
}

/**
 * 获取测试数据源
 * @returns DataSource 测试数据源实例
 */
export function getTestDataSource(): DataSource {
  // 首先检查全局测试数据源
  let dataSource = (globalThis as any).__TEST_DATASOURCE;
  
  // 如果没有全局数据源，使用本地的
  if (!dataSource) {
    dataSource = testDataSource;
  }
  
  if (!dataSource || !dataSource.isInitialized) {
    throw new Error(
      'Test database not initialized. Call initializeTestDatabase() first.',
    );
  }
  return dataSource;
}

/**
 * 获取测试配置
 * @returns AppConfig 测试配置
 */
export function getTestConfig(): AppConfig {
  return createTestConfig();
}

/**
 * 获取测试日志记录器
 * @returns Logger 测试日志记录器
 */
export function getTestLogger(): Logger {
  return testLogger;
}

// Provide global access for legacy tests that reference getTestLogger() without importing.
// This avoids ReferenceError in ESM test environment where implicit globals aren't created.
(globalThis as any).getTestLogger = getTestLogger;

// Ensure jest global is available for tests that call jest.mock without importing in ESM.
// In ESM mode, jest isn't automatically on global, so expose it explicitly.
import { jest as jestGlobal } from '@jest/globals';
(globalThis as any).jest = jestGlobal;

/**
 * 创建测试事务
 * @param fn 在事务中执行的函数
 * @returns Promise<T> 函数执行结果
 */
export async function withTestTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!testDataSource || !testDataSource.isInitialized) {
    throw new Error('Test database not initialized');
  }

  return await testDataSource.transaction(async (manager) => {
    return await fn();
  });
}

/**
 * 创建测试数据
 * @param dataFactory 数据工厂函数
 * @returns Promise<T> 创建的测试数据
 */
export async function createTestData<T>(
  dataFactory: () => Promise<T>,
): Promise<T> {
  return await withTestTransaction(dataFactory);
}

/**
 * 验证数据库状态
 * @param validator 验证函数
 * @returns Promise<boolean> 验证结果
 */
export async function validateDatabaseState(
  validator: () => Promise<boolean>,
): Promise<boolean> {
  return await validator();
}

/**
 * 测试工具函数
 */
export const TestUtils = {
  /**
   * 等待指定时间
   * @param ms 等待毫秒数
   */
  wait: (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * 生成随机字符串
   * @param length 字符串长度
   */
  randomString: (length: number = 10): string => {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  },

  /**
   * 生成随机数字
   * @param min 最小值
   * @param max 最大值
   */
  randomNumber: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * 生成随机日期
   * @param daysAgo 多少天前
   */
  randomDate: (daysAgo: number = 30): Date => {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * daysAgo);
    return date;
  },
};

/**
 * Jest测试环境设置和清理
 */
beforeAll(async () => {
  try {
    await initializeTestDatabase();
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}, 30000); // 30秒超时

afterAll(async () => {
  try {
    // 确保清理所有连接和资源
    await cleanupTestDatabase();
    
    // 清理全局测试数据源引用
    if ((globalThis as any).__TEST_DATASOURCE) {
      delete (globalThis as any).__TEST_DATASOURCE;
    }
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // 不重新抛出错误，避免Jest挂起
  }
}, 10000); // 10秒超时

beforeEach(async () => {
  try {
    // 只需要清理数据，表结构保持不变
    if (testDataSource && testDataSource.isInitialized) {
      const entities = [
        'events', 'scrape_results', 'system_health', 'alert_history', 
        'alert_rules', 'system_metrics', 'chunks_fulltext',
        'chunk_meta', 'chunks', 'docs', 'collections'
      ];
      
      // 清理数据但保留表结构
      for (const table of entities) {
        try {
          await testDataSource.query(`DELETE FROM ${table}`);
        } catch (error) {
          // 忽略表不存在的错误
        }
      }
    } else {
      // 如果数据源未初始化，重新初始化
      await initializeTestDatabase();
    }
  } catch (error) {
    console.error('Failed to reset test database:', error);
    throw error;
  }
}, 10000); // 10秒超时
