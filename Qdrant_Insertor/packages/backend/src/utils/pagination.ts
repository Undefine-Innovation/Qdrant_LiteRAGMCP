import {
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
} from '../domain/types.js';

/**
 * 默认分页配置
 */
export const DEFAULT_PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

/**
 * 解析和验证分页查询参数
 */
export function parsePaginationQuery(
  query: PaginationQuery,
): Required<PaginationQuery> {
  const page = Math.max(
    DEFAULT_PAGINATION_CONFIG.DEFAULT_PAGE,
    Number(query.page) || DEFAULT_PAGINATION_CONFIG.DEFAULT_PAGE,
  );

  const limit = Math.min(
    DEFAULT_PAGINATION_CONFIG.MAX_LIMIT,
    Math.max(1, Number(query.limit) || DEFAULT_PAGINATION_CONFIG.DEFAULT_LIMIT),
  );

  const sort = query.sort || 'created_at';
  const order = query.order === 'asc' ? 'asc' : 'desc';

  return { page, limit, sort, order };
}

/**
 * 计算分页元数据
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResponse<T> {
  const { page, limit } = parsePaginationQuery(query);
  const pagination = calculatePaginationMeta(page, limit, total);

  return {
    data,
    pagination,
  };
}

/**
 * 构建 SQL 查询的分页部分
 */
export function buildSqlPagination(
  query: PaginationQuery,
  defaultSort: string = 'created_at',
): {
  limitClause: string;
  offsetClause: string;
  orderClause: string;
  fullPaginationClause: string;
} {
  const { page, limit, sort, order } = parsePaginationQuery(query);
  const offset = (page - 1) * limit;

  const limitClause = `LIMIT ${limit}`;
  const offsetClause = `OFFSET ${offset}`;
  const orderClause = `ORDER BY ${sort} ${order}`;
  const fullPaginationClause = `${orderClause} ${limitClause} ${offsetClause}`;

  return {
    limitClause,
    offsetClause,
    orderClause,
    fullPaginationClause,
  };
}

/**
 * 验证页码是否有效
 */
export function isValidPage(page: number, totalPages: number): boolean {
  return page >= 1 && page <= totalPages;
}

/**
 * 计算数据库查询的偏移量
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
