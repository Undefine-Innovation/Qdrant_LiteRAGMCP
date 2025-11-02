import { randomUUID } from 'crypto';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { Logger } from '@logging/logger.js';
import {
  IBatchService,
  BatchUploadResponse,
  BatchUploadResult,
  BatchDeleteDocsResponse,
  BatchDeleteCollectionsResponse,
  BatchDeleteResult,
  BatchOperationProgress,
} from '@domain/repositories/IBatchService.js';
import { Express } from 'express';
import { StateMachineService } from './StateMachineService.js';
import { StateMachineTask } from '@domain/state-machine/types.js';

/**
 * 批量操作服务实现
 * 提供文档和集合的批量操作功能
 */
export class BatchService implements IBatchService {
  // 存储批量操作进度信息
  private operationProgress: Map<string, BatchOperationProgress> = new Map();

  /**
   *
   * @param importService
   * @param collectionService
   * @param documentService
   * @param logger
   * @param stateMachineService
   */
  constructor(
    private readonly importService: IImportService,
    private readonly collectionService: ICollectionService,
    private readonly documentService: IDocumentService,
    private readonly logger: Logger,
    private readonly stateMachineService: StateMachineService,
  ) {}

  /**
   * 批量上传文档
   * @param files - 上传的文件列表
   * @param collectionId - 目标集合ID（可选）
   * @returns 批量上传响应
   */
  async batchUploadDocuments(
    files: Express.Multer.File[],
    collectionId?: CollectionId,
  ): Promise<BatchUploadResponse> {
    this.logger.info(`Starting batch upload of ${files.length} files`);

    const operationId = this.createBatchOperationProgress(
      'upload',
      files.length,
    );

    // 如果没有提供集合ID，获取或创建默认集合
    let actualCollectionId = collectionId;
    if (!actualCollectionId) {
      const collections = this.collectionService.listAllCollections();
      let defaultCollection = collections.find((c) => c.name === 'default');

      if (!defaultCollection) {
        defaultCollection = this.collectionService.createCollection(
          'default',
          'Default collection for uploads',
        );
      }
      actualCollectionId = defaultCollection.collectionId;
    }

    // 验证集合是否存在
    const collection =
      this.collectionService.getCollectionById(actualCollectionId);
    if (!collection) {
      throw new Error(`Collection with ID ${actualCollectionId} not found`);
    }

    // 创建状态机任务
    const filesForStateMachine = files.map(file => ({
      id: randomUUID(),
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    }));

    try {
      await this.stateMachineService.createBatchUploadTask(
        operationId,
        filesForStateMachine,
        actualCollectionId,
        {
          skipDuplicates: false,
          generateThumbnails: true,
          chunkSize: 1000,
        }
      );

      // 异步执行批量上传任务
      this.executeBatchUploadWithStateMachine(operationId, files, actualCollectionId)
        .catch(error => {
          this.logger.error(`Batch upload task failed: ${operationId}`, error);
          this.completeBatchOperation(operationId, false);
        });

      // 立即返回操作ID
      return {
        success: true,
        total: files.length,
        successful: 0,
        failed: 0,
        results: [],
      };
    } catch (error) {
      this.logger.error(`Failed to create batch upload task: ${operationId}`, error);
      throw error;
    }
  }

