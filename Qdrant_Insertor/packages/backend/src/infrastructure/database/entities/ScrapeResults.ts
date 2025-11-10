import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

/**
 * 爬虫结果实体
 * 对应数据库中的scrape_results表
 */
@Entity('scrape_results')
@Index(['task_id'])
@Index(['status'])
@Index(['created_at'])
export class ScrapeResults extends BaseEntity {
  /**
   * 任务ID
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  task_id: string;

  /**
   * URL
   */
  @Column({ type: 'text', nullable: false })
  url: string;

  /**
   * 状态
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /**
   * 标题
   */
  @Column({ type: 'text', nullable: true })
  title?: string;

  /**
   * 内容
   */
  @Column({ type: 'text', nullable: true })
  content?: string;

  /**
   * 错误信息
   */
  @Column({ type: 'text', nullable: true })
  error?: string;

  /**
   * 元数据（JSON格式）
   */
  @Column({ type: 'text', nullable: true })
  metadata?: string;

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
  })
  completed_at?: number;

  /**
   * 持续时间（毫秒）
   */
  @Column({ type: 'integer', nullable: true })
  duration_ms?: number;

  /**
   * 爬取深度
   */
  @Column({ type: 'integer', nullable: true })
  depth?: number;

  /**
   * 页面数量
   */
  @Column({ type: 'integer', nullable: true })
  page_count?: number;

  /**
   * 配置（JSON格式）
   */
  @Column({ type: 'text', nullable: true })
  config?: string;
}
