import { CollectionId, Doc, DocId } from '@domain/entities/types.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { IFileLoader } from '@application/services/file-processing/index.js';
import { ISplitter } from '@application/services/file-processing/index.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { IImportService } from '@application/services/index.js';
import { ITransactionManager } from '@domain/repositories/ITransactionManager.js';
import { SyncStateMachine } from '../sync/index.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { CollectionRepository } from '@infrastructure/database/repositories/CollectionRepository.js';
import { DocumentImportProcessor } from './DocumentImportProcessor.js';
import { DocumentResyncProcessor } from './DocumentResyncProcessor.js';
import { DocumentDeletionProcessor } from './DocumentDeletionProcessor.js';
import { CollectionDeletionProcessor } from './CollectionDeletionProcessor.js';

/**
 * 导入服务实现类
 * 负责协调文档的导入、重新同步和删除操作
 */
export class ImportService implements IImportService {
  private readonly importProcessor: DocumentImportProcessor;
  private readonly resyncProcessor: DocumentResyncProcessor | null;
  private readonly deletionProcessor: DocumentDeletionProcessor | null;
  private readonly collectionDeletionProcessor: CollectionDeletionProcessor;

  /**
   * 创建导入服务实例
   * @param fileLoader 文件加载器
   * @param splitter 文本分割器
   * @param embeddingProvider 嵌入提供者
   * @param sqliteRepo SQLite 仓库实例
   * @param qdrantRepo Qdrant 仓库实例
   * @param logger 日志记录器
   * @param syncStateMachine 同步状态机
   * @param transactionManager 事务管理器（可选）
   * @param docRepository TypeORM文档仓库
   * @param collectionRepository TypeORM集合仓库
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
    private readonly transactionManager?: ITransactionManager,
    private readonly docRepository?: DocRepository,
    private readonly collectionRepository?: CollectionRepository,
  ) {
    // 初始化各个处理器
    this.importProcessor = new DocumentImportProcessor(
      fileLoader,
      sqliteRepo,
      logger,
      syncStateMachine,
      transactionManager,
      docRepository,
      collectionRepository,
    );

    // 只有在所有必需的依赖都可用时才初始化重新同步处理器
    if (docRepository && collectionRepository) {
      this.resyncProcessor = new DocumentResyncProcessor(
        fileLoader,
        qdrantRepo,
        logger,
        syncStateMachine,
        docRepository,
        collectionRepository,
      );
    } else {
      this.resyncProcessor = null;
    }

    // 只有在docRepository可用时才初始化删除处理器
    if (docRepository) {
      this.deletionProcessor = new DocumentDeletionProcessor(
        qdrantRepo,
        logger,
        docRepository,
      );
    } else {
      this.deletionProcessor = null;
    }

    // 初始化集合删除处理器
    this.collectionDeletionProcessor = new CollectionDeletionProcessor(
      qdrantRepo,
      sqliteRepo,
      logger,
    );
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
    return this.importProcessor.importDocument(filePath, collectionId);
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
    return this.importProcessor.importUploadedFile(file, collectionId);
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
    return this.importProcessor.importText(name, content, collectionId);
  }

  /**
   * 重新同步文档
   * @param docId 文档ID
   * @returns {Promise<Doc>} 返回重新同步后的文档
   */
  public async resyncDocument(docId: DocId): Promise<Doc> {
    if (!this.resyncProcessor) {
      throw new Error('DocumentResyncProcessor not initialized');
    }
    return this.resyncProcessor.resyncDocument(docId);
  }

  /**
   * 删除文档
   * @param docId 文档ID
   * @returns {Promise<void>}
   */
  public async deleteDocument(docId: DocId): Promise<void> {
    if (!this.deletionProcessor) {
      throw new Error('DocumentDeletionProcessor not initialized');
    }
    return this.deletionProcessor.deleteDocument(docId);
  }

  /**
   * 删除集合
   * @param collectionId 集合ID
   * @returns {Promise<void>}
   */
  public async deleteCollection(collectionId: CollectionId): Promise<void> {
    return this.collectionDeletionProcessor.deleteCollection(collectionId);
  }
}
