// src/infrastructure/external/WebCrawler.ts

import { Logger } from '@logging/logger.js';
import {
  IWebCrawler,
  ScrapeConfig,
  ScrapeResult,
  ScrapeStatus,
} from '@domain/entities/scrape.js';
import { IContentExtractor } from '@domain/entities/scrape.js';
import { Agent, ProxyAgent } from 'undici';

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
      const startedAt = Date.now();
      const base = new URL(config.url);
      const follow = !!config.followLinks;
      const maxDepth = Math.max(1, config.maxDepth ?? 1);
      const maxPages = 50; // 安全上限，避免爆量

      const visited = new Set<string>();
      const toVisit: Array<{ url: string; depth: number }> = [
        { url: base.toString(), depth: 1 },
      ];

      const pages: Array<{ url: string; title?: string; content?: string }> =
        [];
      const linkSet = new Set<string>();
      const inScopeLinks: Array<{
        url: string;
        text?: string;
        title?: string;
      }> = [];

      while (toVisit.length > 0 && pages.length < maxPages) {
        const { url, depth } = toVisit.shift()!;
        if (visited.has(url)) continue;
        visited.add(url);

        let html: string | null = null;
        try {
          html = await this.fetchHtml(
            url,
            config.headers,
            config.timeout,
            config.userAgent,
          );
        } catch (e) {
          this.logger.warn(`抓取失败，跳过: ${url} -> ${String(e)}`);
          continue;
        }
        if (!html) continue;

        const extracted = this.contentExtractor.extract(html, config.selectors);
        pages.push({ url, title: extracted.title, content: extracted.content });

        // 聚合链接（严格约束在同源/子路径范围）
        const links = extracted.links || [];
        for (const l of links) {
          try {
            const abs = new URL(l.url, url);
            if (abs.origin !== base.origin) continue;
            if (!abs.pathname.startsWith(base.pathname)) continue;
            abs.hash = '';
            const normalizedPath =
              abs.pathname.endsWith('/') && abs.pathname !== '/'
                ? abs.pathname.slice(0, -1)
                : abs.pathname;
            const normalized = `${abs.origin}${normalizedPath}`;
            if (!linkSet.has(normalized)) {
              linkSet.add(normalized);
              inScopeLinks.push({
                url: normalized,
                text: l.text,
                title: l.title,
              });
            }
          } catch (_) {
            // ignore
          }
        }

        // 链接扩展：同源且路径前缀一致
        if (follow && depth < maxDepth && links.length) {
          for (const l of links) {
            try {
              const abs = new URL(l.url, url);
              // 仅同源
              if (abs.origin !== base.origin) continue;
              // 仅在同路径前缀（允许子路径）
              if (!abs.pathname.startsWith(base.pathname)) continue;
              // 归一化：去掉片段，标准化路径结尾斜杠
              abs.hash = '';
              const normalizedPath =
                abs.pathname.endsWith('/') && abs.pathname !== '/'
                  ? abs.pathname.slice(0, -1)
                  : abs.pathname;
              const normalized = `${abs.origin}${normalizedPath}`;
              if (!visited.has(normalized)) {
                toVisit.push({ url: normalized, depth: depth + 1 });
              }
            } catch (_) {
              // ignore bad url
            }
          }
        }
      }

      const combinedTitle = pages[0]?.title;
      const combinedContent = pages
        .map((p) => `# ${p.title || p.url}\n\n${p.content || ''}`)
        .join('\n\n---\n\n');

      this.logger.info(
        `抓取完成：页面数 ${pages.length}，同域同路径链接数 ${inScopeLinks.length}`,
      );

      return {
        taskId: `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'COMPLETED' as ScrapeStatus,
        title: combinedTitle,
        content: combinedContent,
        links: inScopeLinks,
        metadata: {
          url: config.url,
          extractedAt: Date.now(),
          selectors: config.selectors,
          pages, // 返回页面数组，供上层按需持久化多条
        },
        startedAt,
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
  private async fetchHtml(
    url: string,
    headers?: Record<string, string>,
    timeout?: number,
    userAgent?: string,
  ): Promise<string> {
    // 配置连接与请求超时
    const requestTimeoutMs = Math.max(1, timeout ?? 30000);
    const connectTimeoutMs = Math.min(requestTimeoutMs - 1, 20000); // 连接超时不超过 20s

    // 可选代理支持（优先 HTTPS_PROXY 其后 HTTP_PROXY）
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const dispatcher = proxyUrl
      ? new ProxyAgent(proxyUrl)
      : new Agent({ connect: { timeout: connectTimeoutMs } });

    // 简单重试（指数退避）
    const maxRetries = 2;
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        /**
         * RequestInit extended with undici dispatcher for custom connection/agent control.
         */
        type UndiciFetchOptions = RequestInit & {
          dispatcher?: Agent | ProxyAgent;
        };
        const fetchOpts: UndiciFetchOptions = {
          method: 'GET',
          headers: {
            'User-Agent':
              userAgent ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            ...headers,
          },
          signal: controller.signal,
          // 使用 undici dispatcher 定制连接超时/代理
          dispatcher,
        };

        const response = await fetch(url, fetchOpts);

        clearTimeout(timeoutId);

        if (!response.ok) {
          // 对易恢复的 429/503 做重试
          if (
            (response.status === 429 || response.status === 503) &&
            attempt < maxRetries
          ) {
            attempt++;
            const backoff = 500 * Math.pow(2, attempt); // 500ms, 1000ms, 2000ms
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        clearTimeout(timeoutId);
        controller.abort();
        lastErr = error;
        const e = error as unknown;
        const eObj =
          typeof e === 'object' && e !== null
            ? (e as Record<string, unknown>)
            : {};
        const code =
          typeof eObj['code'] === 'string'
            ? (eObj['code'] as string)
            : typeof (eObj['cause'] as Record<string, unknown>)?.['code'] ===
                'string'
              ? ((eObj['cause'] as Record<string, unknown>)['code'] as string)
              : undefined;
        const transient =
          code === 'UND_ERR_CONNECT_TIMEOUT' ||
          code === 'ETIMEDOUT' ||
          code === 'ECONNRESET' ||
          code === 'ECONNREFUSED' ||
          code === 'EAI_AGAIN';
        if (transient && attempt < maxRetries) {
          attempt++;
          const backoff = 500 * Math.pow(2, attempt);
          this.logger.warn(
            `请求失败(${code})，第 ${attempt} 次重试，等待 ${backoff}ms`,
          );
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        // 聚合错误细节
        const name =
          typeof eObj['name'] === 'string' ? (eObj['name'] as string) : 'Error';
        const errno =
          typeof eObj['errno'] !== 'undefined'
            ? eObj['errno']
            : (eObj['cause'] as Record<string, unknown>)?.['errno'];
        const msg =
          typeof eObj['message'] === 'string'
            ? (eObj['message'] as string)
            : 'fetch failed';
        const detail = `[${name}${code ? `/${code}` : ''}${errno ? `:${String(errno)}` : ''}] ${msg}`;
        throw new Error(detail);
      }
    }
    // 理论上不会到达这里
    throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
  }
}
