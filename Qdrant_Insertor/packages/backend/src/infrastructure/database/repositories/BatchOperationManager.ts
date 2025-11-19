import { Logger } from '@logging/logger.js';
import { BatchOperationResult } from './BaseRepository.js';

/**
 * 批量操作配置接口
 */
export interface BatchOperationConfig {
  /** 批次大小，默认100 */
  batchSize?: number;
  /** 最大并发批次数量，默认3 */
  maxConcurrentBatches?: number;
  /** 操作超时时间（毫秒），默认30分钟 */
  timeoutMs?: number;
  /** 是否启用进度监控，默认true */
  enableProgressMonitoring?: boolean;
  /** 进度回调函数 */
  onProgress?: (progress: BatchOperationProgress) => void;
}

/**
 * 批量操作进度接口
 */
export interface BatchOperationProgress {
  /** 操作ID */
  operationId: string;
  /** 操作类型 */
  operationType: string;
  /** 总项目数 */
  totalItems: number;
  /** 已处理项目数 */
  processedItems: number;
  /** 成功项目数 */
  successfulItems: number;
  /** 失败项目数 */
  failedItems: number;
  /** 当前批次号 */
  currentBatch?: number;
  /** 总批次数 */
  totalBatches?: number;
  /** 开始时间 */
  startTime: number;
  /** 预估剩余时间（秒） */
  estimatedTimeRemaining?: number;
  /** 操作状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  /** 错误信息 */
  errors?: string[];
}

/**
 * 批量操作处理器接口
 */
export interface BatchOperationProcessor<T, R> {
  /** 处理单个批次 */
  processBatch: (batch: T[], batchNumber: number) => Promise<R>;
  /** 获取批次大小 */
  getBatchSize?: () => number;
}

/**
 * 内存管理器接口
 */
export interface MemoryManager {
  /** 检查内存使用情况 */
  checkMemoryUsage: () => {
    used: number;
    total: number;
    percentage: number;
  };
  /** 建议的批次大小 */
  suggestBatchSize: (currentBatchSize: number, itemSize: number) => number;
  /** 等待内存释放 */
  waitForMemoryRelease: (targetPercentage?: number) => Promise<void>;
}

/**
 * 批量操作管理器
 * 提供高性能的批量操作功能，包括：
 * - 智能分批处理
 * - 内存管理
 * - 进度监控
 * - 错误处理
 * - 性能优化
 */
export class BatchOperationManager {
  private readonly logger: Logger;
  private readonly defaultConfig: Required<BatchOperationConfig>;
  private readonly memoryManager: MemoryManager;

  constructor(
    logger: Logger,
    memoryManager?: MemoryManager,
    defaultConfig?: BatchOperationConfig,
  ) {
    this.logger = logger;
    this.memoryManager = memoryManager || new DefaultMemoryManager(logger);
    this.defaultConfig = {
      batchSize: defaultConfig?.batchSize || 100,
      maxConcurrentBatches: defaultConfig?.maxConcurrentBatches || 3,
      timeoutMs: defaultConfig?.timeoutMs || 30 * 60 * 1000, // 30分钟
      enableProgressMonitoring: defaultConfig?.enableProgressMonitoring ?? true,
      onProgress: defaultConfig?.onProgress || (() => {}),
    };
  }

  /**
   * 安全的数字加法
   * @param a 第一个数字
   * @param b 第二个数字
   * @returns 相加结果
   */
  private safeAdd(a: number, b: number): number {
    const result = a + b;
    if (!isFinite(result)) {
      throw new Error(`数值溢出: ${a} + ${b}`);
    }
    return result;
  }

