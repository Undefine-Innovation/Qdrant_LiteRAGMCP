import path from 'path';
import { CollectionId, Doc, DocId } from '@domain/entities/types.js';
import { IFileLoader } from '@application/services/file-processing/index.js';
import { Logger } from '@logging/logger.js';
import { ErrorFactory } from '@domain/errors/ErrorFactory.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { CollectionRepository } from '@infrastructure/database/repositories/CollectionRepository.js';
import { SyncStateMachine } from '../sync/index.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

/**
 * 文档重新同步处理器
 * 负责处理文档的重新同步操作
 */
export class DocumentResyncProcessor {
  constructor(
    private readonly fileLoader: IFileLoader,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly syncStateMachine:
      | SyncStateMachine
      | PersistentSyncStateMachine,
    private readonly docRepository: DocRepository,
    private readonly collectionRepository: CollectionRepository,
  ) {}

  /**
   * 将TypeORM Doc实体转换为domain Doc类型
   * @param entity TypeORM实体
   * @returns domain类型
   */
  private toDoc(
    entity: import('@infrastructure/database/entities/Doc.js').Doc,
  ): Doc {
    return {
      id: entity.docId as DocId, // 使用docId作为业务标识符
      docId: entity.docId as DocId, // 向后兼容字段
      collectionId: entity.collectionId as CollectionId,
      key: entity.key,
      name: entity.name || '',
      size_bytes: entity.size_bytes || 0,
      mime: entity.mime || '',
      content: entity.content || undefined,
      content_hash: entity.content_hash || '',
      is_deleted: entity.deleted || false,
      status: entity.status || 'new',
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  /**
   * 重新同步文档
   * @param docId 文档ID
   * @returns {Promise<Doc>} 返回重新同步后的文档
   */
  public async resyncDocument(docId: DocId): Promise<Doc> {
    console.log(
      'DEBUG: DocumentResyncProcessor.resyncDocument called with docId:',
      docId,
    );
    this.logger.info(`Resyncing document: ${docId}`);

    console.log('DEBUG: About to find document by docId');
    // Find document by docId (business identifier, not key/file path)
    const docEntity = await this.docRepository.findById(docId);
    console.log('DEBUG: Found document entity:', docEntity);

    if (!docEntity) {
      console.log('DEBUG: Document not found');
      throw ErrorFactory.createNotFoundError('Document', docId);
    }

    // 保存文档的原始属性
    const originalKey = docEntity.key;
    const collectionId = docEntity.collectionId as CollectionId;
    const originalDocId = docEntity.docId; // 保存原始docId

    console.log(
      'DEBUG: Saved original docId:',
      originalDocId,
      'key:',
      originalKey,
      'collectionId:',
      collectionId,
    );

    // 删除旧文档和相关数据
    await this.deleteDocument(docId);
    console.log(
      'DEBUG: Document deleted, now reimporting from key:',
      originalKey,
    );

    // 重新加载文件内容
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw ErrorFactory.createNotFoundError('Collection', collectionId);
    }

    const loadedFile = await this.fileLoader.load(originalKey);
    this.logger.info(`File loaded for resync: ${loadedFile.fileName}`);

    // 使用原始docId重新创建文档（保持业务标识符不变）
    const newDoc = await this.docRepository.create({
      docId: originalDocId, // 使用原始docId而不是生成新的
      collectionId,
      key: originalKey,
      name: path.basename(originalKey),
      mime: loadedFile.mimeType,
      size_bytes: loadedFile.content.length,
      content_hash: '',
      content: loadedFile.content,
      status: 'new',
      deleted: false,
    });
    this.logger.info(`Document resynced with original id: ${originalDocId}`);

    // 触发同步状态机
    await this.syncStateMachine.triggerSync(originalDocId as DocId);

    return this.toDoc(newDoc);
  }

  /**
   * 删除文档（内部方法，用于重新同步过程）
   * @param docId 文档ID
   * @returns {Promise<void>}
   */
  private async deleteDocument(docId: DocId): Promise<void> {
    console.log(
      'DEBUG: DocumentResyncProcessor.deleteDocument called with docId:',
      docId,
    );
    this.logger.info(`Deleting document for resync: ${docId}`);

    console.log('DEBUG: About to find document for deletion');
    const doc = await this.docRepository.findById(docId);
    console.log('DEBUG: Found document for deletion:', doc);

    if (!doc) {
      console.log('DEBUG: Document not found for deletion');
      this.logger.warn(
        `Document with id ${docId} not found. Nothing to delete.`,
      );
      return; // Idempotent deletion
    }

    console.log('DEBUG: About to delete points from Qdrant');
    await this.qdrantRepo.deletePointsByDoc(docId);
    console.log('DEBUG: About to delete doc from TypeORM repository');

    // 使用TypeORM repository直接删除（硬删除）
    // 注意：Doc实体使用docId字段作为业务标识符
    await this.docRepository.delete(docId as string);

    console.log('DEBUG: Document deletion completed');
    this.logger.info(`成功删除文档 ${docId} 及其关联的向量点。`);
  }
}
