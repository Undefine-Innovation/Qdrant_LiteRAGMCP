// src/api/contracts/scrape.ts

import { z } from 'zod';

/**
 * 爬虫任务启动请求Schema
 * 用于验证 `POST /scrape/start` 的请求体
 */
export const ScrapeStartRequestSchema = z.object({
  url: z.string().url('要爬取的URL地址'),
  maxDepth: z.number().int().min(1).max(10).optional().describe('爬取深度限制'),
  followLinks: z.boolean().optional().describe('是否跟随外部链接'),
  selectors: z
    .object({
      title: z.string().optional().describe('标题选择器'),
      content: z.string().optional().describe('内容选择器'),
      links: z.string().optional().describe('链接选择器'),
    })
    .optional()
    .describe('CSS选择器配置'),
  headers: z.record(z.string(), z.string()).optional().describe('自定义请求头'),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(300000)
    .optional()
    .describe('请求超时时间（毫秒）'),
  userAgent: z.string().optional().describe('用户代理字符串'),
});

/**
 * 爬虫任务状态响应Schema
 * 用于验证 `GET /scrape/status/{id}` 的响应
 */
export const ScrapeStatusResponseSchema = z.object({
  success: z.boolean().describe('查询是否成功'),
  task: z
    .object({
      id: z.string().describe('任务ID'),
      taskType: z.string().describe('任务类型'),
      status: z.string().describe('当前状态'),
      retries: z.number().describe('重试次数'),
      lastAttemptAt: z.number().optional().describe('最后尝试时间戳'),
      error: z.string().optional().describe('错误信息'),
      createdAt: z.number().describe('创建时间戳'),
      updatedAt: z.number().describe('更新时间戳'),
      startedAt: z.number().optional().describe('开始时间戳'),
      completedAt: z.number().optional().describe('完成时间戳'),
      progress: z.number().describe('进度百分比'),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('任务上下文'),
    })
    .describe('任务状态信息'),
});

/**
 * 爬虫任务列表响应Schema
 * 用于验证 `GET /scrape/list` 的响应
 */
export const ScrapeListResponseSchema = z.object({
  success: z.boolean().describe('查询是否成功'),
  tasks: z
    .array(
      z.object({
        id: z.string().describe('任务ID'),
        taskType: z.string().describe('任务类型'),
        status: z.string().describe('当前状态'),
        retries: z.number().describe('重试次数'),
        lastAttemptAt: z.number().optional().describe('最后尝试时间戳'),
        error: z.string().optional().describe('错误信息'),
        createdAt: z.number().describe('创建时间戳'),
        updatedAt: z.number().describe('更新时间戳'),
        startedAt: z.number().optional().describe('开始时间戳'),
        completedAt: z.number().optional().describe('完成时间戳'),
        progress: z.number().describe('进度百分比'),
        context: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('任务上下文'),
      }),
    )
    .describe('爬虫任务列表'),
});

/**
 * 爬虫任务取消请求Schema
 * 用于验证 `POST /scrape/cancel/{id}` 的请求体
 */
export const ScrapeCancelRequestSchema = z.object({
  reason: z.string().optional().describe('取消原因'),
});

/**
 * 爬虫任务取消响应Schema
 * 用于验证 `POST /scrape/cancel/{id}` 的响应
 */
export const ScrapeCancelResponseSchema = z.object({
  success: z.boolean().describe('取消是否成功'),
  message: z.string().describe('响应消息'),
});

/**
 * 爬虫任务重试请求Schema
 * 用于验证 `POST /scrape/retry/{id}` 的请求体
 */
export const ScrapeRetryRequestSchema = z.object({
  reason: z.string().optional().describe('重试原因'),
});

/**
 * 爬虫任务重试响应Schema
 * 用于验证 `POST /scrape/retry/{id}` 的响应
 */
export const ScrapeRetryResponseSchema = z.object({
  success: z.boolean().describe('重试是否成功'),
  message: z.string().describe('响应消息'),
});

/**
 * 爬虫任务统计响应Schema
 * 用于验证 `GET /scrape/stats` 的响应
 */
export const ScrapeStatsResponseSchema = z.object({
  success: z.boolean().describe('查询是否成功'),
  stats: z
    .record(z.string(), z.record(z.string(), z.number()))
    .describe('爬虫任务统计信息'),
});

/**
 * 爬虫任务启动请求类型
 */
export type ScrapeStartRequest = z.infer<typeof ScrapeStartRequestSchema>;

/**
 * 爬虫任务状态响应类型
 */
export type ScrapeStatusResponse = z.infer<typeof ScrapeStatusResponseSchema>;

/**
 * 爬虫任务列表响应类型
 */
export type ScrapeListResponse = z.infer<typeof ScrapeListResponseSchema>;

/**
 * 爬虫任务取消请求类型
 */
export type ScrapeCancelRequest = z.infer<typeof ScrapeCancelRequestSchema>;

/**
 * 爬虫任务取消响应类型
 */
export type ScrapeCancelResponse = z.infer<typeof ScrapeCancelResponseSchema>;

/**
 * 爬虫任务重试请求类型
 */
export type ScrapeRetryRequest = z.infer<typeof ScrapeRetryRequestSchema>;

/**
 * 爬虫任务重试响应类型
 */
export type ScrapeRetryResponse = z.infer<typeof ScrapeRetryResponseSchema>;

/**
 * 爬虫任务统计响应类型
 */
export type ScrapeStatsResponse = z.infer<typeof ScrapeStatsResponseSchema>;
