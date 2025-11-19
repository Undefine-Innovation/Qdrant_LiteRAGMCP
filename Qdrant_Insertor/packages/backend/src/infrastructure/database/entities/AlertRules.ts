import { Entity, Column, Index, OneToMany, Check } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

/**
 * 告警规则实体
 * 对应数据库中的alert_rules表
 * 优化了索引、约束和验证逻辑
 */
@Entity('alert_rules')
@Index(['name'], { unique: true })
@Index(['metric_name'])
@Index(['is_active'])
@Index(['severity'])
@Check(`name IS NOT NULL AND name != ''`)
@Check(`LENGTH(name) <= 255`)
@Check(`metric_name IS NOT NULL AND metric_name != ''`)
@Check(`LENGTH(metric_name) <= 255`)
@Check(
  `condition_operator IN ('>', '<', '>=', '<=', '==', '!=', 'in', 'not_in')`,
)
@Check(`severity IN ('low', 'medium', 'high', 'critical')`)
@Check(`cooldown_minutes >= 0`)
export class AlertRules extends BaseEntity {
  /**
   * 规则名称
   * 添加唯一约束和长度限制
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '告警规则名称，全局唯一',
  })
  name: string;

  /**
   * 规则描述
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '告警规则描述',
  })
  description?: string;

  /**
   * 指标名称
   * 添加长度限制和约束
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '监控指标名称',
  })
  metric_name: string;

  /**
   * 条件操作符
   * 添加操作符约束
   */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: false,
    comment: '条件操作符',
  })
  condition_operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'in' | 'not_in';

  /**
   * 阈值
   * 添加数值约束
   */
  @Column({
    type: 'real',
    nullable: false,
    comment: '告警阈值',
  })
  threshold_value: number;

  /**
   * 严重程度
   * 添加严重程度约束
   */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    comment: '告警严重程度',
  })
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * 是否激活
   * 添加默认值
   */
  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
    comment: '规则是否激活',
  })
  is_active: boolean = true;

  /**
   * 冷却时间（分钟）
   * 添加非负约束
   */
  @Column({
    type: 'integer',
    default: 5,
    nullable: false,
    comment: '告警冷却时间（分钟）',
  })
  cooldown_minutes: number = 5;

  /**
   * 通知渠道（JSON格式）
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '通知渠道配置，JSON格式',
  })
  notification_channels?: string;

  /**
   * 规则类型
   * 区分不同类型的告警规则
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'threshold',
    nullable: false,
    comment: '规则类型：threshold/anomaly/trend',
  })
  rule_type: 'threshold' | 'anomaly' | 'trend' = 'threshold';

  /**
   * 评估间隔（秒）
   * 定义规则评估的频率
   */
  @Column({
    type: 'integer',
    default: 60,
    nullable: false,
    comment: '规则评估间隔（秒）',
  })
  evaluation_interval_seconds: number = 60;

  /**
   * 持续时间（秒）
   * 条件需要持续多长时间才触发告警
   */
  @Column({
    type: 'integer',
    default: 300,
    nullable: false,
    comment: '条件持续时间（秒）',
  })
  duration_seconds: number = 300;

  /**
   * 最后评估时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '最后评估时间戳',
  })
  last_evaluated_at?: number;

  /**
   * 最后触发时间
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseInt(value, 10) : null),
    },
    comment: '最后触发告警时间戳',
  })
  last_triggered_at?: number;

  /**
   * 规则表达式
   * 用于复杂规则的表达式
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '复杂规则表达式',
  })
  rule_expression?: string;

  /**
   * 规则参数
   * 存储JSON格式的规则参数
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '规则参数，JSON格式',
  })
  rule_parameters?: string;

  /**
   * 标签
   * 存储JSON格式的标签
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '规则标签，JSON格式',
  })
  tags?: string;

  /**
   * 创建者
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '规则创建者',
  })
  created_by?: string;

  /**
   * 关联的告警历史
   * 暂时移除关系定义以避免循环依赖
   * 可以通过rule_id字段进行手动关联
   */
  // @OneToMany('AlertHistory', 'rule', {
  //   lazy: true,
  // })
  // alertHistories: Promise<any[]>;

  /**
   * 激活规则
   * @returns void
   */
  activate(): void {
    this.is_active = true;
    this.updated_at = Date.now();
  }

  /**
   * 停用规则
   * @returns void
   */
  deactivate(): void {
    this.is_active = false;
    this.updated_at = Date.now();
  }

  /**
   * 更新最后评估时间
   * @returns void
   */
  updateLastEvaluatedTime(): void {
    this.last_evaluated_at = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 更新最后触发时间
   * @returns void
   */
  updateLastTriggeredTime(): void {
    this.last_triggered_at = Date.now();
    this.updated_at = Date.now();
  }

  /**
   * 检查是否在冷却期内
   * @returns 是否在冷却期内
   */
  isInCooldown(): boolean {
    if (!this.last_triggered_at) {
      return false;
    }

    const cooldownMs = this.cooldown_minutes * 60 * 1000;
    const now = Date.now();
    return now - this.last_triggered_at < cooldownMs;
  }

  /**
   * 检查是否应该评估
   * @returns 是否应该评估
   */
  shouldEvaluate(): boolean {
    if (!this.is_active) {
      return false;
    }

    if (!this.last_evaluated_at) {
      return true;
    }

    const intervalMs = this.evaluation_interval_seconds * 1000;
    const now = Date.now();
    return now - this.last_evaluated_at >= intervalMs;
  }

  /**
   * 获取通知渠道对象
   * @returns 通知渠道对象或null
   */
  getNotificationChannelsObject(): Record<string, unknown> | null {
    if (!this.notification_channels) {
      return null;
    }

    try {
      return JSON.parse(this.notification_channels);
    } catch {
      return null;
    }
  }

  /**
   * 设置通知渠道对象
   * @param channels 通知渠道对象
   * @returns void
   */
  setNotificationChannelsObject(channels: Record<string, unknown>): void {
    this.notification_channels = JSON.stringify(channels);
    this.updated_at = Date.now();
  }

  /**
   * 获取规则参数对象
   * @returns 规则参数对象或null
   */
  getRuleParametersObject(): Record<string, unknown> | null {
    if (!this.rule_parameters) {
      return null;
    }

    try {
      return JSON.parse(this.rule_parameters);
    } catch {
      return null;
    }
  }

  /**
   * 设置规则参数对象
   * @param parameters 规则参数对象
   * @returns void
   */
  setRuleParametersObject(parameters: Record<string, unknown>): void {
    this.rule_parameters = JSON.stringify(parameters);
    this.updated_at = Date.now();
  }

  /**
   * 获取标签对象
   * @returns 标签对象或null
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
   * 评估条件
   * @param value 要评估的值
   * @returns 评估结果
   */
  evaluateCondition(value: number): boolean {
    switch (this.condition_operator) {
      case '>':
        return value > this.threshold_value;
      case '<':
        return value < this.threshold_value;
      case '>=':
        return value >= this.threshold_value;
      case '<=':
        return value <= this.threshold_value;
      case '==':
        return value === this.threshold_value;
      case '!=':
        return value !== this.threshold_value;
      default:
        return false;
    }
  }
}
