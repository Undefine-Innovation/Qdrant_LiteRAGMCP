/**
 * Generated Statechart Types
 * 此文件由 contracts/statecharts/syncjob.scxml 自动生成
 * 仅供新代码使用
 */

export type SyncJobState = 'NEW' | 'SPLIT_OK' | 'EMBED_OK' | 'SYNCED' | 'FAILED' | 'RETRYING' | 'DEAD';

export type SyncJobEvent = 'split_ok' | 'fail' | 'embed_ok' | 'synced' | 'retry' | 'dead' | 'retry_ok';

export interface SyncJobStateContext {
  docId: string;
  errorMessage?: string;
}

export interface SyncJobStateMachine {
  currentState: SyncJobState;
  context: SyncJobStateContext;

  transition(event: SyncJobEvent): SyncJobState;
  canTransition(event: SyncJobEvent): boolean;
}
