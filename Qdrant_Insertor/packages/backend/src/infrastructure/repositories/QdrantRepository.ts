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
import { FILE_CONSTANTS } from '@domain/constants/FileConstants.js';

/**
 * 与 Qdrant 向量数据库交互的仓库类。
 * 封装了所有与 Qdrant 相关的操作。
 */
export class QdrantRepo implements IQdrantRepo {
  private client: QdrantClient;
  private config: AppConfig['qdrant'];
  private collectionName: string;
  private logger: Logger;

  /**
   * 构造函数
   * @param appConfig - 应用配置
   * @param logger - 日志记录器
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
   * 确保配置的 Qdrant 集合存在并具有正确的向量参数。
   * 如果集合不存在，将会被创建。
   * @throws {Error} 如果无法创建或验证集合。
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
   * 从集合信息响应中提取向量大小，
   * 处理不同的响应结构以确保兼容性。
   * @param {Schemas['CollectionInfo']} info - 集合信息对象。
   * @returns {number | undefined} 向量大小，如果未找到则返回 undefined。
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

    // Fallback for older or different response structures - attempt safe key access
    const infoRec = info as unknown as Record<string, unknown> | undefined;
    const result = infoRec?.result as Record<string, unknown> | undefined;
    const maybeVectors =
      result?.config && (result.config as Record<string, unknown>).params
        ? (
            (result.config as Record<string, unknown>).params as Record<
              string,
              unknown
            >
          ).vectors
        : (result?.vectors as unknown);

    if (maybeVectors && typeof maybeVectors === 'object') {
      const vecRec = maybeVectors as Record<string, unknown>;
      if (typeof vecRec.size === 'number') return vecRec.size;
    }

    return undefined;
  }

  /**
   * 将一批数据块插入到 Qdrant 集合中。
   * @param {CollectionId} collectionId - 要插入的集合 ID。
   * @param {Point[]} points - 要插入的点数组。
   */
  async upsertCollection(
    collectionId: CollectionId,
    points: Point[],
  ): Promise<void> {
    if (!points?.length) {
      this.logger.info('No points to upsert.');
      return;
    }

    const BATCH_SIZE = FILE_CONSTANTS.BATCH_SIZE;
    const totalBatches = Math.ceil(points.length / BATCH_SIZE);
    let successfulBatches = 0;
    let totalPointsProcessed = 0;

    this.logger.info(`[QdrantSync] 开始向集合 ${collectionId} 插入向量点`, {
      totalPoints: points.length,
      batchSize: BATCH_SIZE,
      totalBatches,
    });

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const startTime = Date.now();
        await this.client.upsert(this.collectionName, {
          wait: true,
          ordering: 'medium',
          points: batch,
        });
        const duration = Date.now() - startTime;

        successfulBatches++;
        totalPointsProcessed += batch.length;

        this.logger.info(
          `[QdrantSync] 批次 ${batchNumber}/${totalBatches} 插入成功`,
          {
            collectionId,
            batchNumber,
            batchSize: batch.length,
            duration: `${duration}ms`,
            totalProcessed: totalPointsProcessed,
            totalPoints: points.length,
            progress: `${Math.round((totalPointsProcessed / points.length) * 100)}%`,
          },
        );
      } catch (e) {
        this.logger.error(
          `[QdrantSync] 批次 ${batchNumber}/${totalBatches} 插入失败`,
          {
            error: e,
            batchSize: batch.length,
            collectionId,
            batchNumber,
            totalProcessed: totalPointsProcessed,
            totalPoints: points.length,
          },
        );
        throw e; // 重新抛出错误，确保调用方能感知失败
      }
    }

    this.logger.info(`[QdrantSync] 集合 ${collectionId} 向量点插入完成`, {
      collectionId,
      totalPoints: points.length,
      totalBatches,
      successfulBatches,
      totalPointsProcessed,
      successRate: `${Math.round((successfulBatches / totalBatches) * 100)}%`,
    });
  }

  /**
   * 在 Qdrant 集合中搜索相似的向量。
   * @param {CollectionId} collectionId - 要搜索的集合 ID。
   * @param {object} opts - 搜索选项。
   * @param {number[]} opts.vector - 要搜索的向量。
   * @param {number} [opts.limit=10] - 返回的最大结果数。
   * @param {Schemas['Filter']} [opts.filter] - 应用到搜索的过滤器。
   * @returns {Promise<SearchResult[]>} 一个 Promise，解析为搜索结果数组。
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
      this.logger.error('[QdrantSync] 无法使用空向量进行搜索');
      return [];
    }

    this.logger.info(`[QdrantSync] 开始在集合 ${collectionId} 中搜索`, {
      collectionId,
      vectorLength: vector.length,
      limit,
      hasFilter: !!filter,
    });

    // Add simple retry/backoff for transient network errors (e.g. "fetch failed").
    const maxAttempts = 3;
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const res = await this.client.search(this.collectionName, {
          vector,
          limit,
          filter,
          with_payload: true,
        });
        const duration = Date.now() - startTime;

        const results = res.map((item) => ({
          pointId: item.id as PointId,
          score: item.score,
          content: item.payload?.content as string,
          titleChain: item.payload?.titleChain as string,
          docId: item.payload?.docId as DocId,
          collectionId: item.payload?.collectionId as CollectionId,
          chunkIndex: item.payload?.chunkIndex as number,
        })) as SearchResult[];

        this.logger.info(`[QdrantSync] 集合 ${collectionId} 搜索成功`, {
          collectionId,
          attempt,
          duration: `${duration}ms`,
          resultCount: results.length,
          limit,
          vectorLength: vector.length,
        });

        return results;
      } catch (e) {
        const maybe = e as Record<string, unknown> | undefined;
        const msg =
          typeof maybe?.message === 'string' ? maybe.message : undefined;

        // If this looks like a transient fetch/network error, retry with backoff.
        const isTransient =
          typeof msg === 'string' && /fetch failed/i.test(msg);

        this.logger.warn(
          `[QdrantSync] 搜索尝试 ${attempt} 失败` +
            (isTransient ? ' (可能是临时错误)' : ''),
          {
            collectionId,
            collection: this.collectionName,
            vectorLength: vector.length,
            limit,
            attempt,
            message: msg,
            name: typeof maybe?.name === 'string' ? maybe.name : undefined,
          },
        );

        if (attempt < maxAttempts && isTransient) {
          // exponential-ish backoff
          await wait(150 * attempt);
          continue;
        }

        const response = maybe?.response as Record<string, unknown> | undefined;
        this.logger.error('[QdrantSync] 搜索失败:', {
          collectionId,
          message: msg,
          name: typeof maybe?.name === 'string' ? maybe.name : undefined,
          code: typeof maybe?.code === 'string' ? maybe.code : undefined,
          status: maybe?.status,
          response: response?.data ?? maybe?.response,
          stack: typeof maybe?.stack === 'string' ? maybe.stack : undefined,
        });
        return [];
      }
    }
    return [];
  }

  /**
   * 删除与特定文档 ID 相关的所有点。
   * 此操作在测试环境中被跳过。
   * @param {string} docId - 要删除点的文档 ID。
   */
  async deletePointsByDoc(docId: string): Promise<void> {
    if (!docId) return;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    try {
      const t0 = Date.now();
      this.logger.info(`[QdrantSync] 开始删除文档 ${docId} 的向量点`, {
        docId,
        collectionName: this.collectionName,
      });

      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [{ key: 'docId', match: { value: docId } }],
        },
      });

      const elapsedMs = Date.now() - t0;
      this.logger.info(`[QdrantSync] 文档 ${docId} 向量点删除成功`, {
        docId,
        collectionName: this.collectionName,
        elapsedMs: `${elapsedMs}ms`,
      });
    } catch (e) {
      this.logger.error(`[QdrantSync] 文档 ${docId} 向量点删除失败`, {
        docId,
        collectionName: this.collectionName,
        error: e,
      });
      throw e; // 重新抛出错误，确保调用方能感知失败
    }
  }

  /**
   * 删除与特定集合 ID 相关的所有点。
   * 此操作在测试环境中被跳过。
   * @param {string} collectionId - 要删除点的集合 ID。
   */
  async deletePointsByCollection(collectionId: string): Promise<void> {
    if (!collectionId) return;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    try {
      const t0 = Date.now();
      this.logger.info(`[QdrantSync] 开始删除集合 ${collectionId} 的向量点`, {
        collectionId,
        collectionName: this.collectionName,
      });

      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [{ key: 'collectionId', match: { value: collectionId } }],
        },
      });

      const elapsedMs = Date.now() - t0;
      this.logger.info(`[QdrantSync] 集合 ${collectionId} 向量点删除成功`, {
        collectionId,
        collectionName: this.collectionName,
        elapsedMs: `${elapsedMs}ms`,
      });
    } catch (e) {
      this.logger.error(`[QdrantSync] 集合 ${collectionId} 向量点删除失败`, {
        collectionId,
        collectionName: this.collectionName,
        error: e,
      });
      throw e; // 重新抛出错误，确保调用方能感知失败
    }
  }

  /**
   * 获取特定集合中的所有点 ID。
   * @param {string} collectionId - 要获取点的集合 ID。
   * @returns {Promise<PointId[]>} 一个 Promise，解析为点 ID 数组。
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
   * 从特定集合中批量删除点。
   * @param {string} collectionId - 要删除点的集合 ID。
   * @param {PointId[]} pointIds - 要删除的点 ID。
   */
  async deletePoints(collectionId: string, pointIds: PointId[]): Promise<void> {
    if (!pointIds?.length) {
      this.logger.info('[QdrantSync] 没有要删除的向量点');
      return;
    }
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    const BATCH_SIZE = FILE_CONSTANTS.BATCH_SIZE;
    const totalBatches = Math.ceil(pointIds.length / BATCH_SIZE);
    let successfulBatches = 0;
    let totalPointsProcessed = 0;

    this.logger.info(`[QdrantSync] 开始删除集合 ${collectionId} 的指定向量点`, {
      collectionId,
      collectionName: this.collectionName,
      totalPoints: pointIds.length,
      batchSize: BATCH_SIZE,
      totalBatches,
    });

    const t0 = Date.now();
    for (let i = 0; i < pointIds.length; i += BATCH_SIZE) {
      const batch = pointIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const tb = Date.now();
        await this.client.delete(this.collectionName, {
          wait: true,
          points: batch,
        });
        const batchDuration = Date.now() - tb;

        successfulBatches++;
        totalPointsProcessed += batch.length;

        this.logger.info(
          `[QdrantSync] 批次 ${batchNumber}/${totalBatches} 删除成功`,
          {
            collectionId,
            batchNumber,
            batchSize: batch.length,
            batchDuration: `${batchDuration}ms`,
            totalProcessed: totalPointsProcessed,
            totalPoints: pointIds.length,
            progress: `${Math.round((totalPointsProcessed / pointIds.length) * 100)}%`,
          },
        );
      } catch (e) {
        this.logger.error(
          `[QdrantSync] 批次 ${batchNumber}/${totalBatches} 删除失败`,
          {
            collectionId,
            batchNumber,
            pointIds: batch,
            error: e,
          },
        );
        throw e; // 重新抛出错误，确保调用方能感知失败
      }
    }

    const totalElapsedMs = Date.now() - t0;
    this.logger.info(`[QdrantSync] 集合 ${collectionId} 指定向量点删除完成`, {
      collectionId,
      collectionName: this.collectionName,
      totalPoints: pointIds.length,
      totalBatches,
      successfulBatches,
      totalPointsProcessed,
      totalElapsedMs: `${totalElapsedMs}ms`,
      successRate: `${Math.round((successfulBatches / totalBatches) * 100)}%`,
    });
  }
}
