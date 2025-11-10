import dotenv from 'dotenv';
dotenv.config();
/**
 * 应用程序配置对象的接口定义
 */
export type AppConfig = {
  openai: { baseUrl: string; apiKey: string; model: string };
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
  };
}
