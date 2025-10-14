import { QdrantClient } from '@qdrant/js-client-rest';
import { validateConfig, AppConfig } from './config.js';

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
  // 校验已存在集合的向量维度是否与配置一致
  try {
    const info = await client.getCollection(collectionName());
    // 兼容不同版本返回结构，尽力取到 size
    const actualSize =
      (info as any)?.result?.config?.params?.vectors?.size ??
      (info as any)?.result?.vectors?.size ??
      (info as any)?.result?.config?.vectors?.size;

    if (actualSize && actualSize !== config.qdrant.vectorSize) {
      throw new Error(
        `Qdrant collection "${collectionName()}" vector size mismatch: ` +
          `expected ${config.qdrant.vectorSize}, got ${actualSize}`,
      );
    }
  } catch (err) {
    console.warn('ensureCollection: could not verify vector size', err);
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
  contentHash?: string;
}

export async function upsertChunks(chunks: ChunkWithVector[]) {
  if (!chunks?.length) {
    console.log('No chunks to upsert.');
    return;
  }
  if (!config) config = validateConfig(); // Ensure config is loaded
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    for (const c of batch) {
      if (!c.pointId) c.pointId = `${c.docId}#${c.chunkIndex}`;
    }
    const points = batch.map((c) => ({
      id: c.pointId ?? `${c.docId}#${c.chunkIndex}`,
      vector: c.vector,
      payload: {
        content: c.content,
        titleChain: Array.isArray(c.titleChain)
          ? c.titleChain.join(' > ')
          : c.titleChain,
        source: c.source,
        contentHash: (c as any).contentHash,
        docId: c.docId,
        versionId: c.versionId,
        collectionId: c.collectionId,
        chunkIndex: c.chunkIndex,
      },
    }));

    try {
      await getQdrantClient().upsert(collectionName(), { wait: true, ordering : "medium", points });
    } catch (e) {
      console.error(
        `Error upserting batch ${Math.floor(i / BATCH) + 1}:`,
        e as Error,
      );
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
    const res: any = await getQdrantClient().search(collectionId, {
      vector,
      limit,
      filter,
      with_payload: true,
    });
    const items = Array.isArray(res) ? res : (res?.result ?? []);
    return items.map((item: any) => ({
      pointId: item.id as string,
      score: item.score,
      content: item.payload?.content,
      titleChain: item.payload?.titleChain,
      docId: item.payload?.docId,
      versionId: item.payload?.versionId,
      collectionId: item.payload?.collectionId,
      chunkIndex: item.payload?.chunkIndex,
    }));
  } catch (e) {
    console.error('Error searching Qdrant:', e as Error);
    return [];
  }
}

export async function deletePointsByDoc(docId: string) {
  if (!docId) return;
  // 测试环境不触发真实删除
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;
  if (!config) config = validateConfig();
  try {
    await getQdrantClient().delete(collectionName(), {
      wait: true,
      filter: { must: [{ key: 'docId', match: { value: docId } }] },
    });
  } catch (e) {
    console.warn('deletePointsByDoc: failed to delete points', docId, e);
  }
}
