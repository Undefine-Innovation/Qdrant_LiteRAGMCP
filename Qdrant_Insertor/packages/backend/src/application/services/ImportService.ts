import path from 'path';
import { CollectionId, Doc, DocId } from '@domain/entities/types.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { IFileLoader } from '@domain/services/loader.js';
import { ISplitter } from '@domain/services/splitter.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { AppError } from '@api/contracts/error.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { SyncStateMachine } from './SyncStateMachine.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';

/**
 *
 */
export class ImportService implements IImportService {
  /**
   *
   * @param fileLoader
   * @param splitter
   * @param embeddingProvider
   * @param sqliteRepo
   * @param qdrantRepo
   * @param logger
   * @param syncStateMachine
   */
  constructor(
    private readonly fileLoader: IFileLoader,
    private readonly splitter: ISplitter,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly syncStateMachine:
      | SyncStateMachine
      | PersistentSyncStateMachine,
  ) {}

  /**
   *
   * @param filePath
   * @param collectionId
   */
  public async importDocument(
    filePath: string,
    collectionId: CollectionId,
  ): Promise<Doc> {
    this.logger.info(`Starting document import for: ${filePath}`);
    try {
      const collection = this.sqliteRepo.collections.getById(collectionId);
      if (!collection) {
        throw AppError.createNotFoundError('Collection not found.');
      }

      const loadedFile = await this.fileLoader.load(filePath);
      this.logger.info(`File loaded: ${loadedFile.fileName}`);

      const docId = this.sqliteRepo.docs.create({
        collectionId,
        key: filePath,
        name: path.basename(filePath),
        mime: loadedFile.mimeType,
        size_bytes: loadedFile.content.length,
        content: loadedFile.content,
      });
      this.logger.info(`Document record created with id: ${docId}`);

      // 触发同步状态机
      await this.syncStateMachine.triggerSync(docId);

      const doc = this.sqliteRepo.docs.getById(docId);
      if (!doc) {
        throw AppError.createInternalServerError(
          `Failed to retrieve created doc with id: ${docId}`,
        );
      }
      return doc;
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
   *
   * @param file
   * @param collectionId
   */
  public async importUploadedFile(
    file: Express.Multer.File,
    collectionId: CollectionId,
  ): Promise<Doc> {
    this.logger.info(`Starting uploaded file import for: ${file.originalname}`);
    try {
      let collection = this.sqliteRepo.collections.getById(collectionId);
      let actualCollectionId = collectionId;

      if (!collection) {
        // 如果集合不存在，自动创建默认集合
        this.logger.info(
          `Collection ${collectionId} not found, creating it...`,
        );
        const newCollectionId = this.sqliteRepo.collections.create({
          name: collectionId,
          description: `Auto-created collection for ${collectionId}`,
        });
        collection = this.sqliteRepo.collections.getById(newCollectionId);
        if (!collection) {
          throw AppError.createInternalServerError(
            `Failed to create or retrieve collection: ${collectionId}`,
          );
        }
        actualCollectionId = collection.collectionId;
        this.logger.info(
          `Collection created with ID: ${collection.collectionId}`,
        );
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
      const docId = this.sqliteRepo.docs.create({
        collectionId: actualCollectionId,
        key: `uploaded_${file.originalname}_${Date.now()}`,
        name: file.originalname,
        mime: file.mimetype,
        size_bytes: file.size,
        content: uniqueContent,
      });
      this.logger.info(`Document record created with id: ${docId}`);

      // 触发同步状态机
      await this.syncStateMachine.triggerSync(docId);

      const doc = this.sqliteRepo.docs.getById(docId);
      if (!doc) {
        throw AppError.createInternalServerError(
          `Failed to retrieve created doc with id: ${docId}`,
        );
      }
      return doc;
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
   *
   * @param docId
   */
  public async resyncDocument(docId: DocId): Promise<Doc> {
    this.logger.info(`Resyncing document: ${docId}`);
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc || !doc.key) {
      throw AppError.createNotFoundError(
        `Document with id ${docId} not found or has no source file path.`,
      );
    }

    // To resync, we first delete the old document and its associated data,
    // then re-import it from the source file.
    await this.deleteDocument(docId);
    return this.importDocument(doc.key, doc.collectionId);
  }

  /**
   *
   * @param docId
   */
  public async deleteDocument(docId: DocId): Promise<void> {
    this.logger.info(`Deleting document: ${docId}`);
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      this.logger.warn(
        `Document with id ${docId} not found. Nothing to delete.`,
      );
      return; // Idempotent deletion
    }

    await this.qdrantRepo.deletePointsByDoc(docId);
    this.sqliteRepo.deleteDoc(docId); // 使用协调deleteDoc 方法
    this.logger.info(`成功删除文档 ${docId} 及其关联的向量点。`);
  }

  /**
   *
   * @param collectionId
   */
  public async deleteCollection(collectionId: CollectionId): Promise<void> {
    this.logger.info(`正在删除集合: ${collectionId}`);
    const collection = this.sqliteRepo.collections.getById(collectionId);
    if (!collection) {
      this.logger.warn(`未找到集合${collectionId}。无需删除。`);
      return; // 幂等删除
    }

    await this.qdrantRepo.deletePointsByCollection(collectionId);
    this.sqliteRepo.deleteCollection(collectionId); // 使用协调deleteCollection 方法
    this.logger.info(`成功删除集合 ${collectionId} 及其关联的向量点。`);
  }
}