  /**
   * 使用状态机执行批量上传
   */
  private async executeBatchUploadWithStateMachine(
    operationId: string,
    files: Express.Multer.File[],
    collectionId: CollectionId,
  ): Promise<void> {
    const results: BatchUploadResult[] = [];
    let successful = 0;
    let failed = 0;

    // 更新状态为处理中
    this.updateBatchOperationProgress(operationId, 0, 0, 0, 'processing');

    try {
      // 执行状态机任务
      await this.stateMachineService.executeBatchUploadTask(operationId);

      // 处理每个文件
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          // 验证文件
          this.validateFile(file);

          // 上传文件
          const doc = await this.importService.importUploadedFile(
            file,
            collectionId,
          );

          results.push({
            fileName: file.originalname,
            docId: doc.docId,
            collectionId: doc.collectionId,
          });

          successful++;
          this.logger.info(`Successfully uploaded file: ${file.originalname}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.push({
            fileName: file.originalname,
            error: errorMessage,
          });

          failed++;
          this.logger.error(`Failed to upload file: ${file.originalname}`, {
            error: errorMessage,
          });
        }

        // 更新进度
        this.updateBatchOperationProgress(operationId, i + 1, successful, failed);
      }

      // 完成操作
      const overallSuccess = failed === 0;
      this.completeBatchOperation(operationId, overallSuccess);

      this.logger.info(
        `Batch upload completed: ${successful} successful, ${failed} failed`,
      );
    } catch (error) {
      this.logger.error(`Batch upload execution failed: ${operationId}`, error);
      this.completeBatchOperation(operationId, false);
      throw error;
    }
  }

  /**
   * 批量删除文档
   * @param docIds - 要删除的文档ID列表
   * @returns 批量删除文档响应
   */
  async batchDeleteDocuments(
    docIds: DocId[],
  ): Promise<BatchDeleteDocsResponse> {
    this.logger.info(`Starting batch delete of ${docIds.length} documents`);

    const operationId = this.createBatchOperationProgress(
      'delete',
      docIds.length,
    );
    const results: BatchDeleteResult[] = [];
    let successful = 0;
    let failed = 0;

    // 处理每个文档
    for (let i = 0; i < docIds.length; i++) {
      const docId = docIds[i];

      try {
        await this.documentService.deleteDocument(docId);

        results.push({
          id: docId,
          success: true,
        });

        successful++;
        this.logger.info(`Successfully deleted document: ${docId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: docId,
          success: false,
          error: errorMessage,
        });

        failed++;
        this.logger.error(`Failed to delete document: ${docId}`, {
          error: errorMessage,
        });
      }

      // 更新进度
      this.updateBatchOperationProgress(operationId, i + 1, successful, failed);
    }

    // 完成操作
    const overallSuccess = failed === 0;
    this.completeBatchOperation(operationId, overallSuccess);

    this.logger.info(
      `Batch delete completed: ${successful} successful, ${failed} failed`,
    );

