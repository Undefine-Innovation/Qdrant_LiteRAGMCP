import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Check,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { ChunkMeta } from './ChunkMeta.js';
import { ChunkFullText } from './ChunkFullText.js';
import { Doc } from './Doc.js';
import { Collection } from './Collection.js';

/**
 * 块内容实体
 * 对应数据库中的chunks表
 * 优化了索引、约束和关系定义
 */
@Entity('chunks')
@Index(['pointId'], { unique: true })
@Index(['docId', 'chunkIndex'], { unique: true })
@Index(['collectionId', 'chunkIndex'])
@Index(['docId'])
@Index(['collectionId'])
@Check(`pointId IS NOT NULL AND pointId != ''`)
@Check(`docId IS NOT NULL AND docId != ''`)
@Check(`collectionId IS NOT NULL AND collectionId != ''`)
@Check(`chunkIndex >= 0`)
@Check(`content IS NOT NULL AND content != ''`)
export class Chunk extends BaseEntity {
  /**
   * 点ID（唯一标识符）
   * 添加唯一约束和长度限制
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
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
   * 标题
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '块标题',
  })
  title?: string;

  /**
   * 块内容
   * 添加非空约束
   */
  @Column({
    type: 'text',
    nullable: false,
    comment: '块文本内容',
  })
  content: string;

  /**
   * 内容长度
   * 缓存内容长度，便于快速统计
   */
  @Column({
    type: 'integer',
    nullable: false,
    comment: '内容字符长度',
  })
  contentLength: number;

  /**
   * Token数量
   * 缓存Token数量，便于快速统计
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: 'Token数量',
  })
  tokenCount?: number;

  /**
   * 嵌入向量状态
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
    comment: '嵌入向量状态',
  })
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed' =
    'pending';

  /**
   * 嵌入向量时间
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
   * 同步状态
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
    comment: '同步到向量数据库状态',
  })
  syncStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';

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
   * 块元数据ID
   * 外键引用chunk_meta表
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '关联的块元数据ID',
  })
  chunkMetaId?: string;

  /**
   * 关联的块元数据
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne('ChunkMeta', {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'chunkMetaId' })
  chunkMeta: Promise<ChunkMeta>;

  /**
   * 关联的全文搜索实体
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('ChunkFullText', 'chunk', {
    cascade: true,
    lazy: true,
  })
  chunkFullText: Promise<ChunkFullText[]>;

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
   * 关联的集合
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @ManyToOne('Collection', {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'collectionId', referencedColumnName: 'id' })
  collection: Promise<Collection>;

  /**
   * 在插入前计算内容长度
   */
  @BeforeInsert()
  @BeforeUpdate()
  calculateContentLength() {
    if (this.content) {
      this.contentLength = this.content.length;
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
    this.updated_at = Date.now();
  }

  /**
   * 开始同步
   * @returns void
   */
  startSync(): void {
    this.syncStatus = 'processing';
    this.updated_at = Date.now();
  }

  /**
   * 完成同步
   * @returns void
   */
  completeSync(): void {
    this.syncStatus = 'completed';
    this.syncedAt = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 同步失败
   * @param error 错误信息
   * @returns void
   */
  failSync(error: string): void {
    this.syncStatus = 'failed';
    this.error = error;
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
   * 检查是否已同步
   * @returns 是否已同步
   */
  isSynced(): boolean {
    return this.syncStatus === 'completed';
  }

  /**
   * 检查是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return (
      this.embeddingStatus === 'processing' || this.syncStatus === 'processing'
    );
  }

  /**
   * 重置状态
   * @returns void
   */
  resetStatus(): void {
    this.embeddingStatus = 'pending';
    this.syncStatus = 'pending';
    this.embeddedAt = undefined;
    this.syncedAt = undefined;
    this.error = undefined;
    this.updated_at = Date.now();
  }
}
