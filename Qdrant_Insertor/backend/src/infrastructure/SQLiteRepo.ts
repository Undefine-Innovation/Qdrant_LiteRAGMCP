import Database from 'better-sqlite3';
import { makeDocId, hashContent, makePointId } from '../domain/utils/id.js';
import {
  Doc,
  SearchResult,
  CollectionId,
  DocId,
  PointId,
  DocumentChunk,
  ChunkMeta,
} from '@domain/types.js';

// Import DAOs
import { CollectionsTable } from './sqlite/dao/CollectionsTable.js';
import { DocsTable } from './sqlite/dao/DocsTable.js';
import { ChunkMetaTable } from './sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from './sqlite/dao/ChunksFts5Table.js';
import { ChunksTable } from './sqlite/dao/ChunksTable.js';

/**
 * SQLiteRepo 作为数据访问对象 (DAO) 的协调器。
 * 它管理数据库连接，提供对 DAO 的访问，
 * 并封装跨多个表的复杂事务操作。
 */
export class SQLiteRepo {
  public readonly collections: CollectionsTable;
  public readonly docs: DocsTable;
  public readonly chunkMeta: ChunkMetaTable;
  public readonly chunksFts5: ChunksFts5Table;
  public readonly chunks: ChunksTable;

  /**
   * @param db `better-sqlite3` 数据库实例。
   */
  constructor(private db: Database.Database) {
    this.collections = new CollectionsTable(db);
    this.docs = new DocsTable(db);
    this.chunkMeta = new ChunkMetaTable(db);
    this.chunksFts5 = new ChunksFts5Table(db);
    this.chunks = new ChunksTable(db);
    this.bootstrap();
  }

  /**
   * 设置数据库模式和 PRAGMA 设置。
   * 假设数据库模式已通过迁移脚本创建。
   */
  private bootstrap() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * 在数据库事务中执行一个函数。
   * @param fn 包含数据库操作的函数。
   * @returns 事务函数的返回值。
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * 关闭数据库连接。
   */
  public close() {
    this.db.close();
  }

