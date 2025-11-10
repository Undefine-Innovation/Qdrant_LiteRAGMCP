import {
  Entity,
  Column,
  Index,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Doc } from './Doc.js';
import { ChunkMeta } from './ChunkMeta.js';
import { Chunk } from './Chunk.js';

/**
 * 集合实体
 * 对应数据库中的collections表
 * 优化了索引、约束和验证逻辑
 */
@Entity('collections')
@Index(['name'], { unique: true })
@Index(['collectionId'], { unique: true })
@Index(['created_at'])
@Index(['updated_at'])
@Check(`name IS NOT NULL AND name != ''`)
@Check(`LENGTH(name) <= 255`)
export class Collection extends BaseEntity {
  /**
   * 集合ID（业务标识符）
   * 添加唯一约束和索引
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: '集合业务标识符，全局唯一',
  })
  collectionId: string;

  /**
   * 集合名称
   * 添加长度约束和验证
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '集合名称，不能为空且长度不超过255字符',
  })
  name: string;

  /**
   * 集合描述
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '集合描述，可选',
  })
  description?: string;

  /**
   * 集合状态
   * 添加状态管理
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    nullable: false,
    comment: '集合状态：active/inactive/archived',
  })
  status: 'active' | 'inactive' | 'archived' = 'active';

  /**
   * 集合配置
   * 存储JSON格式的配置信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '集合配置，JSON格式',
  })
  config?: string;

  /**
   * 文档数量缓存
   * 用于快速统计集合中的文档数量
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '集合中文档数量缓存',
  })
  documentCount: number = 0;

  /**
   * 块数量缓存
   * 用于快速统计集合中的块数量
   */
  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    comment: '集合中块数量缓存',
  })
  chunkCount: number = 0;

  /**
   * 最后同步时间
   * 记录集合最后一次同步的时间
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
  lastSyncAt?: number;

  /**
   * 关联的文档
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('Doc', 'collection', {
    cascade: true,
    lazy: true,
  })
  docs: Promise<Doc[]>;

  /**
   * 关联的块元数据
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('ChunkMeta', 'collection', {
    cascade: true,
    lazy: true,
  })
  chunkMetas: Promise<ChunkMeta[]>;

  /**
   * 关联的块
   * 使用字符串引用避免循环依赖，添加级联删除
   */
  @OneToMany('Chunk', 'collection', {
    cascade: true,
    lazy: true,
  })
  chunks: Promise<Chunk[]>;

  /**
   * 在保存前验证数据
   * 优化验证逻辑，移除console.log
   */
  @BeforeInsert()
  @BeforeUpdate()
  validateCollection() {
    if (!this.name || this.name.trim() === '') {
      throw new Error('Collection name cannot be empty');
    }
    if (this.name.length > 255) {
      throw new Error('Collection name cannot exceed 255 characters');
    }
    this.name = this.name.trim();

    // 验证状态值
    const validStatuses = ['active', 'inactive', 'archived'];
    if (this.status && !validStatuses.includes(this.status)) {
      throw new Error(`Invalid collection status: ${this.status}`);
    }
  }

  /**
   * 激活集合
   */
  activate(): void {
    this.status = 'active';
    this.updated_at = Date.now();
  }

  /**
   * 停用集合
   */
  deactivate(): void {
    this.status = 'inactive';
    this.updated_at = Date.now();
  }

  /**
   * 归档集合
   */
  archive(): void {
    this.status = 'archived';
    this.updated_at = Date.now();
  }

  /**
   * 更新文档数量缓存
   * @param count 文档数量
   * @returns void
   */
  updateDocumentCount(count: number): void {
    this.documentCount = count;
    this.updated_at = Date.now();
  }

  /**
   * 更新块数量缓存
   * @param count 块数量
   * @returns void
   */
  updateChunkCount(count: number): void {
    this.chunkCount = count;
    this.updated_at = Date.now();
  }

  /**
   * 更新最后同步时间
   */
  updateLastSyncTime(): void {
    this.lastSyncAt = Date.now();
    this.updated_at = Date.now();
  }
}