  /**
   * 执行批量操作
   * @param items 要处理的项目数组
   * @param processor 批量操作处理器
   * @param config 操作配置
   * @returns 批量操作结果
   */
  async executeBatchOperation<T, R>(
    items: T[],
    processor: BatchOperationProcessor<T, R>,
    config?: BatchOperationConfig,
  ): Promise<{
    results: R[];
    operationResult: BatchOperationResult;
    progress: BatchOperationProgress;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const operationId = this.generateOperationId();
    const operationType = this.getOperationType(processor);

    this.logger.info(`开始批量操作`, {
      operationId,
      operationType,
      totalItems: items.length,
      batchSize: finalConfig.batchSize,
      maxConcurrentBatches: finalConfig.maxConcurrentBatches,
    });

    const progress: BatchOperationProgress = {
      operationId,
      operationType,
      totalItems: items.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(items.length / finalConfig.batchSize),
      startTime: Date.now(),
      status: 'pending',
      errors: [],
    };

    try {
      // 检查内存使用情况
      const memoryUsage = this.memoryManager.checkMemoryUsage();
      if (memoryUsage.percentage > 80) {
        this.logger.warn(`内存使用率过高，调整批次大小`, {
          operationId,
          memoryUsage: memoryUsage.percentage,
          originalBatchSize: finalConfig.batchSize,
        });

        // 动态调整批次大小
        const suggestedBatchSize = this.memoryManager.suggestBatchSize(
          finalConfig.batchSize,
          this.estimateItemSize(items),
        );
        finalConfig.batchSize = suggestedBatchSize;
        progress.totalBatches = Math.ceil(items.length / finalConfig.batchSize);
      }

      progress.status = 'processing';
      this.notifyProgress(progress, finalConfig);

      const results: R[] = [];
      const errors: string[] = [];
      let successful = 0;
      let failed = 0;

      // 分批处理
      const batches = this.createBatches(items, finalConfig.batchSize);

      if (finalConfig.maxConcurrentBatches > 1) {
        // 并发处理批次
        const concurrentResults = await this.processBatchesConcurrently(
          batches,
          processor,
          progress,
          finalConfig,
        );

        results.push(...concurrentResults.results);
        errors.push(...concurrentResults.errors);
        successful = concurrentResults.successful;
        failed = concurrentResults.failed;
      } else {
        // 串行处理批次
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          progress.currentBatch = i + 1;

          try {
            const batchResult = await this.processSingleBatch(
              batch,
              i + 1,
              processor,
              progress,
              finalConfig,
            );

            results.push(...batchResult.results);
            errors.push(...batchResult.errors);
            successful += batchResult.successful;
            failed += batchResult.failed;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            errors.push(`批次 ${i + 1}: ${errorMessage}`);
            failed += batch.length;

            this.logger.error(`批次处理失败`, {
              operationId,
              batchNumber: i + 1,
              batchSize: batch.length,
              error: errorMessage,
            });
          }

          // 检查内存使用并等待释放
          await this.memoryManager.waitForMemoryRelease(75);
        }
      }

      progress.processedItems = items.length;
      progress.successfulItems = successful;
      progress.failedItems = failed;
      progress.status = failed === 0 ? 'completed' : 'failed';
      progress.errors = errors.length > 0 ? errors : undefined;

      this.notifyProgress(progress, finalConfig);

      const operationResult: BatchOperationResult = {
        success: successful,
        failed,
        errors: errors.length > 0 ? errors : [],
      };

      this.logger.info(`批量操作完成`, {
        operationId,
        operationType,
        totalItems: items.length,
        successful,
        failed,
        duration: `${Date.now() - progress.startTime}ms`,
        successRate: `${Math.round((successful / items.length) * 100)}%`,
      });

      return { results, operationResult, progress };
    } catch (error) {
      progress.status = 'failed';
      progress.errors = [
        error instanceof Error ? error.message : String(error),
      ];
      this.notifyProgress(progress, finalConfig);

      this.logger.error(`批量操作失败`, {
        operationId,
        operationType,
        error: progress.errors[0],
      });

      throw error;
    }
  }

  /**
   * 创建批次
   * @param items 要分批的项目数组
   * @param batchSize 每批大小
   * @returns 分批后的二维数组
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 处理单个批次
   * @param batch 批次数据
   * @param batchNumber 批次编号
   * @param processor 处理器
   * @param progress 进度
   * @param config 配置
   * @returns 处理结果
   */
  private async processSingleBatch<T, R>(
    batch: T[],
    batchNumber: number,
    processor: BatchOperationProcessor<T, R>,
    progress: BatchOperationProgress,
    config: Required<BatchOperationConfig>,
  ): Promise<{
    results: R[];
    errors: string[];
    successful: number;
    failed: number;
  }> {
    const startTime = Date.now();

    this.logger.debug(`开始处理批次`, {
      operationId: progress.operationId,
      batchNumber,
      batchSize: batch.length,
    });

    try {
      const batchResults = await Promise.race([
        processor.processBatch(batch, batchNumber),
        this.createTimeoutPromise(config.timeoutMs),
      ]);

      const duration = Date.now() - startTime;

      this.logger.debug(`批次处理完成`, {
        operationId: progress.operationId,
        batchNumber,
        batchSize: batch.length,
        duration: `${duration}ms`,
      });

      // 假设成功处理所有项目
      return {
        results: Array.isArray(batchResults) ? batchResults : [batchResults],
        errors: [],
        successful: batch.length,
        failed: 0,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`批次处理失败`, {
        operationId: progress.operationId,
        batchNumber,
        batchSize: batch.length,
        duration: `${duration}ms`,
        error: errorMessage,
      });

      return {
        results: [],
        errors: [errorMessage],
        successful: 0,
        failed: batch.length,
      };
    }
  }

  /**
   * 并发处理批次
   * @param batches 批次数组
   * @param processor 处理器
   * @param progress 进度
   * @param config 配置
   * @returns 处理结果
   */
  private async processBatchesConcurrently<T, R>(
    batches: T[][],
    processor: BatchOperationProcessor<T, R>,
    progress: BatchOperationProgress,
    config: Required<BatchOperationConfig>,
  ): Promise<{
    results: R[];
    errors: string[];
    successful: number;
    failed: number;
  }> {
    const results: R[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    // 创建并发任务
    const tasks: Promise<{
      results: R[];
      errors: string[];
      successful: number;
      failed: number;
      batchNumber: number;
    }>[] = [];

    for (let i = 0; i < batches.length; i += config.maxConcurrentBatches) {
      const concurrentBatches = batches.slice(
        i,
        i + config.maxConcurrentBatches,
      );

      const batchTasks = concurrentBatches.map((batch, index) =>
        this.processSingleBatch(
          batch,
          index + i + 1,
          processor,
          progress,
          config,
        ).then((result) => ({ ...result, batchNumber: index + i + 1 })),
      );

      tasks.push(...batchTasks);

      // 等待当前批次组完成
      const batchResults = await Promise.all(batchTasks);

      // 处理结果
      for (const result of batchResults) {
        results.push(...result.results);
        errors.push(...result.errors);
        successful += result.successful;
        failed += result.failed;

        // 更新进度
        progress.processedItems = this.safeAdd(
          progress.processedItems,
          result.successful + result.failed,
        );
        progress.successfulItems = this.safeAdd(successful, result.successful);
        progress.failedItems = this.safeAdd(failed, result.failed);
        progress.currentBatch = result.batchNumber;

        this.notifyProgress(progress, config);
      }
    }

    return { results, errors, successful, failed };
  }

  /**
   * 创建超时Promise
   * @param timeoutMs 超时时间（毫秒）
   * @returns 超时Promise
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`操作超时 (${timeoutMs}ms)`)),
        timeoutMs,
      );
    });
  }

  /**
   * 通知进度
   * @param progress 进度信息
   * @param config 配置
   */
  private notifyProgress(
    progress: BatchOperationProgress,
    config: Required<BatchOperationConfig>,
  ): void {
    if (!config.enableProgressMonitoring) return;

    // 计算预估剩余时间
    if (progress.status === 'processing' && progress.processedItems > 0) {
      const elapsed = Date.now() - progress.startTime;
      const avgTimePerItem = elapsed / progress.processedItems;
      const remainingItems = progress.totalItems - progress.processedItems;
      progress.estimatedTimeRemaining = Math.ceil(
        (avgTimePerItem * remainingItems) / 1000,
      );
    }

    config.onProgress(progress);
  }

  /**
   * 生成操作ID
   * @returns {string} 操作ID
   */
  private generateOperationId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 获取操作类型
   * @param processor 处理器
   * @returns {string} 操作类型
   */
  private getOperationType<T, R>(
    processor: BatchOperationProcessor<T, R>,
  ): string {
    return processor.constructor.name || 'Unknown';
  }

  /**
   * 估算项目大小（字节）
   * @param items 项目数组
   * @returns {number} 估算大小
   */
  private estimateItemSize<T>(items: T[]): number {
    if (items.length === 0) return 0;

    try {
      const sampleItem = items[0];
      return JSON.stringify(sampleItem).length;
    } catch {
      return 1024; // 默认1KB
    }
  }
}

