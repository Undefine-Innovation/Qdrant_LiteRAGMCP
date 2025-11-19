// src/domain/state-machine/BatchUploadStrategy.ts

import { Logger } from '@logging/logger.js';
import { BaseStateMachineStrategy } from './BaseStateMachineStrategy.js';
import {
  StateMachineConfig,
  StateMachineTask,
  StateMachineContext,
  StateTransition,
  BaseState,
  BaseEvent,
} from '@domain/state-machine/types.js';

/**
 * 批量上传任务状态枚举
 */
export enum BatchUploadState {
  NEW = 'NEW',
  VALIDATING = 'VALIDATING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  INDEXING = 'INDEXING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * 批量上传任务事件枚举
 */
export enum BatchUploadEvent {
  START = 'start',
  VALIDATE = 'validate',
  PROCESS = 'process',
  UPLOAD = 'upload',
  INDEX = 'index',
  COMPLETE = 'complete',
  FAIL = 'fail',
  CANCEL = 'cancel',
  RETRY = 'retry',
}

/**
 * 批量上传任务上下文
 */
export interface BatchUploadContext extends StateMachineContext {
  /** 批量上传ID */
  batchId: string;
  /** 文件列表 */
  files: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    path?: string;
  }>;
  /** 目标集合ID */
  collectionId: string;
  /** 上传选项 */
  options?: {
    skipDuplicates?: boolean;
    generateThumbnails?: boolean;
    chunkSize?: number;
  };
  /** 处理结果 */
  results?: {
    total: number;
    successful: number;
    failed: number;
    errors: Array<{
      fileId: string;
      fileName: string;
      error: string;
    }>;
  };
  /** 当前处理的文件索引 */
  currentFileIndex?: number;
  /** 处理进度详情 */
  progressDetails?: {
    validated: number;
    processed: number;
    uploaded: number;
    indexed: number;
  };
  /** 重试次数 */
  retryCount?: number;
}

/**
 * 批量上传状态机策略
 * 实现批量上传任务的状态管理和执行逻辑
 */
/**
 * 批量上传状态机策略
 * 实现批量上传任务的状态管理和执行逻辑
 */
