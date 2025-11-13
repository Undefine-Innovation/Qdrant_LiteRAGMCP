import {
  Entity,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BaseEntity } from './BaseEntity.js';

/**
 * 事件实体
 * 对应数据库中的events表
 * 优化了索引、约束和事件处理逻辑
 */
@Entity('events')
@Index(['aggregateId', 'version'])
@Index(['aggregateType'])
@Index(['eventType'])
@Index(['processedAt'])
@Index(['aggregateId', 'eventType'])
@Index(['occurredOn'])
@Index(['created_at'])
@Index(['updated_at'])
@Check(`eventId IS NOT NULL AND eventId != ''`)
@Check(`eventType IS NOT NULL AND eventType != ''`)
@Check(`aggregateId IS NOT NULL AND aggregateId != ''`)
@Check(`aggregateType IS NOT NULL AND aggregateType != ''`)
@Check(`version >= 1`)
@Check(`eventData IS NOT NULL AND eventData != ''`)
export class Event extends BaseEntity {
  /**
   * 事件ID
   * 添加唯一约束和长度限制
   */
  @Column({
    type: 'varchar',
    length: 36,
    nullable: false,
    unique: true,
    comment: '事件唯一标识符',
  })
  eventId: string;

  /**
   * 事件类型
   * 添加长度限制和约束
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    comment: '事件类型',
  })
  eventType: string;

  /**
   * 聚合根ID
   * 添加长度限制和约束
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '聚合根ID',
  })
  aggregateId: string;

  /**
   * 聚合根类型
   * 添加长度限制和约束
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    comment: '聚合根类型',
  })
  aggregateType: string;

  /**
   * 事件发生时间戳
   * 添加索引和约束
   */
  @Index(['occurredOn'])
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
    comment: '事件发生时间戳（毫秒）',
  })
  occurredOn: number;

  /**
   * 版本号
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    nullable: false,
    default: 1,
    comment: '事件版本号',
  })
  version: number = 1;

  /**
   * 元数据（可选）
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '事件元数据，JSON格式',
  })
  metadata?: string;

  /**
   * 事件数据（JSON字符串）
   * 添加约束
   */
  @Column({
    type: 'text',
    nullable: false,
    comment: '事件数据，JSON格式',
  })
  eventData: string;

  /**
   * 处理时间戳（可选）
   * 添加索引
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '事件处理时间戳（毫秒）',
  })
  processedAt?: number;

  /**
   * 处理状态
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
    comment: '事件处理状态',
  })
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed' =
    'pending';

  /**
   * 处理错误信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '处理错误信息',
  })
  processingError?: string;

  /**
   * 重试次数
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '处理重试次数',
  })
  retryCount: number = 0;

  /**
   * 事件来源
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '事件来源服务或组件',
  })
  source?: string;

  /**
   * 事件优先级
   */
  @Column({
    type: 'integer',
    default: 5,
    nullable: false,
    comment: '事件优先级（1-10，数字越小优先级越高）',
  })
  priority: number = 5;

  /**
   * 事件标签
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '事件标签，JSON格式',
  })
  tags?: string;

  /**
   * 创建时间别名
   * 为了兼容代码中的 createdAt 引用
   */
  get createdAt(): number {
    return this.created_at;
  }

  set createdAt(value: number) {
    this.created_at = value;
  }

  /**
   * 更新时间别名
   * 为了兼容代码中的 updatedAt 引用
   */
  get updatedAt(): number {
    return this.updated_at;
  }

  set updatedAt(value: number) {
    this.updated_at = value;
  }

  /**
   * 在插入前生成ID和eventId
   */
  @BeforeInsert()
  generateIds() {
    if (!this.id) {
      this.id = uuidv4();
    }
    if (!this.eventId) {
      this.eventId = uuidv4();
    }
    const now = Date.now();
    if (!this.created_at) {
      this.created_at = now;
    }
    if (!this.updated_at) {
      this.updated_at = now;
    }
    if (!this.occurredOn) {
      this.occurredOn = now;
    }
  }

  /**
   * 在更新前更新时间戳
   */
  @BeforeUpdate()
  updateTimestamp() {
    this.updated_at = Date.now();
  }

  /**
   * 开始处理
   */
  startProcessing(): void {
    this.processingStatus = 'processing';
    this.updated_at = Date.now();
  }

  /**
   * 完成处理
   */
  completeProcessing(): void {
    this.processingStatus = 'completed';
    this.processedAt = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 处理失败
   * @param error 错误信息
   * @returns void
   */
  failProcessing(error: string): void {
    this.processingStatus = 'failed';
    this.processingError = error;
    this.retryCount++;
    this.updated_at = Date.now();
  }

  /**
   * 重置处理状态
   */
  resetProcessing(): void {
    this.processingStatus = 'pending';
    this.processedAt = undefined;
    this.processingError = undefined;
    this.updated_at = Date.now();
  }

  /**
   * 获取事件数据对象
   * @returns 事件数据对象
   */
  getEventDataObject(): unknown {
    if (!this.eventData) {
      return null;
    }

    try {
      return JSON.parse(this.eventData);
    } catch {
      return null;
    }
  }

  /**
   * 设置事件数据对象
   * @param data 事件数据对象
   * @returns void
   */
  setEventDataObject(data: unknown): void {
    this.eventData = JSON.stringify(data);
    this.updated_at = Date.now();
  }

  /**
   * 获取元数据对象
   * @returns 元数据对象
   */
  getMetadataObject(): unknown {
    if (!this.metadata) {
      return null;
    }

    try {
      return JSON.parse(this.metadata);
    } catch {
      return null;
    }
  }

  /**
   * 设置元数据对象
   * @param metadata 元数据对象
   * @returns void
   */
  setMetadataObject(metadata: unknown): void {
    this.metadata = JSON.stringify(metadata);
    this.updated_at = Date.now();
  }

  /**
   * 获取标签对象
   * @returns 标签对象
   */
  getTagsObject(): Record<string, string> | null {
    if (!this.tags) {
      return null;
    }

    try {
      return JSON.parse(this.tags);
    } catch {
      return null;
    }
  }

  /**
   * 设置标签对象
   * @param tags 标签对象
   * @returns void
   */
  setTagsObject(tags: Record<string, string>): void {
    this.tags = JSON.stringify(tags);
    this.updated_at = Date.now();
  }

  /**
   * 检查是否已处理
   * @returns 是否已处理
   */
  isProcessed(): boolean {
    return this.processingStatus === 'completed';
  }

  /**
   * 检查是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return this.processingStatus === 'processing';
  }

  /**
   * 检查是否处理失败
   * @returns 是否处理失败
   */
  isFailed(): boolean {
    return this.processingStatus === 'failed';
  }

  /**
   * 检查是否可以重试
   * @param maxRetries 最大重试次数
   * @returns 是否可以重试
   */
  canRetry(maxRetries: number = 3): boolean {
    return this.retryCount < maxRetries && this.isFailed();
  }
}
