// src/infrastructure/external/ContentExtractor.ts

import { Logger } from '@logging/logger.js';
import { IContentExtractor, ScrapeConfig } from '@domain/entities/scrape.js';

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
      // 如果没有提供选择器，返回原始HTML
      if (!selectors) {
        this.logger.info('未提供选择器，返回原始HTML内容');
        return {
          content: html,
          title: this.extractTitle(html),
        };
      }

      // 提取标题
      const title = selectors.title
        ? this.extractBySelector(html, selectors.title)
        : undefined;

      // 提取主要内容
      const content = selectors.content
        ? this.extractBySelector(html, selectors.content)
        : undefined;

      // 提取链接
      const links = selectors.links
        ? this.extractLinks(html, selectors.links)
        : undefined;

      this.logger.info(
        `内容提取完成，标题: ${title}, 链接数: ${links?.length || 0}`,
      );

      return {
        title,
        content,
        links,
      };
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
  private extractBySelector(
    html: string,
    selector: string,
  ): string | undefined {
    try {
      // 在实际项目中，应该使用cheerio或类似的HTML解析库
      // 这里提供一个简单的正则表达式实现
      const regex = new RegExp(`<[^>]*${selector}[^>]*>([^<]*)`, 'gi');
      const matches = html.match(regex);

      if (matches && matches.length > 0) {
        // 移除HTML标签，只保留文本内容
        return matches[0].replace(/<[^>]*>/g, '').trim();
      }

      return undefined;
    } catch (error) {
      this.logger.warn(`选择器提取失败: ${selector}, 错误: ${error}`);
      return undefined;
    }
  }

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
