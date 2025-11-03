import dotenv from 'dotenv';
dotenv.config();
/**
 * Interface for application configuration object.
 */
export type AppConfig = {
  openai: { baseUrl: string; apiKey: string; model: string };
  db: { path: string };
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

  const DB_PATH = validateString(env.DB_PATH, 'DB_PATH');

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
    db: { path: DB_PATH },
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
    },
    gc: { intervalHours: GC_INTERVAL_HOURS },
  };
}
