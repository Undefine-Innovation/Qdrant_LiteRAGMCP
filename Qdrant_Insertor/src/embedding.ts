import { validateConfig, AppConfig } from '../config.js'; // Import AppConfig type
import { ChunkMeta, ChunkWithVector } from '../share/type.js';

/**
 * Creates an embedding for a single text chunk.
 * 为单个文本块创建向量。
 * @param {string} text - The text to embed. / 要进行向量化的文本。
 * @returns {Promise<number[] | null>} A promise that resolves to the embedding vector, or null if it fails. / 一个解析为向量数组的 Promise，如果失败则为 null。
 */
import { warn, error } from './logger.js';
import { getEmbeddingMock } from './mock-registry.js';

type OpenAIConstructor = typeof import('openai').default;

type CreateEmbeddingOptions = {
  forceLive?: boolean;
};

async function createOpenAIClient(cfg: AppConfig) {
  const mod = (await import('openai')) as { default: OpenAIConstructor } & Record<string, any>;
  const OpenAI = mod.default;
  return new OpenAI({
    apiKey: cfg.openai.apiKey,
    baseURL: cfg.openai.baseUrl,
  });
}

// 重载声明
export async function createEmbedding(
  text: string,
  options?: CreateEmbeddingOptions,
): Promise<number[] | null>;
export async function createEmbedding(
  texts: string[],
  options?: CreateEmbeddingOptions,
): Promise<number[][] | null>;

// 实现：同时支持 string 与 string[]
export async function createEmbedding(
  input: string | string[],
  options: CreateEmbeddingOptions = {},
): Promise<number[] | number[][] | null> {
  const { forceLive = false } = options;
  // 空值处理
  if (Array.isArray(input)) {
    const texts = input.filter(
      (t) => typeof t === 'string' && t.trim().length > 0,
    );
    if (texts.length === 0) {
      warn('Skipping embedding for empty text array.');
      return [];
    }
  } else {
    if (!input || input.trim() === '') {
      warn('Skipping embedding for empty text.');
      return null;
    }
  }

  const cfg: AppConfig = validateConfig();

  const mockImpl = getEmbeddingMock();
  if (mockImpl) {
    try {
      const result = await mockImpl(input, options);
      return result;
    } catch (err) {
      error('Error using embedding mock:', err);
      return Array.isArray(input) ? [] : null;
    }
  }

  const isTestEnv =
    process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const isMockKey = /^test/i.test(cfg.openai.apiKey ?? '');

  if (!forceLive && (isTestEnv || isMockKey)) {
    const zeroLength = 1536;
    const makeZeroVector = () => new Array(zeroLength).fill(0);
    if (Array.isArray(input)) {
      return input.map(() => makeZeroVector());
    }
    return makeZeroVector();
  }

  const openai = await createOpenAIClient(cfg);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: cfg.openai.model,
        input, // 直接传 string 或 string[]
      });

      if (Array.isArray(input)) {
        const data = response.data ?? [];
        const first = data[0]?.embedding;
        if (!first) return [];
        // 若返回条目不足，使用第一条 embedding 兜底补齐
        const out: number[][] = input.map(
          (_, idx) => data[idx]?.embedding ?? first,
        );
        return out;
      } else {
        return response.data?.[0]?.embedding ?? null;
      }
    } catch (err) {
      error('Error creating embedding:', err);
      if (attempt === maxRetries) {
        return Array.isArray(input) ? [] : null;
      }
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return Array.isArray(input) ? [] : null;
}

/**
 * Creates embeddings for an array of document chunks.
 * 为文档块数组创建向量。
 * @param {Chunk[]} chunks - The array of document chunks. / 文档块数组。
 * @returns {Promise<ChunkWithVector[]>} A promise that resolves to an array of chunks with their corresponding vectors. / 一个解析为带有向量的块数组的 Promise。
 */
export async function embedChunks(chunks: ChunkMeta[]): Promise<ChunkWithVector[]> {
  if (chunks.length === 0) {
    return [];
  }

  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve(
      chunks.map((chunk) => ({
        ...chunk,
        vector: new Array(1536).fill(0),
      })),
    );
  }

  const cfg: AppConfig = validateConfig();
  const openai = await createOpenAIClient(cfg);
  const BATCH_SIZE = cfg.embedding.batchSize;
  const chunksWithEmbeddings: ChunkWithVector[] = [];

  const maxRetries = 3;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((chunk) => (chunk as any).content);

    let success = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await openai.embeddings.create({
          model: cfg.openai.model,
          input: texts,
        });

        for (let j = 0; j < batch.length; j++) {
          const vector = response.data[j]?.embedding;
          if (vector) {
            chunksWithEmbeddings.push({
              ...batch[j],
              vector,
            });
          } else {
            warn(
              `Skipping chunk in batch ${Math.floor(i / BATCH_SIZE)} at index ${j} due to missing embedding.`,
            );
          }
        }
        success = true;
        break;
      } catch (err) {
        error(
          `Error creating embeddings for batch ${Math.floor(i / BATCH_SIZE)} (attempt ${attempt}):`,
          err,
        );
        if (attempt === maxRetries) {
          // 最后一次失败，跳过该批次
          break;
        }
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
    if (!success) {
      warn(
        `Failed to create embeddings for batch ${Math.floor(i / BATCH_SIZE)} after ${maxRetries} attempts.`,
      );
    }
  }
  return chunksWithEmbeddings;
}
