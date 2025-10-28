/**
 * 搜索请求限速和去重工具
 */

/**
 * 请求状态接口
 */
interface PendingRequest {
  timestamp: number;
  controller: AbortController;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * 搜索限速器配置
 */
interface SearchLimiterConfig {
  /** 最小请求间隔（毫秒） */
  minInterval: number;
  /** 最大并发请求数 */
  maxConcurrent: number;
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 是否启用请求去重 */
  enableDeduplication: boolean;
}

/**
 * 搜索限速器类
 */
export class SearchLimiter {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: Array<() => void> = [];
  private activeRequestsCount = 0;
  private config: SearchLimiterConfig;

  constructor(config: Partial<SearchLimiterConfig> = {}) {
    this.config = {
      minInterval: 300,
      maxConcurrent: 3,
      timeout: 10000,
      enableDeduplication: true,
      ...config,
    };
  }

  /**
   * 生成请求的唯一键
   */
  private getRequestKey(query: string, collectionId?: string): string {
    return `${query.toLowerCase().trim()}|${collectionId || ''}`;
  }

  /**
   * 检查是否可以立即执行请求
   */
  private canExecuteRequest(): boolean {
    return this.activeRequestsCount < this.config.maxConcurrent;
  }

  /**
   * 处理请求队列
   */
  private processQueue(): void {
    if (this.canExecuteRequest() && this.requestQueue.length > 0) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  /**
   * 执行搜索请求（带限速和去重）
   */
  public async execute<T>(
    query: string,
    searchFunction: (signal: AbortSignal) => Promise<T>,
    collectionId?: string,
  ): Promise<T> {
    const requestKey = this.getRequestKey(query, collectionId);

    // 检查是否有相同的请求正在进行
    if (
      this.config.enableDeduplication &&
      this.pendingRequests.has(requestKey)
    ) {
      return new Promise<T>((resolve, reject) => {
        // 等待现有请求完成
        const checkCompletion = () => {
          if (!this.pendingRequests.has(requestKey)) {
            // 请求已完成，重新执行以获取最新结果
            this.execute(query, searchFunction, collectionId)
              .then(resolve)
              .catch(reject);
          } else {
            setTimeout(checkCompletion, 50);
          }
        };
        checkCompletion();
      });
    }

    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        this.cleanupRequest(requestKey);
        reject(new Error('搜索请求超时'));
      }, this.config.timeout);

      const executeRequest = async () => {
        try {
          this.activeRequestsCount++;
          const result = await searchFunction(controller.signal);
          clearTimeout(timeoutId);
          this.cleanupRequest(requestKey);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          this.cleanupRequest(requestKey);
          reject(error);
        } finally {
          this.activeRequestsCount--;
          this.processQueue();
        }
      };

      // 存储请求信息
      this.pendingRequests.set(requestKey, {
        timestamp: Date.now(),
        controller,
        resolve,
        reject,
      });

      // 检查是否可以立即执行或需要排队
      if (this.canExecuteRequest()) {
        executeRequest();
      } else {
        this.requestQueue.push(executeRequest);
      }
    });
  }

  /**
   * 清理完成的请求
   */
  private cleanupRequest(requestKey: string): void {
    const request = this.pendingRequests.get(requestKey);
    if (request) {
      request.controller.abort();
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * 取消所有待处理的请求
   */
  public cancelAll(): void {
    for (const [, request] of this.pendingRequests) {
      request.controller.abort();
      request.reject(new Error('请求已取消'));
    }
    this.pendingRequests.clear();
    this.requestQueue.length = 0;
  }

  /**
   * 取消特定查询的请求
   */
  public cancelQuery(query: string, collectionId?: string): void {
    const requestKey = this.getRequestKey(query, collectionId);
    const request = this.pendingRequests.get(requestKey);
    if (request) {
      request.controller.abort();
      request.reject(new Error('查询已取消'));
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * 获取当前状态信息
   */
  public getStatus(): {
    pendingRequests: number;
    queuedRequests: number;
    activeRequests: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      queuedRequests: this.requestQueue.length,
      activeRequests: this.activeRequestsCount,
    };
  }

  /**
   * 清理过期的请求
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests) {
      if (now - request.timestamp > this.config.timeout) {
        request.controller.abort();
        this.pendingRequests.delete(key);
      }
    }
  }
}

// 创建默认的搜索限速器实例
export const defaultSearchLimiter = new SearchLimiter();

/**
 * 搜索历史记录管理
 */
export class SearchHistory {
  private static readonly STORAGE_KEY = 'search_history';
  private static readonly MAX_HISTORY_SIZE = 20;

  /**
   * 添加搜索记录
   */
  public static add(query: string, collectionId?: string): void {
    if (!query.trim()) return;

    try {
      const history = this.get();
      const entry = {
        query: query.trim(),
        collectionId,
        timestamp: Date.now(),
      };

      // 移除重复项
      const filteredHistory = history.filter(
        item =>
          item.query !== entry.query ||
          item.collectionId !== entry.collectionId,
      );

      // 添加到开头
      filteredHistory.unshift(entry);

      // 限制历史记录大小
      const limitedHistory = filteredHistory.slice(0, this.MAX_HISTORY_SIZE);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.warn('无法保存搜索历史:', error);
    }
  }

  /**
   * 获取搜索历史
   */
  public static get(): Array<{
    query: string;
    collectionId?: string;
    timestamp: number;
  }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('无法读取搜索历史:', error);
      return [];
    }
  }

  /**
   * 清空搜索历史
   */
  public static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('无法清空搜索历史:', error);
    }
  }

  /**
   * 获取搜索建议（基于历史记录）
   */
  public static getSuggestions(
    query: string,
    limit: number = 5,
  ): Array<{
    query: string;
    collectionId?: string;
    timestamp: number;
  }> {
    if (!query.trim()) return [];

    const history = this.get();
    const lowerQuery = query.toLowerCase();

    return history
      .filter(item => item.query.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }
}
