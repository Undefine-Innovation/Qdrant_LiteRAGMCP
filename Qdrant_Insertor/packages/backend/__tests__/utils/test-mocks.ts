/**
 * 统一的测试Mock工厂
 * 提供常用的Mock对象创建函数，减少测试代码重复
 */

import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ILLMService, SemanticSplitResult } from '@domain/interfaces/llm.js';

/**
 * Mock对象工厂
 */
export class MockFactory {
  /**
   * 创建标准的Logger Mock
   */
  static createLoggerMock(): jest.Mocked<Logger> {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
  }

  /**
   * 创建标准的DataSource Mock
   */
  static createDataSourceMock(
    overrides: Partial<jest.Mocked<DataSource>> = {},
  ): jest.Mocked<DataSource> {
    const mockRepository = this.createRepositoryMock();

    return {
      getRepository: jest.fn().mockReturnValue(mockRepository),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      isInitialized: true,
      createQueryBuilder: jest.fn(),
      transaction: jest.fn(),
      query: jest.fn(),
      ...overrides,
    } as any;
  }

  /**
   * 创建完整的Repository Mock集合
   */
  static createRepositoryMocks(entityName: string): {
    dataSource: jest.Mocked<DataSource>;
    logger: jest.Mocked<Logger>;
    repository: any;
  } {
    const logger = this.createLoggerMock();
    const repository = this.createRepositoryMock();
    const dataSource = this.createDataSourceMock();

    // 配置DataSource返回对应的Repository
    dataSource.getRepository.mockReturnValue(repository);

    return {
      dataSource,
      logger,
      repository,
    };
  }

