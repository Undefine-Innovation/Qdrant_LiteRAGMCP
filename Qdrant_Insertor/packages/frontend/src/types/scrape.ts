/**
 * 爬虫选择器配置
 */
export interface ScrapeSelectors {
  title?: string;
  content?: string;
  links?: string;
}

/**
 * 爬虫配置接口
 */
export interface ScrapeConfig {
  url: string;
  maxDepth?: number;
  followLinks?: boolean;
  selectors?: ScrapeSelectors;
  headers?: Record<string, string>;
  timeout?: number;
  userAgent?: string;
}

/**
 * 爬虫任务状态枚举
 */
export enum ScrapeTaskStatus {
  NEW = 'NEW',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

/**
 * 爬虫任务上下文接口
 */
export interface ScrapeTaskContext {
  taskId: string;
  taskType: string;
  config: ScrapeConfig;
  createdAt: number;
  /** 执行过程日志 */
  logs?: Array<{
    ts: number;
    level: 'info' | 'error' | 'debug';
    message: string;
  }>;
}

/**
 * 爬虫任务接口
 */
export interface ScrapeTask {
  id: string;
  taskType: string;
  status: ScrapeTaskStatus;
  retries: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  progress: number;
  context: ScrapeTaskContext;
}

/**
 * 爬虫任务统计
 */
export interface ScrapeStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  retrying: number;
  successRate: number;
  avgDuration: number;
}

/**
 * 爬虫启动请求
 */
export type ScrapeStartRequest = ScrapeConfig;

/**
 * 爬虫启动响应
 */
export interface ScrapeStartResponse {
  success: boolean;
  message: string;
  taskId: string;
}

/**
 * 爬虫状态响应
 */
export interface ScrapeStatusResponse {
  success: boolean;
  task: ScrapeTask;
}

/**
 * 爬虫任务列表响应
 */
export interface ScrapeListResponse {
  success: boolean;
  tasks: ScrapeTask[];
}

/**
 * 爬虫取消请求
 */
export interface ScrapeCancelRequest {
  reason?: string;
}

/**
 * 爬虫取消响应
 */
export interface ScrapeCancelResponse {
  success: boolean;
  message: string;
}

/**
 * 爬虫重试请求
 */
export interface ScrapeRetryRequest {
  reason?: string;
}

/**
 * 爬虫重试响应
 */
export interface ScrapeRetryResponse {
  success: boolean;
  message: string;
}

/**
 * 爬虫统计响应
 */
export interface ScrapeStatsResponse {
  success: boolean;
  stats: ScrapeStats;
}

/**
 * 抓取结果记录
 */
export interface ScrapeResultItem {
  id: string;
  taskId: string;
  url: string;
  title?: string;
  content?: string; // 列表接口默认不返回
  snippet?: string; // 简要摘要，前300字
  links?: Array<{ url: string; text?: string; title?: string }>;
  status: 'PENDING' | 'IMPORTED' | 'DELETED';
  created_at: number;
  updated_at: number;
  imported_doc_id?: string | null;
}

export interface ScrapeResultsListResponse {
  success: boolean;
  items: ScrapeResultItem[];
}

export interface ScrapeResultDetailResponse {
  success: boolean;
  item: ScrapeResultItem;
}

export interface ScrapeTaskGroupItem {
  taskId: string;
  total: number;
  pending: number;
  imported: number;
  deleted: number;
  first_at: number;
  last_at: number;
}

export interface ScrapeTaskGroupsResponse {
  success: boolean;
  groups: ScrapeTaskGroupItem[];
}

export interface ImportScrapeResultRequest {
  collectionId: string;
  name?: string;
}

export interface ImportScrapeResultResponse {
  success: boolean;
  docId?: string;
  error?: string;
}

export interface DeleteScrapeResultResponse {
  success: boolean;
  error?: string;
}

export interface ImportTaskResultsResponse {
  success: boolean;
  imported: number;
  errors?: Array<{ id: string; error: string }>;
}

export interface DeleteTaskResultsResponse {
  success: boolean;
}
