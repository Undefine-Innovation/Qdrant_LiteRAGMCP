import { Entity, Column, Index, ManyToOne, Check } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Doc } from './Doc.js';
import { SyncJobStatus } from '@domain/sync/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
/**
 * 同步作业状态枚举
 * 从领域层导出，供外部使用
 */
export { SyncJobStatus } from '@domain/sync/types.js';

/**
 * 同步作业实体
 * 对应数据库中的sync_jobs表
 * 优化了索引、约束和状态管理
 */
@Entity('sync_jobs')
@Index(['docId'])
@Index(['status'])
@Index(['status', 'updated_at'])
@Index(['docId', 'status'])
@Index(['created_at'])
@Index(['updated_at'])
@Check(`docId IS NOT NULL AND docId != ''`)
@Check(
  `status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')`,
)
@Check(`retries >= 0`)
@Check(`progress >= 0 AND progress <= 100`)
export class SyncJobEntity extends BaseEntity {
  /**
   * 文档ID
   * 添加外键约束
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '要同步的文档ID',
  })
  docId: string;

  /**
   * 同步状态
   * 使用领域层的状态定义
   */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: DbSyncJobStatus.PENDING,
    comment: '同步作业状态',
  })
  status: DbSyncJobStatus = DbSyncJobStatus.PENDING;

  /**
   * 作业类型
   * 区分不同类型的同步作业
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'document_sync',
    nullable: false,
    comment: '同步作业类型',
  })
  jobType:
    | 'document_sync'
    | 'collection_sync'
    | 'full_sync'
    | 'incremental_sync' = 'document_sync';

  /**
   * 优先级
   * 用于作业队列的优先级排序
   */
  @Column({
    type: 'integer',
    default: 5,
    nullable: false,
    comment: '作业优先级（1-10，数字越小优先级越高）',
  })
  priority: number = 5;

  /**
   * 重试次数
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '重试次数',
  })
  retries: number = 0;

  /**
   * 最大重试次数
   */
  @Column({
    type: 'integer',
    default: 3,
    nullable: false,
    comment: '最大重试次数',
  })
  maxRetries: number = 3;

  /**
   * 最后尝试时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '最后尝试时间戳',
  })
  last_attempt_at?: number;

  /**
   * 下次重试时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '下次重试时间戳',
  })
  next_retry_at?: number;

  /**
   * 开始时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '作业开始时间戳',
  })
  started_at?: number;

  /**
   * 完成时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '作业完成时间戳',
  })
  completed_at?: number;

  /**
   * 持续时间（毫秒）
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '作业持续时间（毫秒）',
  })
  duration_ms?: number;

  /**
   * 错误信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '错误详细信息',
  })
  error?: string;

  /**
   * 错误类别
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '错误类别',
  })
  error_category?: string;

  /**
   * 最后重试策略
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '最后使用的重试策略',
  })
  last_retry_strategy?: string;

  /**
   * 进度（0-100）
   * 添加范围约束
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '作业进度百分比（0-100）',
  })
  progress: number = 0;

  /**
   * 总步骤数
   */
  @Column({
    type: 'integer',
    default: 1,
    nullable: false,
    comment: '作业总步骤数',
  })
  totalSteps: number = 1;

  /**
   * 已完成步骤数
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '已完成步骤数',
  })
  completedSteps: number = 0;

  /**
   * 作业参数
   * 存储JSON格式的作业参数
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '作业参数，JSON格式',
  })
  jobParams?: string;

  /**
   * 作业结果
   * 存储JSON格式的作业结果
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '作业结果，JSON格式',
  })
  jobResult?: string;

  /**
   * 关联的文档
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne('Doc', {
    onDelete: 'CASCADE',
    lazy: true,
  })
  doc: Promise<Doc>;

  /**
   * 开始作业
   */
  start(): void {
    this.status = DbSyncJobStatus.PROCESSING;
    this.started_at = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 完成作业
   * @param result 作业结果
   * @returns void
   */
  complete(result?: string): void {
    this.status = DbSyncJobStatus.COMPLETED;
    this.completed_at = Date.now();
    this.progress = 100;
    this.completedSteps = this.totalSteps;

    if (this.started_at) {
      this.duration_ms = this.completed_at - this.started_at;
    }

    if (result) {
      this.jobResult = result;
    }

    this.updated_at = Date.now();
  }

  /**
   * 作业失败
   * @param error 错误信息
   * @param category 错误类别
   * @returns void
   */
  fail(error: string, category?: string): void {
    this.status = DbSyncJobStatus.FAILED;
    this.completed_at = Date.now();
    this.error = error;
    this.error_category = category;

    if (this.started_at) {
      this.duration_ms = this.completed_at - this.started_at;
    }

    this.updated_at = Date.now();
  }

  /**
   * 取消作业
   */
  cancel(): void {
    this.status = DbSyncJobStatus.CANCELLED;
    this.completed_at = Date.now();

    if (this.started_at) {
      this.duration_ms = this.completed_at - this.started_at;
    }

    this.updated_at = Date.now();
  }

  /**
   * 重试作业
   * @param strategy 重试策略
   * @returns void
   */
  retry(strategy?: string): void {
    this.retries++;
    this.last_attempt_at = Date.now();
    this.last_retry_strategy = strategy;
    this.status = DbSyncJobStatus.PROCESSING;
    this.error = undefined;
    this.error_category = undefined;

    // 计算下次重试时间（指数退避）
    const delay = Math.min(1000 * Math.pow(2, this.retries), 60000); // 最大1分钟
    this.next_retry_at = Date.now() + delay;

    this.updated_at = Date.now();
  }

  /**
   * 更新进度
   * @param completedSteps 已完成步骤数
   * @param totalSteps 总步骤数
   * @returns void
   */
  updateProgress(completedSteps: number, totalSteps?: number): void {
    this.completedSteps = completedSteps;
    if (totalSteps !== undefined) {
      this.totalSteps = totalSteps;
    }
    this.progress = Math.floor((this.completedSteps / this.totalSteps) * 100);
    this.updated_at = Date.now();
  }

  /**
   * 检查是否可以重试
   * @returns 是否可以重试
   */
  canRetry(): boolean {
    return (
      this.retries < this.maxRetries && this.status === DbSyncJobStatus.FAILED
    );
  }

  /**
   * 检查是否已完成
   * @returns 是否已完成
   */
  isCompleted(): boolean {
    return this.status === DbSyncJobStatus.COMPLETED;
  }

  /**
   * 检查是否失败
   * @returns 是否失败
   */
  isFailed(): boolean {
    return this.status === DbSyncJobStatus.FAILED;
  }

  /**
   * 检查是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return this.status === DbSyncJobStatus.PROCESSING;
  }

  /**
   * 检查是否已取消
   * @returns 是否已取消
   */
  isCancelled(): boolean {
    return this.status === DbSyncJobStatus.CANCELLED;
  }

  /**
   * 检查是否等待重试
   * @returns 是否等待重试
   */
  shouldRetry(): boolean {
    return (
      this.canRetry() &&
      this.next_retry_at !== undefined &&
      Date.now() >= this.next_retry_at
    );
  }
}