  /**
   * 删除一个集合及其所有关联的文档和块。
   * 这是一个事务性操作。
   * @param collectionId 要删除的集合 ID。
   */
  deleteCollection(collectionId: CollectionId): void {
    const collection = this.collections.getById(collectionId);
    if (!collection) {
      console.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    this.transaction(() => {
      // 首先，删除与集合关联的所有块及其元数据。
      this.chunkMeta.deleteByCollectionId(collectionId);
      this.chunksFts5.deleteByCollectionId(collectionId);

      // 然后，删除集合中的所有文档。
      const docsInCollection = this.docs.listByCollection(collectionId);
      for (const doc of docsInCollection) {
        this.docs.hardDelete(doc.docId);
      }

      // 最后，删除集合本身。
      this.collections.delete(collectionId);
    });

    console.log(
      `Collection ${collectionId} and its associated data have been deleted.`,
    );
  }

  /**
   * 更新文档的内容和元数据。
   * 如果内容发生变化，旧文档及其块将被删除，并创建一个新文档。
   * @param docId - 要更新的文档 ID。
   * @param content - 新的文档内容。
   * @param name - 可选的文档名称。
   * @param mime - 可选的 MIME 类型。
   * @returns 更新后的 Doc 对象，如果未找到原始文档则返回 null。
   */
  updateDoc(
    docId: DocId,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Doc | null {
    const existingDoc = this.docs.getById(docId);
    if (!existingDoc) {
      console.error('updateDoc: Document not found', docId);
      return null;
    }

    const newDocId = makeDocId(content);

    // 情况 1: 内容未改变，只更新元数据。
    if (newDocId === docId) {
      this.docs.update(docId, { name, mime });
      return this.docs.getById(docId) ?? null;
    }

    // 情况 2: 内容已改变，替换文档。
    const { collectionId, key } = existingDoc;
    this.transaction(() => {
      this.deleteDoc(docId); // 硬删除旧文档及其块
    });

    // 创建新文档。
    const newId = this.docs.create({
      collectionId,
      key,
      content:
        typeof content === 'string'
          ? content
          : new TextDecoder().decode(content),
      size_bytes:
        typeof content === 'string'
          ? new TextEncoder().encode(content).length
          : content.byteLength,
      name: name ?? existingDoc.name,
      mime,
    });

    return this.docs.getById(newId) ?? null;
  }

  /**
   * 删除一个文档及其所有关联的块。
   * 这是一个在事务中执行的硬删除操作。
   * @param docId - 要删除的文档 ID。
   * @returns 如果找到并删除了文档，则返回 true，否则返回 false。
   */
  deleteDoc(docId: DocId): boolean {
    const doc = this.docs.getById(docId);
    if (!doc) {
      console.warn('deleteDoc: no such docId', docId);
      return false;
    }

    this.transaction(() => {
      this.chunkMeta.deleteByDocId(docId);
      this.chunksFts5.deleteByDocId(docId);
      this.docs.hardDelete(docId);
    });
    return true;
  }

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
      console.warn('getChunkTexts: no chunks found');
      return {};
    }

    return chunks.reduce(
      (acc: Record<string, { content: string; title?: string }>, chunk) => {
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

    return chunks.map((row) => ({
      ...row,
      docId: row.docId as DocId,
      pointId: row.pointId,
      collectionId: row.collectionId as CollectionId,
    }));
  }

  /**
   * 检查数据库连接是否存活。
   * @returns 如果连接响应正常则返回 true，否则返回 false。
   */
  ping(): boolean {
    return this.collections.ping();
  }
  public async getDoc(docId: DocId): Promise<Doc | undefined> {
    return this.docs.getById(docId) ?? undefined;
  }

  public async getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]> {
    return this.chunkMeta.listByDocId(docId);
  }

  public async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    const doc = this.docs.getById(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    console.log(`[SQLiteRepo.addChunks] 开始处理文档 ${docId}，chunks数量: ${documentChunks.length}`);
    console.log(`[SQLiteRepo.addChunks] 文档信息:`, {
      docId: doc.docId,
      collectionId: doc.collectionId,
      collectionIdType: typeof doc.collectionId
    });

    const chunkMetas: Omit<ChunkMeta, 'created_at'>[] = documentChunks.map(
      (dc, index) => {
        const pointId = makePointId(docId, index) as PointId;
        console.log(`[SQLiteRepo.addChunks] 生成chunkMeta ${index}:`, {
          pointId,
          pointIdType: typeof pointId,
          docId,
          docIdType: typeof docId,
          collectionId: doc.collectionId,
          collectionIdType: typeof doc.collectionId,
          chunkIndex: index,
          chunkIndexType: typeof index
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
      this.transaction(() => {
        console.log(`[SQLiteRepo.addChunks] 开始执行chunkMeta.createBatch`);
        this.chunkMeta.createBatch(chunkMetas);
        
        console.log(`[SQLiteRepo.addChunks] 开始执行chunks.createBatch`);
        const chunksData = chunkMetas.map((cm, index) => ({
          pointId: cm.pointId,
          docId: cm.docId,
          collectionId: cm.collectionId,
          chunkIndex: cm.chunkIndex,
          title: cm.titleChain || undefined,
          content: documentChunks[index].content,
        }));
        console.log(`[SQLiteRepo.addChunks] chunksData示例:`, chunksData[0]);
        // 确保 title 字段正确处理 null/undefined
        const processedChunksData = chunksData.map(chunk => ({
          ...chunk,
          title: chunk.title === undefined ? null : chunk.title
        }));
        this.chunks.createBatch(processedChunksData);
        
        console.log(`[SQLiteRepo.addChunks] 开始执行chunksFts5.createBatch`);
        const fts5Data = chunkMetas.map((cm, index) => ({
          pointId: cm.pointId,
          content: documentChunks[index].content,
          titleChain: cm.titleChain,
        }));
        console.log(`[SQLiteRepo.addChunks] fts5Data示例:`, fts5Data[0]);
        this.chunksFts5.createBatch(fts5Data);
      });
      console.log(`[SQLiteRepo.addChunks] 所有数据库操作完成`);
    } catch (error) {
      console.error(`[SQLiteRepo.addChunks] 数据库操作失败:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        docId,
        chunksCount: documentChunks.length,
        chunkMetaExample: chunkMetas[0]
      });
      throw error;
    }
  }

  public async markDocAsSynced(docId: DocId): Promise<void> {
    this.docs.update(docId, { updated_at: Date.now() });
  }

  /**
   * 获取所有集合的 ID。
   * @returns 包含所有集合 ID 的数组。
   */
  public async getAllCollectionIds(): Promise<CollectionId[]> {
    const collections = this.collections.listAll();
    return collections.map((c) => c.collectionId);
  }
}
