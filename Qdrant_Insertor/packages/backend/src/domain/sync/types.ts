/**
 * 同步任务领域类型定义
 * @fileoverview 定义同步作业的状态、事件和相关接口
 * @author SyncJobStatusMapper Implementation
 * @version 1.0.0
 */

/**
 * 同步任务状态枚举
 * 定义同步作业在生命周期中的各种状态
 */
export enum SyncJobStatus {
  /** 新建状态 - 刚创建的同步作业，等待处理 */
  NEW = 'NEW',
  /** 分割完成状态 - 文档分割完成，等待嵌入生成 */
  SPLIT_OK = 'SPLIT_OK',
  /** 嵌入完成状态 - 嵌入生成完成，等待向量插入 */
  EMBED_OK = 'EMBED_OK',
  /** 同步完成状态 - 所有步骤均已成功执行 */
  SYNCED = 'SYNCED',
  /** 失败状态 - 同步过程中发生错误，可以重试 */
  FAILED = 'FAILED',
  /** 重试状态 - 正在重试失败的同步操作 */
  RETRYING = 'RETRYING',
  /** 死亡状态 - 重试次数超限，无法恢复 */
  DEAD = 'DEAD',
}

/**
 * 同步任务事件枚举
 * 定义状态机中可能发生的各种事件
 */
export enum SyncJobEvent {
  /** 分块保存事件 - 文档分块已保存到数据库 */
  CHUNKS_SAVED = 'chunksSaved',
  /** 向量插入事件 - 向量已插入到Qdrant */
  VECTORS_INSERTED = 'vectorsInserted',
  /** 元数据更新事件 - 文档元数据已更新 */
  META_UPDATED = 'metaUpdated',
  /** 错误事件 - 同步过程中发生错误 */
  ERROR = 'error',
  /** 重试事件 - 开始重试失败的同步操作 */
  RETRY = 'retry',
  /** 重试超限事件 - 重试次数超过最大限制 */
  RETRIES_EXCEEDED = 'retriesExceeded',
}

/**
 * 同步作业领域对象接口
 * 表示一个同步作业的完整信息
 */
export interface SyncJob {
  /** 同步作业唯一标识符 */
  id: string;
  /** 关联的文档ID */
  docId: string;
  /** 当前同步状态 */
  status: SyncJobStatus;
  /** 重试次数 */
  retries: number;
  /** 最后尝试时间戳（Unix时间戳） */
  lastAttemptAt?: number;
  /** 错误信息 */
  error?: string;
  /** 创建时间戳（Unix时间戳） */
  createdAt: number;
  /** 更新时间戳（Unix时间戳） */
  updatedAt: number;
}

/**
 * 状态机上下文接口
 * 在状态机内部存储运行时数据和状态信息
 */
export interface SyncMachineContext {
  /** 关联的文档ID */
  docId: string;
  /** 错误信息，用于状态机内部传递错误详情 */
  errorMessage?: string;
}

/**
 * 状态机事件类型联合
 * 定义状态机可以处理的所有事件类型及其载荷
 */
export type SyncMachineEvent =
  /** 分块保存事件 */
  | { type: SyncJobEvent.CHUNKS_SAVED; docId: string }
  /** 向量插入事件 */
  | { type: SyncJobEvent.VECTORS_INSERTED; docId: string }
  /** 元数据更新事件 */
  | { type: SyncJobEvent.META_UPDATED; docId: string }
  /** 错误事件 */
  | { type: SyncJobEvent.ERROR; docId: string; message: string }
  /** 重试事件 */
  | { type: SyncJobEvent.RETRY; docId: string }
  /** 重试超限事件 */
  | { type: SyncJobEvent.RETRIES_EXCEEDED; docId: string };