/**
 * 默认内存管理器
 */
export class DefaultMemoryManager implements MemoryManager {
  constructor(private readonly logger: Logger) {}

  checkMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const total = usage.heapTotal;
      const used = usage.heapUsed;

      return {
        used,
        total,
        percentage: Math.round((used / total) * 100),
      };
    }

    // 浏览器环境或其他环境的默认实现
    return {
      used: 0,
      total: 100,
      percentage: 0,
    };
  }

  suggestBatchSize(currentBatchSize: number, itemSize: number): number {
    const memoryUsage = this.checkMemoryUsage();

    if (memoryUsage.percentage > 80) {
      // 内存使用率过高，减少批次大小
      return Math.max(10, Math.floor(currentBatchSize * 0.5));
    } else if (memoryUsage.percentage < 50) {
      // 内存使用率较低，可以增加批次大小
      return Math.min(1000, Math.floor(currentBatchSize * 1.5));
    }

    return currentBatchSize;
  }

  async waitForMemoryRelease(targetPercentage = 75): Promise<void> {
    const maxWaitTime = 5000; // 最大等待5秒
    const checkInterval = 500; // 每500ms检查一次
    let waitedTime = 0;

    while (waitedTime < maxWaitTime) {
      const memoryUsage = this.checkMemoryUsage();

      if (memoryUsage.percentage <= targetPercentage) {
        return;
      }

      // 触发垃圾回收（如果可用）
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waitedTime += checkInterval;
    }

    this.logger.warn(`等待内存释放超时`, {
      targetPercentage,
      currentPercentage: this.checkMemoryUsage().percentage,
      waitedTime,
    });
  }
}
