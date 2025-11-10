import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

/**
 * 系统健康实体
 * 对应数据库中的system_health表
 */
@Entity('system_health')
@Index(['component'])
export class SystemHealth extends BaseEntity {
  /**
   * 组件名称
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  component: string;

  /**
   * 状态
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * 最后检查时间
   */
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  last_check: number;

  /**
   * 响应时间（毫秒）
   */
  @Column({ type: 'integer', nullable: true })
  response_time_ms?: number;

  /**
   * 错误信息
   */
  @Column({ type: 'text', nullable: true })
  error_message?: string;

  /**
   * 详细信息（JSON格式）
   */
  @Column({ type: 'text', nullable: true })
  details?: string;
}
