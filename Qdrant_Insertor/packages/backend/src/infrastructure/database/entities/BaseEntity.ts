import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 基础实体类
 * 包含所有实体的通用字段
 * 优化了时间戳处理和UUID生成
 */
@Entity()
export abstract class BaseEntity {
  /**
   * 主键ID
   * 使用自定义UUID生成，兼容SQLite和PostgreSQL
   */
  @PrimaryColumn({
    type: 'varchar',
    length: 36,
    comment: '主键ID，使用UUID v4格式',
  })
  id: string;

  /**
   * 软删除标记
   * 添加软删除支持，便于数据恢复和审计
   */
  @Column({
    type: 'boolean',
    default: false,
    nullable: false,
    comment: '软删除标记，true表示已删除',
  })
  deleted: boolean = false;

  /**
   * 删除时间戳
   * 记录软删除的具体时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '软删除时间戳',
  })
  deleted_at?: number;

  /**
   * 版本号
   * 用于乐观锁控制并发更新
   */
  @Column({
    type: 'integer',
    default: 1,
    nullable: false,
    comment: '版本号，用于乐观锁',
  })
  version: number = 1;

  /**
   * 在插入前生成UUID和设置时间戳
   */
  @BeforeInsert()
  generateIdAndSetTimestamps() {
    if (!this.id) {
      this.id = uuidv4();
    }

    const entityRecord = this as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(entityRecord, 'collectionId')) {
      const collectionAwareEntity = this as unknown as { collectionId?: string };
      if (!collectionAwareEntity.collectionId) {
        collectionAwareEntity.collectionId = this.id;
      }
    }

    if (Object.prototype.hasOwnProperty.call(entityRecord, 'docId')) {
      const docAwareEntity = this as unknown as { docId?: string };
      if (!docAwareEntity.docId) {
        docAwareEntity.docId = this.id;
      }
    }

    const now = Date.now();
    if (!this.created_at) {
      this.created_at = now;
    }
    if (!this.updated_at) {
      this.updated_at = now;
    }
  }

  /**  /**
   * 在更新前更新时间戳和版本号
   */
  @BeforeUpdate()
  updateTimestamp() {
    // 确保时间戳总是更新为当前时间
    const now = Date.now();
    this.updated_at = now;
    // 自动递增版本号
    this.version = (this.version || 1) + 1;
  }

  /**
   * 软删除方法
   * 标记实体为已删除而不是物理删除
   */
  softDelete(): void {
    this.deleted = true;
    this.deleted_at = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 恢复软删除的实体
   */
  restore(): void {
    this.deleted = false;
    this.deleted_at = undefined;
    this.updated_at = Date.now();
  }

  /**
   * 创建时间戳
   * 添加索引以支持按时间范围查询
   */
  @Index(['created_at'])
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
    comment: '创建时间戳（毫秒）',
  })
  created_at: number;

  /**
   * 更新时间戳
   * 添加索引以支持按更新时间查询
   */
  @Index(['updated_at'])
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
    comment: '更新时间戳（毫秒）',
  })
  updated_at: number;
}
