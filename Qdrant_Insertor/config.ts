import dotenv from "dotenv";

/**
 * Interface for the application configuration object.
 */
export type AppConfig = {
  openai: { baseUrl: string; apiKey: string; model: string };
  db: { path: string };
  qdrant: { url: string; collection: string; vectorSize: number };
  embedding: { batchSize: number };
};

/**
 * 校验字符串参数，确保非空，并去除可能的引号
 */
function validateString(value: any, name: string): string {
  if (!value || String(value).trim() === "") {
    throw new Error(`validateConfig: Missing ${name}`);
  }
  return String(value)
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
}

/**
 * 校验数值参数，确保为正整数
 */
function validateNumber(value: any, name: string, defaultValue: number): number {
  const num = Number(value ?? defaultValue);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new Error(`validateConfig: Invalid ${name}`);
  }
  return num;
}

/**
 * 读取并校验配置
 */
export function validateConfig(env = process.env): AppConfig {
  const OPENAI_API_KEY = validateString(env.OPENAI_API_KEY, "OPENAI_API_KEY");
  const OPENAI_BASE_URL = env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const OPENAI_MODEL =
    env.OPENAI_MODEL || env.EMBEDDING_MODEL_NAME || "text-embedding-ada-002";

  const DB_PATH = validateString(env.DB_PATH, "DB_PATH");

  // Qdrant 地址拼接
  const QDRANT_URL = `${env.QDRANT_PROTOCOL || "http"}://${
    env.QDRANT_HOST || "localhost"
  }:${env.QDRANT_PORT || "6333"}`;
  const QDRANT_COLLECTION = env.QDRANT_COLLECTION || "chunks";

  // 数值参数校验
  const VECTOR_SIZE = validateNumber(env.EMBEDDING_DIM, "EMBEDDING_DIM", 1536);
  const EMBEDDING_BATCH_SIZE = validateNumber(
    env.EMBEDDING_BATCH_SIZE,
    "EMBEDDING_BATCH_SIZE",
    200
  );

  return {
    openai: { baseUrl: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY, model: OPENAI_MODEL },
    db: { path: DB_PATH },
    qdrant: { url: QDRANT_URL, collection: QDRANT_COLLECTION, vectorSize: VECTOR_SIZE },
    embedding: { batchSize: EMBEDDING_BATCH_SIZE },
  };
}
