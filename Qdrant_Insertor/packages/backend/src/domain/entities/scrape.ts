// src/domain/entities/scrape.ts

/**
 * 爬虫任务状态枚举
 */
export enum ScrapeStatus {
  NEW = 'NEW',
  INITIATED = 'INITIATED',
  FETCHING = 'FETCHING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

/**
 * 爬虫任务类型枚举
 */
export enum ScrapeType {
  WEB_CRAWL = 'web_crawl',
  CONTENT_EXTRACTION = 'content_extraction',
}

/**
 * 爬虫任务配置接口
 */
export interface ScrapeConfig {
  /** 目标URL */
  url: string;
  /** 爬取深度 */
  maxDepth?: number;
  /** 是否跟随外部链接 */
  followLinks?: boolean;
  /** 选择器配置 */
  selectors?: {
    title?: string;
    content?: string;
    links?: string;
  };
  /** 请求头配置 */
  headers?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 爬虫结果接口
 */
export interface ScrapeResult {
  /** 任务ID */
  taskId: string;
  /** 状态 */
  status: ScrapeStatus;
  /** 标题 */
  title?: string;
  /** 主要内容 */
  content?: string;
  /** 提取的链接列表 */
  links?: Array<{
    url: string;
    text?: string;
    title?: string;
  }>;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 进度百分比 */
  progress: number;
  /** 重试次数 */
  retries: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 爬虫任务接口
 */
export interface IScrapeTask {
  /** 任务唯一标识符 */
  id: string;
  /** 任务类型 */
  taskType: ScrapeType;
  /** 当前状态 */
  status: string;
  /** 重试次数 */
  retries: number;
  /** 最后一次尝试时间 */
  lastAttemptAt?: number;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 任务上下文数据 */
  context?: Record<string, unknown>;
}

/**
 * 爬虫服务接口
 */
export interface IScrapeService {
  /**
   * 创建爬虫任务
   * @param config - 爬虫配置
   * @returns 任务ID
   */
  createScrapeTask(config: ScrapeConfig): Promise<string>;

  /**
   * 获取爬虫任务状态
   * @param taskId - 任务ID
   * @returns 任务状态
   */
  getScrapeTask(taskId: string): Promise<IScrapeTask | null>;

  /**
   * 获取所有爬虫任务
   * @returns 任务列表
   */
  getAllScrapeTasks(): Promise<IScrapeTask[]>;

  /**
   * 获取指定状态的爬虫任务
   * @param status - 状态
   * @returns 任务列表
   */
  getScrapeTasksByStatus(status: string): Promise<IScrapeTask[]>;

  /**
   * 取消爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  cancelScrapeTask(taskId: string): Promise<boolean>;

  /**
   * 重试爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  retryScrapeTask(taskId: string): Promise<boolean>;

  /**
   * 获取爬虫任务统计
   * @returns 统计信息
   */
  getScrapeTaskStats(): Promise<Record<string, Record<string, number>>>;

  /**
   * 列出已持久化的爬取结果供审核/导入
   */
  listScrapeResults(params?: {
    status?: 'PENDING' | 'IMPORTED' | 'DELETED';
    taskId?: string;
  }): Promise<
    Array<{
      id: string;
      taskId: string;
      url: string;
      title?: string;
      content?: string;
      links?: Array<{ url: string; text?: string; title?: string }>;
      status: 'PENDING' | 'IMPORTED' | 'DELETED';
      created_at: number;
      updated_at: number;
      imported_doc_id?: string | null;
    }>
  >;

  /**
   * 将抓取结果导入到指定集合
   */
  importScrapeResult(id: string, collectionId: import('@domain/entities/types.js').CollectionId, name?: string): Promise<{ success: boolean; docId?: import('@domain/entities/types.js').DocId; error?: string }>;

  /**
   * 删除（软删除）抓取结果
   */
  deleteScrapeResult(id: string): Promise<{ success: boolean }>;
}

/**
 * Web爬虫接口
 */
export interface IWebCrawler {
  /**
   * 执行网页爬取
   * @param config - 爬虫配置
   * @returns 爬取结果
   */
  crawl(config: ScrapeConfig): Promise<ScrapeResult>;
}

/**
 * 内容提取器接口
 */
export interface IContentExtractor {
  /**
   * 提取网页内容
   * @param html - HTML内容
   * @param selectors - CSS选择器配置
   * @returns 提取结果
   */
  extract(
    html: string,
    selectors?: ScrapeConfig['selectors'],
  ): {
    title?: string;
    content?: string;
    links?: Array<{
      url: string;
      text?: string;
      title?: string;
    }>;
  };
}
