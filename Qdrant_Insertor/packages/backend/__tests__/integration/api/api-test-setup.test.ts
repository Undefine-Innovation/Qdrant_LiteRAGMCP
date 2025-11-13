/**
 * API测试设置文件
 * 提供API测试的基础设置和工具函数
 */

import express from 'express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '@/app.js';
import {
  initializeInfrastructure,
  initializeServices,
} from '@infrastructure/di/services.js';
import { validateConfig, AppConfig } from '@infrastructure/config/config.js';
import { createLogger, Logger } from '@logging/logger.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../test-data-factory.js';

/**
 * API测试环境接口
 */
export interface ApiTestEnvironment {
  app: express.Application;
  dataSource: DataSource;
  config: AppConfig;
  logger: Logger;
}

/**
 * 创建API测试环境
 * @returns Promise<ApiTestEnvironment> 测试环境实例
 */
export async function createApiTestEnvironment(): Promise<ApiTestEnvironment> {
  // 获取或初始化测试数据库
  // 先检查全局是否已有初始化的测试数据源
  let dataSource = (globalThis as any).__TEST_DATASOURCE;

  if (!dataSource || !dataSource.isInitialized) {
    // 如果没有，则初始化
    dataSource = await initializeTestDatabase();
  }

  // 确保dataSource已初始化
  if (!dataSource || !dataSource.isInitialized) {
    throw new Error('Test DataSource is not initialized');
  }

  // 验证dataSource是否可以执行查询
  try {
    await dataSource.query('SELECT 1');
    console.log('[API Test Setup] DataSource连接验证成功');
  } catch (error) {
    console.error('[API Test Setup] DataSource连接验证失败:', error);
    // 尝试重新初始化
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = await initializeTestDatabase();
    console.log('[API Test Setup] DataSource已重新初始化');
  }

  // 创建测试配置 - 配置为指向内存数据库
  const config: AppConfig = {
    openai: {
      baseUrl: 'https://api.openai.com',
      apiKey: 'test-key',
      model: 'text-embedding-ada-002',
    },
    db: {
      type: 'sqlite',
      path: ':memory:',
    },
    qdrant: {
      url: 'http://localhost:6333',
      collection: 'test-collection',
      vectorSize: 1536,
    },
    embedding: {
      batchSize: 10,
    },
    log: {
      level: 'error', // 测试时只记录错误
      enableTraceId: false, // 测试环境中禁用追踪ID
      enablePerformanceLogging: false, // 测试环境中禁用性能日志
    },
    api: {
      port: 3001, // 使用不同的端口避免冲突
    },
    gc: {
      intervalHours: 24,
    },
  };

  // 创建测试日志记录器
  const logger = createLogger(config);

  // 在全局对象上保存测试数据源，供 initializeInfrastructure 和其他地方使用
  (globalThis as any).__TEST_DATASOURCE = dataSource;

  // 初始化基础设施 - 它会检查 __TEST_DATASOURCE
  const infrastructure = await initializeInfrastructure(config, logger);

  // 初始化服务
  const services = await initializeServices(infrastructure, config, logger);

  // 创建Express应用 - 传递测试数据源
  const app = createApp(services, config, logger, undefined, dataSource);

  return {
    app,
    dataSource,
    config,
    logger,
  };
}

/**
 * API测试工具类
 */
export class ApiTestUtils {
  /**
   * 创建测试请求
   * @param app Express应用实例
   * @returns supertest请求实例
   */
  static createRequest(app: express.Application) {
    return request(app);
  }

