/**
 * DAOStub - 在迁移到 TypeORM 后提供向后兼容性的通用存根类
 * 所有方法返回默认值/空值，防止运行时错误
 * 注意：这是一个兼容性占位符。实际调用会返回 undefined 或空值。
 * 服务应该迁移到使用 TypeORM 仓库而不是这个存根。
 */
export type GenericRecord = Record<string, unknown>;

export type Stats = {
  total: number;
  statusBreakdown: Record<string, number>;
  active: number;
  inactive: number;
  bySeverity: Record<string, number>;
};

export type Health = { status: 'healthy' | 'unhealthy' };

export class DAOStub {
  // 同步创建方法 - 返回 undefined
  create = (data: GenericRecord): unknown => undefined;

  // 同步更新方法 - 返回 undefined
  update = (id: string, data: GenericRecord): unknown => undefined;

  // 同步删除方法 - 返回 false
  delete = (id: string): boolean => false;

  // 同步获取方法 - 返回 undefined
  getById = (id: string): unknown => undefined;

  // 同步获取所有 - 返回空数组
  getAll = (filter?: GenericRecord): unknown[] => [];

  // 同步状态查询 - 返回空数组
  getByStatus = (status: string): unknown[] => [];

  // 同步文档查询 - 返回 undefined
  getByDocId = (docId: string): unknown => undefined;

  // 同步列表查询 - 返回空数组
  list = (options?: GenericRecord): unknown[] => [];

  // 获取统计信息
  getStats = (): Stats => ({
    total: 0,
    statusBreakdown: {},
    active: 0,
    inactive: 0,
    bySeverity: {},
  });

  // 获取计数
  getCount = (filter?: GenericRecord): number => 0;

  // 清理旧记录
  cleanup = (days: number): number => 0;

  // 分页查询
  listPaginated = (
    page: number,
    pageSize: number,
    sort?: string,
    order?: string,
    activeOnly?: boolean,
  ): unknown[] => [];

  // 设置活跃状态 - 返回 false
  setActive = (id: string, isActive: boolean): boolean => false;

  // 获取最新记录 - 返回 undefined
  getLatestByName = (name: string): unknown => undefined;

  // 获取多个最新记录 - 返回空对象
  getLatestByNames = (names: string[]): Record<string, unknown> => ({});

  // 按时间范围查询 - 返回空数组
  getByNameAndTimeRange = (
    name: string,
    start: number,
    end: number,
    limit?: number,
  ): unknown[] => [];

  // ping 检查 - 返回 true
  ping = (): boolean => true;

  // upsert 操作 - 返回 undefined
  upsert = (data: GenericRecord): unknown => undefined;

  // 获取整体健康状态 - 返回健康状态对象
  getOverallHealth = (): Health => ({ status: 'healthy' });

  // 按组件获取健康状态 - 返回健康状态对象
  getByComponent = (component: string): Health => ({ status: 'healthy' });

  // 获取不健康的组件 - 返回空数组
  getUnhealthyComponents = (): unknown[] => [];

  // 批量创建 - 返回 undefined
  createBatch = (items: unknown[]): unknown => undefined;

  // 获取所有指标名称 - 返回空数组
  getAllMetricNames = (): string[] => [];

  // 获取聚合指标 - 返回空对象
  getAggregatedMetrics = (
    metricName?: string,
    startTime?: number,
    endTime?: number,
  ): Record<string, unknown> => ({});

  // 获取指标统计信息 - 返回空对象
  getMetricStats = (
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): Record<string, unknown> => ({});

  // 标记为已导入 - 返回 undefined
  markImported = (id: string, docId: string): unknown => undefined;

  // 获取任务组 - 返回空数组
  getTaskGroups = (options?: GenericRecord): unknown[] => [];

  // 删除任务相关数据 - 返回 undefined
  deleteByTask = (taskId: string): unknown => undefined;
}

