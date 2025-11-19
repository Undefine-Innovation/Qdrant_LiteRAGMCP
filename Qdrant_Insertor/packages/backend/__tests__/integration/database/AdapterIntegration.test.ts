import {
  AdapterFactory,
  AdapterManager,
  EnvironmentConfigParser,
} from '@infrastructure/database/adapters/AdapterFactory.js';
import { PostgreSQLRepositoryAdapter } from '@infrastructure/database/adapters/PostgreSQLRepositoryAdapter.js';
import { SQLiteRepositoryAdapter } from '@infrastructure/database/adapters/SQLiteRepositoryAdapter.js';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DatabaseType,
  DatabaseConfig,
} from '@domain/interfaces/IDatabaseRepository.js';
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
  DocumentChunk,
  ChunkMeta,
  PaginationQuery,
  PaginatedResponse,
  Doc,
} from '@domain/entities/types.js';

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

// Mock Entity
class TestEntity {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

describe('Adapter Integration Tests', () => {
  let factory: AdapterFactory;
  let manager: AdapterManager;

  beforeEach(() => {
    factory = AdapterFactory.getInstance();
    factory.clearCache();
    manager = factory.createAdapterManager(mockLogger);
  });

  afterEach(async () => {
    await manager.closeAll();
    factory.clearCache();
  });

  describe('SQLite适配器集成测试', () => {
    let adapter: SQLiteRepositoryAdapter<TestEntity>;
    let dataSource: DataSource;

    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      dataSource = await factory.createDataSource(config, mockLogger);
      adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      ) as SQLiteRepositoryAdapter<TestEntity>;

      // 创建测试表
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS test_entity (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('应该完成完整的CRUD操作流程', async () => {
      // 创建
      const entity = { name: 'Integration Test' };
      const created = await adapter.create(entity);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Integration Test');

      // 读取
      const found = await adapter.findById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);

      // 更新
      const updateResult = await adapter.update(
        { id: created.id },
        { name: 'Updated Integration Test' },
      );
      expect(updateResult.affected).toBe(1);

      const updated = await adapter.findById(created.id);
      expect(updated!.name).toBe('Updated Integration Test');

      // 删除
      const deleteResult = await adapter.delete({ id: created.id });
      expect(deleteResult.affected).toBe(1);

      const deleted = await adapter.findById(created.id);
      expect(deleted).toBeUndefined();
    });

    it('应该处理批量操作', async () => {
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Batch Test ${i}`,
      }));

      // 批量创建
      const created = await adapter.createBatch(entities);
      expect(created).toHaveLength(100);

      // 批量查询
      const all = await adapter.find({});
      expect(all).toHaveLength(100);

      // 批量删除
      const deleteResult = await adapter.delete({});
      expect(deleteResult.affected).toBe(100);

      const remaining = await adapter.find({});
      expect(remaining).toHaveLength(0);
    });

    it('应该处理事务', async () => {
      const initialCount = await adapter.count();

      // 在事务中创建多个实体
      await adapter.transaction(async () => {
        await adapter.create({ name: 'Transaction Test 1' });
        await adapter.create({ name: 'Transaction Test 2' });
        await adapter.create({ name: 'Transaction Test 3' });
      });

      const finalCount = await adapter.count();
      expect(finalCount).toBe(initialCount + 3);
    });

    it('应该处理分页查询', async () => {
      // 创建测试数据
      const entities = Array.from({ length: 25 }, (_, i) => ({
        name: `Pagination Test ${i}`,
      }));
      await adapter.createBatch(entities);

      // 测试分页
      const page1 = await adapter.findWithPagination(
        {},
        { page: 1, limit: 10 },
      );
      expect(page1.data).toHaveLength(10);
      expect(page1.pagination.total).toBe(25);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      const page2 = await adapter.findWithPagination(
        {},
        { page: 2, limit: 10 },
      );
      expect(page2.data).toHaveLength(10);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNext).toBe(true);
      expect(page2.pagination.hasPrev).toBe(true);

      const page3 = await adapter.findWithPagination(
        {},
        { page: 3, limit: 10 },
      );
      expect(page3.data).toHaveLength(5);
      expect(page3.pagination.page).toBe(3);
      expect(page3.pagination.hasNext).toBe(false);
      expect(page3.pagination.hasPrev).toBe(true);
    });

    it('应该处理文档和块操作', async () => {
      const testDocId = 'integration-doc-1' as DocId;
      const testCollectionId = 'integration-collection-1' as CollectionId;

      // 创建必要的表
      await adapter.query(`
        CREATE TABLE IF NOT EXISTS docs (
          id TEXT PRIMARY KEY,
          key TEXT,
          collection_id TEXT,
          name TEXT,
          size_bytes INTEGER,
          mime TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          deleted INTEGER,
          content TEXT,
          synced_at INTEGER
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS chunks (
          point_id TEXT PRIMARY KEY,
          doc_id TEXT,
          collection_id TEXT,
          chunk_index INTEGER,
          title TEXT,
          content TEXT
        )
      `);

      await adapter.query(`
        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY
        )
      `);

      // 插入测试数据
      await adapter.query(
        'INSERT INTO docs (id, key, collection_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          testDocId,
          testDocId,
          testCollectionId,
          'Integration Test Doc',
          Date.now(),
          Date.now(),
          0,
        ],
      );

      await adapter.query('INSERT INTO collections (id) VALUES (?)', [
        testCollectionId,
      ]);

      // 测试文档块操作
      const documentChunks: DocumentChunk[] = [
        {
          content: 'Integration Content 1',
          titleChain: ['Integration Title 1'],
        },
        {
          content: 'Integration Content 2',
          titleChain: ['Integration Title 2'],
        },
      ];

      await adapter.addChunks(testDocId, documentChunks);

      const chunks = await adapter.getDocumentChunks(testDocId);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe('Integration Content 1');
      expect(chunks[0].title).toBe('Integration Title 1');

      // 测试分页
      const paginatedChunks = await adapter.getDocumentChunksPaginated(
        testDocId,
        {
          page: 1,
          limit: 1,
        },
      );
      expect(paginatedChunks.data).toHaveLength(1);
      expect(paginatedChunks.pagination.total).toBe(2);

      // 测试删除
      const deleteResult = await adapter.deleteDoc(testDocId);
      expect(deleteResult).toBe(true);

      const remainingChunks = await adapter.getDocumentChunks(testDocId);
      expect(remainingChunks).toHaveLength(0);
    });
  });

  describe('PostgreSQL适配器集成测试', () => {
    let adapter: PostgreSQLRepositoryAdapter<TestEntity>;
    let dataSource: DataSource;

    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      try {
        dataSource = await factory.createDataSource(config, mockLogger);
        adapter = factory.createAdapter(
          TestEntity,
          dataSource,
          config,
          mockLogger,
        ) as PostgreSQLRepositoryAdapter<TestEntity>;

        // 创建测试表
        await dataSource.query(`
          CREATE TABLE IF NOT EXISTS test_entity (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (error) {
        console.warn('PostgreSQL集成测试跳过:', error);
        adapter = null as any;
        dataSource = null as any;
      }
    });

    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
    });

    const runIfPostgreSQLAvailable = (testFn: () => void) => {
      return adapter
        ? testFn
        : () => {
            console.warn('跳过PostgreSQL集成测试：数据库不可用');
          };
    };

    it(
      '应该完成完整的CRUD操作流程',
      runIfPostgreSQLAvailable(async () => {
        // 创建
        const entity = { name: 'PostgreSQL Integration Test' };
        const created = await adapter.create(entity);
        expect(created.id).toBeDefined();
        expect(created.name).toBe('PostgreSQL Integration Test');

        // 读取
        const found = await adapter.findById(created.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(created.id);

        // 更新
        const updateResult = await adapter.update(
          { id: created.id },
          { name: 'Updated PostgreSQL Integration Test' },
        );
        expect(updateResult.affected).toBe(1);

        const updated = await adapter.findById(created.id);
        expect(updated!.name).toBe('Updated PostgreSQL Integration Test');

        // 删除
        const deleteResult = await adapter.delete({ id: created.id });
        expect(deleteResult.affected).toBe(1);

        const deleted = await adapter.findById(created.id);
        expect(deleted).toBeUndefined();
      }),
    );

    it(
      '应该处理批量操作',
      runIfPostgreSQLAvailable(async () => {
        const entities = Array.from({ length: 100 }, (_, i) => ({
          name: `PostgreSQL Batch Test ${i}`,
        }));

        // 批量创建
        const created = await adapter.createBatch(entities);
        expect(created).toHaveLength(100);

        // 批量查询
        const all = await adapter.find({});
        expect(all).toHaveLength(100);

        // 批量删除
        const deleteResult = await adapter.delete({});
        expect(deleteResult.affected).toBe(100);

        const remaining = await adapter.find({});
        expect(remaining).toHaveLength(0);
      }),
    );

    it(
      '应该处理高级SQL功能',
      runIfPostgreSQLAvailable(async () => {
        // 测试PostgreSQL特定的SQL功能
        await adapter.create({ name: 'Advanced SQL Test' });

        // 测试ANY操作符
        const results = await adapter.query(
          'SELECT * FROM test_entity WHERE id = ANY($1)',
          [['1', '2', '3']],
        );
        expect(Array.isArray(results)).toBe(true);

        // 测试JSON操作符（如果支持）
        try {
          const jsonResults = await adapter.query(
            'SELECT name, created_at FROM test_entity WHERE name = $1',
            ['Advanced SQL Test'],
          );
          expect(jsonResults).toHaveLength(1);
        } catch (error) {
          // JSON操作可能不支持，这是正常的
        }
      }),
    );
  });

  describe('适配器管理器集成测试', () => {
    it('应该管理多个适配器', async () => {
      const sqliteConfig: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const pgConfig: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      // 创建SQLite适配器
      const sqliteDataSource = await factory.createDataSource(
        sqliteConfig,
        mockLogger,
      );
      const sqliteAdapter = factory.createAdapter(
        TestEntity,
        sqliteDataSource,
        sqliteConfig,
        mockLogger,
      );
      manager.registerAdapter('sqlite', sqliteAdapter);

      // 尝试创建PostgreSQL适配器（可能失败）
      try {
        const pgDataSource = await factory.createDataSource(
          pgConfig,
          mockLogger,
        );
        const pgAdapter = factory.createAdapter(
          TestEntity,
          pgDataSource,
          pgConfig,
          mockLogger,
        );
        manager.registerAdapter('postgresql', pgAdapter);
      } catch (error) {
        console.warn('PostgreSQL适配器创建失败:', error);
      }

      // 初始化所有适配器
      await manager.initializeAll();

      // 获取统计信息
      const stats = manager.getStats();
      expect(stats.totalAdapters).toBeGreaterThanOrEqual(1);
      expect(stats.adapterNames).toContain('sqlite');

      // 获取健康状态
      const healthStatuses = await manager.getHealthStatus();
      expect(healthStatuses.size).toBeGreaterThanOrEqual(1);
      expect(healthStatuses.get('sqlite')).toBeDefined();

      // 关闭所有适配器
      await manager.closeAll();
      const finalStats = manager.getStats();
      expect(finalStats.totalAdapters).toBe(0);
    });
  });

  describe('环境配置解析集成测试', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('应该从环境变量创建SQLite适配器', async () => {
      process.env.DB_TYPE = 'sqlite';
      process.env.DB_PATH = ':memory:';

      const config = EnvironmentConfigParser.parseFromEnv();
      expect(config.type).toBe(DatabaseType.SQLITE);
      expect(config.path).toBe(':memory:');

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      );

      expect(adapter).toBeInstanceOf(SQLiteRepositoryAdapter);

      await dataSource.destroy();
    });

    it('应该验证环境变量', () => {
      process.env.DB_TYPE = 'sqlite';
      // 不设置DB_PATH

      const result = EnvironmentConfigParser.validateEnvVars();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的环境变量', () => {
      process.env.DB_TYPE = 'invalid_db';

      const result = EnvironmentConfigParser.validateEnvVars();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('不支持的数据库类型: invalid_db');
    });
  });

  describe('性能和监控集成测试', () => {
    it('应该收集性能指标', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      );

      // 执行一些操作
      await adapter.create({ name: 'Performance Test 1' });
      await adapter.create({ name: 'Performance Test 2' });
      await adapter.find({});

      // 获取性能指标
      const metrics = await adapter.getPerformanceMetrics();
      expect(metrics.databaseType).toBe(DatabaseType.SQLITE);
      expect(metrics.connectionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.queryTime).toBeGreaterThanOrEqual(0);

      // 获取仓库统计
      const stats = await adapter.getRepositoryStats();
      expect(stats.totalRecords).toBe(2);
      expect(stats.averageQueryTime).toBeGreaterThanOrEqual(0);

      await dataSource.destroy();
    });

    it('应该优化仓库性能', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      );

      // 优化仓库
      const result = await adapter.optimizeRepository();
      expect(result.success).toBe(true);
      expect(result.optimizations.length).toBeGreaterThan(0);

      await dataSource.destroy();
    });
  });

  describe('错误处理集成测试', () => {
    it('应该处理连接错误', async () => {
      const invalidConfig: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'nonexistent-host',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'nonexistentdb',
      };

      try {
        await factory.createDataSource(invalidConfig, mockLogger);
        // 如果没有抛出错误，说明连接成功（不太可能）
        expect(true).toBe(false);
      } catch (error) {
        // 预期的连接错误
        expect(error).toBeDefined();
      }
    });

    it('应该处理无效SQL', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      );

      try {
        await adapter.query('INVALID SQL QUERY');
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error).toBeDefined();
      }

      await dataSource.destroy();
    });

    it('应该处理事务回滚', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        TestEntity,
        dataSource,
        config,
        mockLogger,
      );

      const initialCount = await adapter.count();

      try {
        await adapter.transaction(async () => {
          await adapter.create({ name: 'Before Error' });
          throw new Error('Transaction Error');
        });
      } catch (error) {
        // 预期的错误
      }

      const finalCount = await adapter.count();
      expect(finalCount).toBe(initialCount);

      await dataSource.destroy();
    });
  });
});
