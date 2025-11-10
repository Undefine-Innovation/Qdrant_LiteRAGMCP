import { Entity, Column, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

/**
 * 告警历史实体
 * 对应数据库中的alert_history表
 */
@Entity('alert_history')
@Index(['rule_id'])
@Index(['triggered_at'])
export class AlertHistory extends BaseEntity {
  /**
   * 规则ID
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  rule_id: string;

  /**
   * 指标值
   */
  @Column({ type: 'real', nullable: false })
  metric_value: number;

  /**
   * 阈值
   */
  @Column({ type: 'real', nullable: false })
  threshold_value: number;

  /**
   * 严重程度
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * 状态
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  status: 'triggered' | 'resolved' | 'suppressed';

  /**
   * 消息
   */
  @Column({ type: 'text', nullable: true })
  message?: string;

  /**
   * 触发时间
   */
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  triggered_at: number;

  /**
   * 解决时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
  })
  resolved_at?: number;

  /**
   * 关联的告警规则
   * 暂时移除关系定义以避免循环依赖
   * 可以通过rule_id字段进行手动关联
   */
  // @ManyToOne('AlertRules', 'alertHistories', {
  //   onDelete: 'CASCADE',
  //   lazy: true,
  // })
  // rule: Promise<any>;
}