  /**
   * 创建认证头
   * @param token 认证令牌
   * @returns 认证头对象
   */
  static createAuthHeaders(token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * 验证API响应格式
   * @param response API响应
   * @param expectedStatus 期望状态码
   * @param expectedFields 期望字段
   */
  static validateApiResponse(
    response: request.Response,
    expectedStatus: number,
    expectedFields?: string[],
  ) {
    expect(response.status).toBe(expectedStatus);
    expect(response.headers['content-type']).toMatch(/json/);

    if (expectedFields) {
      for (const field of expectedFields) {
        expect(response.body).toHaveProperty(field);
      }
    }
  }

  /**
   * 验证错误响应格式
   * @param response API响应
   * @param expectedStatus 期望状态码
   * @param expectedErrorCode 期望错误代码
   */
  static validateErrorResponse(
    response: request.Response,
    expectedStatus: number,
    expectedErrorCode?: string,
  ) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');

    if (expectedErrorCode) {
      expect(response.body.error.code).toBe(expectedErrorCode);
    }
  }

  /**
   * 验证分页响应格式
   * @param response API响应
   * @param expectedDataCount 期望数据数量
   * @param expectedPagination 期望分页信息
   */
  static validatePaginatedResponse(
    response: request.Response,
    expectedDataCount?: number,
    expectedPagination?: Partial<{
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>,
  ) {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');

    if (expectedDataCount !== undefined) {
      expect(response.body.data).toHaveLength(expectedDataCount);
    }

    if (expectedPagination) {
      for (const [key, value] of Object.entries(expectedPagination)) {
        expect(response.body.pagination[key]).toBe(value);
      }
    }
  }

  /**
   * 创建测试文件
   * @param filename 文件名
   * @param content 文件内容
   * @param mimeType MIME类型
   * @returns 测试文件对象
   */
  static createTestFile(
    filename: string,
    content: string,
    mimeType: string = 'text/plain',
  ) {
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: mimeType,
      buffer: Buffer.from(content),
      size: content.length,
    };
  }

  /**
   * 创建多个测试文件
   * @param count 文件数量
   * @param prefix 文件名前缀
   * @returns 测试文件数组
   */
  static createTestFiles(count: number, prefix: string = 'test') {
    const files = [];
    for (let i = 0; i < count; i++) {
      files.push(
        this.createTestFile(
          `${prefix}-${i}.txt`,
          `Test content for file ${i}`,
          'text/plain',
        ),
      );
    }
    return files;
  }

  /**
   * 等待异步操作完成
   * @param ms 等待毫秒数
   * @returns Promise<void>
   */
  static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 重试操作
   * @param fn 要重试的函数
   * @param maxRetries 最大重试次数
   * @param delay 重试间隔
   * @returns Promise<T> 操作结果
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100,
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.wait(delay);
        }
      }
    }

    throw lastError!;
  }
}

/**
 * API测试数据工厂
 */
export class ApiTestDataFactory {
  /**
   * �������Լ�������
   */
  static createCollectionData(overrides: Partial<any> = {}) {
    const timestamp = Date.now();
    const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      collectionId: `test-collection-${uniqueId}`,
      name: `test_collection_${uniqueId}`,
      description: 'Test collection description',
      ...overrides,
    };
  }

  /**
   * ���������ĵ�����
   */
  static createDocumentData(overrides: Partial<any> = {}) {
    const timestamp = Date.now();
    const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      docId: `test-doc-${uniqueId}`,
      name: `Test Document ${uniqueId}`,
      content: 'Test document content',
      key: `test-doc-key-${uniqueId}`,
      ...overrides,
    };
  }

  /**
   * ����������ѯ����
   */
  static createSearchQuery(overrides: Partial<any> = {}) {
    return {
      q: 'test query',
      collectionId: 'test-collection-id',
      limit: 10,
      ...overrides,
    };
  }

  /**
   * ����������������
   */
  static createBatchOperationData(overrides: Partial<any> = {}) {
    return {
      operationId: `batch-op-${Date.now()}`,
      type: 'upload',
      status: 'pending',
      total: 10,
      processed: 0,
      successful: 0,
      failed: 0,
      ...overrides,
    };
  }
}
// 导出常用的测试工具和工厂
export {
  TestDataFactory,
  TestAssertions,
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
};

describe('api-test-setup smoke', () => {
  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
