import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import {
  CollectionId,
  PointId,
  DocId,
  Chunk,
  SearchResult as UniversalSearchResult,
  RetrievalResultDTO,
  RetrievalResultType,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js'; // Import IQdrantRepo
import { ISearchService } from '@domain/repositories/ISearchService.js'; // Import ISearchService
import {
  parsePaginationQuery,
  createPaginatedResponse,
} from '../../utils/pagination.js';

// 定义FtsResult接口，避免直接依赖Infrastructure层
/**
 *
 */
interface FtsResult {
  pointId: PointId;
  docId: DocId;
  collectionId?: CollectionId;
  chunkIndex: number;
  content: string;
  title?: string;
  titleChain?: string;
  score?: number;
}

// This will be final search result structure
/**
 *
 */
export interface SearchResult extends Chunk {
  score: number;
  type?: 'keyword' | 'semantic' | 'fused';
}

// A temporary internal structure for fusion
/**
 *
 */
interface FusionCandidate {
  pointId: PointId;
  score: number; // Original score for semantic, 0 for keyword
  type: 'keyword' | 'semantic';
}

/**
 *
 */
interface FusedResult {
  pointId: PointId;
  score: number; // RRF score
}

/**
 *
 */
export class SearchService implements ISearchService {
  // Implement ISearchService
  /**
   *
   * @param embeddingProvider
   * @param sqliteRepo
   * @param qdrantRepo
   * @param logger
   */
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly sqliteRepo: ISQLiteRepo,
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

  /**
   *
   * @param query
   * @param collectionId
   * @param options
   * @param options.limit
   */
  public async search(
    query: string,
    collectionId: CollectionId,
    options: { limit?: number } = {},
  ): Promise<RetrievalResultDTO[]> {
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
        const kwResults = this.sqliteRepo.chunksFts5.search(
          query,
          collectionId,
          limit,
        );
        if (!kwResults) return [];

        // If semantic search fails, return keyword results as RetrievalResultDTO
        return kwResults.map((r: FtsResult) => ({
          type: 'chunkResult' as RetrievalResultType,
          score: 0,
          content: r.content,
          metadata: {
            pointId: r.pointId,
            docId: r.docId,
            collectionId: r.collectionId,
            chunkIndex: r.chunkIndex,
            titleChain: r.titleChain,
            title: r.title,
          },
        }));
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

      // 5. Format and return as RetrievalResultDTO
      const finalResults: RetrievalResultDTO[] = [];
      for (const fusedResult of fused) {
        const chunk = chunksMap.get(fusedResult.pointId);
        if (!chunk) continue;

        // Convert chunk to RetrievalResultDTO format
        finalResults.push({
          type: 'chunkResult' as RetrievalResultType,
          score: fusedResult.score,
          content: chunk.content,
          metadata: {
            pointId: chunk.pointId,
            docId: chunk.docId,
            collectionId: chunk.collectionId,
            chunkIndex: chunk.chunkIndex,
            titleChain: chunk.titleChain,
            title: chunk.title,
          },
        });
      }

      this.logger.info(
        `Found ${finalResults.length} results for query "${query}".`,
      );
      return finalResults.slice(0, limit);
    } catch (err) {
      this.logger.error(
        `An error occurred during search for query "${query}":`,
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          collectionId,
        },
      );
      throw err; // Re-throw to be handled by API error middleware
    }
  }

  /**
   *
   * @param query
   * @param collectionId
   * @param paginationQuery
   */
  public async searchPaginated(
    query: string,
    collectionId: CollectionId | undefined,
    paginationQuery: PaginationQuery,
  ): Promise<PaginatedResponse<RetrievalResultDTO>> {
    const { page, limit } = parsePaginationQuery(paginationQuery);

    this.logger.info(
      `Starting paginated search for query "${query}" in collection "${collectionId}" with page ${page} and limit ${limit}.`,
    );

    try {
      // 1. Generate query vector
      const [queryVector] = await this.embeddingProvider.generate([query]);
      if (!queryVector || queryVector.length === 0) {
        this.logger.warn(
          'Failed to generate embedding for query. Semantic search will be skipped.',
        );
        // Fallback to keyword search only
        const kwResults = this.sqliteRepo.chunksFts5.search(
          query,
          collectionId || ('' as CollectionId),
          limit * page, // Get more results to calculate pagination
        );
        if (!kwResults) {
          return createPaginatedResponse([], 0, paginationQuery);
        }

        // Calculate pagination for keyword-only results
        const total = kwResults.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedResults = kwResults.slice(startIndex, endIndex);

        // Convert to RetrievalResultDTO format
        const formattedResults = paginatedResults.map((r: FtsResult) => ({
          type: 'chunkResult' as RetrievalResultType,
          score: 0,
          content: r.content,
          metadata: {
            pointId: r.pointId,
            docId: r.docId,
            collectionId: r.collectionId,
            chunkIndex: r.chunkIndex,
            titleChain: r.titleChain,
            title: r.title,
          },
        }));

        return createPaginatedResponse(
          formattedResults,
          total,
          paginationQuery,
        );
      }

      // 2. Parallel search with larger limit to get more results for pagination
      const searchLimit = limit * page; // Get enough results to calculate pagination
      const [keywordResults, semanticResults] = await Promise.all([
        // a. Keyword search
        this.sqliteRepo.chunksFts5.search(
          query,
          collectionId || ('' as CollectionId),
          searchLimit,
        ),
        // b. Vector search - only if collectionId is provided
        collectionId
          ? this.qdrantRepo.search(collectionId, {
              vector: queryVector,
              limit: searchLimit,
            })
          : Promise.resolve([]),
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
        return createPaginatedResponse([], 0, paginationQuery);
      }

      // 4. Get chunk details for all fused results
      const chunks = this.sqliteRepo.getChunksByPointIds(
        fusedPointIds,
        collectionId || ('' as CollectionId),
      );
      const chunksMap = new Map(chunks.map((c) => [c.pointId, c]));

      // 5. Format all results as RetrievalResultDTO
      const allResults: RetrievalResultDTO[] = [];
      for (const fusedResult of fused) {
        const chunk = chunksMap.get(fusedResult.pointId);
        if (!chunk) continue;

        // Convert chunk to RetrievalResultDTO format
        allResults.push({
          type: 'chunkResult' as RetrievalResultType,
          score: fusedResult.score,
          content: chunk.content,
          metadata: {
            pointId: chunk.pointId,
            docId: chunk.docId,
            collectionId: chunk.collectionId,
            chunkIndex: chunk.chunkIndex,
            titleChain: chunk.titleChain,
            title: chunk.title,
          },
        });
      }

      // 6. Apply pagination to final results
      const total = allResults.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = allResults.slice(startIndex, endIndex);

      this.logger.info(
        `Found ${total} total results for query "${query}", returning ${paginatedResults.length} for page ${page}.`,
      );

      return createPaginatedResponse(paginatedResults, total, paginationQuery);
    } catch (err) {
      this.logger.error(
        `An error occurred during search for query "${query}":`,
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          collectionId,
        },
      );
      // Return empty results instead of throwing error to ensure API always returns a response
      return createPaginatedResponse([], 0, paginationQuery);
    }
  }
}