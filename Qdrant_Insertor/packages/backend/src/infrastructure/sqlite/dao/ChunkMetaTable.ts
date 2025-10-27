import type { Database } from 'better-sqlite3';
import type {
  ChunkMeta,
  PointId,
  DocId,
  CollectionId,
} from '../../../domain/types.js';
import {
  SELECT_CHUNK_BY_POINT_ID,
  SELECT_CHUNKS_BY_DOC_ID,
  DELETE_CHUNKS_BY_DOC_ID,
  DELETE_CHUNKS_BY_COLLECTION_ID,
  INSERT_CHUNK_META,
  SELECT_CHUNKS_AND_CONTENT_BY_POINT_IDS,
  SELECT_CHUNKS_DETAILS_BY_POINT_IDS,
  DELETE_CHUNKS_META_BATCH,
  SELECT_CHUNKS_BY_COLLECTION_ID,
} from '../sql/chunk_meta.sql.js';

/**
 * `chunk_meta` 表的数据访问对象 (DAO)。
 * 封装了所有块元数据的 SQL 交互。
 */
export class ChunkMetaTable {
  private db: Database;

  /**
   * @param db - 数据库实例。
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 创建一个新的块元数据记录。
   * @param data - 新块元数据的数据，不包括 'created_at'。
   */
  create(data: Omit<ChunkMeta, 'created_at'>): void {
    const now = Date.now();
    const stmt = this.db.prepare(INSERT_CHUNK_META);
    stmt.run(
      data.pointId,
      data.docId,
      data.collectionId,
      data.chunkIndex,
      data.titleChain,
      data.contentHash,
      now,
    );
  }

  /**
   * 在单个事务中创建多个块元数据记录。
   * 这对于性能至关重要，因为一个文档通常被拆分为许多块。
   * @param data - 要插入的块元数据对象数组。
   */
  createBatch(data: Omit<ChunkMeta, 'created_at'>[]): void {
    console.log(
      `[ChunkMetaTable.createBatch] 开始批量插入chunkMeta，数量: ${data.length}`,
    );

    if (data.length > 0) {
      console.log(`[ChunkMetaTable.createBatch] 第一条数据示例:`, {
        pointId: data[0].pointId,
        pointIdType: typeof data[0].pointId,
        docId: data[0].docId,
        docIdType: typeof data[0].docId,
        collectionId: data[0].collectionId,
        collectionIdType: typeof data[0].collectionId,
        chunkIndex: data[0].chunkIndex,
        chunkIndexType: typeof data[0].chunkIndex,
        titleChain: data[0].titleChain,
        titleChainType: typeof data[0].titleChain,
        contentHash: data[0].contentHash,
        contentHashType: typeof data[0].contentHash,
      });
    }

    const insert = this.db.prepare(INSERT_CHUNK_META);

    const insertMany = this.db.transaction(
      (items: Omit<ChunkMeta, 'created_at'>[]) => {
        const now = Date.now();
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          console.log(`[ChunkMetaTable.createBatch] 插入第${i + 1}条数据:`, {
            pointId: item.pointId,
            pointIdType: typeof item.pointId,
            docId: item.docId,
            docIdType: typeof item.docId,
            collectionId: item.collectionId,
            collectionIdType: typeof item.collectionId,
            chunkIndex: item.chunkIndex,
            chunkIndexType: typeof item.chunkIndex,
            titleChain: item.titleChain,
            titleChainType: typeof item.titleChain,
            titleChainValue: item.titleChain,
            contentHash: item.contentHash,
            contentHashType: typeof item.contentHash,
          });

          try {
            insert.run(
              item.pointId,
              item.docId,
              item.collectionId,
              item.chunkIndex,
              item.titleChain,
              item.contentHash,
              now,
            );
          } catch (insertError) {
            console.error(
              `[ChunkMetaTable.createBatch] 插入第${i + 1}条数据失败:`,
              {
                error: (insertError as Error).message,
                stack: (insertError as Error).stack,
                pointId: item.pointId,
                pointIdType: typeof item.pointId,
                docId: item.docId,
                docIdType: typeof item.docId,
                collectionId: item.collectionId,
                collectionIdType: typeof item.collectionId,
                chunkIndex: item.chunkIndex,
                chunkIndexType: typeof item.chunkIndex,
                titleChain: item.titleChain,
                titleChainType: typeof item.titleChain,
                titleChainValue: item.titleChain,
                contentHash: item.contentHash,
                contentHashType: typeof item.contentHash,
              },
            );
            throw insertError;
          }
        }
      },
    );