    return {
      success: overallSuccess,
      total: docIds.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * 批量删除集合
   * @param collectionIds - 要删除的集合ID列表
   * @returns 批量删除集合响应
   */
  async batchDeleteCollections(
    collectionIds: CollectionId[],
  ): Promise<BatchDeleteCollectionsResponse> {
    this.logger.info(
      `Starting batch delete of ${collectionIds.length} collections`,
    );

    const operationId = this.createBatchOperationProgress(
      'delete',
      collectionIds.length,
    );
    const results: BatchDeleteResult[] = [];
    let successful = 0;
    let failed = 0;

    // 处理每个集合
    for (let i = 0; i < collectionIds.length; i++) {
      const collectionId = collectionIds[i];

      try {
        await this.collectionService.deleteCollection(collectionId);

        results.push({
          id: collectionId,
          success: true,
        });

        successful++;
        this.logger.info(`Successfully deleted collection: ${collectionId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: collectionId,
          success: false,
          error: errorMessage,
        });

        failed++;
        this.logger.error(`Failed to delete collection: ${collectionId}`, {
          error: errorMessage,
        });
      }

      // 更新进度
      this.updateBatchOperationProgress(operationId, i + 1, successful, failed);
    }

    // 完成操作
    const overallSuccess = failed === 0;
    this.completeBatchOperation(operationId, overallSuccess);

    this.logger.info(
      `Batch delete completed: ${successful} successful, ${failed} failed`,
    );

    return {
      success: overallSuccess,
      total: collectionIds.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * 获取批量操作进度
   * @param operationId - 操作ID
   * @returns 批量操作进度
   */
  async getBatchOperationProgress(
    operationId: string,
  ): Promise<BatchOperationProgress | null> {
    // 首先尝试从状态机获取进度
    const task = await this.stateMachineService.getTaskStatus(operationId);
    if (task) {
      return this.convertStateMachineTaskToProgress(task);
    }

    // 如果状态机中没有，从内存中获取
    const progress = this.operationProgress.get(operationId);
    if (!progress) {
      return null;
    }

    // 计算预估剩余时间
    if (progress.status === 'processing' && progress.processed > 0) {
      const elapsed = Date.now() - progress.startTime;
      const avgTimePerItem = elapsed / progress.processed;
      const remainingItems = progress.total - progress.processed;
      progress.estimatedTimeRemaining = Math.ceil(
        (avgTimePerItem * remainingItems) / 1000,
      );
    }

    return progress;
  }

  /**
   * 获取批量操作任务列表
   * @param status - 可选的状态过滤器
   * @returns 批量操作任务列表
   */
  async getBatchOperationList(status?: string): Promise<StateMachineTask[]> {
    if (status) {
      return await this.stateMachineService.getTasksByStatus(status);
    } else {
      return await this.stateMachineService.getBatchUploadTasks();
    }
  }

  /**
   * 将状态机任务转换为批量操作进度
   */
  private convertStateMachineTaskToProgress(task: StateMachineTask): BatchOperationProgress {
    const context = task.context as {
      files?: Array<{ id: string; name: string; size: number; type: string; }>;
      results?: { successful: number; failed: number; };
    };
    return {
      operationId: task.id,
      type: task.taskType === 'batch_upload' ? 'upload' : 'delete',
      status: this.convertStateMachineStatus(task.status),
      total: context.files?.length || 0,
      processed: task.progress,
      successful: context.results?.successful || 0,
      failed: context.results?.failed || 0,
      startTime: task.createdAt,
      endTime: task.completedAt,
      estimatedTimeRemaining: task.status === 'PROCESSING' ? this.calculateEstimatedTime(task) : undefined,
    };
  }

  /**
   * 转换状态机状态为批量操作状态
   */
  private convertStateMachineStatus(status: string): BatchOperationProgress['status'] {
    switch (status) {
      case 'NEW':
        return 'pending';
      case 'PROCESSING':
      case 'VALIDATING':
      case 'UPLOADING':
      case 'INDEXING':
        return 'processing';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
      case 'CANCELLED':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * 计算预估剩余时间
   */
  private calculateEstimatedTime(task: StateMachineTask): number {
    if (!task.startedAt || task.progress <= 0) {
      return 0;
    }

    const elapsed = Date.now() - task.startedAt;
    const avgTimePerPercent = elapsed / task.progress;
    const remainingPercent = 100 - task.progress;
    
    return Math.ceil((avgTimePerPercent * remainingPercent) / 1000);
  }

  /**
   * 创建批量操作进度跟踪
   * @param type - 操作类型
   * @param total - 总项目数
   * @returns 操作ID
   */
  createBatchOperationProgress(
    type: 'upload' | 'delete',
    total: number,
  ): string {
    const operationId = randomUUID();
    const progress: BatchOperationProgress = {
      operationId,
      type,
      status: 'pending',
      total,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: Date.now(),
    };

    this.operationProgress.set(operationId, progress);
    this.logger.info(`Created batch operation progress: ${operationId}`, {
      type,
      total,
    });

    return operationId;
  }

  /**
   * 更新批量操作进度
   * @param operationId - 操作ID
   * @param processed - 已处理的项目数
   * @param successful - 成功的项目数
   * @param failed - 失败的项目数
   * @param status - 操作状态
   */
  updateBatchOperationProgress(
    operationId: string,
    processed: number,
    successful: number,
    failed: number,
    status?: BatchOperationProgress['status'],
  ): void {
    const progress = this.operationProgress.get(operationId);
    if (!progress) {
      return;
    }

    progress.processed = processed;
    progress.successful = successful;
    progress.failed = failed;

    if (status) {
      progress.status = status;
    } else if (progress.status === 'pending' && processed > 0) {
      progress.status = 'processing';
    }

    this.logger.debug(`Updated batch operation progress: ${operationId}`, {
      processed,
      successful,
      failed,
      status: progress.status,
    });
  }

  /**
   * 完成批量操作
   * @param operationId - 操作ID
   * @param success - 操作是否成功
   */
  completeBatchOperation(operationId: string, success: boolean): void {
    const progress = this.operationProgress.get(operationId);
    if (!progress) {
      return;
    }

    progress.status = success ? 'completed' : 'failed';
    progress.endTime = Date.now();

    this.logger.info(`Completed batch operation: ${operationId}`, {
      success,
      duration: progress.endTime - progress.startTime,
    });

    // 30分钟后清理进度信息
    setTimeout(
      () => {
        this.operationProgress.delete(operationId);
        this.logger.debug(
          `Cleaned up batch operation progress: ${operationId}`,
        );
      },
      30 * 60 * 1000,
    );
  }

  /**
   * 验证文件
   * @param file - 要验证的文件
   */
  private validateFile(file: Express.Multer.File): void {
    // 检查文件大小限制
    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      throw new Error(`File size exceeds maximum limit of 10MB`);
    }

    // 检查文件类型
    const allowedMimeTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(
        `File type ${file.mimetype} is not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }
}