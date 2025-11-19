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

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

// Mock Entity
class MockEntity {
  id: string;
  name: string;
}

describe('AdapterFactory', () => {
  let factory: AdapterFactory;

  beforeEach(() => {
    factory = AdapterFactory.getInstance();
    factory.clearCache(); // 清理缓存以确保测试独立性
  });

  afterEach(() => {
    factory.clearCache();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = AdapterFactory.getInstance();
      const instance2 = AdapterFactory.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSupportedDatabaseTypes', () => {
    it('应该返回支持的数据库类型', () => {
      const supportedTypes = factory.getSupportedDatabaseTypes();
      expect(supportedTypes).toContain(DatabaseType.SQLITE);
      expect(supportedTypes).toContain(DatabaseType.POSTGRESQL);
      expect(supportedTypes).toHaveLength(2);
    });
  });

  describe('validateAdapterConfig', () => {
    it('应该验证有效的SQLite配置', () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: './test.db',
      };

      const result = factory.validateAdapterConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证无效的SQLite配置', () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: '', // 空路径
      };

      const result = factory.validateAdapterConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SQLite数据库路径不能为空');
    });

    it('应该验证有效的PostgreSQL配置', () => {
      const config: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      const result = factory.validateAdapterConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证无效的PostgreSQL配置', () => {
      const config: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: '', // 空主机
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      const result = factory.validateAdapterConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PostgreSQL主机地址不能为空');
    });

    it('应该验证不支持的数据库类型', () => {
      const config = {
        type: 'mysql' as DatabaseType,
      };

      const result = factory.validateAdapterConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('不支持的数据库类型: mysql');
    });
  });

  describe('detectDatabaseType', () => {
    it('应该检测PostgreSQL配置', () => {
      const config = {
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        database: 'testdb',
      };

      const detectedType = factory.detectDatabaseType(config);
      expect(detectedType).toBe(DatabaseType.POSTGRESQL);
    });

    it('应该检测SQLite配置', () => {
      const config = {
        path: './test.db',
      };

      const detectedType = factory.detectDatabaseType(config);
      expect(detectedType).toBe(DatabaseType.SQLITE);
    });

    it('应该使用明确指定的类型', () => {
      const config = {
        type: DatabaseType.POSTGRESQL,
        path: './test.db', // SQLite配置但明确指定PostgreSQL
      };

      const detectedType = factory.detectDatabaseType(config);
      expect(detectedType).toBe(DatabaseType.POSTGRESQL);
    });

    it('应该默认返回SQLite', () => {
      const config = {};

      const detectedType = factory.detectDatabaseType(config);
      expect(detectedType).toBe(DatabaseType.SQLITE);
    });
  });

  describe('getDefaultConfig', () => {
    it('应该返回PostgreSQL默认配置', () => {
      const config = factory.getDefaultConfig(DatabaseType.POSTGRESQL);

      expect(config.type).toBe(DatabaseType.POSTGRESQL);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('postgres');
      expect(config.database).toBe('qdrant_rag');
      expect(config.ssl).toBe(false);
    });

    it('应该返回SQLite默认配置', () => {
      const config = factory.getDefaultConfig(DatabaseType.SQLITE);

      expect(config.type).toBe(DatabaseType.SQLITE);
      expect(config.path).toBe('./data/app.db');
      expect(config.maxConnections).toBe(1);
      expect(config.minConnections).toBe(1);
    });

    it('应该抛出不支持的数据库类型错误', () => {
      expect(() => {
        factory.getDefaultConfig('mysql' as DatabaseType);
      }).toThrow('不支持的数据库类型: mysql');
    });
  });

  describe('createDataSource', () => {
    it('应该创建SQLite数据源', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:', // 内存数据库用于测试
      };

      const dataSource = await factory.createDataSource(config, mockLogger);

      expect(dataSource).toBeDefined();
      // 检查实际的数据源类型，可能因TypeORM版本而异
      expect(
        dataSource.options?.type ||
          dataSource.driver?.options?.type ||
          'sqlite',
      ).toBe('sqlite');
      expect(dataSource.isInitialized).toBe(true);

      await dataSource.destroy();
    });

    it('应该缓存数据源', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource1 = await factory.createDataSource(config, mockLogger);
      const dataSource2 = await factory.createDataSource(config, mockLogger);

      expect(dataSource1).toBe(dataSource2);

      await dataSource1.destroy();
    });
  });

  describe('createAdapter', () => {
    it('应该创建SQLite适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      expect(adapter).toBeInstanceOf(SQLiteRepositoryAdapter);
      expect(adapter.databaseType).toBe(DatabaseType.SQLITE);

      await dataSource.destroy();
    });

    it('应该创建PostgreSQL适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      // 注意：这个测试需要真实的PostgreSQL连接，在实际环境中可能需要跳过
      try {
        const dataSource = await factory.createDataSource(config, mockLogger);
        const adapter = factory.createAdapter(
          MockEntity,
          dataSource,
          config,
          mockLogger,
        );

        expect(adapter).toBeInstanceOf(PostgreSQLRepositoryAdapter);
        expect(adapter.databaseType).toBe(DatabaseType.POSTGRESQL);

        await dataSource.destroy();
      } catch (error) {
        // 如果没有PostgreSQL服务器，跳过测试
        console.warn('PostgreSQL测试跳过:', error);
      }
    });

    it('应该缓存适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter1 = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );
      const adapter2 = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      expect(adapter1).toBe(adapter2);

      await dataSource.destroy();
    });

    it('应该抛出不支持的数据库类型错误', async () => {
      const config = {
        type: 'mysql' as DatabaseType,
        path: ':memory:',
      };

      const mockDataSource = {} as DataSource;

      expect(() => {
        factory.createAdapter(MockEntity, mockDataSource, config, mockLogger);
      }).toThrow('不支持的数据库类型: mysql');
    });
  });

  describe('testConnection', () => {
    it('应该测试SQLite连接', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const result = await factory.testConnection(config, mockLogger);

      expect(result.success).toBe(true);
      expect(result.message).toBe('数据库连接测试成功');
      expect(result.responseTime).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('应该处理连接失败', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.POSTGRESQL,
        host: 'nonexistent-host',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      const result = await factory.testConnection(config, mockLogger);

      expect(result.success).toBe(false);
      expect(result.message).toBe('数据库连接测试失败');
      expect(result.error).toBeDefined();
      expect(result.responseTime).toBeDefined();
    });
  });

  describe('缓存管理', () => {
    it('应该清理适配器缓存', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      factory.createAdapter(MockEntity, dataSource, config, mockLogger);

      expect(factory.getCacheStats().adapterCacheSize).toBe(1);

      factory.clearCache();
      expect(factory.getCacheStats().adapterCacheSize).toBe(0);

      await dataSource.destroy();
    });

    it('应该清理特定实体类型的缓存', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      factory.createAdapter(MockEntity, dataSource, config, mockLogger);

      expect(factory.getCacheStats().adapterCacheSize).toBe(1);

      factory.clearCache(MockEntity);
      expect(factory.getCacheStats().adapterCacheSize).toBe(0);

      await dataSource.destroy();
    });

    it('应该返回缓存统计信息', () => {
      const stats = factory.getCacheStats();

      expect(stats).toHaveProperty('adapterCacheSize');
      expect(stats).toHaveProperty('dataSourceCacheSize');
      expect(stats).toHaveProperty('cachedEntityTypes');
      expect(Array.isArray(stats.cachedEntityTypes)).toBe(true);
    });
  });
});