export class BatchUploadStrategy extends BaseStateMachineStrategy {
  /**
   * 构造函数
   * @param persistence 状态持久化实现
   * @param persistence.saveTask 保存任务方法
   * @param persistence.getTask 获取任务方法
   * @param persistence.getTasksByStatus 根据状态获取任务方法
   * @param persistence.getTasksByType 根据类型获取任务方法
   * @param persistence.updateTask 更新任务方法
   * @param persistence.deleteTask 删除任务方法
   * @param persistence.cleanupExpiredTasks 清理过期任务方法
   * @param logger 日志记录器
   */
  constructor(
    persistence: {
      saveTask: (task: StateMachineTask) => Promise<void>;
      getTask: (taskId: string) => Promise<StateMachineTask | null>;
      getTasksByStatus: (status: string) => Promise<StateMachineTask[]>;
      getTasksByType: (taskType: string) => Promise<StateMachineTask[]>;
      updateTask: (
        taskId: string,
        updates: Partial<StateMachineTask>,
      ) => Promise<void>;
      deleteTask: (taskId: string) => Promise<void>;
      cleanupExpiredTasks: (olderThan: number) => Promise<number>;
    },
    logger: Logger,
  ) {
    const config: StateMachineConfig = {
      taskType: 'batch_upload',
      initialState: BatchUploadState.NEW,
      finalStates: [
        BatchUploadState.COMPLETED,
        BatchUploadState.FAILED,
        BatchUploadState.CANCELLED,
      ],
      maxRetries: 3,
      enablePersistence: true,
      transitions: [
        // NEW -> VALIDATING
        {
          from: BatchUploadState.NEW,
          to: BatchUploadState.VALIDATING,
          event: BatchUploadEvent.START,
          action: async (context: StateMachineContext) => {
            await this.onStartValidation(context as BatchUploadContext);
          },
        },
        // VALIDATING -> PROCESSING
        {
          from: BatchUploadState.VALIDATING,
          to: BatchUploadState.PROCESSING,
          event: BatchUploadEvent.PROCESS,
          condition: (context: StateMachineContext) => {
            return this.canStartProcessing(context as BatchUploadContext);
          },
          action: async (context: StateMachineContext) => {
            await this.onStartProcessing(context as BatchUploadContext);
          },
        },
        // VALIDATING -> FAILED
        {
          from: BatchUploadState.VALIDATING,
          to: BatchUploadState.FAILED,
          event: BatchUploadEvent.FAIL,
        },
        // PROCESSING -> UPLOADING
        {
          from: BatchUploadState.PROCESSING,
          to: BatchUploadState.UPLOADING,
          event: BatchUploadEvent.UPLOAD,
          action: async (context: StateMachineContext) => {
            await this.onStartUploading(context as BatchUploadContext);
          },
        },
        // PROCESSING -> FAILED
        {
          from: BatchUploadState.PROCESSING,
          to: BatchUploadState.FAILED,
          event: BatchUploadEvent.FAIL,
        },
        // UPLOADING -> INDEXING
        {
          from: BatchUploadState.UPLOADING,
          to: BatchUploadState.INDEXING,
          event: BatchUploadEvent.INDEX,
          action: async (context: StateMachineContext) => {
            await this.onStartIndexing(context as BatchUploadContext);
          },
        },
        // UPLOADING -> FAILED
        {
          from: BatchUploadState.UPLOADING,
          to: BatchUploadState.FAILED,
          event: BatchUploadEvent.FAIL,
        },
        // INDEXING -> COMPLETED
        {
          from: BatchUploadState.INDEXING,
          to: BatchUploadState.COMPLETED,
          event: BatchUploadEvent.COMPLETE,
          action: async (context: StateMachineContext) => {
            await this.onComplete(context as BatchUploadContext);
          },
        },
        // INDEXING -> FAILED
        {
          from: BatchUploadState.INDEXING,
          to: BatchUploadState.FAILED,
          event: BatchUploadEvent.FAIL,
        },
        // 任何状态 -> CANCELLED
        {
          from: BatchUploadState.NEW,
          to: BatchUploadState.CANCELLED,
          event: BatchUploadEvent.CANCEL,
        },
        {
          from: BatchUploadState.VALIDATING,
          to: BatchUploadState.CANCELLED,
          event: BatchUploadEvent.CANCEL,
        },
        {
          from: BatchUploadState.PROCESSING,
          to: BatchUploadState.CANCELLED,
          event: BatchUploadEvent.CANCEL,
        },
        {
          from: BatchUploadState.UPLOADING,
          to: BatchUploadState.CANCELLED,
          event: BatchUploadEvent.CANCEL,
        },
        {
          from: BatchUploadState.INDEXING,
          to: BatchUploadState.CANCELLED,
          event: BatchUploadEvent.CANCEL,
        },
        // FAILED -> VALIDATING (重试)
        {
          from: BatchUploadState.FAILED,
          to: BatchUploadState.VALIDATING,
          event: BatchUploadEvent.RETRY,
          condition: (context: StateMachineContext) => {
            const batchContext = context as BatchUploadContext;
            return ((batchContext as BatchUploadContext).retryCount || 0) < 3; // 最多重试3次
          },
        },
      ],
    };

    super('batch_upload', config, persistence, logger);
  }

  // --- EnhancedStateMachineStrategy compatibility methods ---
  async validateTransition(
    taskId: string,
    event: string,
    context?: Record<string, unknown>,
  ) {
    // Basic permissive validator for compatibility; can be enhanced later
    return { valid: true } as const;
  }

  async getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransition[]> {
    // No-op in-memory history for this strategy (can be implemented later)
    return [];
  }

  async getTaskMetrics() {
    // Return a simple zeroed metrics object for compatibility
    return {
      totalTasks: 0,
      tasksByState: {},
      tasksByType: {},
      averageExecutionTime: 0,
      successRate: 0,
      failureRate: 0,
      retryRate: 0,
    };
  }

