import path from 'path';
import {
  CollectionId,
  Doc,
  DocId,
} from '@domain/types.js';
import { IEmbeddingProvider } from '../domain/embedding.js';
import { IFileLoader } from '../domain/loader.js';
import { ISplitter } from '../domain/splitter.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { AppError } from '../api/contracts/error.js';
import { IImportService } from '../domain/IImportService.js';
import { SyncStateMachine } from './SyncStateMachine.js';

export class ImportService implements IImportService {
  constructor(
    private readonly fileLoader: IFileLoader,
    private readonly splitter: ISplitter,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly syncStateMachine: SyncStateMachine,
  ) {}

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

  public async deleteDocument(docId: DocId): Promise<void> {
    this.logger.info(`Deleting document: ${docId}`);
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      this.logger.warn(`Document with id ${docId} not found. Nothing to delete.`);
      return; // Idempotent deletion
    }

    await this.qdrantRepo.deletePointsByDoc(docId);
    this.sqliteRepo.deleteDoc(docId); // 使用协调的 deleteDoc 方法
    this.logger.info(`成功删除文档 ${docId} 及其关联的向量点。`);
  }

  public async deleteCollection(collectionId: CollectionId): Promise<void> {
    this.logger.info(`正在删除集合: ${collectionId}`);
    const collection = this.sqliteRepo.collections.getById(collectionId);
    if (!collection) {
      this.logger.warn(`未找到集合 ${collectionId}。无需删除。`);
      return; // 幂等删除
    }

    await this.qdrantRepo.deletePointsByCollection(collectionId);
    this.sqliteRepo.deleteCollection(collectionId); // 使用协调的 deleteCollection 方法
    this.logger.info(
      `成功删除集合 ${collectionId} 及其关联的向量点。`,
    );
  }
}