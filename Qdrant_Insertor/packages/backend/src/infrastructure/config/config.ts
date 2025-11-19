import dotenv from 'dotenv';
dotenv.config();
/**
 * 应用程序配置对象的接口定义
 */
export type AppConfig = {
  openai: { baseUrl: string; apiKey: string; model: string };
  llm: {
    provider: 'openai' | 'anthropic' | 'azure' | 'openai_compatible';
    apiKey: string;
    baseUrl?: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    // Azure特定配置
    apiVersion?: string;
    organizationId?: string;
    projectId?: string;
    deploymentName?: string;
    // 自定义请求头
    headers?: Record<string, string>;
    // 语义分块配置
    semanticSplitting: {
      enabled: boolean;
      targetChunkSize?: number;
      chunkOverlap?: number;
      maxChunks?: number;
      strategy?: 'coherent' | 'topic-based' | 'semantic' | 'balanced';
      enableFallback?: boolean;
      fallbackStrategy?: 'by_size' | 'by_headings' | 'auto';
      maxRetries?: number;
      retryDelay?: number;
      enableCache?: boolean;
      cacheTTL?: number;
    };
  };
  db: {
    type: 'sqlite' | 'postgres';
    path?: string;
    postgres?: {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
      ssl?: boolean;
    };
  };
  qdrant: { url: string; collection: string; vectorSize: number };
  embedding: { batchSize: number };
  api: { port: number };
  log: {
    level: string;
    // 以下为可选的日志轮转配置（不填则采用默认值）
    dirname?: string; // 日志目录
    maxFiles?: string | number; // 例如 '14d' 或 30
    maxSize?: string; // 例如 '20m'
    datePattern?: string; // 例如 'YYYY-MM-DD'
    zippedArchive?: boolean; // 是否压缩归档
    // 增强日志功能配置
    enableTraceId?: boolean; // 是否启用traceID
    enableModuleTag?: boolean; // 是否启用模块TAG
    enablePerformanceLogging?: boolean; // 是否启用性能日志
    logSlowQueriesThreshold?: number; // 慢查询阈值（毫秒）
  };
  gc: { intervalHours: number };
  rateLimit: {
    // 是否启用限流
    enabled?: boolean;
    // 全局限流配置
    global?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
    };
    // IP限流配置
    ip?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
      whitelist?: string[];
    };
    // 用户限流配置
    user?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
    };
    // 路径限流配置
    path?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
    };
    // 搜索API限流配置
    search?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
    };
    // 上传API限流配置
    upload?: {
      maxTokens?: number;
      refillRate?: number;
      enabled?: boolean;
    };
    // 指标收集配置
    metrics?: {
      enabled?: boolean;
      retentionPeriod?: number; // 数据保留时间（毫秒）
      cleanupInterval?: number; // 清理间隔（毫秒）
    };
    // 中间件配置
    middleware?: {
      includeHeaders?: boolean; // 是否在响应头中包含限流信息
      logEvents?: boolean; // 是否记录限流事件
      logOnlyBlocked?: boolean; // 是否只记录被限流的请求
      errorMessage?: string; // 自定义错误消息
      skipHealthCheck?: boolean; // 是否跳过健康检查端点的限流
      skipOptions?: boolean; // 是否跳过OPTIONS请求的限流
    };
  };
};

/**
 * 校验字符串参数，确保非空，并去除可能的引号
 *
 * @param value - 要校验的值
 * @param name - 参数名称
 * @returns 校验后的字符串
 */
function validateString(value: unknown, name: string): string {
  if (!value || String(value).trim() === '') {
    throw new Error(`validateConfig: Missing ${name}`);
  }
  return String(value)
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1');
}

/**
 * 校验数值参数，确保为正整数
 *
 * @param value - 要校验的值
 * @param name - 参数名称
 * @param defaultValue - 默认值
 * @returns 校验后的数字
 */
