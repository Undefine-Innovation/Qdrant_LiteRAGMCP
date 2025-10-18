import { QdrantClient, Schemas } from '@qdrant/js-client-rest';
import { AppConfig } from '../config.js';
import * as logger from '../logger.js';

/**
 * Interface for a chunk of text with its vector representation.
 */
export interface ChunkWithVector {
  collectionId: string;
  docId: string;
  chunkIndex: number;
  content: string;
  titleChain?: string | string[];
  vector: number[];
  pointId?: string;
  source?: string;
  contentHash?: string;
}

/**
 * A repository class for interacting with the Qdrant vector database.
 * It encapsulates all Qdrant-related operations.
 */
export class QdrantRepo {
  private client: QdrantClient;
  private config: AppConfig['qdrant'];
  private collectionName: string;

  /**
   * Creates an instance of QdrantRepo.
   * @param {AppConfig} appConfig - The application configuration.
   */
  constructor(appConfig: AppConfig) {
    this.config = appConfig.qdrant;
    this.collectionName = this.config.collection;
    this.client = new QdrantClient({
      url: this.config.url ?? 'http://localhost:6333',
      checkCompatibility: false,
    });
  }

  /**
   * Ensures that the configured Qdrant collection exists and has the correct vector parameters.
   * If the collection does not exist, it will be created.
   * @throws {Error} If the collection cannot be created or verified.
   * @throws {Error} If the existing collection's vector size does not match the configuration.
   */
  async ensureCollection() {
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
      logger.error('Failed to ensure Qdrant collection', {
        error: err,
        collectionName: this.collectionName,
      });
      throw new Error(`Failed to ensure Qdrant collection: ${this.collectionName}`);
    }
  }

  /**
   * Extracts the vector size from the collection info response,
   * handling different structures for compatibility.
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
   * @param {ChunkWithVector[]} chunks - An array of chunks to upsert.
   */
  async upsertChunks(chunks: ChunkWithVector[]) {
    if (!chunks?.length) {
      logger.info('No chunks to upsert.');
      return;
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const points = batch.map((c) => ({
        id: c.pointId ?? `${c.docId}#${c.chunkIndex}`,
        vector: c.vector,
        payload: {
          content: c.content,
          titleChain: Array.isArray(c.titleChain)
            ? c.titleChain.join(' > ')
            : c.titleChain,
          source: c.source,
          contentHash: c.contentHash,
          docId: c.docId,
          collectionId: c.collectionId,
          chunkIndex: c.chunkIndex,
        },
      }));

      try {
        await this.client.upsert(this.collectionName, {
          wait: true,
          ordering: 'medium',
          points,
        });
      } catch (e) {
        logger.error(`Error upserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, {
          error: e,
        });
      }
    }
  }

  /**
   * Searches for similar vectors in the Qdrant collection.
   * @param {string} collectionId - The ID of the collection to search in.
   * @param {object} opts - The search options.
   * @param {number[]} opts.vector - The vector to search for.
   * @param {number} [opts.limit=10] - The maximum number of results to return.
   * @param {Schemas.Filter} [opts.filter] - The filter to apply to the search.
   * @returns {Promise<any[]>} A promise that resolves to an array of search results.
   */
  async search(
    collectionId: string, // Note: collectionId is kept for API compatibility but this repo instance targets one collection.
    opts: {
      vector: number[];
      limit?: number;
      filter?: Schemas['Filter'];
    },
  ) {
    const { vector, limit = 10, filter } = opts;
    if (!vector?.length) {
      logger.error('Cannot search with an empty vector.');
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
        pointId: item.id as string,
        score: item.score,
        content: item.payload?.content,
        titleChain: item.payload?.titleChain,
        docId: item.payload?.docId,
        collectionId: item.payload?.collectionId,
        chunkIndex: item.payload?.chunkIndex,
      }));
    } catch (e) {
      logger.error('Error searching Qdrant:', { error: e });
      return [];
    }
  }

  /**
   * Deletes all points associated with a specific document ID from the Qdrant collection.
   * This operation is skipped in test environments.
   * @param {string} docId - The ID of the document whose points should be deleted.
   */
  async deletePointsByDoc(docId: string) {
    if (!docId) return;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: { must: [{ key: 'docId', match: { value: docId } }] },
      });
    } catch (e) {
      logger.warn('deletePointsByDoc: failed to delete points', { docId, error: e });
    }
  }
}