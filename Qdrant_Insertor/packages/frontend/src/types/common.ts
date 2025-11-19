/**
 * 通用类型定义
 */

/**
 * 基础 API 响应接口
 */
export interface BaseApiResponse {
  success: boolean;
  message?: string;
}

/**
 * 分页基础接口
 */
export interface BasePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 分页查询参数基础接口
 */
export interface BasePaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  offset?: number;
}

/**
 * 时间戳字段接口
 */
export interface TimestampFields {
  created_at: number;
  updated_at?: number;
}

/**
 * 兼容性时间戳字段接口
 */
export interface CompatibleTimestampFields extends TimestampFields {
  createdAt: number;
  updatedAt?: number;
}

/**
 * 状态字段接口
 */
export interface StatusField {
  status?: string;
}

/**
 * ID 字段接口
 */
export interface IdField {
  id: string;
}

/**
 * 文档 ID 字段接口
 */
export interface DocIdField {
  docId: string;
}

/**
 * 集合 ID 字段接口
 */
export interface CollectionIdField {
  collectionId: string;
}

/**
 * 错误详情接口
 */
export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: boolean;
  error?: string;
}

/**
 * 批量操作结果接口
 */
export interface BatchOperationResult extends OperationResult {
  total: number;
  successful: number;
  failed: number;
}

/**
 * 选择状态接口
 */
export interface SelectionState<T> {
  selected: T[];
  isSelected: (item: T) => boolean;
  toggleSelection: (item: T) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

/**
 * 加载状态接口
 */
export interface LoadingState {
  loading: boolean;
  error: string | null;
}

/**
 * 表格列配置接口
 */
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

/**
 * 表格操作配置接口
 */
export interface TableAction<T = unknown> {
  key: string;
  label: string;
  action: (record: T) => void;
  disabled?: (record: T) => boolean;
  icon?: React.ReactNode;
  danger?: boolean;
}