  /**
   * 执行批量上传任务
   * @param taskId 任务ID
   * @returns 无返回值
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const context = task.context as BatchUploadContext;

    try {
      // 标记任务开始
      await this.markTaskStarted(taskId);

      // 开始验证
      await this.handleTransition(taskId, BatchUploadEvent.START, context);

      // 验证文件
      await this.validateFiles(taskId, context);

      // 开始处理
      await this.handleTransition(taskId, BatchUploadEvent.PROCESS, context);

      // 处理文件
      await this.processFiles(taskId, context);

      // 开始上传
      await this.handleTransition(taskId, BatchUploadEvent.UPLOAD, context);

      // 上传文件
      await this.uploadFiles(taskId, context);

      // 开始索引
      await this.handleTransition(taskId, BatchUploadEvent.INDEX, context);

      // 索引文件
      await this.indexFiles(taskId, context);

      // 完成任务
      await this.handleTransition(taskId, BatchUploadEvent.COMPLETE, context);
    } catch (error) {
      this.logger.error(`批量上传任务执行失败: ${taskId}, 错误: ${error}`);
      await this.handleTransition(taskId, BatchUploadEvent.FAIL, {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 开始验证时的动作
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async onStartValidation(context: BatchUploadContext): Promise<void> {
    this.logger.info(`开始验证批量上传任务: ${context.batchId}`);

    // 初始化进度详情
    context.progressDetails = {
      validated: 0,
      processed: 0,
      uploaded: 0,
      indexed: 0,
    };

    // 初始化结果
    context.results = {
      total: context.files.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    await this.updateProgress(context.taskId, 5);
  }

  /**
   * 开始处理时的动作
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async onStartProcessing(context: BatchUploadContext): Promise<void> {
    this.logger.info(`开始处理批量上传任务: ${context.batchId}`);
    await this.updateProgress(context.taskId, 25);
  }

  /**
   * 开始上传时的动作
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async onStartUploading(context: BatchUploadContext): Promise<void> {
    this.logger.info(`开始上传批量上传任务: ${context.batchId}`);
    await this.updateProgress(context.taskId, 50);
  }

  /**
   * 开始索引时的动作
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async onStartIndexing(context: BatchUploadContext): Promise<void> {
    this.logger.info(`开始索引批量上传任务: ${context.batchId}`);
    await this.updateProgress(context.taskId, 75);
  }

  /**
   * 完成时的动作
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async onComplete(context: BatchUploadContext): Promise<void> {
    this.logger.info(`批量上传任务完成: ${context.batchId}`);

    if (context.results) {
      this.logger.info(
        `上传结果: 总计 ${context.results.total}, 成功 ${context.results.successful}, 失败 ${context.results.failed}`,
      );
    }

    await this.updateProgress(context.taskId, 100);
  }

  /**
   * 检查是否可以开始处理
   * @param context 批量上传上下文
   * @returns 是否可以开始处理
   */
  private canStartProcessing(context: BatchUploadContext): boolean {
    return context.progressDetails?.validated === context.files.length;
  }

