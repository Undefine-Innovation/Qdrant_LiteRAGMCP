import { SQLiteRepoCore } from './SQLiteRepoCore.js';
import { Logger } from '../logger.js';
import {
  DocId,
  PointId,
  DocumentChunk,
  SearchResult,
  CollectionId,
} from '../domain/types.js';
import { makeDocId, makePointId, hashContent } from '../domain/utils/id.js';

/**
 * 块管理器
 * 负责文档块相关的数据库操作
 */
export class ChunkManager {
  constructor(
    private readonly chunkMeta: any, // ChunkMetaTable
    private readonly chunksFts5: any, // ChunksFts5Table
    private readonly chunks: any, // ChunksTable
    private readonly core: SQLiteRepoCore,
    private readonly logger: Logger,
  ) {}

  /**
   * 检索块点 ID 列表的文本内容。
   * @param pointIds - 块 ID 数组。
   * @returns 一个记录，将每个 pointId 映射到其内容和标题。
   */
  getChunkTexts(
    pointIds: PointId[],
  ): Record<string, { content: string; title?: string }> | null {
    if (pointIds.length === 0) {
      return {};
    }

    // 使用 ChunkMetaTable 和 ChunksTable 获取块内容
    const chunks = this.chunkMeta.getChunksAndContentByPointIds(pointIds);

    if (chunks.length === 0) {
      this.logger.warn('getChunkTexts: no chunks found');
      return {};
    }

    return chunks.reduce(
      (acc: Record<string, { content: string; title?: string }>, chunk: any) => {
        acc[chunk.pointId] = {
          content: chunk.content,
          title: chunk.title ?? undefined,
        };
        return acc;
      },
      {} as Record<string, { content: string; title?: string }>,
    );
  }

  /**
   * 检索块点 ID 列表的详细信息。
   * @param pointIds - 块 ID 数组。
   * @param collectionId - 集合的 ID。
   * @returns 搜索结果数组。
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[] {
    if (pointIds.length === 0) {
      return [];
    }

    // 使用 ChunkMetaTable 获取块详细信息
    const chunks = this.chunkMeta.getChunksDetailsByPointIds(
      pointIds,
      collectionId,
    );

    return chunks.map((row: any) => ({
      ...row,
      docId: row.docId as DocId,
      pointId: row.pointId,
      collectionId: row.collectionId as CollectionId,
    }));
  }

  /**
   * 添加文档块到数据库
   * @param docId - 文档ID
   * @param documentChunks - 文档块数组
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    const doc = await this.getDoc(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    this.logger.info(
      `[ChunkManager.addChunks] 开始处理文档 ${docId}，chunks数量: ${documentChunks.length}`,
    );

    const chunkMetas: Omit<any, 'created_at'>[] = documentChunks.map(
      (dc, index) => {
        const pointId = makePointId(docId, index) as PointId;
        this.logger.info(`[ChunkManager.addChunks] 生成chunkMeta ${index}:`, {
          pointId,
          pointIdType: typeof pointId,
          docId,
          docIdType: typeof docId,
          collectionId: doc.collectionId,
          collectionIdType: typeof doc.collectionId,
          chunkIndex: index,
          chunkIndexType: typeof index,
        });
        return {
          pointId,
          docId: docId,
          collectionId: doc.collectionId,
          chunkIndex: index,
          titleChain: dc.titleChain?.join(' > ') || undefined,
          contentHash: hashContent(dc.content),
        };
      },
    );

    try {
      this.core.transaction(() => {
        this.logger.info(
          `[ChunkManager.addChunks] 开始执行chunkMeta.createBatch`,
        );
        this.chunkMeta.createBatch(chunkMetas);

        this.logger.info(`[ChunkManager.addChunks] 开始执行chunks.createBatch`);
        const chunksData = chunkMetas.map((cm, index) => ({
          pointId: cm.pointId,
          docId: cm.docId,
          collectionId: cm.collectionId,
          chunkIndex: cm.chunkIndex,
          title: cm.titleChain || undefined,
          content: documentChunks[index].content,
        }));
        this.logger.info(
          `[ChunkManager.addChunks] chunksData示例:`,
          chunksData[0],
        );
        // 确保 title 字段正确处理 null/undefined
        const processedChunksData = chunksData.map((chunk) => ({
          ...chunk,
          title: chunk.title === undefined ? null : chunk.title,
        }));
        this.chunks.createBatch(processedChunksData);

        this.logger.info(
          `[ChunkManager.addChunks] 开始执行chunksFts5.createBatch`,
        );
        const fts5Data = chunkMetas.map((cm, index) => ({
          pointId: cm.pointId,
          content: documentChunks[index].content,
          titleChain: cm.titleChain,
        }));
        this.logger.info(`[ChunkManager.addChunks] fts5Data示例:`, fts5Data[0]);
        this.chunksFts5.createBatch(fts5Data);
      });
      this.logger.info(`[ChunkManager.addChunks] 所有数据库操作完成`);
    } catch (error) {
      this.logger.error(`[ChunkManager.addChunks] 数据库操作失败:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        docId,
        chunksCount: documentChunks.length,
        chunkMetaExample: chunkMetas[0],
      });
      throw error;
    }
  }

  /**
   * 获取文档
   * @param docId - 文档ID
   * @returns 文档对象
   */
  private async getDoc(docId: DocId): Promise<any> {
    // 这里应该从DocumentManager获取文档
    // 暂时直接从docs表获取
    // 需要通过SQLiteRepoCore访问docs表
    return (this.core as any).docs?.getById(docId);
  }

  /**
   * 获取文档的块元数据
   * @param docId - 文档ID
   * @returns 块元数据数组
   */
  getChunkMetasByDocId(docId: DocId): any[] {
    return this.chunkMeta.listByDocId(docId);
  }
}
