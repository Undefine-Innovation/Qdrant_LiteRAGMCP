import dotenv from 'dotenv';

/**
 * Interface for the application configuration object.
 */
export type AppConfig = {
  openai: { baseUrl: string; apiKey: string; model: string };
  db: { path: string };
  qdrant: { url: string; collection: string; vectorSize: number };
  embedding: { batchSize: number };
};

export function validateConfig(env = process.env): AppConfig {
  const errs: string[] = [];
  let OPENAI_API_KEY = env.OPENAI_API_KEY;
  const OPENAI_BASE_URL = env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  // 优先使用环境变量 OPENAI_MODEL，且不被默认覆盖
  const OPENAI_MODEL = env.OPENAI_MODEL || env.EMBEDDING_MODEL_NAME || "text-embedding-ada-002";
  const DB_PATH = env.DB_PATH;
  const QDRANT_URL = env.QDRANT_URL;
  const QDRANT_COLLECTION = env.QDRANT_COLLECTION || "chunks";
  const VECTOR_SIZE = Number(env.EMBEDDING_DIM || 1536);
  // 统一默认 EMBEDDING_BATCH_SIZE 为 200
  const EMBEDDING_BATCH_SIZE = Number(env.EMBEDDING_BATCH_SIZE || 200);

  // 去除API Key可能的引号
  if (OPENAI_API_KEY) {
    OPENAI_API_KEY = OPENAI_API_KEY.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }

  // 校验顺序固定为 OPENAI_API_KEY → QDRANT_URL → DB_PATH ...
  if (!OPENAI_API_KEY) errs.push("Missing OPENAI_API_KEY");
  if (!QDRANT_URL) errs.push("Missing QDRANT_URL");
  if (!DB_PATH) errs.push("Missing DB_PATH");
  if (!Number.isInteger(VECTOR_SIZE) || VECTOR_SIZE <= 0) errs.push("Invalid EMBEDDING_DIM");
  if (!Number.isInteger(EMBEDDING_BATCH_SIZE) || EMBEDDING_BATCH_SIZE <= 0) errs.push("Invalid EMBEDDING_BATCH_SIZE");

  if (errs.length) {
    // 与测试期望对齐：抛出统一可读错误，逗号分隔，无句号
    throw new Error(`validateConfig: ${errs.join(", ")}`);
  }

  return {
    openai: { baseUrl: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY!, model: OPENAI_MODEL },
    db: { path: DB_PATH! },
    qdrant: { url: QDRANT_URL!, collection: QDRANT_COLLECTION, vectorSize: VECTOR_SIZE },
    embedding: { batchSize: EMBEDDING_BATCH_SIZE },
  };
}