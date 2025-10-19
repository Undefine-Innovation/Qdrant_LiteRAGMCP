import { IEmbeddingProvider } from '../domain/embedding.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import {
  CollectionId,
  PointId,
  Chunk,
  SearchResult as UniversalSearchResult,
} from '@domain/types.js';
import { FtsResult } from '../infrastructure/sqlite/dao/ChunksFts5Table.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js'; // Import IQdrantRepo
import { ISearchService } from '../domain/ISearchService.js'; // Import ISearchService

// This will be the final search result structure
export interface SearchResult extends Chunk {
  score: number;
  type?: 'keyword' | 'semantic' | 'fused';
}

// A temporary internal structure for fusion
interface FusionCandidate {
  pointId: PointId;
  score: number; // Original score for semantic, 0 for keyword
  type: 'keyword' | 'semantic';
}

interface FusedResult {
  pointId: PointId;
  score: number; // RRF score
}

export class SearchService implements ISearchService { // Implement ISearchService
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo, // Changed to IQdrantRepo
    private readonly logger: Logger,
  ) {}

  /**
   * Reciprocal Rank Fusion (RRF) algorithm to combine search results.
   * @param results - An array of result lists from different search methods.
   * @param k - A constant for rank scaling.
   * @returns A combined and re-ranked list of results.
   */
  private _reciprocalRankFusion(
    results: FusionCandidate[][],
    k: number = 60,
  ): FusedResult[] {
    const fused: Record<string, { score: number }> = {};

    results.forEach((list) => {
      list.forEach((r, idx) => {
        const rank = idx + 1;
        const inc = 1 / (k + rank);
        if (!fused[r.pointId]) {
          fused[r.pointId] = { score: 0 };
        }
        fused[r.pointId].score += inc;
      });
    });

    return Object.entries(fused)
      .map(([pointId, { score }]) => ({
        pointId: pointId as PointId,
        score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  public async search(
    query: string,
    collectionId: CollectionId,
    options: { limit?: number } = {},
  ): Promise<UniversalSearchResult[]> {
    const { limit = 10 } = options;

    this.logger.info(
      `Starting search for query "${query}" in collection "${collectionId}" with limit ${limit}.`,
    );

    try {
      // 1. Generate query vector
      const [queryVector] = await this.embeddingProvider.generate([query]);
      if (!queryVector || queryVector.length === 0) {
        this.logger.warn(
          'Failed to generate embedding for query. Semantic search will be skipped.',
        );
        // Fallback to keyword search only
        const kwResults = this.sqliteRepo.chunksFts5.search(query, collectionId, limit);
        if (!kwResults) return [];

        // If semantic search fails, return keyword results with a default score
        return kwResults.map(r => ({ ...r, score: 0 }));
      }

      // 2. Parallel search
      const [keywordResults, semanticResults] = await Promise.all([
        // a. Keyword search
        this.sqliteRepo.chunksFts5.search(query, collectionId, limit),
        // b. Vector search
        this.qdrantRepo.search(collectionId, { vector: queryVector, limit }),
      ]);

      const kwCandidates: FusionCandidate[] = (keywordResults ?? []).map(
        (r: FtsResult) => ({
          pointId: r.pointId,
          score: 0, // FTS5 rank is not directly comparable, RRF uses position
          type: 'keyword',
        }),
      );

      const semCandidates: FusionCandidate[] = (semanticResults ?? []).map(
        (p) => ({
          pointId: p.pointId as PointId,
          score: p.score ?? 0, // Ensure score is always a number
          type: 'semantic',
        }),
      );

      // 3. Reciprocal Rank Fusion
      const fused = this._reciprocalRankFusion([kwCandidates, semCandidates]);
      const fusedPointIds = fused.map((r) => r.pointId);

      if (fusedPointIds.length === 0) {
        this.logger.info('No results found after fusion.');
        return [];
      }

      // 4. Get chunk details
      const chunks = this.sqliteRepo.getChunksByPointIds(
        fusedPointIds,
        collectionId,
      );
      const chunksMap = new Map(chunks.map((c) => [c.pointId, c]));

      // 5. Format and return
      const finalResults: UniversalSearchResult[] = fused
        .map((fusedResult) => {
          const chunk = chunksMap.get(fusedResult.pointId);
          if (!chunk) return null;
          return {
            ...chunk,
            score: fusedResult.score, // score is guaranteed by _reciprocalRankFusion
          };
        })
        .filter((r): r is Chunk & { score: number } => r !== null)
        .map(r => ({...r, score: r.score}));

      this.logger.info(`Found ${finalResults.length} results for query "${query}".`);
      return finalResults.slice(0, limit);
    } catch (err) {
      this.logger.error(`An error occurred during search for query "${query}":`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        collectionId,
      });
      throw err; // Re-throw to be handled by the API error middleware
    }
  }
}