import { randomUUID } from 'crypto';
import { IStateMachineService } from '@domain/repositories/IStateMachineService.js';
import { StateMachineTask } from '@domain/state-machine/types.js';
import { Logger } from '@logging/logger.js';
import { BatchOperationProgress } from '@application/services/index.js';

/**
 * 批量进度管理服务
 * 专门处理批量操作的进度跟踪和状态管理
 */
export class BatchProgressService {
  private readonly operationProgress = new Map<
    string,
    BatchOperationProgress
  >();

  constructor(
    private readonly stateMachineService: IStateMachineService,
    private readonly logger: Logger,
  ) {}

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
   * 获取批量进度（别名方法，用于向后兼容）
   * @param operationId - 操作ID
   * @returns 批量操作进度
   */
  async getBatchProgress(
    operationId: string,
  ): Promise<BatchOperationProgress | null> {
    return this.getBatchOperationProgress(operationId);
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
   * 创建批量操作进度跟踪
   * @param type - 操作类型
   * @param total - 总项目数
   * @returns {string} 返回操作ID
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

    // 30分钟后清理进度信息（测试环境中跳过以避免Jest挂起）
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
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
    // 测试环境中不使用setTimeout，避免Jest挂起
  }

  /**
   * 将状态机任务转换为批量操作进度
   * @param task - 状态机任务
   * @returns {BatchOperationProgress} 返回批量操作进度
   */
  private convertStateMachineTaskToProgress(
    task: StateMachineTask,
  ): BatchOperationProgress {
    const context = task.context as {
      files?: Array<{ id: string; name: string; size: number; type: string }>;
      results?: { successful: number; failed: number };
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
      estimatedTimeRemaining:
        task.status === 'PROCESSING'
          ? this.calculateEstimatedTime(task)
          : undefined,
    };
  }

  /**
   * 转换状态机状态为批量操作状态
   * @param status - 状态机状态
   * @returns {BatchOperationProgress['status']} 返回批量操作状态
   */
  private convertStateMachineStatus(
    status: string,
  ): BatchOperationProgress['status'] {
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
   * @param task - 状态机任务
   * @returns {number} 返回预估剩余时间（秒）
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
}