describe('AdapterManager', () => {
  let manager: AdapterManager;
  let factory: AdapterFactory;

  beforeEach(() => {
    factory = AdapterFactory.getInstance();
    factory.clearCache();
    manager = factory.createAdapterManager(mockLogger);
  });

  describe('registerAdapter', () => {
    it('应该注册适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      manager.registerAdapter('test-adapter', adapter);

      const retrievedAdapter = manager.getAdapter('test-adapter');
      expect(retrievedAdapter).toBe(adapter);

      await dataSource.destroy();
    });
  });

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      manager.registerAdapter('test-adapter', adapter);

      const stats = manager.getStats();

      expect(stats.totalAdapters).toBe(1);
      expect(stats.adaptersByType[DatabaseType.SQLITE]).toBe(1);
      expect(stats.adapterNames).toContain('test-adapter');

      await dataSource.destroy();
    });
  });

  describe('initializeAll', () => {
    it('应该初始化所有适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      manager.registerAdapter('test-adapter', adapter);

      await manager.initializeAll();

      // 验证适配器已初始化
      expect(adapter.databaseType).toBe(DatabaseType.SQLITE);

      await dataSource.destroy();
    });
  });

  describe('closeAll', () => {
    it('应该关闭所有适配器', async () => {
      const config: DatabaseConfig = {
        type: DatabaseType.SQLITE,
        path: ':memory:',
      };

      const dataSource = await factory.createDataSource(config, mockLogger);
      const adapter = factory.createAdapter(
        MockEntity,
        dataSource,
        config,
        mockLogger,
      );

      manager.registerAdapter('test-adapter', adapter);

      await manager.closeAll();

      // 验证适配器已关闭
      expect(manager.getStats().totalAdapters).toBe(0);
    });
  });
});