function validateNumber(
  value: unknown,
  name: string,
  defaultValue: number,
): number {
  const num = Number(value ?? defaultValue);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new Error(`validateConfig: Invalid ${name}`);
  }
  return num;
}

/**
 * 读取并校验配置
 *
 * @param env - 环境变量对象
 * @returns 验证后的配置对象
 */
export function validateConfig(env = process.env): AppConfig {
  const OPENAI_API_KEY = validateString(env.OPENAI_API_KEY, 'OPENAI_API_KEY');
  const OPENAI_BASE_URL = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const OPENAI_MODEL =
    env.OPENAI_MODEL || env.EMBEDDING_MODEL_NAME || 'text-embedding-ada-002';

  // LLM配置
  const LLM_PROVIDER = (env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'azure' | 'openai_compatible';
  const LLM_API_KEY = validateString(env.LLM_API_KEY || env.OPENAI_API_KEY, 'LLM_API_KEY');
  const LLM_BASE_URL = env.LLM_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const LLM_MODEL = env.LLM_MODEL || env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const LLM_MAX_TOKENS = validateNumber(env.LLM_MAX_TOKENS, 'LLM_MAX_TOKENS', 4096);
  const LLM_TEMPERATURE = Number(env.LLM_TEMPERATURE) || 0.1;
  const LLM_TIMEOUT = validateNumber(env.LLM_TIMEOUT, 'LLM_TIMEOUT', 30000);
  
  // Azure特定配置
  const LLM_API_VERSION = env.LLM_API_VERSION || '2024-02-15-preview';
  const LLM_ORGANIZATION_ID = env.LLM_ORGANIZATION_ID;
  const LLM_PROJECT_ID = env.LLM_PROJECT_ID;
  const LLM_DEPLOYMENT_NAME = env.LLM_DEPLOYMENT_NAME;
  
  // 语义分块配置
  const LLM_SEMANTIC_SPLITTING_ENABLED = env.LLM_SEMANTIC_SPLITTING_ENABLED === 'true';
  const LLM_TARGET_CHUNK_SIZE = validateNumber(env.LLM_TARGET_CHUNK_SIZE, 'LLM_TARGET_CHUNK_SIZE', 1000);
  const LLM_CHUNK_OVERLAP = validateNumber(env.LLM_CHUNK_OVERLAP, 'LLM_CHUNK_OVERLAP', 100);
  const LLM_MAX_CHUNKS = env.LLM_MAX_CHUNKS ? Number(env.LLM_MAX_CHUNKS) : undefined;
  const LLM_SPLIT_STRATEGY = (env.LLM_SPLIT_STRATEGY || 'balanced') as 'coherent' | 'topic-based' | 'semantic' | 'balanced';
  const LLM_ENABLE_FALLBACK = env.LLM_ENABLE_FALLBACK !== 'false';
  const LLM_FALLBACK_STRATEGY = (env.LLM_FALLBACK_STRATEGY || 'auto') as 'by_size' | 'by_headings' | 'auto';
  const LLM_MAX_RETRIES = validateNumber(env.LLM_MAX_RETRIES, 'LLM_MAX_RETRIES', 3);
  const LLM_RETRY_DELAY = validateNumber(env.LLM_RETRY_DELAY, 'LLM_RETRY_DELAY', 1000);
  const LLM_ENABLE_CACHE = env.LLM_ENABLE_CACHE !== 'false';
  const LLM_CACHE_TTL = validateNumber(env.LLM_CACHE_TTL, 'LLM_CACHE_TTL', 300000);

  // 数据库配置
  const DB_TYPE = (env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres';

  let dbConfig: AppConfig['db'];

  if (DB_TYPE === 'postgres') {
    const POSTGRES_HOST = validateString(env.POSTGRES_HOST, 'POSTGRES_HOST');
    const POSTGRES_PORT = validateNumber(
      env.POSTGRES_PORT,
      'POSTGRES_PORT',
      5432,
    );
    const POSTGRES_USERNAME = validateString(
      env.POSTGRES_USERNAME,
      'POSTGRES_USERNAME',
    );
    const POSTGRES_PASSWORD = validateString(
      env.POSTGRES_PASSWORD,
      'POSTGRES_PASSWORD',
    );
    const POSTGRES_DATABASE = validateString(
      env.POSTGRES_DATABASE,
      'POSTGRES_DATABASE',
    );
    const POSTGRES_SSL = env.POSTGRES_SSL === 'true';

    dbConfig = {
      type: 'postgres',
      postgres: {
        host: POSTGRES_HOST,
        port: POSTGRES_PORT,
        username: POSTGRES_USERNAME,
        password: POSTGRES_PASSWORD,
        database: POSTGRES_DATABASE,
        ssl: POSTGRES_SSL,
      },
    };
  } else {
    const DB_PATH = validateString(env.DB_PATH, 'DB_PATH');
    dbConfig = {
      type: 'sqlite',
      path: DB_PATH,
    };
  }

  // Qdrant 直读 URL（缺失直接抛错）
  const QDRANT_URL = validateString(env.QDRANT_URL, 'QDRANT_URL');
  const QDRANT_COLLECTION = env.QDRANT_COLLECTION || 'chunks';

  // 数值参数校验
  const VECTOR_SIZE = validateNumber(env.EMBEDDING_DIM, 'EMBEDDING_DIM', 1536);
  const EMBEDDING_BATCH_SIZE = validateNumber(
    env.EMBEDDING_BATCH_SIZE,
    'EMBEDDING_BATCH_SIZE',
    200,
  );

  const API_PORT = validateNumber(env.API_PORT || env.PORT, 'API_PORT', 3000);
  const GC_INTERVAL_HOURS = validateNumber(
    env.GC_INTERVAL_HOURS,
    'GC_INTERVAL_HOURS',
    24,
  );

  return {
    openai: {
      baseUrl: OPENAI_BASE_URL,
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
    },
    llm: {
      provider: LLM_PROVIDER,
      apiKey: LLM_API_KEY,
      baseUrl: LLM_BASE_URL,
      model: LLM_MODEL,
      maxTokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      timeout: LLM_TIMEOUT,
      apiVersion: LLM_API_VERSION,
      organizationId: LLM_ORGANIZATION_ID,
      projectId: LLM_PROJECT_ID,
      deploymentName: LLM_DEPLOYMENT_NAME,
      semanticSplitting: {
        enabled: LLM_SEMANTIC_SPLITTING_ENABLED,
        targetChunkSize: LLM_TARGET_CHUNK_SIZE,
        chunkOverlap: LLM_CHUNK_OVERLAP,
        maxChunks: LLM_MAX_CHUNKS,
        strategy: LLM_SPLIT_STRATEGY,
        enableFallback: LLM_ENABLE_FALLBACK,
        fallbackStrategy: LLM_FALLBACK_STRATEGY,
        maxRetries: LLM_MAX_RETRIES,
        retryDelay: LLM_RETRY_DELAY,
        enableCache: LLM_ENABLE_CACHE,
        cacheTTL: LLM_CACHE_TTL,
      },
    },
    db: dbConfig,
    qdrant: {
      url: QDRANT_URL,
      collection: QDRANT_COLLECTION,
      vectorSize: VECTOR_SIZE,
    },
    embedding: { batchSize: EMBEDDING_BATCH_SIZE },
    api: { port: API_PORT },
    log: {
      level: env.LOG_LEVEL || 'info',
      dirname: env.LOG_DIRNAME || undefined,
      maxFiles: env.LOG_MAX_FILES || undefined,
      maxSize: env.LOG_MAX_SIZE || undefined,
      datePattern: env.LOG_DATE_PATTERN || undefined,
      zippedArchive: env.LOG_ZIP ? env.LOG_ZIP === 'true' : undefined,
      // 增强日志功能配置
      enableTraceId: env.LOG_ENABLE_TRACE_ID
        ? env.LOG_ENABLE_TRACE_ID === 'true'
        : true,
      enableModuleTag: env.LOG_ENABLE_MODULE_TAG
        ? env.LOG_ENABLE_MODULE_TAG === 'true'
        : true,
      enablePerformanceLogging: env.LOG_ENABLE_PERFORMANCE
        ? env.LOG_ENABLE_PERFORMANCE === 'true'
        : true,
      logSlowQueriesThreshold: Number(env.LOG_SLOW_QUERIES_THRESHOLD) || 1000,
    },
    gc: { intervalHours: GC_INTERVAL_HOURS },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED === 'true',
      global: {
        maxTokens: Number(env.RATE_LIMIT_GLOBAL_REQUESTS_PER_MINUTE) || 1000,
        refillRate: Number(env.RATE_LIMIT_GLOBAL_BURST) || 100,
        enabled: env.RATE_LIMIT_GLOBAL_ENABLED !== 'false',
      },
      ip: {
        maxTokens: Number(env.RATE_LIMIT_IP_REQUESTS_PER_MINUTE) || 100,
        refillRate: Number(env.RATE_LIMIT_IP_BURST) || 20,
        enabled: env.RATE_LIMIT_IP_ENABLED !== 'false',
        whitelist: env.RATE_LIMIT_WHITELIST_IPS
          ? env.RATE_LIMIT_WHITELIST_IPS.split(',').map((s) => s.trim())
          : [],
      },
      user: {
        maxTokens: Number(env.RATE_LIMIT_USER_REQUESTS_PER_MINUTE) || 200,
        refillRate: Number(env.RATE_LIMIT_USER_BURST) || 50,
        enabled: env.RATE_LIMIT_USER_ENABLED !== 'false',
      },
      path: {
        maxTokens: Number(env.RATE_LIMIT_PATH_REQUESTS_PER_MINUTE) || 50,
        refillRate: Number(env.RATE_LIMIT_PATH_BURST) || 10,
        enabled: env.RATE_LIMIT_PATH_ENABLED !== 'false',
      },
      search: {
        maxTokens: Number(env.RATE_LIMIT_SEARCH_REQUESTS_PER_MINUTE) || 30,
        refillRate: Number(env.RATE_LIMIT_SEARCH_BURST) || 5,
        enabled: env.RATE_LIMIT_SEARCH_ENABLED !== 'false',
      },
      upload: {
        maxTokens: Number(env.RATE_LIMIT_UPLOAD_REQUESTS_PER_MINUTE) || 10,
        refillRate: Number(env.RATE_LIMIT_UPLOAD_BURST) || 2,
        enabled: env.RATE_LIMIT_UPLOAD_ENABLED !== 'false',
      },
      metrics: {
        enabled: env.RATE_LIMIT_METRICS_ENABLED !== 'false',
        retentionPeriod:
          (Number(env.RATE_LIMIT_METRICS_RETENTION_HOURS) || 24) *
          60 *
          60 *
          1000, // 转换为毫秒
        cleanupInterval:
          (Number(env.RATE_LIMIT_CLEANUP_INTERVAL_MINUTES) || 60) * 60 * 1000, // 转换为毫秒
      },
      middleware: {
        includeHeaders: env.RATE_LIMIT_INCLUDE_HEADERS !== 'false',
        logEvents: env.RATE_LIMIT_LOG_EVENTS !== 'false',
        logOnlyBlocked: env.RATE_LIMIT_LOG_ONLY_BLOCKED !== 'false',
        errorMessage:
          env.RATE_LIMIT_ERROR_MESSAGE || '请求过于频繁，请稍后再试',
        skipHealthCheck: env.RATE_LIMIT_SKIP_HEALTH_CHECK !== 'false',
        skipOptions: env.RATE_LIMIT_SKIP_OPTIONS !== 'false',
      },
    },
  };
}
