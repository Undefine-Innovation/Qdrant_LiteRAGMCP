// src/domain/sync/types.ts

/**
 * 定义同步任务的状态枚举
 */
export enum SyncJobStatus {
  NEW = 'NEW',
  SPLIT_OK = 'SPLIT_OK',
  EMBED_OK = 'EMBED_OK',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD = 'DEAD',
}

/**
 * 定义同步任务的事件枚举
 */
export enum SyncJobEvent {
  CHUNKS_SAVED = 'chunksSaved',
  VECTORS_INSERTED = 'vectorsInserted',
  META_UPDATED = 'metaUpdated',
  ERROR = 'error',
  RETRY = 'retry',
  RETRIES_EXCEEDED = 'retriesExceeded',
}

/**
 * 定义 SyncJob 领域对象接口
 */
export interface SyncJob {
  id: string;
  docId: string;
  status: SyncJobStatus;
  retries: number;
  lastAttemptAt?: number; // Unix timestamp
  error?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

/**
 * 定义状态机上下文 (Context)
 * 可以在状态机内部存储一些运行时数据
 */
export interface SyncMachineContext {
  docId: string;
  // 可以在这里添加其他需要传递给状态机的数据
  // 例如：当前处理的 chunk 数量，错误信息等
  errorMessage?: string;
}

/**
 * 定义状态机事件 (Event)
 * 每个事件可以携带不同的 payload
 */
export type SyncMachineEvent =
  | { type: SyncJobEvent.CHUNKS_SAVED; docId: string }
  | { type: SyncJobEvent.VECTORS_INSERTED; docId: string }
  | { type: SyncJobEvent.META_UPDATED; docId: string }
  | { type: SyncJobEvent.ERROR; docId: string; message: string }
  | { type: SyncJobEvent.RETRY; docId: string }
  | { type: SyncJobEvent.RETRIES_EXCEEDED; docId: string };