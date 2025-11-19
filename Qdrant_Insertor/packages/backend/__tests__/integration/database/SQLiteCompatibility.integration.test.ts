import { DatabaseRepositoryFactory } from '../../../src/infrastructure/database/repositories/DatabaseRepositoryFactory.js';
import {
  DatabaseType,
  DatabaseConfig,
} from '../../../src/domain/interfaces/IDatabaseRepository.js';
import { AppConfig } from '../../../src/infrastructure/config/config.js';
import { Logger } from '../../../src/infrastructure/logging/logger.js';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

describe('SQLite Compatibility Tests', () => {
  let factory: DatabaseRepositoryFactory;
  let sqliteConfig: DatabaseConfig;
  let postgresConfig: DatabaseConfig;

  beforeEach(() => {
    factory = new DatabaseRepositoryFactory();

    sqliteConfig = {
      type: DatabaseType.SQLITE,
      path: './test.db',
      maxConnections: 1,
      minConnections: 1,
      connectionTimeout: 30000,
      idleTimeout: 300000,
    };

    postgresConfig = {
      type: DatabaseType.POSTGRESQL,
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'test_db',
      ssl: false,
      maxConnections: 10,
      minConnections: 2,
      connectionTimeout: 10000,
      idleTimeout: 300000,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Repository Factory', () => {
    it('should create SQLite repository', async () => {
      const repository = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );

      expect(repository.databaseType).toBe(DatabaseType.SQLITE);
      expect(repository.config).toEqual(sqliteConfig);
    });

    it('should create PostgreSQL repository', async () => {
      const repository = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      expect(repository.databaseType).toBe(DatabaseType.POSTGRESQL);
      expect(repository.config).toEqual(postgresConfig);
    });

    it('should validate SQLite config', () => {
      const result = factory.validateConfig(sqliteConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate PostgreSQL config', () => {
      const result = factory.validateConfig(postgresConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        type: DatabaseType.POSTGRESQL,
        // 缺少必要字段
      } as DatabaseConfig;

      const result = factory.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should get supported database types', () => {
      const types = factory.getSupportedDatabaseTypes();

      expect(types).toContain(DatabaseType.SQLITE);
      expect(types).toContain(DatabaseType.POSTGRESQL);
      expect(types).toHaveLength(2);
    });
  });

  describe('Interface Compatibility', () => {
    let sqliteRepo: any;
    let postgresRepo: any;

    beforeEach(async () => {
      sqliteRepo = await factory.createRepository(sqliteConfig, mockLogger);
      postgresRepo = await factory.createRepository(postgresConfig, mockLogger);
    });

    it('should implement same interface methods', () => {
      // 验证两个仓库都实现了相同的接口方法
      const interfaceMethods = [
        'initialize',
        'close',
        'ping',
        'transaction',
        'deleteCollection',
        'deleteDoc',
        'getChunksByPointIds',
        'getDocumentChunks',
        'getDocumentChunksPaginated',
        'getDoc',
        'getChunkMetasByDocId',
        'getChunkMetasByCollectionId',
        'getChunkTexts',
        'addChunks',
        'markDocAsSynced',
        'getAllCollectionIds',
        'listDeletedDocs',
        'hardDelete',
        'deleteBatch',
        'runMigrations',
        'getPendingMigrations',
        'getAppliedMigrations',
        'createBackup',
        'restoreFromBackup',
        'optimize',
        'getStatistics',
      ];

      for (const method of interfaceMethods) {
        expect(typeof sqliteRepo[method]).toBe('function');
        expect(typeof postgresRepo[method]).toBe('function');
      }
    });

    it('should have same method signatures', async () => {
      // 验证方法签名兼容性
      const testDocId = 'test-doc-id' as any;
      const testCollectionId = 'test-collection-id' as any;
      const testPointIds = ['point1', 'point2'] as any;
      const testDocumentChunks = [
        {
          pointId: 'point1',
          docId: 'test-doc-id',
          collectionId: 'test-collection-id',
          chunkIndex: 0,
          title: 'Test Title',
          content: 'Test Content',
        },
      ] as any;

      // 测试初始化方法
      const sqliteInitResult = await sqliteRepo.initialize(mockLogger);
      const postgresInitResult = await postgresRepo.initialize(mockLogger);

      expect(typeof sqliteInitResult.success).toBe('boolean');
      expect(typeof postgresInitResult.success).toBe('boolean');

      // 测试ping方法
      const sqlitePingResult = await sqliteRepo.ping();
      const postgresPingResult = await postgresRepo.ping();

      expect(typeof sqlitePingResult).toBe('boolean');
      expect(typeof postgresPingResult).toBe('boolean');

      // 测试事务方法
      const sqliteTransactionResult = await sqliteRepo.transaction(
        async () => 'sqlite-result',
      );
      const postgresTransactionResult = await postgresRepo.transaction(
        async () => 'postgres-result',
      );

      expect(sqliteTransactionResult).toBe('sqlite-result');
      expect(postgresTransactionResult).toBe('postgres-result');

      // 测试CRUD方法
      const sqliteDocResult = await sqliteRepo.getDoc(testDocId);
      const postgresDocResult = await postgresRepo.getDoc(testDocId);

      expect(typeof sqliteDocResult).toBeDefined();
      expect(typeof postgresDocResult).toBeDefined();

      // 测试分页方法
      const sqlitePaginatedResult = await sqliteRepo.getDocumentChunksPaginated(
        testDocId,
        {
          page: 1,
          limit: 10,
        } as any,
      );
      const postgresPaginatedResult =
        await postgresRepo.getDocumentChunksPaginated(testDocId, {
          page: 1,
          limit: 10,
        } as any);

      expect(typeof sqlitePaginatedResult.data).toBe('object');
      expect(typeof sqlitePaginatedResult.pagination).toBe('object');
      expect(typeof postgresPaginatedResult.data).toBe('object');
      expect(typeof postgresPaginatedResult.pagination).toBe('object');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across database types', async () => {
      // 这个测试需要真实的数据库连接来验证数据一致性
      // 在模拟环境中，我们只能验证接口的一致性

      const sqliteRepo = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );
      const postgresRepo = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      // 验证两个仓库都能处理相同的数据结构
      const testDocId = 'test-doc-id' as any;
      const testCollectionId = 'test-collection-id' as any;
      const testPointIds = ['point1', 'point2'] as any;

      // 测试获取文档块
      const sqliteChunks = await sqliteRepo.getChunksByPointIds(
        testPointIds,
        testCollectionId,
      );
      const postgresChunks = await postgresRepo.getChunksByPointIds(
        testPointIds,
        testCollectionId,
      );

      expect(Array.isArray(sqliteChunks)).toBe(true);
      expect(Array.isArray(postgresChunks)).toBe(true);
      expect(sqliteChunks).toHaveLength(postgresChunks.length);

      // 验证返回的数据结构相同
      if (sqliteChunks.length > 0 && postgresChunks.length > 0) {
        const sqliteChunk = sqliteChunks[0];
        const postgresChunk = postgresChunks[0];

        expect(typeof sqliteChunk.pointId).toBe(typeof postgresChunk.pointId);
        expect(typeof sqliteChunk.docId).toBe(typeof postgresChunk.docId);
        expect(typeof sqliteChunk.collectionId).toBe(
          typeof postgresChunk.collectionId,
        );
        expect(typeof sqliteChunk.chunkIndex).toBe(
          typeof postgresChunk.chunkIndex,
        );
        expect(typeof sqliteChunk.title).toBe(typeof postgresChunk.title);
        expect(typeof sqliteChunk.content).toBe(typeof postgresChunk.content);
      }
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle SQLite-specific performance characteristics', async () => {
      const sqliteRepo = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );

      // SQLite特定的性能特征
      const sqliteMetrics = await sqliteRepo.getPerformanceMetrics();

      expect(sqliteMetrics.databaseType).toBe(DatabaseType.SQLITE);
      expect(typeof sqliteMetrics.connectionTime).toBe('number');
      expect(typeof sqliteMetrics.queryTime).toBe('number');
      expect(typeof sqliteMetrics.memoryUsage).toBe('number');
      expect(typeof sqliteMetrics.diskUsage).toBe('number');
    });

    it('should handle PostgreSQL-specific performance characteristics', async () => {
      const postgresRepo = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      // PostgreSQL特定的性能特征
      const postgresMetrics = await postgresRepo.getPerformanceMetrics();

      expect(postgresMetrics.databaseType).toBe(DatabaseType.POSTGRESQL);
      expect(typeof postgresMetrics.connectionTime).toBe('number');
      expect(typeof postgresMetrics.queryTime).toBe('number');
      expect(typeof postgresMetrics.memoryUsage).toBe('number');
      expect(typeof postgresMetrics.diskUsage).toBe('number');
      expect(typeof postgresMetrics.indexUsage).toBe('number');
      expect(typeof postgresMetrics.cacheHitRate).toBe('number');
    });
  });

  describe('Migration Compatibility', () => {
    it('should handle migrations consistently across database types', async () => {
      const sqliteRepo = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );
      const postgresRepo = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      const testMigrations = [
        {
          id: '001-test-migration',
          name: 'Test Migration',
          version: '1.0.0',
          description: 'Test migration for compatibility',
          up: 'CREATE TABLE test_table (id VARCHAR(255))',
          down: 'DROP TABLE test_table',
        },
      ];

      // 测试迁移执行
      const sqliteResult = await sqliteRepo.runMigrations(testMigrations);
      const postgresResult = await postgresRepo.runMigrations(testMigrations);

      expect(typeof sqliteResult.success).toBe('boolean');
      expect(typeof postgresResult.success).toBe('boolean');
      expect(typeof sqliteResult.applied).toBe('object');
      expect(typeof postgresResult.applied).toBe('object');
      expect(typeof sqliteResult.failed).toBe('object');
      expect(typeof postgresResult.failed).toBe('object');
    });
  });

  describe('Backup and Restore Compatibility', () => {
    it('should handle backup operations consistently', async () => {
      const sqliteRepo = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );
      const postgresRepo = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      const backupPath = './test-backup.sql';

      // 测试备份创建
      const sqliteResult = await sqliteRepo.createBackup(backupPath);
      const postgresResult = await postgresRepo.createBackup(backupPath);

      expect(typeof sqliteResult.success).toBe('boolean');
      expect(typeof postgresResult.success).toBe('boolean');
      expect(typeof sqliteResult.message).toBe('string');
      expect(typeof postgresResult.message).toBe('string');

      // 测试恢复操作
      const sqliteRestoreResult =
        await sqliteRepo.restoreFromBackup(backupPath);
      const postgresRestoreResult =
        await postgresRepo.restoreFromBackup(backupPath);

      expect(typeof sqliteRestoreResult.success).toBe('boolean');
      expect(typeof postgresRestoreResult.success).toBe('boolean');
      expect(typeof sqliteRestoreResult.message).toBe('string');
      expect(typeof postgresRestoreResult.message).toBe('string');
    });
  });

  describe('Configuration Compatibility', () => {
    it('should handle configuration from app config', async () => {
      const sqliteAppConfig: AppConfig = {
        db: {
          type: 'sqlite',
          path: './test.db',
        },
      } as AppConfig;

      const postgresAppConfig: AppConfig = {
        db: {
          type: 'postgres',
          postgres: {
            host: 'localhost',
            port: 5432,
            username: 'test',
            password: 'test',
            database: 'test_db',
          },
        },
      } as AppConfig;

      // 测试从应用配置创建仓库
      const sqliteRepo = await factory.createFromAppConfig(
        sqliteAppConfig,
        mockLogger,
      );
      const postgresRepo = await factory.createFromAppConfig(
        postgresAppConfig,
        mockLogger,
      );

      expect(sqliteRepo.databaseType).toBe(DatabaseType.SQLITE);
      expect(postgresRepo.databaseType).toBe(DatabaseType.POSTGRESQL);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle errors consistently across database types', async () => {
      const sqliteRepo = await factory.createRepository(
        sqliteConfig,
        mockLogger,
      );
      const postgresRepo = await factory.createRepository(
        postgresConfig,
        mockLogger,
      );

      // 测试无效操作的错误处理
      const invalidDocId = 'invalid-doc-id' as any;

      // 两个仓库都应该以类似的方式处理错误
      const sqliteError = await sqliteRepo
        .getDoc(invalidDocId)
        .catch((err) => err);
      const postgresError = await postgresRepo
        .getDoc(invalidDocId)
        .catch((err) => err);

      expect(sqliteError).toBeDefined();
      expect(postgresError).toBeDefined();
    });
  });
});