  /**
   * 创建标准的Repository Mock
   */
  static createRepositoryMock(overrides: any = {}): any {
    const createMockQueryBuilder = () => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
      getRawOne: jest.fn().mockResolvedValue({}),
      getRawMany: jest.fn().mockResolvedValue([]),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    });

    return {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest
        .fn()
        .mockImplementation(() => createMockQueryBuilder()),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      findAndCount: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      // 确保repository本身也有getRawOne和getRawMany方法
      getRawOne: jest.fn().mockResolvedValue({}),
      getRawMany: jest.fn().mockResolvedValue([]),
      ...overrides,
    };
  }

  /**
   * 创建事务管理器Mock
   */
  static createTransactionManagerMock(): any {
    return {
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      query: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
  }

  /**
   * 创建查询构建器Mock
   */
  static createQueryBuilder(overrides: any = {}): any {
    const defaultQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
      getRawOne: jest.fn().mockResolvedValue({}),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    // 应用覆盖配置 - 如果传入的不是mock函数，则转换为mock
    const processedOverrides: any = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (key === 'getMany' && Array.isArray(value)) {
        // getMany 传入数组，转换为 jest.fn()
        processedOverrides[key] = jest.fn().mockResolvedValue(value);
      } else if (
        key === 'getOne' &&
        !jest.isMockFunction(value) &&
        value !== null
      ) {
        // getOne 传入非 mock 值，转换为 jest.fn()
        processedOverrides[key] = jest.fn().mockResolvedValue(value);
      } else if (key === 'getManyAndCount' && Array.isArray(value)) {
        // getManyAndCount 传入数组，转换为 jest.fn()
        processedOverrides[key] = jest.fn().mockResolvedValue(value);
      } else if (key === 'getCount' && typeof value === 'number') {
        // getCount 传入数字，转换为 jest.fn()
        processedOverrides[key] = jest.fn().mockResolvedValue(value);
      } else {
        processedOverrides[key] = value;
      }
    }

    return { ...defaultQueryBuilder, ...processedOverrides };
  }

  /**
   * 创建查询构建器Mock（向后兼容）
   */
  static createQueryBuilderMock(overrides: any = {}): any {
    return this.createQueryBuilder(overrides);
  }

  /**
   * 创建API响应Mock
   */
  static createApiResponseMock<T>(data: T, overrides: any = {}): any {
    return {
      data,
      success: true,
      message: 'Success',
      ...overrides,
    };
  }

  /**
   * 创建分页响应Mock
   */
  static createPaginatedResponseMock<T>(
    data: T[],
    pagination: any = {},
    overrides: any = {},
  ): any {
    return {
      data,
      pagination: {
        page: 1,
        limit: 10,
        total: data.length,
        totalPages: Math.ceil(data.length / 10),
        hasNext: false,
        hasPrev: false,
        ...pagination,
      },
      ...overrides,
    };
  }

  /**
   * 创建错误响应Mock
   */
  static createErrorResponseMock(
    error: string | Error,
    statusCode: number = 500,
  ): any {
    return {
      success: false,
      error: typeof error === 'string' ? error : error.message,
      statusCode,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 测试Mock设置工具
 */
export class MockSetupHelpers {
  /**
   * 设置Repository Mock的基本行为
   */
  static setupRepositoryBasics(mockRepository: any): void {
    // 默认成功响应
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.find.mockResolvedValue([]);
    mockRepository.count.mockResolvedValue(0);
    mockRepository.save.mockResolvedValue({});
    mockRepository.update.mockResolvedValue({ affected: 1 });
    mockRepository.delete.mockResolvedValue({ affected: 1 });
  }

  /**
   * 设置Repository Mock的错误行为
   */
  static setupRepositoryErrors(mockRepository: any, error: Error): void {
    mockRepository.findOne.mockRejectedValue(error);
    mockRepository.find.mockRejectedValue(error);
    mockRepository.count.mockRejectedValue(error);
    mockRepository.save.mockRejectedValue(error);
    mockRepository.update.mockRejectedValue(error);
    mockRepository.delete.mockRejectedValue(error);
  }

  /**
   * 设置QueryBuilder Mock的基本行为
   */
  static setupQueryBuilderBasics(mockQueryBuilder: any): void {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    mockQueryBuilder.getOne.mockResolvedValue(null);
    mockQueryBuilder.getCount.mockResolvedValue(0);
    mockQueryBuilder.getRawOne.mockResolvedValue({});
    mockQueryBuilder.getRawMany.mockResolvedValue([]);
    mockQueryBuilder.execute.mockResolvedValue(undefined);
  }

  /**
   * 设置QueryBuilder Mock的错误行为
   */
  static setupQueryBuilderErrors(mockQueryBuilder: any, error: Error): void {
    mockQueryBuilder.getMany.mockRejectedValue(error);
    mockQueryBuilder.getManyAndCount.mockRejectedValue(error);
    mockQueryBuilder.getOne.mockRejectedValue(error);
    mockQueryBuilder.getCount.mockRejectedValue(error);
    mockQueryBuilder.getRawOne.mockRejectedValue(error);
    mockQueryBuilder.getRawMany.mockRejectedValue(error);
    mockQueryBuilder.execute.mockRejectedValue(error);
  }
}

/**
 * 常用的测试场景Mock
 */
export class CommonTestScenarios {
  /**
   * 模拟数据库连接成功
   */
  static mockDatabaseConnectionSuccess(
    dataSource: jest.Mocked<DataSource>,
  ): void {
    dataSource.initialize.mockResolvedValue(undefined as any);
    (dataSource as any).isInitialized = true;
  }

  /**
   * 模拟数据库连接失败
   */
  static mockDatabaseConnectionFailure(
    dataSource: jest.Mocked<DataSource>,
    error: Error,
  ): void {
    dataSource.initialize.mockRejectedValue(error);
    (dataSource as any).isInitialized = false;
  }

  /**
   * 模拟事务成功
   */
  static mockTransactionSuccess(
    transactionManager: any,
    result: any = {},
  ): void {
    transactionManager.save.mockResolvedValue(result);
    transactionManager.remove.mockResolvedValue(result);
    transactionManager.update.mockResolvedValue({ affected: 1 });
    transactionManager.delete.mockResolvedValue({ affected: 1 });
  }

  /**
   * 模拟事务失败
   */
  static mockTransactionFailure(transactionManager: any, error: Error): void {
    transactionManager.save.mockRejectedValue(error);
    transactionManager.remove.mockRejectedValue(error);
    transactionManager.update.mockRejectedValue(error);
    transactionManager.delete.mockRejectedValue(error);
  }
}

/**
 * LLM服务相关的Mock工厂
 */
export class LLMServiceMockFactory {
  /**
   * 创建标准的LLM服务Mock
   */
  static createLLMServiceMock(overrides: Partial<jest.Mocked<ILLMService>> = {}): jest.Mocked<ILLMService> {
    return {
      getProvider: jest.fn().mockReturnValue('openai'),
      getModelConfig: jest.fn().mockReturnValue({
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
      }),
      semanticSplit: jest.fn().mockResolvedValue({
        chunks: ['Mock chunk 1', 'Mock chunk 2'],
        chunkTitles: ['Mock title 1', 'Mock title 2'],
        tokensUsed: 100,
        processingTime: 1000,
      }),
      batchSemanticSplit: jest.fn().mockResolvedValue([
        {
          chunks: ['Mock chunk 1'],
          tokensUsed: 50,
        },
        {
          chunks: ['Mock chunk 2'],
          tokensUsed: 50,
        },
      ]),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelInfo: jest.fn().mockResolvedValue({
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 128000,
      }),
      ...overrides,
    } as any;
  }

  /**
   * 创建不可用的LLM服务Mock
   */
  static createUnavailableLLMServiceMock(): jest.Mocked<ILLMService> {
    return {
      getProvider: jest.fn().mockReturnValue('openai'),
      getModelConfig: jest.fn().mockReturnValue({
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
      }),
      semanticSplit: jest.fn().mockRejectedValue(new Error('LLM服务不可用')),
      batchSemanticSplit: jest.fn().mockRejectedValue(new Error('LLM服务不可用')),
      isAvailable: jest.fn().mockResolvedValue(false),
      getModelInfo: jest.fn().mockRejectedValue(new Error('LLM服务不可用')),
    } as any;
  }

  /**
   * 创建会失败的LLM服务Mock
   */
  static createFailingLLMServiceMock(error: Error = new Error('LLM服务错误')): jest.Mocked<ILLMService> {
    return {
      getProvider: jest.fn().mockReturnValue('openai'),
      getModelConfig: jest.fn().mockReturnValue({
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
      }),
      semanticSplit: jest.fn().mockRejectedValue(error),
      batchSemanticSplit: jest.fn().mockRejectedValue(error),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelInfo: jest.fn().mockResolvedValue({
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 128000,
      }),
    } as any;
  }

  /**
   * 创建自定义响应的LLM服务Mock
   */
  static createCustomLLMServiceMock(response: SemanticSplitResult): jest.Mocked<ILLMService> {
    return {
      getProvider: jest.fn().mockReturnValue('openai'),
      getModelConfig: jest.fn().mockReturnValue({
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
      }),
      semanticSplit: jest.fn().mockResolvedValue(response),
      batchSemanticSplit: jest.fn().mockResolvedValue([response]),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelInfo: jest.fn().mockResolvedValue({
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 128000,
      }),
    } as any;
  }
}