    try {
      insertMany(data);
      console.log(`[ChunkMetaTable.createBatch] 批量插入chunkMeta完成`);
    } catch (error) {
      console.error(`[ChunkMetaTable.createBatch] 批量插入chunkMeta失败:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        dataCount: data.length,
      });
      throw error;
    }
  }

  /**
   * 根据其 pointId 检索块的元数据。
   * @param pointId - point（和块）的唯一 ID。
   * @returns 块元数据对象，如果未找到则返回 undefined。
   */
  getByPointId(pointId: PointId): ChunkMeta | undefined {
    const stmt = this.db.prepare(SELECT_CHUNK_BY_POINT_ID);
    return stmt.get(pointId) as ChunkMeta | undefined;
  }

  /**
   * 列出特定文档的所有块元数据。
   * @param docId - 文档的 ID。
   * @returns 块元数据对象数组。
   */
  listByDocId(docId: DocId): ChunkMeta[] {
    const stmt = this.db.prepare(SELECT_CHUNKS_BY_DOC_ID);
    return stmt.all(docId) as ChunkMeta[];
  }

  /**
   * 列出特定集合的所有块元数据。
   * @param collectionId - 集合的 ID。
   * @returns 块元数据对象数组。
   */
  listByCollectionId(collectionId: CollectionId): ChunkMeta[] {
    const stmt = this.db.prepare(SELECT_CHUNKS_BY_COLLECTION_ID);
    return stmt.all(collectionId) as ChunkMeta[];
  }

  /**
   * 删除与特定文档关联的所有块元数据。
   * @param docId - 要删除其块的文档 ID。
   */
  deleteByDocId(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_BY_DOC_ID);
    stmt.run(docId);
  }

  /**
   * 删除与特定集合关联的所有块元数据。
   * @param collectionId - 要删除其块的集合 ID。
   */
  deleteByCollectionId(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_BY_COLLECTION_ID);
    stmt.run(collectionId);
  }
  /**
   * 根据 pointIds 批量查询块元数据和内容。
   * @param pointIds - 块 ID 数组。
   * @returns 包含块元数据和内容的数组。
   */
  getChunksAndContentByPointIds(
    pointIds: PointId[],
  ): Array<{ pointId: PointId; content: string; title?: string }> {
    if (pointIds.length === 0) {
      return [];
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      SELECT_CHUNKS_AND_CONTENT_BY_POINT_IDS.replace(
        '(?)',
        `(${placeholders})`,
      ),
    );
    return stmt.all(...pointIds) as Array<{
      pointId: PointId;
      content: string;
      title?: string;
    }>;
  }

  /**
   * 根据 pointIds 批量查询块详细信息。
   * @param pointIds - 块 ID 数组。
   * @param collectionId - 集合 ID。
   * @returns 包含块详细信息的数组。
   */
  getChunksDetailsByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Array<{
    pointId: PointId;
    collectionId: CollectionId;
    content: string;
    titleChain: string;
    title?: string;
    docId: DocId;
    chunkIndex: number;
  }> {
    if (pointIds.length === 0) {
      return [];
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      SELECT_CHUNKS_DETAILS_BY_POINT_IDS.replace('(?)', `(${placeholders})`),
    );
    return stmt.all(...pointIds, collectionId) as Array<{
      pointId: PointId;
      collectionId: CollectionId;
      content: string;
      titleChain: string;
      title?: string;
      docId: DocId;
      chunkIndex: number;
    }>;
  }

  /**
   * 根据 pointId 批量删除块元数据。
   * @param pointIds - 要删除的 pointId 数组。
   */
  deleteBatch(pointIds: PointId[]): void {
    if (pointIds.length === 0) {
      return;
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      DELETE_CHUNKS_META_BATCH.replace('(?)', `(${placeholders})`),
    );
    stmt.run(...pointIds);
  }
}
