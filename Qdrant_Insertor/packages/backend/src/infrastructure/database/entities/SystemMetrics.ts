import { Entity, Column, Index, Check } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

/**
 * 系统指标实体
 * 对应数据库中的system_metrics表
 * 优化了索引、约束和查询性能
 */
@Entity('system_metrics')
@Index(['metric_name', 'timestamp'])
@Index(['metric_name'])
@Index(['timestamp'])
@Index(['metric_name', 'timestamp', 'tags'])
@Check(`metric_name IS NOT NULL AND metric_name != ''`)
@Check(`LENGTH(metric_name) <= 255`)
@Check(`metric_unit IS NULL OR LENGTH(metric_unit) <= 50`)
export class SystemMetrics extends BaseEntity {
  /**
   * 指标名称
   * 添加长度约束和验证
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '指标名称',
  })
  metric_name: string;

  /**
   * 指标值
   * 添加数值范围约束
   */
  @Column({
    type: 'real',
    nullable: false,
    comment: '指标数值',
  })
  metric_value: number;

  /**
   * 指标单位
   * 添加长度限制
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '指标单位',
  })
  metric_unit?: string;

  /**
   * 指标类型
   * 区分不同类型的指标
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'gauge',
    nullable: false,
    comment: '指标类型：gauge/counter/histogram',
  })
  metric_type: 'gauge' | 'counter' | 'histogram' = 'gauge';

  /**
   * 标签（JSON格式）
   * 添加长度限制
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '指标标签，JSON格式',
  })
  tags?: string;

  /**
   * 时间戳
   * 添加索引和约束
   */
  @Column({
    type: 'bigint',
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
    comment: '指标时间戳（毫秒）',
  })
  timestamp: number;

  /**
   * 指标来源
   * 标识指标来源的组件或服务
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '指标来源',
  })
  source?: string;

  /**
   * 指标描述
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '指标描述',
  })
  description?: string;

  /**
   * 采样率
   * 用于histogram类型指标
   */
  @Column({
    type: 'real',
    nullable: true,
    comment: '采样率',
  })
  sample_rate?: number;

  /**
   * 分位数
   * 用于histogram类型指标
   */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: '分位数（如p50, p95, p99）',
  })
  quantile?: string;

  /**
   * 创建指标记录
   * 静态方法用于创建标准化的指标记录
   * @param options ������
   * @param options.name ָ������
   * @param options.value ָ��ֵ
   * @param options.unit ָ�굥λ
   * @param options.type ָ������
   * @param options.tags ָ���ǩ
   * @param options.source ָ����Դ
   * @param options.description ָ������
   * @param options.timestamp ָ��ʱ���
   * @returns ��׼��ָ���¼
   */
  static createMetric(options: {
    name: string;
    value: number;
    unit?: string;
    type?: 'gauge' | 'counter' | 'histogram';
    tags?: Record<string, string>;
    source?: string;
    description?: string;
    timestamp?: number;
  }): SystemMetrics {
    const metric = new SystemMetrics();
    metric.metric_name = options.name;
    metric.metric_value = options.value;
    metric.metric_unit = options.unit;
    metric.metric_type = options.type || 'gauge';
    metric.source = options.source;
    metric.description = options.description;
    metric.timestamp = options.timestamp || Date.now();

    if (options.tags) {
      metric.tags = JSON.stringify(options.tags);
    }

    return metric;
  }

  /**
   * 获取标签对象
   * @returns ���л���ǩ����
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
   * @param tags ��Ҫ�����ı�ǩ����
   */
  setTagsObject(tags: Record<string, string>): void {
    this.tags = JSON.stringify(tags);
    this.updated_at = Date.now();
  }

  /**
   * 添加标签
   * @param key ��ǩ��
   * @param value ��ǩֵ
   */
  addTag(key: string, value: string): void {
    const tags = this.getTagsObject() || {};
    tags[key] = value;
    this.setTagsObject(tags);
  }

  /**
   * 移除标签
   * @param key ��Ҫɾ������ǩ��
   */
  removeTag(key: string): void {
    const tags = this.getTagsObject();
    if (tags && tags[key]) {
      delete tags[key];
      this.setTagsObject(tags);
    }
  }

  /**
   * 检查是否为计数器类型
   * @returns �Ƿ�Ϊ counter ����
   */
  isCounter(): boolean {
    return this.metric_type === 'counter';
  }

  /**
   * 检查是否为仪表盘类型
   * @returns �Ƿ�Ϊ gauge ����
   */
  isGauge(): boolean {
    return this.metric_type === 'gauge';
  }

  /**
   * 检查是否为直方图类型
   * @returns �Ƿ�Ϊ histogram ����
   */
  isHistogram(): boolean {
    return this.metric_type === 'histogram';
  }

  /**
   * 增加计数器值
   * @param delta �ۼƲ���
   */
  incrementCounter(delta: number = 1): void {
    if (this.isCounter()) {
      this.metric_value += delta;
      this.updated_at = Date.now();
    }
  }

  /**
   * 设置仪表盘值
   * @param value ��Ҫ���õ�����ֵ
   */
  setGaugeValue(value: number): void {
    if (this.isGauge()) {
      this.metric_value = value;
      this.updated_at = Date.now();
    }
  }
}
