// src/infrastructure/external/ContentExtractor.ts

import { Logger } from '@logging/logger.js';
import { IContentExtractor, ScrapeConfig } from '@domain/entities/scrape.js';
import * as cheerio from 'cheerio';

/**
 * 内容提取器实现类
 * 支持CSS选择器进行HTML内容提取
 */
/**
 * 内容提取器实现类
 * 支持CSS选择器进行HTML内容提取
 */
/**
 * 内容提取器实现类
 * 支持CSS选择器进行HTML内容提取
 */
export class ContentExtractor implements IContentExtractor {
  private readonly logger: Logger;

  /**
   * 构造函数
   * @param logger - 日志记录器
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

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
    links?: Array<{ url: string; text?: string; title?: string }>;
    error?: string;
  } {
    this.logger.info('开始提取HTML内容');

    try {
      const $ = cheerio.load(html);

      // 标题
      let title: string | undefined;
      const titleSel = selectors?.title?.trim() || 'title, h1';
      try {
        const t = $(titleSel).first().text().trim();
        title = t || this.extractTitle(html) || undefined;
      } catch {
        title = this.extractTitle(html) || undefined;
      }

      // 内容（合并多个选择器的文本，保持换行）
      let content: string | undefined;
      const contentSel =
        selectors?.content?.trim() || 'main, article, .content, #content';
      try {
        const parts: string[] = [];
        $(contentSel).each((_, el) => {
          const text = $(el).text().trim();
          if (text) parts.push(text);
        });
        content = parts.length ? parts.join('\n\n') : undefined;
      } catch {
        content = undefined;
      }

      // 链接
      let links:
        | Array<{ url: string; text?: string; title?: string }>
        | undefined;
      const linkSel = selectors?.links?.trim() || 'a[href]';
      try {
        const linkList: Array<{ url: string; text?: string; title?: string }> =
          [];
        $(linkSel).each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          const text = $(el).text().trim();
          const lt = text || $(el).attr('title') || undefined;
          linkList.push({ url: href, text, title: lt });
        });
        links = linkList;
      } catch {
        links = undefined;
      }

      this.logger.info(
        `内容提取完成，标题: ${title || ''}, 链接数: ${links?.length || 0}`,
      );

      return { title, content, links };
    } catch (error) {
      this.logger.error(`内容提取失败: ${error}`);

      return {
        title: undefined,
        content: undefined,
        links: undefined,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 使用CSS选择器提取内容
   * @param html - HTML内容
   * @param selector - CSS选择器
   * @returns 提取的文本内容
   */
  // 旧的正则实现已被 cheerio 替换

  /**
   * 提取页面标题
   * @param html - HTML内容
   * @returns 标题文本
   */
  private extractTitle(html: string): string | undefined {
    try {
      // 尝试多种常见的标题标签
      const titleSelectors = [
        /<title[^>]*>([^<]*)<\/title>/gi,
        /<h1[^>]*>([^<]*)<\/h1>/gi,
        /<h2[^>]*>([^<]*)<\/h2>/gi,
        /<h3[^>]*>([^<]*)<\/h3>/gi,
      ];

      for (const selector of titleSelectors) {
        const match = html.match(selector);
        if (match && match[1]) {
          return match[1].replace(/<[^>]*>/g, '').trim();
        }
      }

      // 如果没有找到标题，尝试从meta标签获取
      const metaMatch = html.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i,
      );
      if (metaMatch && metaMatch[1]) {
        return metaMatch[1].replace(/["']/g, '');
      }

      return undefined;
    } catch (error) {
      this.logger.warn(`标题提取失败: ${error}`);
      return undefined;
    }
  }

  /**
   * 提取页面链接
   * @param html - HTML内容
   * @param linkSelector - 链接选择器
   * @returns 提取的链接数组
   */
  private extractLinks(
    html: string,
    linkSelector?: string,
  ): Array<{ url: string; text?: string; title?: string }> | undefined {
    try {
      // 在实际项目中，应该使用cheerio或类似的HTML解析库
      // 这里提供一个简单的正则表达式实现
      const links: Array<{ url: string; text?: string; title?: string }> = [];

      // 提取所有链接
      const hrefRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
      let match;

      while ((match = hrefRegex.exec(html)) !== null) {
        const url = match[1];
        const linkText = match[2]
          ? match[2].replace(/<[^>]*>/g, '').trim()
          : '';
        const title = this.extractTitle(match[2]) || linkText;

        links.push({
          url,
          text: linkText,
          title,
        });
      }

      this.logger.info(`链接提取完成，共找到 ${links.length} 个链接`);
      return links;
    } catch (error) {
      this.logger.warn(`链接提取失败: ${error}`);
      return undefined;
    }
  }
}
