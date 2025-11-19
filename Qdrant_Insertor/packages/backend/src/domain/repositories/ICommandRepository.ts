import { IRepository, BatchOperationResult } from './IRepository.js';

/**
 * 命令仓库接口
 * 扩展基础仓库接口，添加批量操作和高级命令功能
 */
export interface ICommandRepository<T, ID> extends IRepository<T, ID> {
  /**
   * 批量创建实体
   * @param entities 要创建的实体列表
   * @returns 创建完成的实体列表
   */
  createBatch(entities: Partial<T>[]): Promise<T[]>;

  /**
   * 批量更新实体
   * @param ids 要更新的实体ID列表
   * @param data 要更新的数据
   * @returns 批量操作结果
   */
  updateBatch(ids: ID[], data: Partial<T>): Promise<BatchOperationResult>;

  /**
   * 批量删除实体
   * @param ids 要删除的实体ID列表
   * @returns 批量操作结果
   */
  deleteBatch(ids: ID[]): Promise<BatchOperationResult>;

  /**
   * 插入或更新实体（如果存在则更新，否则创建）
   * @param entity 实体数据
   * @param identifierFields 用于标识实体的字段列表
   * @returns 处理后的实体
   */
  upsert(entity: Partial<T>, identifierFields: string[]): Promise<T>;

  /**
   * 软删除实体
   * @param id 实体ID
   * @returns 是否成功软删除
   */
  softDelete(id: ID): Promise<boolean>;

  /**
   * 批量软删除实体
   * @param ids 要软删除的实体ID列表
   * @returns 成功软删除的数量
   */
  softDeleteBatch(ids: ID[]): Promise<number>;

  /**
   * 恢复已软删除的实体
   * @param id 实体ID
   * @returns 是否成功恢复
   */
  restore(id: ID): Promise<boolean>;

  /**
   * 批量恢复已软删除的实体
   * @param ids 要恢复的实体ID列表
   * @returns 成功恢复的数量
   */
  restoreBatch(ids: ID[]): Promise<number>;

  /**
   * 硬删除实体（物理删除）
   * @param id 实体ID
   * @returns 是否成功删除
   */
  hardDelete(id: ID): Promise<boolean>;

  /**
   * 批量硬删除实体（物理删除）
   * @param ids 要删除的实体ID列表
   * @returns 批量操作结果
   */
  hardDeleteBatch(ids: ID[]): Promise<BatchOperationResult>;

  /**
   * 更新实体的指定字段
   * @param id 实体ID
   * @param fieldName 字段名
   * @param value 新值
   * @returns 更新后的实体
   */
  updateField(id: ID, fieldName: string, value: unknown): Promise<T>;

  /**
   * 批量更新实体的指定字段
   * @param ids 实体ID列表
   * @param fieldName 字段名
   * @param value 新值
   * @returns 批量操作结果
   */
  updateFieldBatch(
    ids: ID[],
    fieldName: string,
    value: unknown,
  ): Promise<BatchOperationResult>;

  /**
   * 增加实体的数值字段
   * @param id 实体ID
   * @param fieldName 字段名
   * @param increment 增量值
   * @returns 更新后的实体
   */
  incrementField(id: ID, fieldName: string, increment: number): Promise<T>;

  /**
   * 批量增加实体的数值字段
   * @param ids 实体ID列表
   * @param fieldName 字段名
   * @param increment 增量值
   * @returns 批量操作结果
   */
  incrementFieldBatch(
    ids: ID[],
    fieldName: string,
    increment: number,
  ): Promise<BatchOperationResult>;
}
