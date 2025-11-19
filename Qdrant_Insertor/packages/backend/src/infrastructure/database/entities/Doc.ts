import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Check,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Collection } from './Collection.js';
import { ChunkMeta } from './ChunkMeta.js';
import { Chunk } from './Chunk.js';

/**
 * 文档实体
 * 对应数据库中的docs表
 * 优化了索引、约束和状态管理
 */
@Entity('docs')
@Index(['docId'], { unique: true })
@Index(['collectionId', 'key'], { unique: true })
@Index(['collectionId', 'status'])
@Index(['collectionId', 'created_at'])
@Index(['content_hash'])
@Index(['mime'])
@Check(`key IS NOT NULL AND key != ''`)
@Check(`LENGTH(key) <= 255`)
@Check(`status IN ('new', 'processing', 'completed', 'failed')`)
export class Doc extends BaseEntity {
  /**
   * 软删除标记别名
   * 为了兼容代码中的 is_deleted 引用
   * 使用虚拟属性，映射到deleted字段
   * @returns {boolean} 软删除状态
   */
  get is_deleted(): boolean {
    return this.deleted;
  }

  /**
   * 软删除标记别名
   * 为了兼容代码中的 is_deleted 引用
   * 使用虚拟属性，映射到deleted字段
   * @param {boolean} value 软删除状态
   * @returns {void}
   */
  set is_deleted(value: boolean) {
    this.deleted = value;
  }

  /**
   * 重写基类方法，禁止自动设置collectionId
   * 文档必须显式提供collectionId
   * @returns {boolean} 始终返回false
   */
  protected shouldAutoSetCollectionId(): boolean {
    return false;
  }

  /**
   * 在插入前验证约束
   * @returns {void}
   */
  @BeforeInsert()
  validateConstraints() {
    // 验证collectionId不为空
    if (!this.collectionId || this.collectionId.trim() === '') {
      throw new Error('Collection ID cannot be empty');
    }

    // 验证key不为空
    if (!this.key || this.key.trim() === '') {
      throw new Error('Document key cannot be empty');
    }

    // 验证key长度
    if (this.key.length > 255) {
      throw new Error('Document key cannot exceed 255 characters');
    }

    // 验证status值
    const validStatuses = ['new', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(this.status)) {
      throw new Error(`Invalid document status: ${this.status}`);
    }
  }
  /**
   * 文档ID（业务标识符）
   * 添加唯一约束和索引
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: '文档业务标识符，全局唯一',
  })
  docId: string;

  /**
   * 集合ID
   * 添加外键约束
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '所属集合ID',
  })
  collectionId: string;

  /**
   * 文档键值
   * 添加唯一约束和验证
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '文档唯一键值',
  })
  key: string;

  /**
   * 文档名称
   * 添加长度限制
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '文档显示名称',
  })
  name?: string;

  /**
   * 文档大小（字节）
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '文档大小（字节）',
  })
  size_bytes?: number;

  /**
   * MIME类型
   * 添加长度限制
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '文档MIME类型',
  })
  mime?: string;

  /**
   * 文档内容（仅用于创建，不持久化）
   * 保持select: false以避免查询时返回大内容
   */
  @Column({
    type: 'text',
    nullable: true,
    select: false,
    comment: '文档内容（不持久化）',
  })
  content?: string;

  /**
   * 文档内容哈希值
   * 用于内容去重和完整性检查
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '文档内容SHA256哈希值',
  })
  content_hash?: string;

  /**
   * 文档状态
   * 添加状态约束和默认值
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'new',
    nullable: false,
    comment: '文档处理状态',
  })
  status: 'new' | 'processing' | 'completed' | 'failed' = 'new';

  /**
   * 处理错误信息
   * 记录处理失败时的错误详情
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '处理错误信息',
  })
  processing_error?: string;

  /**
   * 处理开始时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '处理开始时间戳',
  })
  processing_started_at?: number;

  /**
   * 处理完成时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '处理完成时间戳',
  })
  processing_completed_at?: number;

  /**
   * 处理持续时间（毫秒）
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '处理持续时间（毫秒）',
  })
  processing_duration_ms?: number;

  /**
   * 块数量
   * 缓存文档分割后的块数量
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '文档分割后的块数量',
  })
  chunk_count: number = 0;

  /**
   * 最后同步时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '最后同步时间戳',
  })
  last_sync_at?: number;

  /**
   * 关联的集合
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne(() => Collection, (collection) => collection.docs, {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'collectionId', referencedColumnName: 'id' })
  collection: Promise<Collection>;

  /**
   * 关联的块元数据
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('ChunkMeta', 'doc', {
    cascade: true,
    lazy: true,
  })
  chunkMetas: Promise<ChunkMeta[]>;

  /**
   * 关联的块
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('Chunk', 'doc', {
    cascade: true,
    lazy: true,
  })
  chunks: Promise<Chunk[]>;

  /**
   * 开始处理
   * @returns {void}
   */
  startProcessing(): void {
    this.status = 'processing';
    this.processing_started_at = Date.now();
    this.processing_error = undefined;
    this.updated_at = Date.now();
  }

  /**
   * 完成处理
   * @returns {void}
   */
  completeProcessing(): void {
    this.status = 'completed';
    this.processing_completed_at = Date.now();
    if (this.processing_started_at) {
      this.processing_duration_ms =
        this.processing_completed_at - this.processing_started_at;
    }
    this.updated_at = Date.now();
  }

  /**
   * 处理失败
   * @param error 错误信息
   * @returns void
   */
  failProcessing(error: string): void {
    this.status = 'failed';
    this.processing_completed_at = Date.now();
    if (this.processing_started_at) {
      this.processing_duration_ms =
        this.processing_completed_at - this.processing_started_at;
    }
    this.processing_error = error;
    this.updated_at = Date.now();
  }

  /**
   * 重置处理状态
   * @returns {void}
   */
  resetProcessing(): void {
    this.status = 'new';
    this.processing_started_at = undefined;
    this.processing_completed_at = undefined;
    this.processing_duration_ms = undefined;
    this.processing_error = undefined;
    this.updated_at = Date.now();
  }

  /**
   * 更新块数量
   * @param count 块数量
   * @returns void
   */
  updateChunkCount(count: number): void {
    this.chunk_count = count;
    this.updated_at = Date.now();
  }

  /**
   * 更新同步时间
   * @returns {void}
   */
  updateSyncTime(): void {
    this.last_sync_at = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 检查是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return this.status === 'processing';
  }

  /**
   * 检查是否已完成处理
   * @returns 是否已完成处理
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * 检查是否处理失败
   * @returns 是否处理失败
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }
}
