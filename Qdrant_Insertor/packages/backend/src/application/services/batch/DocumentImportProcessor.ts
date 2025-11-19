import path from 'path';
import { CollectionId, Doc, DocId } from '@domain/entities/types.js';
import type { Doc as DocEntity } from '@infrastructure/database/entities/Doc.js';
import { IFileLoader } from '@application/services/file-processing/index.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { ErrorFactory } from '@domain/errors/ErrorFactory.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { CollectionRepository } from '@infrastructure/database/repositories/CollectionRepository.js';
import { SyncStateMachine } from '../sync/index.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
import { makeDocId } from '@domain/utils/id.js';
import {
  ITransactionManager,
  TransactionOperationType,
} from '@domain/repositories/ITransactionManager.js';

type SQLiteCollectionRecord = {
  id?: CollectionId;
  collectionId?: CollectionId;
  [key: string]: unknown;
};

/**
 * 文档导入处理器
 * 负责处理各种类型的文档导入操作
 */
export class DocumentImportProcessor {
  constructor(
    private readonly fileLoader: IFileLoader,
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
    private readonly syncStateMachine:
      | SyncStateMachine
      | PersistentSyncStateMachine,
    private readonly transactionManager?: ITransactionManager,
    private readonly docRepository?: DocRepository,
    private readonly collectionRepository?: CollectionRepository,
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
   * 根据上传文件名生成唯一的文档key
   * @param originalname - 原始文件名
   * @returns 生成的文档key
   */
  private generateUploadedDocKey(originalname: string): DocId {
    const uniqueSuffix = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    return `upload_${uniqueSuffix}_${originalname}` as DocId;
  }

  /**
   * ���SQLite�洢�����еļ���ID
   * @param record SQLite ������¼
   * @param fallbackId ��ȷȷ������ʶ��ʱʹ�õı���ֵ
   * @returns �����еļ���ID
   */
  private resolveCollectionId(
    record: SQLiteCollectionRecord,
    fallbackId: CollectionId,
  ): CollectionId {
    return (record.id ?? record.collectionId ?? fallbackId) as CollectionId;
  }

  /**
   * 从文件路径导入文档
   * @param filePath 文件路径
   * @param collectionId 集合ID
   * @returns {Promise<Doc>} 返回导入的文档
   */
  public async importDocument(
    filePath: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    this.logger.info(`Starting document import for: ${filePath}`);

    // 如果有事务管理器，使用事务管理器处理
    if (this.transactionManager) {
      return this.importDocumentWithTransaction(filePath, collectionId);
    }

    // 回退到原始实现
    return this.importDocumentWithoutTransaction(filePath, collectionId);
  }

  /**
   * 使用事务管理器导入文档
   * @param filePath 文件路径
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importDocumentWithTransaction(
    filePath: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    const _res1 = await this.transactionManager!.executeInTransaction<Doc>(
      async (context) => {
        // 记录创建文档操作
        await this.transactionManager!.executeOperation(context.transactionId, {
          type: TransactionOperationType.CREATE,
          target: 'document',
          targetId: '' as DocId, // 将在创建后设置
          data: { filePath, collectionId, operation: 'importDocument' },
        });

        if (!this.collectionRepository) {
          throw ErrorFactory.createInternalServerError(
            'CollectionRepository not initialized',
          );
        }

        const collection =
          await this.collectionRepository.findById(collectionId);
        if (!collection) {
          throw ErrorFactory.createNotFoundError('Collection', collectionId);
        }

        const loadedFile = await this.fileLoader.load(filePath);
        this.logger.info(`File loaded: ${loadedFile.fileName}`);

        if (!this.docRepository) {
          throw ErrorFactory.createInternalServerError(
            'DocRepository not initialized',
          );
        }

        // 生成docId（基于内容的哈希）
        const docId = makeDocId(loadedFile.content) as DocId;
        this.logger.info(`Generated docId: ${docId} for file: ${filePath}`);

        const newDoc = await this.docRepository.create({
          docId,
          collectionId,
          key: filePath,
          name: path.basename(filePath),
          mime: loadedFile.mimeType,
          size_bytes: loadedFile.content.length,
          content_hash: '', // 添加content_hash字段
          content: loadedFile.content,
          status: 'new',
          deleted: false,
        });
        this.logger.info(`Document record created with id: ${docId}`);

        // 更新操作记录中的targetId
        const operations = context.operations;
        const lastOperation = operations[operations.length - 1];
        if (lastOperation && lastOperation.targetId === ('' as DocId)) {
          lastOperation.targetId = docId;
        }

        // 触发同步状态机
        await this.syncStateMachine.triggerSync(docId);

        return this.toDoc(newDoc);
      },
      { operation: 'importDocument', filePath, collectionId },
    );
    return _res1 as Doc;
  }

  /**
   * 不使用事务管理器导入文档（原始实现）
   * @param filePath 文件路径
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importDocumentWithoutTransaction(
    filePath: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    try {
      if (!this.collectionRepository) {
        throw ErrorFactory.createInternalServerError(
          'CollectionRepository not initialized',
        );
      }

      const collection = await this.collectionRepository.findById(collectionId);
      if (!collection) {
        throw ErrorFactory.createNotFoundError('Collection', collectionId);
      }

      const loadedFile = await this.fileLoader.load(filePath);
      this.logger.info(`File loaded: ${loadedFile.fileName}`);

      if (!this.docRepository) {
        throw ErrorFactory.createInternalServerError(
          'DocRepository not initialized',
        );
      }

      // 生成docId（基于内容的哈希）
      const docId = makeDocId(loadedFile.content) as DocId;
      this.logger.info(`Generated docId: ${docId} for file: ${filePath}`);

      const newDoc = await this.docRepository.create({
        docId,
        collectionId,
        key: filePath,
        name: path.basename(filePath),
        mime: loadedFile.mimeType,
        size_bytes: loadedFile.content.length,
        content_hash: '', // 添加content_hash字段
        content: loadedFile.content,
        status: 'new',
        deleted: false,
      });
      this.logger.info(`Document record created with id: ${docId}`);

      // 触发同步状态机
      await this.syncStateMachine.triggerSync(docId);

      return this.toDoc(newDoc);
    } catch (error) {
      this.logger.error('Error during document import process.', {
        error,
        filePath,
        collectionId,
      });
      throw error;
    }
  }

  /**
   * 从上传的文件导入文档
   * @param file 上传的文件
   * @param collectionId 集合ID
   * @returns {Promise<Doc>} 返回导入的文档
   */
  public async importUploadedFile(
    file: Express.Multer.File,
    collectionId: CollectionId,
  ): Promise<Doc> {
    this.logger.info(`Starting uploaded file import for: ${file.originalname}`);

    // 如果有事务管理器，使用事务管理器处理
    if (this.transactionManager) {
      return this.importUploadedFileWithTransaction(file, collectionId);
    }

    // 回退到原始实现
    return this.importUploadedFileWithoutTransaction(file, collectionId);
  }

  /**
   * 使用事务管理器导入上传的文件
   * @param file 上传的文件
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importUploadedFileWithTransaction(
    file: Express.Multer.File,
    collectionId: CollectionId,
  ): Promise<Doc> {
    const _res2 = await this.transactionManager!.executeInTransaction<Doc>(
      async (context) => {
        let actualCollectionId = collectionId;
        const docKey = this.generateUploadedDocKey(file.originalname);

        // 使用TypeORM repository检查集合是否存在
        if (!this.collectionRepository) {
          throw ErrorFactory.createInternalServerError(
            'CollectionRepository not initialized',
          );
        }

        let collection = await this.collectionRepository.findById(collectionId);

        // 检查是否需要创建集合
        if (!collection) {
          // 记录创建集合操作
          await this.transactionManager!.executeOperation(
            context.transactionId,
            {
              type: TransactionOperationType.CREATE,
              target: 'collection',
              targetId: collectionId,
              data: {
                name: collectionId,
                description: `Auto-created collection for ${collectionId}`,
                operation: 'importUploadedFile',
              },
            },
          );

          // 如果集合不存在，自动创建默认集合
          this.logger.info(
            `Collection ${collectionId} not found, creating it...`,
          );

          collection = await this.collectionRepository.create({
            name: collectionId,
            description: `Auto-created collection for ${collectionId}`,
          });

          if (!collection) {
            throw ErrorFactory.createInternalServerError(
              `Failed to create or retrieve collection: ${collectionId}`,
            );
          }
          actualCollectionId = collection.id as CollectionId;
          this.logger.info(`Collection created with ID: ${actualCollectionId}`);
        }

        // 记录创建文档操作
        await this.transactionManager!.executeOperation(context.transactionId, {
          type: TransactionOperationType.CREATE,
          target: 'document',
          targetId: '' as DocId, // 将在创建后设置
          data: {
            key: docKey,
            fileName: file.originalname,
            collectionId: actualCollectionId,
            operation: 'importUploadedFile',
          },
        });

        // 将上传的文件转换为与文件加载器兼容的格式
        const loadedFile = {
          fileName: file.originalname,
          mimeType: file.mimetype,
          content: file.buffer.toString('utf-8'),
        };
        this.logger.info(`File loaded: ${loadedFile.fileName}`);

        // 为了避免相同内容导致的docId冲突，我们在内容前添加时间戳
        const uniqueContent = `${Date.now()}_${loadedFile.content}`;

        // 生成docId（基于唯一内容的哈希）
        const docId = makeDocId(uniqueContent) as DocId;
        this.logger.info(
          `Generated docId: ${docId} for file: ${file.originalname}`,
        );

        // 使用TypeORM repository创建文档
        if (!this.docRepository) {
          throw ErrorFactory.createInternalServerError(
            'DocRepository not initialized',
          );
        }

        const newDoc = await this.docRepository.create({
          docId,
          collectionId: actualCollectionId,
          key: docKey,
          name: file.originalname,
          mime: file.mimetype,
          size_bytes: file.size,
          content_hash: '', // 添加content_hash字段
          content: uniqueContent,
          status: 'new',
          deleted: false,
        });
        this.logger.info(`Document record created with id: ${docId}`);

        // 更新操作记录中的targetId
        const operations = context.operations;
        const lastOperation = operations[operations.length - 1];
        if (lastOperation && lastOperation.targetId === ('' as DocId)) {
          lastOperation.targetId = docId;
        }

        // 触发同步状态机
        await this.syncStateMachine.triggerSync(docId);

        return this.toDoc(newDoc);
      },
      {
        operation: 'importUploadedFile',
        fileName: file.originalname,
        collectionId,
      },
    );
    return _res2 as Doc;
  }

  /**
   * 不使用事务管理器导入上传文件（原始实现）
   * @param file 上传的文件
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importUploadedFileWithoutTransaction(
    file: Express.Multer.File,
    collectionId: CollectionId,
  ): Promise<Doc> {
    try {
      const collection = this.sqliteRepo.collections.getById(collectionId);
      const docKey = this.generateUploadedDocKey(file.originalname);
      if (!collection) {
        throw ErrorFactory.createNotFoundError('Collection', collectionId);
      }

      // 将上传的文件转换为与文件加载器兼容的格式
      const loadedFile = {
        fileName: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer.toString('utf-8'),
      };
      this.logger.info(`File loaded: ${loadedFile.fileName}`);

      // 为了避免相同内容导致的docId冲突，我们在内容前添加时间戳
      const uniqueContent = `${Date.now()}_${loadedFile.content}`;

      // 生成docId（基于唯一内容的哈希）
      const docId = makeDocId(uniqueContent) as DocId;
      this.logger.info(
        `Generated docId: ${docId} for file: ${file.originalname}`,
      );

      if (!this.docRepository) {
        throw ErrorFactory.createInternalServerError(
          'DocRepository not initialized',
        );
      }

      const newDoc = await this.docRepository.create({
        docId,
        collectionId,
        key: docKey,
        name: file.originalname,
        mime: file.mimetype,
        size_bytes: file.size,
        content_hash: '', // 添加content_hash字段
        content: uniqueContent,
        status: 'new',
        deleted: false,
      });
      this.logger.info(`Document record created with id: ${docId}`);

      // 触发同步状态机
      await this.syncStateMachine.triggerSync(docId);

      return this.toDoc(newDoc);
    } catch (error) {
      this.logger.error('Error during uploaded file import process.', {
        error,
        fileName: file.originalname,
        collectionId,
      });
      throw error;
    }
  }

  /**
   * 从文本直接导入文档
   * @param name 文档名称
   * @param content 文档内容
   * @param collectionId 集合ID
   * @returns {Promise<Doc>} 返回导入的文档
   */
  public async importText(
    name: string,
    content: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    this.logger.info(`Starting text import: ${name}`);

    // 如果有事务管理器，使用事务管理器处理
    if (this.transactionManager) {
      return this.importTextWithTransaction(name, content, collectionId);
    }

    // 回退到原始实现
    return this.importTextWithoutTransaction(name, content, collectionId);
  }

  /**
   * 使用事务管理器导入文本
   * @param name 文档名称
   * @param content 文档内容
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importTextWithTransaction(
    name: string,
    content: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    const _res3 = await this.transactionManager!.executeInTransaction<Doc>(
      async (context) => {
        const collection = this.sqliteRepo.collections.getById(collectionId);
        let actualCollectionId = collectionId;

        // 检查是否需要创建集合
        if (!collection) {
          // 记录创建集合操作
          await this.transactionManager!.executeOperation(
            context.transactionId,
            {
              type: TransactionOperationType.CREATE,
              target: 'collection',
              targetId: collectionId,
              data: {
                name: collectionId,
                description: `Auto-created collection for ${collectionId}`,
                operation: 'importText',
              },
            },
          );

          this.logger.info(
            `Collection ${collectionId} not found, creating it...`,
          );
          const newCollectionId = this.sqliteRepo.collections.create({
            name: collectionId,
            description: `Auto-created collection for ${collectionId}`,
          }) as CollectionId;
          const createdCollection = this.sqliteRepo.collections.getById(
            newCollectionId,
          ) as SQLiteCollectionRecord | undefined;
          if (!createdCollection) {
            throw ErrorFactory.createInternalServerError(
              `Failed to create or retrieve collection: ${collectionId}`,
            );
          }
          actualCollectionId = this.resolveCollectionId(
            createdCollection,
            collectionId,
          );
        }

        // 基于内容哈希的去重：如已存在则直接复用，避免主键冲突
        const candidateDocId = makeDocId(content) as DocId;

        if (!this.docRepository) {
          throw ErrorFactory.createInternalServerError(
            'DocRepository not initialized',
          );
        }

        const allDocs = await this.docRepository.findAll();
        const existing = allDocs.find(
          (d: DocEntity) => d.key === candidateDocId,
        );

        if (existing) {
          if (existing.collectionId !== actualCollectionId) {
            this.logger.warn(
              `Duplicate content detected for doc "${name}". Existing doc ${candidateDocId} belongs to collection ${existing.collectionId}, requested collection ${actualCollectionId}. Reusing existing doc to avoid PK conflicts.`,
            );
          } else {
            this.logger.info(
              `Duplicate content detected for doc "${name}" in the same collection. Reusing existing doc ${candidateDocId}.`,
            );
          }

          // 记录复用现有文档的操作
          await this.transactionManager!.executeOperation(
            context.transactionId,
            {
              type: TransactionOperationType.UPDATE,
              target: 'document',
              targetId: candidateDocId,
              data: {
                operation: 'reuse_existing_doc',
                reason: 'duplicate_content',
                name,
                collectionId: actualCollectionId,
              },
            },
          );

          await this.syncStateMachine.triggerSync(candidateDocId);
          return this.toDoc(
            existing as import('@infrastructure/database/entities/Doc.js').Doc,
          );
        }

        // 记录创建文档操作
        await this.transactionManager!.executeOperation(context.transactionId, {
          type: TransactionOperationType.CREATE,
          target: 'document',
          targetId: '' as DocId, // 将在创建后设置
          data: {
            name,
            collectionId: actualCollectionId,
            operation: 'importText',
            contentLength: content.length,
          },
        });

        // 生成docId（基于内容的哈希）
        const docId = makeDocId(content) as DocId;
        this.logger.info(`Generated docId: ${docId} for text: ${name}`);

        if (!this.docRepository) {
          throw ErrorFactory.createInternalServerError(
            'DocRepository not initialized',
          );
        }

        const newDoc = await this.docRepository.create({
          docId,
          collectionId: actualCollectionId,
          key: `text_${Date.now()}_${name}`,
          name,
          mime: 'text/markdown',
          size_bytes: Buffer.byteLength(content, 'utf-8'),
          content_hash: '', // 添加content_hash字段
          content,
          status: 'new',
          deleted: false,
        });
        this.logger.info(`Document created from text with id: ${docId}`);

        // 更新操作记录中的targetId
        const operations = context.operations;
        const lastOperation = operations[operations.length - 1];
        if (lastOperation && lastOperation.targetId === ('' as DocId)) {
          lastOperation.targetId = docId;
        }

        await this.syncStateMachine.triggerSync(docId);
        return this.toDoc(newDoc);
      },
      { operation: 'importText', name, collectionId },
    );
    return _res3 as Doc;
  }

  /**
   * 不使用事务管理器导入文本（原始实现）
   * @param name 文档名称
   * @param content 文档内容
   * @param collectionId 集合ID
   * @returns 导入的文档
   */
  private async importTextWithoutTransaction(
    name: string,
    content: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    try {
      const collection = this.sqliteRepo.collections.getById(collectionId);
      let actualCollectionId = collectionId;

      // 检查是否需要创建集合
      if (!collection) {
        this.logger.info(
          `Collection ${collectionId} not found, creating it...`,
        );
        const newCollectionId = this.sqliteRepo.collections.create({
          name: collectionId,
          description: `Auto-created collection for ${collectionId}`,
        }) as CollectionId;
        const createdCollection = this.sqliteRepo.collections.getById(
          newCollectionId,
        ) as SQLiteCollectionRecord | undefined;
        if (!createdCollection) {
          throw ErrorFactory.createInternalServerError(
            `Failed to create or retrieve collection: ${collectionId}`,
          );
        }
        actualCollectionId = this.resolveCollectionId(
          createdCollection,
          collectionId,
        );
      }

      // 基于内容哈希的去重：如已存在则直接复用，避免主键冲突
      const candidateDocId = makeDocId(content) as DocId;
      const existing = this.sqliteRepo.docs.getById(
        candidateDocId,
      ) as unknown as
        | import('@infrastructure/database/entities/Doc.js').Doc
        | undefined;
      if (existing) {
        if (existing.collectionId !== actualCollectionId) {
          this.logger.warn(
            `Duplicate content detected for doc "${name}". Existing doc ${candidateDocId} belongs to collection ${existing.collectionId}, requested collection ${actualCollectionId}. Reusing existing doc to avoid PK conflicts.`,
          );
        } else {
          this.logger.info(
            `Duplicate content detected for doc "${name}" in the same collection. Reusing existing doc ${candidateDocId}.`,
          );
        }

        await this.syncStateMachine.triggerSync(candidateDocId);
        return this.toDoc(
          existing as import('@infrastructure/database/entities/Doc.js').Doc,
        );
      }

      // 生成docId（基于内容的哈希）
      const docId = makeDocId(content) as DocId;
      this.logger.info(`Generated docId: ${docId} for text: ${name}`);

      if (!this.docRepository) {
        throw ErrorFactory.createInternalServerError(
          'DocRepository not initialized',
        );
      }

      const newDoc = await this.docRepository.create({
        docId,
        collectionId: actualCollectionId,
        key: `text_${Date.now()}_${name}`,
        name,
        mime: 'text/markdown',
        size_bytes: Buffer.byteLength(content, 'utf-8'),
        content_hash: '', // 添加content_hash字段
        content,
        status: 'new',
        deleted: false,
      });
      this.logger.info(`Document created from text with id: ${docId}`);

      await this.syncStateMachine.triggerSync(docId);
      return this.toDoc(newDoc);
    } catch (error) {
      this.logger.error('Error during text import process.', {
        error,
        name,
        collectionId,
      });
      throw error;
    }
  }
}
