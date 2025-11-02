import { QdrantClient } from '@qdrant/js-client-rest';
import type { Schemas } from '@qdrant/js-client-rest';
import { AppConfig } from '@config/config.js';
import { Logger } from '@logging/logger.js';
import { IQdrantRepo, Point } from '@domain/repositories/IQdrantRepo.js';
import {
  PointId,
  DocId,
  CollectionId,
  SearchResult,
} from '@domain/entities/types.js';

/**
 * A repository class for interacting with Qdrant vector database.
 * It encapsulates all Qdrant-related operations.
 */
export class QdrantRepo implements IQdrantRepo {
  private client: QdrantClient;
  private config: AppConfig['qdrant'];
  private collectionName: string;
  private logger: Logger;

  /**
   *
   * @param appConfig
   * @param logger
   */
  constructor(appConfig: AppConfig, logger: Logger) {
    this.config = appConfig.qdrant;
    this.collectionName = this.config.collection;
    this.logger = logger;
    this.client = new QdrantClient({
      url: this.config.url ?? 'http://localhost:6333',
      checkCompatibility: false,
    });
  }

  /**
   * Ensures that the configured Qdrant collection exists and has the correct vector parameters.
   * If the collection does not exist, it will be created.
   * @throws {Error} If the collection cannot be created or verified.
   */
  async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!collectionExists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.config.vectorSize,
            distance: 'Cosine',
          },
        });
        this.logger.info(`Created Qdrant collection: ${this.collectionName}`);
      }

      const info = await this.client.getCollection(this.collectionName);
      const actualSize = this.getVectorSizeFromCollectionInfo(info);

      if (actualSize && actualSize !== this.config.vectorSize) {
        throw new Error(
          `Qdrant collection "${this.collectionName}" vector size mismatch: ` +
            `expected ${this.config.vectorSize}, got ${actualSize}`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to ensure Qdrant collection', {
        error: err,
        collectionName: this.collectionName,
      });
      throw new Error(
        `Failed to ensure Qdrant collection: ${this.collectionName}`,
      );
    }
  }

  /**
   * Extracts the vector size from the collection info response,
   * handling different response structures for compatibility.
   * @param {Schemas['CollectionInfo']} info - The collection information object.
   * @returns {number | undefined} The vector size, or undefined if not found.
   */
  private getVectorSizeFromCollectionInfo(
    info: Schemas['CollectionInfo'],
  ): number | undefined {
    const vectorsConfig = info.config?.params?.vectors;

    if (typeof vectorsConfig === 'object' && vectorsConfig !== null) {
      // This handles the case where vectorsConfig is a VectorParams object
      if ('size' in vectorsConfig && typeof vectorsConfig.size === 'number') {
        return vectorsConfig.size;
      }
    }

    // Fallback for older or different response structures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const infoAny = info as any;
    return (
      infoAny?.result?.config?.params?.vectors?.size ??
      infoAny?.result?.vectors?.size
    );
  }

  /**
   * Upserts a batch of chunks into the Qdrant collection.
   * @param {CollectionId} collectionId - The ID of the collection to upsert into.
   * @param {Point[]} points - An array of points to upsert.
   */
  async upsertCollection(
    collectionId: CollectionId,
    points: Point[],
  ): Promise<void> {
    if (!points?.length) {
      this.logger.info('No points to upsert.');
      return;
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);

      try {
        await this.client.upsert(this.collectionName, {
          wait: true,
          ordering: 'medium',
          points: batch,
        });
      } catch (e) {
        this.logger.error(
          `Error upserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          {
            error: e,
            batchSize: batch.length,
          },
        );
      }
    }
  }

  /**
   * Searches for similar vectors in the Qdrant collection.
   * @param {CollectionId} collectionId - The ID of the collection to search in.
   * @param {object} opts - The search options.
   * @param {number[]} opts.vector - The vector to search for.
   * @param {number} [opts.limit=10] - The maximum number of results to return.
   * @param {Schemas['Filter']} [opts.filter] - The filter to apply to the search.
   * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
   */
  async search(
    collectionId: CollectionId,
    opts: {
      vector: number[];
      limit?: number;
      filter?: Schemas['Filter'];
    },
  ): Promise<SearchResult[]> {
    const { vector, limit = 10, filter } = opts;
    if (!vector?.length) {
      this.logger.error('Cannot search with an empty vector.');
      return [];
    }

    try {
      const res = await this.client.search(this.collectionName, {
        vector,
        limit,
        filter,
        with_payload: true,
      });
      return res.map((item) => ({
        pointId: item.id as PointId,
        score: item.score,
        content: item.payload?.content as string,
        titleChain: item.payload?.titleChain as string,
        docId: item.payload?.docId as DocId,
        collectionId: item.payload?.collectionId as CollectionId,
        chunkIndex: item.payload?.chunkIndex as number,
      })) as SearchResult[];
    } catch (e) {
      this.logger.error('Error searching Qdrant:', { error: e });
      return [];
    }
  }

  /**
   * Deletes all points associated with a specific document ID from the Qdrant collection.
   * This operation is skipped in test environments.
   * @param {string} docId - The ID of the document whose points should be deleted.
   */
  async deletePointsByDoc(docId: string): Promise<void> {
    if (!docId) return;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [{ key: 'docId', match: { value: docId } }],
        },
      });
    } catch (e) {
      this.logger.warn('deletePointsByDoc: failed to delete points', {
        docId,
        error: e,
      });
    }
  }

  /**
   * Deletes all points associated with a specific collection ID from the Qdrant collection.
   * This operation is skipped in test environments.
   * @param {string} collectionId - The ID of the collection whose points should be deleted.
   */
  async deletePointsByCollection(collectionId: string): Promise<void> {
    if (!collectionId) return;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [{ key: 'collectionId', match: { value: collectionId } }],
        },
      });
    } catch (e) {
      this.logger.warn('deletePointsByCollection: failed to delete points', {
        collectionId,
        error: e,
      });
    }
  }

  /**
   * Gets all point IDs in a specific collection.
   * @param {string} collectionId - The ID of the collection to get points for.
   * @returns {Promise<PointId[]>} A promise that resolves to an array of point IDs.
   */
  async getAllPointIdsInCollection(collectionId: string): Promise<PointId[]> {
    try {
      const { points } = await this.client.scroll(this.collectionName, {
        limit: 10000, // Adjust based on your needs
        with_payload: false,
      });
      return points.map((point) => point.id as PointId);
    } catch (e) {
      this.logger.error('Error getting all point IDs:', {
        error: e,
        collectionId,
      });
      return [];
    }
  }

  /**
   * Deletes points in batches from a specific collection.
   * @param {string} collectionId - The ID of the collection to delete points from.
   * @param {PointId[]} pointIds - The point IDs to delete.
   */
  async deletePoints(collectionId: string, pointIds: PointId[]): Promise<void> {
    if (!pointIds?.length) {
      this.logger.info('没有要删除的点');
      return;
    }
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    const BATCH_SIZE = 100;
    for (let i = 0; i < pointIds.length; i += BATCH_SIZE) {
      const batch = pointIds.slice(i, i + BATCH_SIZE);

      try {
        await this.client.delete(this.collectionName, {
          wait: true,
          points: batch,
        });
      } catch (e) {
        this.logger.warn(
          `Qdrant 删除点批次时出错 (批次 ${Math.floor(i / BATCH_SIZE) + 1}):`,
          {
            collectionId,
            pointIds: batch,
            error: e,
          },
        );
      }
    }
  }
}
