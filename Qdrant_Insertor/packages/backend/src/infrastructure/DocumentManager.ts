import { SQLiteRepoCore } from './SQLiteRepoCore.js';
import { Logger } from '../logger.js';
import { DocId, DocumentChunk, Doc } from '../domain/types.js';
import { DocsTable } from './sqlite/dao/DocsTable.js';
import { ChunkMetaTable } from './sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from './sqlite/dao/ChunksFts5Table.js';

/**
 * 文档管理器
 * 负责文档相关的数据库操作
 */
export class DocumentManager {
  constructor(
    private readonly docs: {
      getById: (id: DocId) => Doc | undefined;
      update: (id: DocId, data: Partial<Doc>) => void;
      create: (data: Omit<Doc, 'docId'>) => DocId;
      hardDelete: (id: DocId) => void;
      chunkMeta: ChunkMetaTable;
      chunksFts5: ChunksFts5Table;
    }, // DocsTable
    private readonly core: SQLiteRepoCore,
    private readonly logger: Logger,
  ) {}

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
      this.logger.error('updateDoc: Document not found', docId);
      return null;
    }

    const newDocId = this.makeDocId(content);

    // 情况 1: 内容未改变，只更新元数据。
    if (newDocId === docId) {
      this.docs.update(docId, { name, mime });
      return this.docs.getById(docId) ?? null;
    }

    // 情况 2: 内容已改变，替换文档。
    const { collectionId, key } = existingDoc;
    this.core.transaction(() => {
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
      created_at: Date.now(),
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
      this.logger.warn('deleteDoc: no such docId', docId);
      return false;
    }

    this.core.transaction(() => {
      this.docs.chunkMeta.deleteByDocId(docId);
      this.docs.chunksFts5.deleteByDocId(docId);
      this.docs.hardDelete(docId);
    });
    return true;
  }

  /**
   * 获取文档
   * @param docId - 文档ID
   * @returns 文档对象
   */
  async getDoc(docId: DocId): Promise<Doc | undefined> {
    return this.docs.getById(docId) ?? undefined;
  }

  /**
   * 标记文档为已同步
   * @param docId - 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    this.docs.update(docId, { updated_at: Date.now() });
  }

  /**
   * 生成文档ID
   * @param content - 文档内容
   * @returns 文档ID
   */
  private makeDocId(content: string | Uint8Array): DocId {
    // 这里应该使用实际的ID生成逻辑
    // 暂时返回一个简单的哈希值
    const contentStr =
      typeof content === 'string' ? content : new TextDecoder().decode(content);
    return `doc_${contentStr.length}_${Date.now()}` as DocId;
  }
}
