import {
  WinstonEnhancedLogger,
  LogTag,
  TraceIdGenerator,
  createEnhancedLogger,
} from './EnhancedLogger.js';
import { AppConfig } from '../config/config.js';

/**
 * 增强日志系统测试脚本
 */
async function testEnhancedLogger() {
  console.log('🧪 开始测试增强日志系统...\n');

  // 创建测试配置
  const testConfig: AppConfig = {
    log: {
      level: 'debug',
      enableTraceId: true,
      enableModuleTag: true,
      enablePerformanceLogging: true,
      logSlowQueriesThreshold: 1000,
    },
    // 其他配置项使用默认值
    openai: { baseUrl: '', apiKey: '', model: '' },
    llm: {
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      model: '',
      maxTokens: 0,
      temperature: 0,
      timeout: 0,
      semanticSplitting: {
        enabled: false,
        targetChunkSize: 1000,
        chunkOverlap: 100,
        maxChunks: 0,
        strategy: 'balanced',
        enableFallback: true,
        fallbackStrategy: 'auto',
        maxRetries: 1,
        retryDelay: 0,
        enableCache: false,
        cacheTTL: 0,
      },
    },
    db: { type: 'sqlite', path: '' },
    qdrant: { url: '', collection: '', vectorSize: 0 },
    embedding: { batchSize: 0 },
    api: { port: 0 },
    gc: { intervalHours: 0 },
    rateLimit: {
      enabled: false,
      global: { enabled: false },
      ip: { enabled: false },
      user: { enabled: false },
      path: { enabled: false },
      search: { enabled: false },
      upload: { enabled: false },
      metrics: { enabled: false },
      middleware: {
        includeHeaders: false,
        logEvents: false,
        logOnlyBlocked: false,
        skipHealthCheck: true,
        skipOptions: true,
      },
    },
  };

  // 创建增强日志器实例
  const logger = createEnhancedLogger(testConfig);

  console.log('✅ 增强日志器创建成功\n');

  // 测试基本日志功能
  console.log('📝 测试基本日志功能:');
  logger.debug('这是一条调试信息', LogTag.SYSTEM, { debugData: 'test' });
  logger.info('这是一条信息日志', LogTag.API, { apiData: 'test' });
  logger.warn('这是一条警告日志', LogTag.DATABASE, { warningData: 'test' });
  logger.error('这是一条错误日志', LogTag.QDRANT, { errorData: 'test' });

  // 测试traceID功能
  console.log('\n🔍 测试traceID功能:');
  const traceId = TraceIdGenerator.generate();
  logger.info('使用自定义traceID', LogTag.SYSTEM, { customTraceId: traceId });

  // 测试withTag功能
  console.log('\n🏷️ 测试withTag功能:');
  const apiLogger = logger.withTag(LogTag.API);
  apiLogger.info('使用withTag创建的API日志器', LogTag.API, {
    withTagTest: true,
  });

  // 测试性能日志功能
  console.log('\n⏱️ 测试性能日志功能:');
  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 100)); // 模拟异步操作
  const duration = Date.now() - startTime;
  logger.info('性能测试操作完成', LogTag.SYSTEM, {
    operation: 'test',
    duration: `${duration}ms`,
    performance: true,
  });

  // 测试慢查询检测
  console.log('\n🐌 测试慢查询检测:');
  const slowStartTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1100)); // 模拟慢操作
  const slowDuration = Date.now() - slowStartTime;
  logger.warn('检测到慢查询', LogTag.DATABASE, {
    query: 'SELECT * FROM test',
    duration: `${slowDuration}ms`,
    slowQuery: true,
  });

  // 测试结构化日志
  console.log('\n📊 测试结构化日志:');
  logger.info('结构化日志测试', LogTag.SYSTEM, {
    userId: '12345',
    action: 'test',
    metadata: {
      feature: 'logging',
      version: '1.0.0',
      environment: 'test',
    },
  });

  // 测试批量日志记录
  console.log('\n📦 测试批量日志记录:');
  logger.info('批量日志1', LogTag.API, { batch: 1 });
  logger.info('批量日志2', LogTag.DATABASE, { batch: 2 });
  logger.warn('批量日志3', LogTag.SYSTEM, { batch: 3 });

  console.log('\n✅ 增强日志系统测试完成！');
  console.log('📁 请检查 ./logs/test.log 文件查看日志输出');
}

// 运行测试
testEnhancedLogger().catch(console.error);
