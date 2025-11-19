import {
  IRepository,
  PaginationOptions,
  PaginatedResult,
} from './IRepository.js';

/**
 * 查询仓库接口
 * 扩展基础仓库接口，添加高级查询功能
 */
export interface IQueryRepository<T, ID> extends IRepository<T, ID> {
  /**
   * 分页查询实体
   * @param criteria 查找条件
   * @param pagination 分页选项
   * @returns 分页结果
   */
  findWithPagination(
    criteria: Partial<T>,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<T>>;

  /**
   * 根据时间范围查找实体
   * @param field 时间字段名
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 匹配的实体列表
   */
  findByTimeRange(field: string, startTime: Date, endTime: Date): Promise<T[]>;

  /**
   * 模糊搜索实体
   * @param field 搜索字段名
   * @param searchText 搜索文本
   * @returns 匹配的实体列表
   */
  findByFuzzySearch(field: string, searchText: string): Promise<T[]>;

  /**
   * 获取统计信息
   * @param groupBy 分组字段
   * @returns 统计结果
   */
  getStatistics(groupBy: string): Promise<Record<string, number>>;

  /**
   * 根据多个条件查找实体
   * @param conditions 多个查找条件
   * @returns 匹配的实体列表
   */
  findByMultipleConditions(conditions: Partial<T>[]): Promise<T[]>;

  /**
   * 查找指定字段值的实体
   * @param fieldName 字段名
   * @param values 字段值列表
   * @returns 匹配的实体列表
   */
  findByFieldValues(fieldName: string, values: unknown[]): Promise<T[]>;

  /**
   * 查找指定范围内的实体
   * @param fieldName 字段名
   * @param minValue 最小值
   * @param maxValue 最大值
   * @returns 匹配的实体列表
   */
  findByRange(
    fieldName: string,
    minValue: unknown,
    maxValue: unknown,
  ): Promise<T[]>;

  /**
   * 查找最近创建的实体
   * @param limit 限制数量
   * @returns 匹配的实体列表
   */
  findRecentlyCreated(limit?: number): Promise<T[]>;

  /**
   * 查找最近更新的实体
   * @param limit 限制数量
   * @returns 匹配的实体列表
   */
  findRecentlyUpdated(limit?: number): Promise<T[]>;
}
