/**
 * 数据库健康监控器测试
 */

import { Logger } from '@logging/logger.js';
import { EventEmitter } from 'events';
import {
  DatabaseHealthMonitor,
  createDefaultHealthCheckConfig,
  createDatabaseHealthMonitor,
  HealthCheckConfig,
  HealthCheckResult,
  HealthMonitorEvent,
} from '../../../../src/infrastructure/database/adapters/DatabaseHealthMonitor.js';
import {
  IRepositoryAdapter,
  AdapterHealthStatus,
  DatabaseConnectionStatus,
  AdapterPerformanceMetrics,
} from '../../../../src/infrastructure/database/adapters/IRepositoryAdapter.js';
import { DatabaseType } from '../../../../src/domain/interfaces/IDatabaseRepository.js';

// Mock implementations
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

const createMockAdapter = (
  databaseType: DatabaseType,
  connectionStatus: DatabaseConnectionStatus = DatabaseConnectionStatus.CONNECTED,
  isHealthy: boolean = true,
): jest.Mocked<IRepositoryAdapter<any>> => ({
  databaseType,
  config: {},
  dataSource: {} as any,
  logger: mockLogger,
  getHealthStatus: jest.fn().mockResolvedValue({
    connectionStatus,
    lastError: null,
    isConnected: connectionStatus === DatabaseConnectionStatus.CONNECTED,
  }),
  getPerformanceMetrics: jest.fn().mockReturnValue({
    queryCount: 100,
    totalQueryTime: 5000,
    averageQueryTime: 50,
    errorCount: 2,
    errorRate: 0.02,
    slowQueryCount: 5,
    lastQueryTime: Date.now(),
  }),
  ping: jest.fn().mockResolvedValue(true),
  cleanup: jest.fn().mockResolvedValue(undefined),
  // 其他必需的方法
  create: jest.fn(),
  createBatch: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findOne: jest.fn(),
  findMany: jest.fn(),
  findPaginated: jest.fn(),
  update: jest.fn(),
  updateBatch: jest.fn(),
  delete: jest.fn(),
  deleteBatch: jest.fn(),
  count: jest.fn(),
  exists: jest.fn(),
  query: jest.fn(),
  getRepository: jest.fn(),
  withTransaction: jest.fn(),
  beginTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  createQueryBuilder: jest.fn(),
  executeQuery: jest.fn(),
  executeRawQuery: jest.fn(),
  getSchemaInfo: jest.fn(),
  backup: jest.fn(),
  restore: jest.fn(),
  optimize: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  removeAllEventListeners: jest.fn(),
  emitEvent: jest.fn(),
  getEventListeners: jest.fn(),
  hasEventListener: jest.fn(),
  getAdapterInfo: jest.fn(),
  getDatabaseInfo: jest.fn(),
  getConnectionInfo: jest.fn(),
  getQueryPlan: jest.fn(),
  analyzeQuery: jest.fn(),
  validateConnection: jest.fn(),
  testConnection: jest.fn(),
  resetMetrics: jest.fn(),
  enableQueryCache: jest.fn(),
  disableQueryCache: jest.fn(),
  clearQueryCache: jest.fn(),
  getQueryCacheStats: jest.fn(),
  enablePerformanceMonitoring: jest.fn(),
  disablePerformanceMonitoring: jest.fn(),
  getSlowQueries: jest.fn(),
  getErrorStats: jest.fn(),
  getConnectionPoolStats: jest.fn(),
  getDatabaseStats: jest.fn(),
  getTableStats: jest.fn(),
  getIndexStats: jest.fn(),
  getAdapterStats: jest.fn(),
  getHealthCheckHistory: jest.fn(),
  getPerformanceHistory: jest.fn(),
  getErrorHistory: jest.fn(),
  getConnectionHistory: jest.fn(),
  getQueryHistory: jest.fn(),
  getSlowQueryHistory: jest.fn(),
  getErrorQueryHistory: jest.fn(),
  getPerformanceReport: jest.fn(),
  getHealthReport: jest.fn(),
  getErrorReport: jest.fn(),
  getConnectionReport: jest.fn(),
  getQueryReport: jest.fn(),
  getSlowQueryReport: jest.fn(),
  getAdapterReport: jest.fn(),
  getDatabaseReport: jest.fn(),
  getTableReport: jest.fn(),
  getIndexReport: jest.fn(),
  getConnectionPoolReport: jest.fn(),
  getPerformanceTrends: jest.fn(),
  getHealthTrends: jest.fn(),
  getErrorTrends: jest.fn(),
  getConnectionTrends: jest.fn(),
  getQueryTrends: jest.fn(),
  getSlowQueryTrends: jest.fn(),
  getErrorQueryTrends: jest.fn(),
  getPerformanceInsights: jest.fn(),
  getHealthInsights: jest.fn(),
  getErrorInsights: jest.fn(),
  getConnectionInsights: jest.fn(),
  getQueryInsights: jest.fn(),
  getSlowQueryInsights: jest.fn(),
  getErrorQueryInsights: jest.fn(),
  getAdapterInsights: jest.fn(),
  getDatabaseInsights: jest.fn(),
  getTableInsights: jest.fn(),
  getIndexInsights: jest.fn(),
  getConnectionPoolInsights: jest.fn(),
  getPerformanceRecommendations: jest.fn(),
  getHealthRecommendations: jest.fn(),
  getErrorRecommendations: jest.fn(),
  getConnectionRecommendations: jest.fn(),
  getQueryRecommendations: jest.fn(),
  getSlowQueryRecommendations: jest.fn(),
  getErrorQueryRecommendations: jest.fn(),
  getAdapterRecommendations: jest.fn(),
  getDatabaseRecommendations: jest.fn(),
  getTableRecommendations: jest.fn(),
  getIndexRecommendations: jest.fn(),
  getConnectionPoolRecommendations: jest.fn(),
  getPerformanceAlerts: jest.fn(),
  getHealthAlerts: jest.fn(),
  getErrorAlerts: jest.fn(),
  getConnectionAlerts: jest.fn(),
  getQueryAlerts: jest.fn(),
  getSlowQueryAlerts: jest.fn(),
  getErrorQueryAlerts: jest.fn(),
  getAdapterAlerts: jest.fn(),
  getDatabaseAlerts: jest.fn(),
  getTableAlerts: jest.fn(),
  getIndexAlerts: jest.fn(),
  getConnectionPoolAlerts: jest.fn(),
  getPerformanceWarnings: jest.fn(),
  getHealthWarnings: jest.fn(),
  getErrorWarnings: jest.fn(),
  getConnectionWarnings: jest.fn(),
  getQueryWarnings: jest.fn(),
  getSlowQueryWarnings: jest.fn(),
  getErrorQueryWarnings: jest.fn(),
  getAdapterWarnings: jest.fn(),
  getDatabaseWarnings: jest.fn(),
  getTableWarnings: jest.fn(),
  getIndexWarnings: jest.fn(),
  getConnectionPoolWarnings: jest.fn(),
  getPerformanceErrors: jest.fn(),
  getHealthErrors: jest.fn(),
  getErrorErrors: jest.fn(),
  getConnectionErrors: jest.fn(),
  getQueryErrors: jest.fn(),
  getSlowQueryErrors: jest.fn(),
  getErrorQueryErrors: jest.fn(),
  getAdapterErrors: jest.fn(),
  getDatabaseErrors: jest.fn(),
  getTableErrors: jest.fn(),
  getIndexErrors: jest.fn(),
  getConnectionPoolErrors: jest.fn(),
  getPerformanceExceptions: jest.fn(),
  getHealthExceptions: jest.fn(),
  getErrorExceptions: jest.fn(),
  getConnectionExceptions: jest.fn(),
  getQueryExceptions: jest.fn(),
  getSlowQueryExceptions: jest.fn(),
  getErrorQueryExceptions: jest.fn(),
  getAdapterExceptions: jest.fn(),
  getDatabaseExceptions: jest.fn(),
  getTableExceptions: jest.fn(),
  getIndexExceptions: jest.fn(),
  getConnectionPoolExceptions: jest.fn(),
  getPerformanceCritical: jest.fn(),
  getHealthCritical: jest.fn(),
  getErrorCritical: jest.fn(),
  getConnectionCritical: jest.fn(),
  getQueryCritical: jest.fn(),
  getSlowQueryCritical: jest.fn(),
  getErrorQueryCritical: jest.fn(),
  getAdapterCritical: jest.fn(),
  getDatabaseCritical: jest.fn(),
  getTableCritical: jest.fn(),
  getIndexCritical: jest.fn(),
  getConnectionPoolCritical: jest.fn(),
  getPerformanceEmergency: jest.fn(),
  getHealthEmergency: jest.fn(),
  getErrorEmergency: jest.fn(),
  getConnectionEmergency: jest.fn(),
  getQueryEmergency: jest.fn(),
  getSlowQueryEmergency: jest.fn(),
  getErrorQueryEmergency: jest.fn(),
  getAdapterEmergency: jest.fn(),
  getDatabaseEmergency: jest.fn(),
  getTableEmergency: jest.fn(),
  getIndexEmergency: jest.fn(),
  getConnectionPoolEmergency: jest.fn(),
});

