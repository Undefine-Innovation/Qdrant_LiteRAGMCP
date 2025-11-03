import { apiClient } from './api-client';
import type {
  ScrapeStartRequest,
  ScrapeStartResponse,
  ScrapeStatusResponse,
  ScrapeListResponse,
  ScrapeCancelRequest,
  ScrapeCancelResponse,
  ScrapeRetryRequest,
  ScrapeRetryResponse,
  ScrapeStatsResponse,
  ScrapeResultsListResponse,
  ImportScrapeResultRequest,
  ImportScrapeResultResponse,
  DeleteScrapeResultResponse,
} from '../types/scrape';

/**
 * 爬虫服务API类
 * 封装所有爬虫相关的API请求
 */
export class ScrapeApiService {
  private readonly basePath = '/scrape';

  /**
   * 启动新的爬虫任务
   * @param config 爬虫配置
   * @returns 爬虫启动响应
   */
  async startScrapeTask(config: ScrapeStartRequest): Promise<ScrapeStartResponse> {
    return apiClient.post<ScrapeStartResponse>(`${this.basePath}/start`, config);
  }

  /**
   * 查询爬虫任务状态
   * @param taskId 任务ID
   * @returns 爬虫状态响应
   */
  async getScrapeTaskStatus(taskId: string): Promise<ScrapeStatusResponse> {
    return apiClient.get<ScrapeStatusResponse>(`${this.basePath}/status/${taskId}`);
  }

  /**
   * 获取所有爬虫任务列表
   * @returns 爬虫任务列表响应
   */
  async getAllScrapeTasks(): Promise<ScrapeListResponse> {
    return apiClient.get<ScrapeListResponse>(`${this.basePath}/list`);
  }

  /**
   * 取消爬虫任务
   * @param taskId 任务ID
   * @param request 取消请求数据
   * @returns 取消响应
   */
  async cancelScrapeTask(
    taskId: string,
    request: ScrapeCancelRequest = {}
  ): Promise<ScrapeCancelResponse> {
    return apiClient.post<ScrapeCancelResponse>(
      `${this.basePath}/cancel/${taskId}`,
      request
    );
  }

  /**
   * 重试爬虫任务
   * @param taskId 任务ID
   * @param request 重试请求数据
   * @returns 重试响应
   */
  async retryScrapeTask(
    taskId: string,
    request: ScrapeRetryRequest = {}
  ): Promise<ScrapeRetryResponse> {
    return apiClient.post<ScrapeRetryResponse>(
      `${this.basePath}/retry/${taskId}`,
      request
    );
  }

  /**
   * 获取爬虫任务统计信息
   * @returns 统计信息响应
   */
  async getScrapeStats(): Promise<ScrapeStatsResponse> {
    return apiClient.get<ScrapeStatsResponse>(`${this.basePath}/stats`);
  }

  /**
   * 获取抓取结果列表（默认PENDING）
   */
  async getScrapeResults(params?: { status?: string; taskId?: string; limit?: number; offset?: number; includeContent?: boolean }): Promise<ScrapeResultsListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.taskId) query.set('taskId', params.taskId);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    query.set('includeContent', String(params?.includeContent ?? false));
    const qs = query.toString();
    const url = `${this.basePath}/results${qs ? `?${qs}` : ''}`;
    return apiClient.get<ScrapeResultsListResponse>(url);
  }

  /** 获取单条抓取结果（包含全文） */
  async getScrapeResult(id: string) {
    return apiClient.get<import('../types/scrape').ScrapeResultDetailResponse>(`${this.basePath}/results/${id}`);
  }

  /** 获取抓取任务分组 */
  async getScrapeGroups(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    const qs = query.toString();
    const url = `${this.basePath}/results-groups${qs ? `?${qs}` : ''}`;
    return apiClient.get<import('../types/scrape').ScrapeTaskGroupsResponse>(url);
  }

  /**
   * 导入指定抓取结果为文档
   */
  async importScrapeResult(id: string, body: ImportScrapeResultRequest): Promise<ImportScrapeResultResponse> {
    return apiClient.post<ImportScrapeResultResponse>(`${this.basePath}/results/${id}/import`, body);
  }

  /**
   * 删除（软删除）指定抓取结果
   */
  async deleteScrapeResult(id: string): Promise<DeleteScrapeResultResponse> {
    return apiClient.post<DeleteScrapeResultResponse>(`${this.basePath}/results/${id}/delete`, {});
  }

  /** 批量导入任务 */
  async importTask(taskId: string, body: { collectionId: string; namePrefix?: string }) {
    return apiClient.post<import('../types/scrape').ImportTaskResultsResponse>(`${this.basePath}/results/task/${taskId}/import`, body);
  }

  /** 批量删除任务 */
  async deleteTask(taskId: string) {
    return apiClient.post<import('../types/scrape').DeleteTaskResultsResponse>(`${this.basePath}/results/task/${taskId}/delete`, {});
  }

  /**
   * 轮询任务状态，直到任务完成或失败
   * @param taskId 任务ID
   * @param onProgress 进度回调
   * @param interval 轮询间隔（毫秒）
   * @returns 最终任务状态
   */
  async pollTaskStatus(
    taskId: string,
    onProgress?: (task: any) => void,
    interval: number = 2000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await this.getScrapeTaskStatus(taskId);
          const task = response.task;

          if (onProgress) {
            onProgress(task);
          }

          // 检查任务是否完成
          if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
            resolve(task);
            return;
          }

          // 继续轮询
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * 可取消的轻量轮询（不会返回Promise，返回取消函数）
   * 用于在组件中挂载/卸载时安全启停，避免产生多个未清理的轮询器
   */
  startPollingTask(
    taskId: string,
    onProgress?: (task: any) => void,
    interval: number = 2000,
  ): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;
      try {
        const response = await this.getScrapeTaskStatus(taskId);
        const task = response.task;
        onProgress?.(task);
        if (stopped) return;
        // 终止条件：到达结束状态则不再继续
        if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
          return;
        }
      } catch (e) {
        // 发生错误时，稍后重试一次，避免爆栈/热循环
      }
      if (!stopped) {
        timer = setTimeout(tick, interval);
      }
    };

    // 立即启动一次
    void tick();

    // 返回取消函数
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }
}

// 创建单例实例
export const scrapeApiService = new ScrapeApiService();

// 导出默认实例
export default scrapeApiService;