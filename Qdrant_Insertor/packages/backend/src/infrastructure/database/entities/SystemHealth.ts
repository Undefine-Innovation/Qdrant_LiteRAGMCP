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
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  /**
   * 最后检查时间
   */
  @Column({
    name: 'last_check',
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseInt(value, 10) : null),
    },
  })
  lastCheck: number;

  /**
   * 响应时间（毫秒）
   */
  @Column({ name: 'response_time_ms', type: 'integer', nullable: true })
  responseTimeMs?: number;

  /**
   * 错误信息
   */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /**
   * 详细信息（JSON格式）
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value?: Record<string, unknown> | string | null) =>
        value == null
          ? null
          : typeof value === 'string'
            ? value
            : JSON.stringify(value),
      from: (value?: string | null) => value ?? null,
    },
  })
  details?: string;
}
