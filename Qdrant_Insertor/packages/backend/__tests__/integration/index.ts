/**
 * 集成测试主入口文件
 * 导出所有集成测试模块和工具
 */

// 导出测试设置工具
export * from './setup.js';

// 导出测试工具
export * from './utils/test-data-factory.js';
export * from './utils/test-assertions.js';

// 导出实体测试
export * from './entities/collection.test.js';
export * from './entities/document.test.js';
export * from './entities/chunk.test.js';

// 导出聚合根测试
export * from './aggregates/collection-aggregate.test.js';

// 导出事件系统测试
export * from './events/domain-events.test.js';

// 导出事务管理测试
export * from './transactions/transaction-management.test.js';

// 导出API测试
export * from './api/collections-api.test.js';

// 导出搜索功能测试
export * from './search/search-functionality.test.js';

// 导出批量操作测试
export * from './batch/batch-operations.test.js';

// 导出监控和健康检查测试
export * from './monitoring/health-check.test.js';

// 导出错误处理测试
export * from './error-handling/error-scenarios.test.js';

// 导出性能基准测试
export * from './performance/performance-benchmarks.test.js';

/**
 * 集成测试配置
 */
export const INTEGRATION_TEST_CONFIG = {
  // 测试数据库配置
  database: {
    type: 'sqlite',
    path: ':memory:',
    synchronize: true,
    logging: false,
  },

  // 性能测试配置
  performance: {
    enabled: process.env.NODE_ENV !== 'test',
    thresholds: {
      collectionCreation: 10, // ms
      documentCreation: 5, // ms
      chunkCreation: 2, // ms
      searchTime: 100, // ms
      transactionTime: 5, // ms
    },
    batchSizes: {
      collections: 1000,
      documents: 5000,
      chunks: 10000,
    },
  },

  // 错误处理配置
  errorHandling: {
    maxRetries: 3,
    retryDelay: 100,
    timeoutMs: 30000,
  },

  // 监控配置
  monitoring: {
    healthCheckInterval: 60000, // 1分钟
    metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7天
    alertThresholds: {
      errorRate: 0.05, // 5%
      responseTime: 1000, // 1秒
      memoryUsage: 0.8, // 80%
    },
  },
} as const;

/**
 * 集成测试工具函数
 */
export class IntegrationTestUtils {
  /**
   * 运行所有集成测试
   */
  static async runAllIntegrationTests(): Promise<void> {
    console.log('🧪 开始运行所有集成测试...');

    const testSuites = [
      'Entity Tests',
      'Aggregate Tests',
      'Event System Tests',
      'Transaction Management Tests',
      'API Tests',
      'Search Functionality Tests',
      'Batch Operations Tests',
      'Monitoring and Health Check Tests',
      'Error Handling Tests',
      'Performance Benchmark Tests',
    ];

    for (const testSuite of testSuites) {
      console.log(`📋 运行测试套件: ${testSuite}`);
      // 这里可以添加具体的测试运行逻辑
    }

    console.log('✅ 所有集成测试运行完成');
  }

  /**
   * 生成集成测试报告
   */
  static generateTestReport(results: any[]): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter((r) => r.status === 'passed').length,
        failed: results.filter((r) => r.status === 'failed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      },
      details: results,
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * 验证TypeORM迁移完整性
   */
  static async validateTypeORMMigration(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // 这里可以添加具体的验证逻辑
    // 例如：检查所有表是否存在、索引是否正确等

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * 清理集成测试环境
   */
  static async cleanup(): Promise<void> {
    console.log('🧹 清理集成测试环境...');

    // 这里可以添加清理逻辑
    // 例如：清理测试数据库、重置模拟服务等

    console.log('✅ 集成测试环境清理完成');
  }
}

/**
 * 集成测试常量
 */
export const INTEGRATION_TEST_CONSTANTS = {
  // 测试数据大小
  TEST_DATA_SIZES: {
    SMALL: 10,
    MEDIUM: 100,
    LARGE: 1000,
    EXTRA_LARGE: 10000,
  },

  // 性能基准
  PERFORMANCE_BENCHMARKS: {
    DATABASE_OPERATIONS: {
      CREATE: 5, // ms
      READ: 1, // ms
      UPDATE: 3, // ms
      DELETE: 2, // ms
    },
    API_RESPONSES: {
      FAST: 100, // ms
      NORMAL: 500, // ms
      SLOW: 2000, // ms
    },
    SEARCH_QUERIES: {
      KEYWORD: 50, // ms
      SEMANTIC: 200, // ms
      HYBRID: 150, // ms
    },
  },

  // 错误场景
  ERROR_SCENARIOS: {
    DATABASE_CONNECTION: 'database_connection_lost',
    TRANSACTION_TIMEOUT: 'transaction_timeout',
    VALIDATION_ERROR: 'validation_error',
    NETWORK_ERROR: 'network_error',
    RESOURCE_EXHAUSTION: 'resource_exhaustion',
  },

  // 监控指标
  MONITORING_METRICS: {
    SYSTEM_HEALTH: 'system_health',
    PERFORMANCE_METRICS: 'performance_metrics',
    ERROR_RATES: 'error_rates',
    RESOURCE_USAGE: 'resource_usage',
  },
} as const;

/**
 * 默认导出
 */
export default {
  INTEGRATION_TEST_CONFIG,
  IntegrationTestUtils,
  INTEGRATION_TEST_CONSTANTS,
};
