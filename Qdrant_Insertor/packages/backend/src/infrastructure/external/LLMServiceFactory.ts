/**
 * LLM服务工厂
 * 根据配置创建相应的LLM服务实例
 */

import { ILLMService, LLMProvider } from '@domain/interfaces/llm.js';
import { AppConfig } from '@config/config.js';
import { Logger } from '@logging/logger.js';
import { OpenAICompatibleLLMService, createOpenAICompatibleLLMService } from './OpenAICompatibleLLMService.js';
import { OpenAICompatibleLLMServiceConfig } from './OpenAICompatibleLLMServiceTypes.js';

/**
 * LLM服务配置映射
 */
interface LLMServiceConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  apiVersion?: string;
  organizationId?: string;
  projectId?: string;
  deploymentName?: string;
  headers?: Record<string, string>;
}

/**
 * LLM服务工厂类
 */
export class LLMServiceFactory {
  /**
   * 根据应用配置创建LLM服务
   * @param config - 应用配置
   * @param logger - 日志记录器
   * @returns LLM服务实例
   */
  static createFromConfig(config: AppConfig, logger: Logger): ILLMService {
    const llmConfig = config.llm;
    
    if (!llmConfig.semanticSplitting.enabled) {
      logger.warn('LLM语义分块功能已禁用');
      throw new Error('LLM语义分块功能已禁用');
    }

    const serviceConfig: LLMServiceConfig = {
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      maxTokens: llmConfig.maxTokens,
      temperature: llmConfig.temperature,
      timeout: llmConfig.timeout,
      apiVersion: llmConfig.apiVersion,
      organizationId: llmConfig.organizationId,
      projectId: llmConfig.projectId,
      deploymentName: llmConfig.deploymentName,
      headers: llmConfig.headers,
    };

    return LLMServiceFactory.create(serviceConfig, logger);
  }

  /**
   * 根据LLM服务配置创建LLM服务
   * @param config - LLM服务配置
   * @param logger - 日志记录器
   * @returns LLM服务实例
   */
  static create(config: LLMServiceConfig, logger: Logger): ILLMService {
    logger.info('创建LLM服务', {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    });

    switch (config.provider) {
      case 'openai':
      case 'anthropic':
      case 'azure':
      case 'openai_compatible':
        // OpenAICompatibleLLMService expects an OpenAICompatibleLLMServiceConfig
        // which extends the common model config with provider-specific fields.
        return createOpenAICompatibleLLMService(
          config as unknown as OpenAICompatibleLLMServiceConfig,
          logger,
        );
      
      default:
        throw new Error(`不支持的LLM提供商: ${config.provider}`);
    }
  }

  /**
   * 创建测试用的LLM服务
   * @param logger - 日志记录器
   * @returns 测试用LLM服务实例
   */
  static createTestService(logger: Logger): ILLMService {
    const testConfig: LLMServiceConfig = {
      provider: 'openai',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.1,
      timeout: 5000,
    };

    logger.info('创建测试LLM服务', {
      provider: testConfig.provider,
      model: testConfig.model,
    });

    return LLMServiceFactory.create(testConfig, logger);
  }

  /**
   * 验证LLM服务配置
   * @param config - LLM服务配置
   * @returns 验证结果
   */
  static validateConfig(config: LLMServiceConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('LLM提供商不能为空');
    }

    if (!config.apiKey) {
      errors.push('LLM API密钥不能为空');
    }

    if (!config.model) {
      errors.push('LLM模型名称不能为空');
    }

    if (config.maxTokens && config.maxTokens <= 0) {
      errors.push('最大令牌数必须大于0');
    }

    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('温度参数必须在0-2之间');
    }

    if (config.timeout && config.timeout <= 0) {
      errors.push('超时时间必须大于0');
    }

    // Azure特定验证
    if (config.provider === 'azure') {
      if (!config.projectId) {
        errors.push('Azure项目ID不能为空');
      }
      if (!config.deploymentName) {
        errors.push('Azure部署名称不能为空');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取支持的LLM提供商列表
   * @returns 支持的提供商列表
   */
  static getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'azure', 'openai_compatible'];
  }

  /**
   * 获取提供商的默认配置
   * @param provider - 提供商名称
   * @returns 默认配置
   */
  static getDefaultConfig(provider: string): Partial<LLMServiceConfig> {
    switch (provider) {
      case 'openai':
        return {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-3.5-turbo',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 30000,
        };
      
      case 'anthropic':
        return {
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-3-sonnet-20240229',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 30000,
        };
      
      case 'azure':
        return {
          provider: 'azure',
          apiVersion: '2024-02-15-preview',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 30000,
        };
      
      case 'openai_compatible':
        return {
          provider: 'openai_compatible',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 30000,
        };
      
      default:
        throw new Error(`未知的LLM提供商: ${provider}`);
    }
  }
}

/**
 * 从应用配置创建LLM服务的便捷函数
 * @param config - 应用配置
 * @param logger - 日志记录器
 * @returns LLM服务实例
 */
export function createLLMServiceFromConfig(
  config: AppConfig,
  logger: Logger
): ILLMService {
  return LLMServiceFactory.createFromConfig(config, logger);
}

/**
 * 创建测试用LLM服务的便捷函数
 * @param logger - 日志记录器
 * @returns 测试用LLM服务实例
 */
export function createTestLLMService(logger: Logger): ILLMService {
  return LLMServiceFactory.createTestService(logger);
}