/**
 * 自动垃圾回收服务接口
 * @description 定义垃圾回收管理的核心业务接口，遵循依赖倒置原则
 */

/**
 * 垃圾回收统计信息
 */
export interface GCStatistics {
  deletedDocuments: number;
  deletedChunks: number;
  reclaimedSpace: number;
  processedCollections: number;
  executionTime: number;
  lastRun: Date;
}

/**
 * 垃圾回收配置
 */
export interface GCConfig {
  enabled: boolean;
  interval: number; // 执行间隔（分钟）
  retentionDays: number; // 保留天数
  batchSize: number; // 批次大小
  dryRun: boolean; // 是否为演练模式
}

/**
 * 垃圾回收任务选项
 */
export interface GCTaskOptions {
  collectionIds?: string[];
  force?: boolean;
  dryRun?: boolean;
  olderThan?: Date;
}

/**
 * 自动垃圾回收服务接口
 * @description 应用层应该依赖此接口而不是具体实现
 */
export interface IAutoGCService {
  /**
   * 执行垃圾回收任务
   * 包括双端比对、删除孤儿向量、删除无关元数据和清理历史垃圾
   */
  runGC(): Promise<void>;
}
