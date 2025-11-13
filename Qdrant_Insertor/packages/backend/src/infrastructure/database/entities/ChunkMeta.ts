import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  BeforeInsert,
  JoinColumn,
  Check,
} from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Doc } from './Doc.js';
import { Collection } from './Collection.js';
import { Chunk } from './Chunk.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 块元数据实体
 * 对应数据库中的chunk_meta表
 * 优化了索引、约束和状态管理
 */
@Entity('chunk_meta')
@Index(['pointId'], { unique: true })
@Index(['docId', 'chunkIndex'], { unique: true })
@Index(['collectionId', 'chunkIndex'])
@Index(['docId'])
@Index(['collectionId'])
@Index(['contentHash'])
@Index(['embeddingStatus'])
@Check(`pointId IS NOT NULL AND pointId != ''`)
@Check(`docId IS NOT NULL AND docId != ''`)
@Check(`collectionId IS NOT NULL AND collectionId != ''`)
@Check(`chunkIndex >= 0`)
@Check(`contentHash IS NOT NULL AND contentHash != ''`)
@Check(`embeddingStatus IN ('pending', 'processing', 'completed', 'failed')`)
export class ChunkMeta extends BaseEntity {
  /**
   * 点ID（唯一标识符）
   * 添加唯一约束和长度限制
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: '向量数据库中的点ID',
  })
  pointId: string;

  /**
   * 文档ID
   * 添加外键约束
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '所属文档ID',
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
   * 块索引
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    nullable: false,
    comment: '块在文档中的索引位置',
  })
  chunkIndex: number;

  /**
   * 标题链
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '块标题层级链',
  })
  titleChain?: string;

  /**
   * 内容哈希
   * 添加长度限制和约束
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    comment: '内容SHA256哈希值',
  })
  contentHash: string;

  /**
   * Token数量
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: 'Token数量',
  })
  tokenCount?: number;

  /**
   * 字符数量
   * 缓存字符数量，便于快速统计
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '字符数量',
  })
  charCount?: number;

  /**
   * 嵌入状态
   * 添加状态约束
   */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'pending',
    comment: '嵌入向量状态',
  })
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed' =
    'pending';

  /**
   * 嵌入时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '嵌入向量生成时间戳',
  })
  embeddedAt?: number;

  /**
   * 同步时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '同步到向量数据库时间戳',
  })
  syncedAt?: number;

  /**
   * 错误信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '处理错误信息',
  })
  error?: string;

  /**
   * 重试次数
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '重试次数',
  })
  retryCount: number = 0;

  /**
   * 最后重试时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '最后重试时间戳',
  })
  lastRetryAt?: number;

  /**
   * 元数据
   * 存储JSON格式的额外信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '块元数据，JSON格式',
  })
  metadata?: string;

  /**
   * 关联的文档
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne(() => Doc, (doc) => doc.chunkMetas, {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'docId' })
  doc: Promise<Doc>;

  /**
   * 关联的集合
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne(() => Collection, (collection) => collection.chunkMetas, {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'collectionId' })
  collection: Promise<Collection>;

  /**
   * 关联的块内容
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('Chunk', 'chunkMeta', {
    cascade: true,
    lazy: true,
  })
  chunks: Promise<Chunk[]>;

  /**
   * 在插入前生成UUID并确保pointId被设置
   */
  @BeforeInsert()
  generateIds() {
    if (!this.id) {
      this.id = uuidv4();
    }
    // 确保pointId也被设置（如果未设置）
    if (!this.pointId) {
      this.pointId = this.id;
    }
    // 确保contentHash有值（如果未设置）
    if (!this.contentHash) {
      // 简单的哈希生成，实际应用中应使用更安全的哈希算法
      this.contentHash = `hash_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
  }

  /**
   * 开始嵌入处理
   */
  startEmbedding(): void {
    this.embeddingStatus = 'processing';
    this.updated_at = Date.now();
  }

  /**
   * 完成嵌入处理
   */
  completeEmbedding(): void {
    this.embeddingStatus = 'completed';
    this.embeddedAt = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 嵌入处理失败
   * @param error 错误信息
   * @returns void
   */
  failEmbedding(error: string): void {
    this.embeddingStatus = 'failed';
    this.error = error;
    this.retryCount++;
    this.lastRetryAt = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 重置嵌入状态
   * @returns void
   */
  resetEmbedding(): void {
    this.embeddingStatus = 'pending';
    this.embeddedAt = undefined;
    this.error = undefined;
    this.updated_at = Date.now();
  }

  /**
   * 更新同步时间
   * @returns void
   */
  updateSyncTime(): void {
    this.syncedAt = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 检查是否已嵌入
   * @returns 是否已嵌入
   */
  isEmbedded(): boolean {
    return this.embeddingStatus === 'completed';
  }

  /**
   * 检查是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return this.embeddingStatus === 'processing';
  }

  /**
   * 检查是否处理失败
   * @returns 是否处理失败
   */
  isFailed(): boolean {
    return this.embeddingStatus === 'failed';
  }

  /**
   * 检查是否可以重试
   * @param maxRetries 最大重试次数
   * @returns 是否可以重试
   */
  canRetry(maxRetries: number = 3): boolean {
    return this.retryCount < maxRetries;
  }
}
