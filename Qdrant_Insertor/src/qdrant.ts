import { QdrantClient } from '@qdrant/js-client-rest';
import { validateConfig, AppConfig } from '../config.js';

let config: AppConfig; // Declare config as a mutable variable

export const collectionName = () => {
  if (!config) config = validateConfig();
  return config.qdrant.collection;
};

let qdrantClientInstance: QdrantClient;

function getQdrantClient(): QdrantClient {
  if (!qdrantClientInstance) {
    if (!config) config = validateConfig();
    qdrantClientInstance = new QdrantClient({
      url: config.qdrant.url ?? 'http://localhost:6333',
      checkCompatibility: false,
    });
  }
  return qdrantClientInstance;
}

export async function ensureCollection() {
  if (!config) config = validateConfig(); // Ensure config is loaded
  const client = getQdrantClient();
  let collections;
  try {
    const result = await client.getCollections();
    collections = result.collections ?? [];
  } catch (e) {
    // GET 失败，尝试创建
    try {
      await client.createCollection(collectionName(), {
        vectors: { size: config.qdrant.vectorSize, distance: 'Cosine' },
      });
    } catch (err) {
      throw new Error('Failed to create collection');
    }
    // 创建后再次 GET
    try {
      const verify = await client.getCollections();
      collections = verify.collections ?? [];
    } catch (err) {
      throw new Error('Failed to verify collection after creation');
    }
  }
  const exists = collections.some((c: any) => c.name === collectionName());
  if (!exists) {
    try {
      await client.createCollection(collectionName(), {
        vectors: { size: config.qdrant.vectorSize, distance: 'Cosine' },
      });
    } catch (err) {
      throw new Error('Failed to create collection');
    }
  }
}

const BATCH = 100;

export interface ChunkWithVector {
  collectionId: string;
  versionId: string;
  docId: string;
  chunkIndex: number;
  content: string;
  titleChain?: string | string[]; // 兼容两种来源
  vector: number[];
  pointId?: string;
  source?: string;
}

export async function upsertChunks(chunks: ChunkWithVector[]) {
  if (!chunks?.length) {
    console.log('No chunks to upsert.');
    return;
  }
  if (!config) config = validateConfig(); // Ensure config is loaded
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const points = batch.map((c) => ({
      id: c.pointId ?? `${c.docId}#${c.chunkIndex}`,
      vector: c.vector,
      payload: {
        content: c.content,
        titleChain: Array.isArray(c.titleChain) ? c.titleChain.join(' > ') : c.titleChain,
        source: c.source,
        docId: c.docId,
        versionId: c.versionId,
        chunkIndex: c.chunkIndex,
      },
    }));

    try {
      await getQdrantClient().upsert(collectionName(), { wait: true, points });
    } catch (e) {
      console.error(`Error upserting batch ${Math.floor(i / BATCH) + 1}:`, e as Error);
    }
  }
}

export async function search(
  collectionId: string,
  opts: { vector: number[]; limit?: number; filter?: any },
) {
  const { vector, limit = 10, filter } = opts;
  if (!vector?.length) {
    console.error('Cannot search with an empty vector.');
    return [];
  }
  if (!config) config = validateConfig();

  try {
    return await getQdrantClient().search(collectionId, {
      vector,
      limit,
      filter,             // 👈 保持 filter 传递，测试断言里需要
      with_payload: true,
    });
  } catch (e) {
    console.error('Error searching Qdrant:', e as Error);
    return [];
  }
}
