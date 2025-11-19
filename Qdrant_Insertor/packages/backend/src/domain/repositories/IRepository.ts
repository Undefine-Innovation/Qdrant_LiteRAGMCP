import { CollectionId, DocId, PointId } from '../entities/types.js';

/**
 * 基础仓库接口
 * 定义所有仓库必须实现的核心CRUD操作
 */
export interface IRepository<T, ID> {
  /**
   * 创建新实体
   * @param entity 要创建的实体数据
   * @returns 创建完成的实体
   */
  create(entity: Partial<T>): Promise<T>;

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或null
   */
  findById(id: ID): Promise<T | null>;

  /**
   * 根据条件查找实体列表
   * @param criteria 查找条件
   * @returns 匹配的实体列表
   */
  find(criteria: Partial<T>): Promise<T[]>;

  /**
   * 根据条件查找单个实体
   * @param criteria 查找条件
   * @returns 找到的实体或null
   */
  findOne(criteria: Partial<T>): Promise<T | null>;

  /**
   * 更新实体
   * @param id 实体ID
   * @param data 要更新的数据
   * @returns 更新后的实体
   */
  update(id: ID, data: Partial<T>): Promise<T>;

  /**
   * 删除实体
   * @param id 实体ID
   * @returns 是否成功删除
   */
  delete(id: ID): Promise<boolean>;

  /**
   * 统计实体数量
   * @param criteria 统计条件（可选）
   * @returns 匹配的实体数量
   */
  count(criteria?: Partial<T>): Promise<number>;

  /**
   * 检查实体是否存在
   * @param criteria 检查条件
   * @returns 是否存在匹配的实体
   */
  exists(criteria: Partial<T>): Promise<boolean>;
}

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  /** 页码（从1开始） */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 向后兼容的页大小别名 */
  pageSize?: number;
  /** 排序字段和方向 */
  orderBy?: Record<string, 'ASC' | 'DESC'>;
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  data: T[];
  /** 向后兼容的数据别名 */
  items?: T[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
    /** 是否有下一页 */
    hasNext: boolean;
    /** 是否有上一页 */
    hasPrev: boolean;
  };
}

/**
 * 批量操作结果接口
 */
export interface BatchOperationResult {
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 错误信息列表 */
  errors?: Array<Record<string, unknown>>;
  /** 向后兼容的更新数量 */
  updated?: number;
}

/**
 * 查询选项接口
 */
export interface QueryOptions<T = unknown> {
  /** 查找条件，使用实体类型的 Partial 以获得更精确的类型约束 */
  where?: Partial<T> | Array<Partial<T>>;
  /** 排序选项，键为实体属性名（字符串化），值为方向 */
  order?: Partial<Record<keyof T & string, 'ASC' | 'DESC'>>;
  /** 限制数量 */
  take?: number;
  /** 跳过数量 */
  skip?: number;
  /** 限制数量别名 */
  limit?: number;
  /** 页码 */
  page?: number;
  /** 页大小别名 */
  pageSize?: number;
  /** 其他选项 */
  [key: string]: unknown;
}
