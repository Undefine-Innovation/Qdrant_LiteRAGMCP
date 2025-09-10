import OpenAI from 'openai';
import { validateConfig, AppConfig } from '../config.js'; // Import AppConfig type
import { DocumentChunk } from './splitter.js'; // Import the DocumentChunk interface
import { Chunk, ChunkWithVector } from './db.js'; // Import Chunk and ChunkWithVector interfaces

/**
 * Creates an embedding for a single text chunk.
 * 为单个文本块创建向量。
 * @param {string} text - The text to embed. / 要进行向量化的文本。
 * @returns {Promise<number[] | null>} A promise that resolves to the embedding vector, or null if it fails. / 一个解析为向量数组的 Promise，如果失败则为 null。
 */
import { warn, error } from './logger.js';

export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!text) {
    warn('Skipping embedding for empty text.');
    return null;
  }
  const cfg: AppConfig = validateConfig();
  const openai = new OpenAI({ apiKey: cfg.openai.apiKey, baseURL: cfg.openai.baseUrl });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.embeddings.create({ model: cfg.openai.model, input: text });
      return response.data[0].embedding;
    } catch (err) {
      error('Error creating embedding:', err);
      if (attempt === maxRetries) {
        return null;
      }
      // 等待一段时间后重试，避免短暂网络或认证问题
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return null;
}

/**
 * Creates embeddings for an array of document chunks.
 * 为文档块数组创建向量。
 * @param {Chunk[]} chunks - The array of document chunks. / 文档块数组。
 * @returns {Promise<ChunkWithVector[]>} A promise that resolves to an array of chunks with their corresponding vectors. / 一个解析为带有向量的块数组的 Promise。
 */
export async function embedChunks(chunks: Chunk[]): Promise<ChunkWithVector[]> {
  if (chunks.length === 0) {
    return [];
  }

  const cfg: AppConfig = validateConfig();
  const openai = new OpenAI({ apiKey: cfg.openai.apiKey, baseURL: cfg.openai.baseUrl });
  const BATCH_SIZE = cfg.embedding.batchSize;
  const chunksWithEmbeddings: ChunkWithVector[] = [];

  const maxRetries = 3;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(chunk => chunk.content);

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
              vector
            });
          } else {
            warn(`Skipping chunk in batch ${Math.floor(i / BATCH_SIZE)} at index ${j} due to missing embedding.`);
          }
        }
        success = true;
        break;
      } catch (err) {
        error(`Error creating embeddings for batch ${Math.floor(i / BATCH_SIZE)} (attempt ${attempt}):`, err);
        if (attempt === maxRetries) {
          // 最后一次失败，跳过该批次
          break;
        }
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }
    if (!success) {
      warn(`Failed to create embeddings for batch ${Math.floor(i / BATCH_SIZE)} after ${maxRetries} attempts.`);
    }
  }
  return chunksWithEmbeddings;
}