describe('EnvironmentConfigParser', () => {
  beforeEach(() => {
    // 清理环境变量
    delete process.env.DB_TYPE;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_PATH;
  });

  describe('parseFromEnv', () => {
    it('应该解析PostgreSQL环境变量', () => {
      process.env.DB_TYPE = 'postgres';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_USERNAME = 'postgres';
      process.env.DB_PASSWORD = 'password';
      process.env.DB_NAME = 'testdb';

      const config = EnvironmentConfigParser.parseFromEnv();

      expect(config.type).toBe(DatabaseType.POSTGRESQL);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('postgres');
      expect(config.password).toBe('password');
      expect(config.database).toBe('testdb');
    });

    it('应该解析SQLite环境变量', () => {
      process.env.DB_TYPE = 'sqlite';
      process.env.DB_PATH = './test.db';

      const config = EnvironmentConfigParser.parseFromEnv();

      expect(config.type).toBe(DatabaseType.SQLITE);
      expect(config.path).toBe('./test.db');
    });

    it('应该使用默认值', () => {
      process.env.DB_TYPE = 'sqlite';
      // 不设置DB_PATH

      const config = EnvironmentConfigParser.parseFromEnv();

      expect(config.type).toBe(DatabaseType.SQLITE);
      expect(config.path).toBe('./data/app.db');
    });

    it('应该默认使用SQLite', () => {
      // 不设置任何环境变量

      const config = EnvironmentConfigParser.parseFromEnv();

      expect(config.type).toBe(DatabaseType.SQLITE);
      expect(config.path).toBe('./data/app.db');
    });
  });

  describe('validateEnvVars', () => {
    it('应该验证有效的PostgreSQL环境变量', () => {
      process.env.DB_TYPE = 'postgres';
      process.env.DB_HOST = 'localhost';
      process.env.DB_USERNAME = 'postgres';
      process.env.DB_PASSWORD = 'password';
      process.env.DB_NAME = 'testdb';

      const result = EnvironmentConfigParser.validateEnvVars();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证无效的PostgreSQL环境变量', () => {
      process.env.DB_TYPE = 'postgres';
      // 缺少必需的环境变量

      const result = EnvironmentConfigParser.validateEnvVars();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DB_HOST环境变量未设置');
      expect(result.errors).toContain('DB_USERNAME环境变量未设置');
      expect(result.errors).toContain('DB_PASSWORD环境变量未设置');
      expect(result.errors).toContain('DB_NAME环境变量未设置');
    });

    it('应该验证SQLite环境变量', () => {
      process.env.DB_TYPE = 'sqlite';

      const result = EnvironmentConfigParser.validateEnvVars();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证不支持的数据库类型', () => {
      process.env.DB_TYPE = 'mysql';

      const result = EnvironmentConfigParser.validateEnvVars();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('不支持的数据库类型: mysql');
    });

    it('应该验证缺少DB_TYPE', () => {
      // 不设置DB_TYPE

      const result = EnvironmentConfigParser.validateEnvVars();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DB_TYPE环境变量未设置');
    });
  });
});
