import { DB } from './db.js'; // ChunksDatabase is default export
import { createEmbedding } from './embedding.js';
import { search as qdrantSearch } from './qdrant.js';
import { validateConfig, AppConfig } from './config.js'; // Import config

let config: AppConfig; // Declare config as a mutable variable
let dbInstance: DB; // Declare dbInstance as a mutable variable

interface QdrantPayload {
  content?: string; // Make content optional
  source?: string; // Make source optional
  titleChain?: string;
  docId?: string;
  versionId?: string;
  chunkIndex?: number;
  collectionId?: string;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: QdrantPayload;
  vector?: number[];
}

// Unified Search Result Interface
export interface UnifiedSearchResult {
  pointId: string;
  content: string;
  title?: string;
  source: string;
  score: number;
  versionId: string; // Made required
  docId: string; // Made required
  chunkIndex: number; // Made required, compatible with DBSearchResult
  is_current?: boolean;
  type: 'keyword' | 'semantic';
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm to combine search results.
 * 倒数排名融合 (RRF) 算法，用于合并搜索结果。
 * @param {UnifiedSearchResult[][]} results - An array of result lists from different search methods. / 来自不同搜索方法的结果列表数组。
 * @param {number} k - A constant for rank scaling. / 用于排名缩放的常数。
 * @returns {UnifiedSearchResult[]} A combined and re-ranked list of results. / 合并并重新排名的结果列表。
 */
export function reciprocalRankFusion(
  results: UnifiedSearchResult[][],
  k: number = 60,
): UnifiedSearchResult[] {
  const fused: Record<string, { score: number; base: UnifiedSearchResult }> =
    {};

  results.forEach((list) => {
    list.forEach((r, idx) => {
      const rank = idx + 1;
      const inc = 1 / (k + rank);
      if (!fused[r.pointId]) fused[r.pointId] = { score: 0, base: { ...r } };
      fused[r.pointId].score += inc;
    });
  });

  return Object.values(fused)
    .sort((a, b) => b.score - a.score)
    .map(({ score, base }) => ({ ...base, score })); // ← 把融合分写回 score
}

/**
 * The main function to run a search query.
 * 运行搜索查询的主函数。
 * @param {string} query - The search query text. / 搜索查询文本。
 * @param {string} collectionId - The ID of the collection to search within. / 要搜索的集合的ID。
 * @param {number} [limit=10] - The maximum number of results to return. / 返回结果的最大数量。
 * @param {boolean} [latestOnly=false] - Whether to search only the latest version. / 是否只搜索最新版本。
 */
export async function runSearch(
  query: string,
  collectionId: string,
  limit: number = 10,
  latestOnly: boolean = false,
  filters?: { [key: string]: any },
): Promise<UnifiedSearchResult[]> {
  if (!config) config = validateConfig(); // Ensure config is loaded
  if (!dbInstance) dbInstance = new DB(config.db.path); // Ensure db is initialized

  if (!query?.trim()) {
    console.error('Please provide a search query.');
    return [];
  }
  if (!collectionId?.trim()) {
    console.error('Please provide a collection ID.');
    return [];
  }

  // 关键词检索 -> 统一结构
  const kwRows =
    dbInstance.searchKeyword({
      collectionId,
      query,
      limit,
      latestOnly,
      filters,
    }) ?? [];
  const keywordResults: UnifiedSearchResult[] = kwRows.map((r: any) => ({
    pointId: String(r.pointId ?? r.id),
    content: r.content,
    source: r.sourcePath ?? r.source,
    score: 0,
    type: 'keyword',
    versionId: r.versionId, // 添加 versionId
    docId: r.docId, // 添加 docId
    chunkIndex: r.chunkIndex, // 添加 chunkIndex
  }));

  // 语义检索（可选）
  let semanticResults: UnifiedSearchResult[] = [];
  const vec = await createEmbedding(query, { forceLive: true });
  if (!vec) {
    console.warn(
      'Failed to create embedding for semantic search. Skipping semantic search.',
    );
  } else {
    // ✅ 与测试期望一致的调用形状
    const raw = (await qdrantSearch(collectionId, {
      vector: vec,
      limit,
      filter: latestOnly ? { latestOnly: true } : undefined,
    })) as { points?: any[] } | any[];
    // ✅ 兼容两种返回形状
    const points = Array.isArray(raw) ? raw : (raw.points ?? []);

    const pointIds = points.map((x: any) => String(x.pointId ?? x.id));
    const chunks =
      dbInstance.getChunksByPointIds(pointIds, collectionId, latestOnly) ?? [];

    const scoreById = new Map<string, number>(
      points.map((x: any) => [String(x.pointId ?? x.id), Number(x.score) || 0]),
    );

    semanticResults = chunks.map((c: any) => ({
      pointId: String(c.pointId ?? c.id),
      content: c.content,
      source: c.source ?? c.sourcePath,
      score: scoreById.get(String(c.pointId ?? c.id)) ?? 0,
      type: 'semantic',
      versionId: c.versionId,
      docId: c.docId,
      chunkIndex: c.chunkIndex,
    }));
  }

  const fused = reciprocalRankFusion([keywordResults, semanticResults]);
  if (fused.length === 0) {
    console.log('No results found.');
  } else {
    console.log('--- Top Fused Search Results ---');
    // 如需打印类型/内容，留痕即可
    fused.slice(0, Math.min(fused.length, 50)).forEach((r) => {
      console.log(`Type: ${r.type} | ${r.content?.slice(0, 80) ?? ''}`);
    });
  }
  return fused;
}
