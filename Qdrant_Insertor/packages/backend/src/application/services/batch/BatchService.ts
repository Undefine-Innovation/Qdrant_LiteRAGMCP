import { CollectionId, DocId } from '@domain/entities/types.js';
import {
  IBatchService,
  BatchUploadResponse,
  BatchDeleteDocsResponse,
  BatchDeleteCollectionsResponse,
  BatchOperationProgress,
  IImportService,
  ICollectionService,
  IDocumentService,
} from '@application/services/index.js';
import { StateMachineTask } from '@domain/state-machine/types.js';
import { BatchUploadService } from './BatchUploadService.js';
import { BatchDeleteService } from './BatchDeleteService.js';
import { BatchProgressService } from './BatchProgressService.js';
import { Logger } from '@logging/logger.js';
import { IStateMachineService } from '@domain/repositories/IStateMachineService.js';
import { StateMachineService } from '../state-machine/StateMachineService.js';

/**
 * 批量服务实现
 * 提供文档和集合的批量操作功能
 *
 * 此文件已重构为多个模块以提高可维护性：
 * - BatchUploadService: 批量上传功能
 * - BatchDeleteService: 批量删除功能
 * - BatchProgressService: 进度管理功能
 */
export class BatchService implements IBatchService {
  private readonly uploadService: BatchUploadService;
  private readonly deleteService: BatchDeleteService;
  private readonly progressService: BatchProgressService;

  constructor(
    importService: IImportService,
    collectionService: ICollectionService,
    documentService: IDocumentService,
    logger: Logger,
    stateMachineService: IStateMachineService,
  ) {
    // 创建内部服务实例
    this.uploadService = new BatchUploadService(
      importService,
      collectionService,
      logger,
      stateMachineService,
    );
    this.deleteService = new BatchDeleteService(
      documentService,
      collectionService,
      logger,
    );
    this.progressService = new BatchProgressService(
      stateMachineService,
      logger,
    );
  }

  // 批量上传方法 - 委托给BatchUploadService
  async batchUploadDocuments(
    files: Express.Multer.File[],
    collectionId?: CollectionId,
  ): Promise<BatchUploadResponse> {
    return this.uploadService.batchUploadDocuments(files, collectionId);
  }

  // 批量删除文档方法 - 委托给BatchDeleteService
  async batchDeleteDocuments(
    docIds: DocId[],
  ): Promise<BatchDeleteDocsResponse> {
    return this.deleteService.batchDeleteDocuments(docIds);
  }

  // 批量删除集合方法 - 委托给BatchDeleteService
  async batchDeleteCollections(
    collectionIds: CollectionId[],
  ): Promise<BatchDeleteCollectionsResponse> {
    return this.deleteService.batchDeleteCollections(collectionIds);
  }

  // 批量删除块方法 - 委托给BatchDeleteService
  async batchDeleteChunks(
    chunkPointIds: string[],
  ): Promise<BatchDeleteDocsResponse> {
    return this.deleteService.batchDeleteChunks(chunkPointIds);
  }

  // 进度管理方法 - 委托给BatchProgressService
  async getBatchOperationProgress(
    operationId: string,
  ): Promise<BatchOperationProgress | null> {
    return this.progressService.getBatchOperationProgress(operationId);
  }

  // 进度管理方法（别名） - 委托给BatchProgressService
  async getBatchProgress(
    operationId: string,
  ): Promise<BatchOperationProgress | null> {
    return this.progressService.getBatchProgress(operationId);
  }

  // 获取批量操作任务列表 - 委托给BatchProgressService
  async getBatchOperationList(status?: string): Promise<StateMachineTask[]> {
    return this.progressService.getBatchOperationList(status);
  }

  // 实现接口要求的进度管理方法
  createBatchOperationProgress(
    type: 'upload' | 'delete',
    total: number,
  ): string {
    return this.progressService.createBatchOperationProgress(type, total);
  }

  updateBatchOperationProgress(
    operationId: string,
    processed: number,
    successful: number,
    failed: number,
    status?: 'pending' | 'processing' | 'completed' | 'failed',
  ): void {
    this.progressService.updateBatchOperationProgress(
      operationId,
      processed,
      successful,
      failed,
      status,
    );
  }

  completeBatchOperation(operationId: string, success: boolean): void {
    this.progressService.completeBatchOperation(operationId, success);
  }
}
