import { Logger } from '@logging/logger.js';
import { TypeORMRepositoryCollections } from './TypeORMRepositoryCollections.js';
import {
  DocId,
  CollectionId,
  DocumentChunk,
  Doc as DomainDoc,
} from '@domain/entities/types.js';

/**
 * TypeORM Repository 文档相关操作方法
 */
export class TypeORMRepositoryDocuments extends TypeORMRepositoryCollections {
  /**
   * 删除一个文档及其所有关联的块
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  deleteDoc(docId: DocId): boolean {
    // 为了保持接口兼容性，这里返回false
    // 实际使用应该调用异步版本
    this.logger.warn(`deleteDoc是同步方法，请使用asyncDeleteDoc`);
    return false;
  }

  /**
   * 异步版本的deleteDoc
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  async asyncDeleteDoc(docId: DocId): Promise<boolean> {
    return await this.asyncTransaction(async () => {
      // 删除关联的块
      await this.chunkRepository.deleteByDocId(docId);

      // 删除文档
      const success = await this.docs.delete(docId);

      if (success) {
        this.logger.info(`删除文档成功`, { docId });
      }

      return success;
    });
  }

  /**
   * 获取文档
   * @param docId 文档ID
   * @returns 文档对象
   */
  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    try {
      const doc = await this.docRepository.findById(docId as unknown as string);
      // 转换为领域类型
      if (doc) {
        return {
          id: doc.key as DocId, // 使用key字段作为id
          docId: doc.key as DocId, // 向后兼容
          collectionId: doc.collectionId as CollectionId,
          key: doc.key,
          name: doc.name,
          size_bytes: doc.size_bytes,
          mime: doc.mime,
          created_at:
            typeof doc.created_at === 'number'
              ? doc.created_at
              : (doc.created_at as Date)?.getTime?.() || Date.now(),
          updated_at:
            typeof doc.updated_at === 'number'
              ? doc.updated_at
              : (doc.updated_at as Date)?.getTime?.() || Date.now(),
          deleted: doc.deleted,
          content: doc.content,
        } as DomainDoc;
      }
      return undefined;
    } catch (error) {
      this.logger.error(`获取文档失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 添加文档块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    await this.asyncTransaction(async () => {
      const chunks = documentChunks.map((chunk, index) => ({
        pointId: `${docId}_${index}`,
        docId,
        collectionId: '', // DocumentChunk没有collectionId字段，使用空字符串
        chunkIndex: index,
        title: chunk.titleChain?.join(' > ') || '', // 使用titleChain
        content: chunk.content,
      }));

      await this.chunkRepository.createBatch(chunks);

      this.logger.debug(`添加文档块成功`, {
        docId,
        count: chunks.length,
      });
    });
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    try {
      // 这里需要在Doc实体中添加同步状态字段，暂时只记录日志
      this.logger.debug(`标记文档为已同步`, { docId });
      // 实际实现需要在Doc实体中添加synced_at字段
    } catch (error) {
      this.logger.error(`标记文档为已同步失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  listDeletedDocs(): DomainDoc[] {
    // 同步方法 - 委托到 docs 适配器
    // 由于 TypeORM 是异步的，这里返回空数组
    // 实际使用应调用 docs.findDeleted() 异步方法
    this.logger.warn(
      `listDeletedDocs是同步方法但 TypeORM 是异步的，请使用 docs.findDeleted()`,
    );
    return [];
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   */
  async hardDelete(docId: DocId): Promise<void> {
    try {
      await this.docs.delete(docId);
      this.logger.debug(`硬删除文档成功`, { docId });
    } catch (error) {
      this.logger.error(`硬删除文档失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
