// src/infrastructure/external/WebCrawler.ts

import { Logger } from '@logging/logger.js';
import {
  IWebCrawler,
  ScrapeConfig,
  ScrapeResult,
  ScrapeStatus,
} from '@domain/entities/scrape.js';
import { IContentExtractor } from '@domain/entities/scrape.js';

/**
 * Web爬虫实现类
 * 支持基础HTML内容提取和链接跟随
 */
/**
 * Web爬虫实现类
 * 支持基础HTML内容提取和链接跟随
 */
export class WebCrawler implements IWebCrawler {
  private readonly logger: Logger;
  private readonly contentExtractor: IContentExtractor;

  /**
   * 构造函数
   * @param logger - 日志记录器
   * @param contentExtractor - 内容提取器
   */
  constructor(logger: Logger, contentExtractor: IContentExtractor) {
    this.logger = logger;
    this.contentExtractor = contentExtractor;
  }

  /**
   * 执行网页爬取
   * @param config - 爬虫配置
   * @returns 爬取结果
   */
  /**
   * 执行网页爬取
   * @param config - 爬虫配置
   * @returns 爬取结果
   */
  async crawl(config: ScrapeConfig): Promise<ScrapeResult> {
    this.logger.info(`开始爬取网页: ${config.url}`);

    try {
      // 获取网页内容
      const html = await this.fetchHtml(
        config.url,
        config.headers,
        config.timeout,
        config.userAgent,
      );

      if (!html) {
        throw new Error(`无法获取网页内容: ${config.url}`);
      }

      // 提取内容
      const extracted = this.contentExtractor.extract(html, config.selectors);

      // 处理链接跟随（如果启用）
      let links: Array<{ url: string; text?: string; title?: string }> = [];
      if (config.followLinks && extracted.links) {
        // 这里可以添加深度控制和链接过滤逻辑
        links = extracted.links.slice(0, config.maxDepth || 10);
      }

      this.logger.info(
        `内容提取完成，标题: ${extracted.title}, 链接数: ${links.length}`,
      );

      return {
        taskId: `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'COMPLETED' as ScrapeStatus,
        title: extracted.title,
        content: extracted.content,
        links,
        metadata: {
          url: config.url,
          extractedAt: Date.now(),
          selectors: config.selectors,
        },
        startedAt: Date.now(),
        completedAt: Date.now(),
        progress: 100,
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error(`爬取失败: ${config.url}, 错误: ${error}`);

      return {
        taskId: `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'FAILED' as ScrapeStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt: Date.now(),
        completedAt: Date.now(),
        progress: 0,
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * 获取HTML内容
   * @param url - 目标URL
   * @param headers - 请求头
   * @param timeout - 超时时间
   * @param userAgent - 用户代理
   * @returns HTML内容
   */
  /**
   * 获取HTML内容
   * @param url - 目标URL
   * @param headers - 请求头
   * @param timeout - 超时时间
   * @param userAgent - 用户代理
   * @returns HTML内容
   */
  private async fetchHtml(
    url: string,
    headers?: Record<string, string>,
    timeout?: number,
    userAgent?: string,
  ): Promise<string> {
    // 在实际项目中，应该使用fetch或axios等HTTP客户端
    // 这里提供一个基础实现
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || 30000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.0 Safari/537.36',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      controller.abort();

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`网络请求失败: ${error}`);
      }
    }
  }
}