describe.skip('DatabaseHealthMonitor', () => {
  let healthMonitor: DatabaseHealthMonitor;
  let config: HealthCheckConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    config = createDefaultHealthCheckConfig();
    healthMonitor = new DatabaseHealthMonitor(config, mockLogger);
  });

  afterEach(() => {
    healthMonitor.stop();
    jest.useRealTimers();
  });

  describe('registerAdapter', () => {
    it('应该注册适配器并开始健康检查', () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);

      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '注册数据库适配器监控',
        expect.objectContaining({
          name: 'test-adapter',
          databaseType: DatabaseType.SQLITE,
        }),
      );

      // 验证健康检查被调度
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        config.checkInterval,
      );
    });
  });

  describe('unregisterAdapter', () => {
    it('应该注销适配器并停止健康检查', () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);

      healthMonitor.registerAdapter('test-adapter', mockAdapter);
      healthMonitor.unregisterAdapter('test-adapter');

      expect(mockLogger.info).toHaveBeenCalledWith('注销数据库适配器监控', {
        name: 'test-adapter',
      });
    });
  });

  describe('getHealthStatus', () => {
    it('应该返回特定适配器的健康状态', async () => {
      const mockAdapter = createMockAdapter(DatabaseType.POSTGRESQL);

      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      // 等待第一次健康检查完成
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const status = healthMonitor.getHealthStatus('test-adapter');

      expect(status).toBeDefined();
      expect(status?.databaseType).toBe(DatabaseType.POSTGRESQL);
      expect(status?.connectionStatus).toBe(DatabaseConnectionStatus.CONNECTED);
      expect(status?.isHealthy).toBe(true);
    });

    it('应该返回undefined对于不存在的适配器', () => {
      const status = healthMonitor.getHealthStatus('non-existent');
      expect(status).toBeUndefined();
    });
  });

  describe('getAllHealthStatus', () => {
    it('应该返回所有适配器的健康状态', async () => {
      const mockAdapter1 = createMockAdapter(DatabaseType.SQLITE);
      const mockAdapter2 = createMockAdapter(DatabaseType.POSTGRESQL);

      healthMonitor.registerAdapter('sqlite-adapter', mockAdapter1);
      healthMonitor.registerAdapter('postgres-adapter', mockAdapter2);

      // 等待健康检查完成
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const allStatus = healthMonitor.getAllHealthStatus();

      expect(Object.keys(allStatus)).toHaveLength(2);
      expect(allStatus['sqlite-adapter']).toBeDefined();
      expect(allStatus['postgres-adapter']).toBeDefined();
    });
  });

  describe('getSystemHealthStatus', () => {
    it('应该返回整体系统健康状态', async () => {
      const healthyAdapter = createMockAdapter(DatabaseType.SQLITE);
      const unhealthyAdapter = createMockAdapter(
        DatabaseType.POSTGRESQL,
        DatabaseConnectionStatus.DISCONNECTED,
        false,
      );

      healthMonitor.registerAdapter('healthy-adapter', healthyAdapter);
      healthMonitor.registerAdapter('unhealthy-adapter', unhealthyAdapter);

      // 等待健康检查完成
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const systemHealth = healthMonitor.getSystemHealthStatus();

      expect(systemHealth.isHealthy).toBe(false);
      expect(systemHealth.healthyAdapters).toContain('healthy-adapter');
      expect(systemHealth.unhealthyAdapters).toContain('unhealthy-adapter');
      expect(systemHealth.totalAdapters).toBe(2);
    });

    it('应该返回健康状态当所有适配器都健康时', async () => {
      const healthyAdapter1 = createMockAdapter(DatabaseType.SQLITE);
      const healthyAdapter2 = createMockAdapter(DatabaseType.POSTGRESQL);

      healthMonitor.registerAdapter('adapter1', healthyAdapter1);
      healthMonitor.registerAdapter('adapter2', healthyAdapter2);

      // 等待健康检查完成
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const systemHealth = healthMonitor.getSystemHealthStatus();

      expect(systemHealth.isHealthy).toBe(true);
      expect(systemHealth.healthyAdapters).toHaveLength(2);
      expect(systemHealth.unhealthyAdapters).toHaveLength(0);
    });
  });

  describe('getPerformanceSummary', () => {
    it('应该返回性能摘要', async () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);

      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      // 等待健康检查完成
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const summary = healthMonitor.getPerformanceSummary();

      expect(summary['test-adapter']).toEqual({
        averageResponseTime: 50,
        totalQueries: 100,
        errorRate: 0.02,
        slowQueries: 5,
      });
    });
  });

  describe('health events', () => {
    it('应该发出连接丢失事件', async () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);

      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      // 等待第一次健康检查（连接正常）
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const eventListener = jest.fn();
      healthMonitor.on('health_event', eventListener);

      // 模拟连接丢失
      mockAdapter.getHealthStatus.mockResolvedValue({
        connectionStatus: DatabaseConnectionStatus.DISCONNECTED,
        lastError: new Error('Connection lost'),
        isConnected: false,
      });

      // 触发下一次健康检查
      jest.advanceTimersByTime(config.checkInterval);
      await Promise.resolve();

      expect(eventListener).toHaveBeenCalledWith(
        'test-adapter',
        expect.objectContaining({
          type: 'connection_lost',
          data: expect.objectContaining({
            connectionStatus: DatabaseConnectionStatus.DISCONNECTED,
            isHealthy: false,
          }),
        }),
      );
    });

    it('应该发出连接恢复事件', async () => {
      const mockAdapter = createMockAdapter(
        DatabaseType.SQLITE,
        DatabaseConnectionStatus.DISCONNECTED,
        false,
      );

      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      // 等待第一次健康检查（连接断开）
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const eventListener = jest.fn();
      healthMonitor.on('health_event', eventListener);

      // 模拟连接恢复
      mockAdapter.getHealthStatus.mockResolvedValue({
        connectionStatus: DatabaseConnectionStatus.CONNECTED,
        lastError: null,
        isConnected: true,
      });

      // 触发下一次健康检查
      jest.advanceTimersByTime(config.checkInterval);
      await Promise.resolve();

      expect(eventListener).toHaveBeenCalledWith(
        'test-adapter',
        expect.objectContaining({
          type: 'connection_restored',
          data: expect.objectContaining({
            connectionStatus: DatabaseConnectionStatus.CONNECTED,
            isHealthy: true,
          }),
        }),
      );
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置并重新启动健康检查', () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);
      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      const newConfig = {
        checkInterval: 60000,
        slowQueryThreshold: 2000,
      };

      healthMonitor.updateConfig(newConfig);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '更新健康监控配置',
        expect.objectContaining(newConfig),
      );
    });
  });

  describe('forceHealthCheck', () => {
    it('应该强制执行健康检查', async () => {
      const mockAdapter = createMockAdapter(DatabaseType.SQLITE);
      healthMonitor.registerAdapter('test-adapter', mockAdapter);

      await healthMonitor.forceHealthCheck('test-adapter');

      expect(mockAdapter.getHealthStatus).toHaveBeenCalled();
    });

    it('应该强制执行所有适配器的健康检查', async () => {
      const mockAdapter1 = createMockAdapter(DatabaseType.SQLITE);
      const mockAdapter2 = createMockAdapter(DatabaseType.POSTGRESQL);

      healthMonitor.registerAdapter('adapter1', mockAdapter1);
      healthMonitor.registerAdapter('adapter2', mockAdapter2);

      await healthMonitor.forceHealthCheck();

      expect(mockAdapter1.getHealthStatus).toHaveBeenCalled();
      expect(mockAdapter2.getHealthStatus).toHaveBeenCalled();
    });
  });
});

describe('createDefaultHealthCheckConfig', () => {
  it('应该创建默认健康检查配置', () => {
    const config = createDefaultHealthCheckConfig();

    expect(config.checkInterval).toBe(30000);
    expect(config.connectionTimeout).toBe(5000);
    expect(config.slowQueryThreshold).toBe(1000);
    expect(config.minPoolHealthPercentage).toBe(80);
    expect(config.enableDetailedMonitoring).toBe(true);
  });

  it('在生产环境中应该禁用详细监控', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const config = createDefaultHealthCheckConfig();

    expect(config.enableDetailedMonitoring).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });
});

describe('createDatabaseHealthMonitor', () => {
  it('应该创建数据库健康监控器实例', () => {
    const monitor = createDatabaseHealthMonitor(mockLogger);

    expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
  });

  it('应该使用自定义配置', () => {
    const customConfig = {
      checkInterval: 60000,
      slowQueryThreshold: 2000,
    };

    const monitor = createDatabaseHealthMonitor(mockLogger, customConfig);

    expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
  });
});