  /**
   * 验证文件
   * @param taskId 任务ID
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async validateFiles(
    taskId: string,
    context: BatchUploadContext,
  ): Promise<void> {
    this.logger.info(`开始验证文件: ${context.files.length} 个文件`);

    for (let i = 0; i < context.files.length; i++) {
      const file = context.files[i];

      try {
        // 这里应该调用文件验证逻辑
        await this.validateFile(file);

        if (context.progressDetails) {
          context.progressDetails.validated++;
        }

        // 更新进度 (5% - 25%)
        const progress = 5 + (20 * (i + 1)) / context.files.length;
        await this.updateProgress(taskId, progress);
      } catch (error) {
        if (context.results) {
          context.results.failed++;
          context.results.errors.push({
            fileId: file.id,
            fileName: file.name,
            error: (error as Error).message,
          });
        }

        this.logger.warn(`文件验证失败: ${file.name}, 错误: ${error}`);
      }
    }

    this.logger.info(
      `文件验证完成: ${context.progressDetails?.validated}/${context.files.length}`,
    );
  }

  /**
   * 处理文件
   * @param taskId 任务ID
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async processFiles(
    taskId: string,
    context: BatchUploadContext,
  ): Promise<void> {
    this.logger.info(`开始处理文件`);

    for (let i = 0; i < context.files.length; i++) {
      const file = context.files[i];

      try {
        // 这里应该调用文件处理逻辑
        await this.processFile(file, context);

        if (context.progressDetails) {
          context.progressDetails.processed++;
        }

        // 更新进度 (25% - 50%)
        const progress = 25 + (25 * (i + 1)) / context.files.length;
        await this.updateProgress(taskId, progress);
      } catch (error) {
        if (context.results) {
          context.results.failed++;
          context.results.errors.push({
            fileId: file.id,
            fileName: file.name,
            error: (error as Error).message,
          });
        }

        this.logger.warn(`文件处理失败: ${file.name}, 错误: ${error}`);
      }
    }

    this.logger.info(
      `文件处理完成: ${context.progressDetails?.processed}/${context.files.length}`,
    );
  }

  /**
   * 上传文件
   * @param taskId 任务ID
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async uploadFiles(
    taskId: string,
    context: BatchUploadContext,
  ): Promise<void> {
    this.logger.info(`开始上传文件`);

    for (let i = 0; i < context.files.length; i++) {
      const file = context.files[i];

      try {
        // 这里应该调用文件上传逻辑
        await this.uploadFile(file, context);

        if (context.progressDetails) {
          context.progressDetails.uploaded++;
        }

        // 更新进度 (50% - 75%)
        const progress = 50 + (25 * (i + 1)) / context.files.length;
        await this.updateProgress(taskId, progress);
      } catch (error) {
        if (context.results) {
          context.results.failed++;
          context.results.errors.push({
            fileId: file.id,
            fileName: file.name,
            error: (error as Error).message,
          });
        }

        this.logger.warn(`文件上传失败: ${file.name}, 错误: ${error}`);
      }
    }

    this.logger.info(
      `文件上传完成: ${context.progressDetails?.uploaded}/${context.files.length}`,
    );
  }

  /**
   * 索引文件
   * @param taskId 任务ID
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async indexFiles(
    taskId: string,
    context: BatchUploadContext,
  ): Promise<void> {
    this.logger.info(`开始索引文件`);

    for (let i = 0; i < context.files.length; i++) {
      const file = context.files[i];

      try {
        // 这里应该调用文件索引逻辑
        await this.indexFile(file, context);

        if (context.progressDetails) {
          context.progressDetails.indexed++;
        }

        // 更新进度 (75% - 95%)
        const progress = 75 + (20 * (i + 1)) / context.files.length;
        await this.updateProgress(taskId, progress);
      } catch (error) {
        if (context.results) {
          context.results.failed++;
          context.results.errors.push({
            fileId: file.id,
            fileName: file.name,
            error: (error as Error).message,
          });
        }

        this.logger.warn(`文件索引失败: ${file.name}, 错误: ${error}`);
      }
    }

    this.logger.info(
      `文件索引完成: ${context.progressDetails?.indexed}/${context.files.length}`,
    );
  }

  /**
   * 验证单个文件
   * @param file 文件对象
   * @param file.id 文件ID
   * @param file.name 文件名
   * @param file.size 文件大小
   * @param file.type 文件类型
   * @param file.path 文件路径
   * @returns 无返回值
   */
  private async validateFile(file: {
    id: string;
    name: string;
    size: number;
    type: string;
    path?: string;
  }): Promise<void> {
    // 实现文件验证逻辑
    // 检查文件类型、大小、格式等
    this.logger.debug(`验证文件: ${file.name}`);
  }

  /**
   * 处理单个文件
   * @param file 文件对象
   * @param file.id 文件ID
   * @param file.name 文件名
   * @param file.size 文件大小
   * @param file.type 文件类型
   * @param file.path 文件路径
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async processFile(
    file: {
      id: string;
      name: string;
      size: number;
      type: string;
      path?: string;
    },
    context: BatchUploadContext,
  ): Promise<void> {
    // 实现文件处理逻辑
    // 文档解析、内容提取、分块等
    this.logger.debug(`处理文件: ${file.name}`);
  }

  /**
   * 上传单个文件
   * @param file 文件对象
   * @param file.id 文件ID
   * @param file.name 文件名
   * @param file.size 文件大小
   * @param file.type 文件类型
   * @param file.path 文件路径
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async uploadFile(
    file: {
      id: string;
      name: string;
      size: number;
      type: string;
      path?: string;
    },
    context: BatchUploadContext,
  ): Promise<void> {
    // 实现文件上传逻辑
    // 保存到存储系统、生成嵌入向量等
    this.logger.debug(`上传文件: ${file.name}`);
  }

  /**
   * 索引单个文件
   * @param file 文件对象
   * @param file.id 文件ID
   * @param file.name 文件名
   * @param file.size 文件大小
   * @param file.type 文件类型
   * @param file.path 文件路径
   * @param context 批量上传上下文
   * @returns 无返回值
   */
  private async indexFile(
    file: {
      id: string;
      name: string;
      size: number;
      type: string;
      path?: string;
    },
    context: BatchUploadContext,
  ): Promise<void> {
    // 实现文件索引逻辑
    // 添加到搜索索引、更新元数据等
    this.logger.debug(`索引文件: ${file.name}`);
  }
}
