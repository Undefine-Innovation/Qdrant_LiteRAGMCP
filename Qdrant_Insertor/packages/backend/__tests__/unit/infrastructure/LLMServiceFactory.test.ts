/**
 * LLMServiceFactory 单元测试
 */

import { LLMServiceFactory, createLLMServiceFromConfig, createTestLLMService } from '@infrastructure/external/LLMServiceFactory.js';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';

describe('LLMServiceFactory', () => {
  let logger: jest.Mocked<Logger>;
  let mockConfig: AppConfig;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      llm: {
        provider: 'openai',
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 30000,
        semanticSplitting: {
          enabled: true,
          targetChunkSize: 1000,
          chunkOverlap: 100,
          strategy: 'balanced',
          enableFallback: true,
          fallbackStrategy: 'auto',
          maxRetries: 3,
          retryDelay: 1000,
          enableCache: true,
          cacheTTL: 300000,
        },
      },
    } as AppConfig;
  });

  describe('createFromConfig', () => {
    it('应该在启用语义分块时创建LLM服务', () => {
      const service = LLMServiceFactory.createFromConfig(mockConfig, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        baseUrl: 'https://api.openai.com/v1',
      });
    });

    it('应该在禁用语义分块时抛出错误', () => {
      const disabledConfig = {
        ...mockConfig,
        llm: {
          ...mockConfig.llm,
          semanticSplitting: {
            ...mockConfig.llm.semanticSplitting,
            enabled: false,
          },
        },
      };

      expect(() => {
        LLMServiceFactory.createFromConfig(disabledConfig, logger);
      }).toThrow('LLM语义分块功能已禁用');

      expect(logger.warn).toHaveBeenCalledWith('LLM语义分块功能已禁用');
    });
  });

  describe('create', () => {
    it('应该创建OpenAI服务', () => {
      const config = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      };

      const service = LLMServiceFactory.create(config, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        baseUrl: undefined,
      });
    });

    it('应该创建Anthropic服务', () => {
      const config = {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-sonnet-20240229',
      };

      const service = LLMServiceFactory.create(config, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        baseUrl: undefined,
      });
    });

    it('应该创建Azure服务', () => {
      const config = {
        provider: 'azure',
        apiKey: 'test-key',
        model: 'gpt-35-turbo',
        projectId: 'test-project',
        deploymentName: 'test-deployment',
      };

      const service = LLMServiceFactory.create(config, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', {
        provider: 'azure',
        model: 'gpt-35-turbo',
        baseUrl: undefined,
      });
    });

    it('应该创建OpenAI兼容服务', () => {
      const config = {
        provider: 'openai_compatible',
        apiKey: 'test-key',
        model: 'custom-model',
        baseUrl: 'https://custom-api.com/v1',
      };

      const service = LLMServiceFactory.create(config, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', {
        provider: 'openai_compatible',
        model: 'custom-model',
        baseUrl: 'https://custom-api.com/v1',
      });
    });

    it('应该在不支持的提供商时抛出错误', () => {
      const config = {
        provider: 'unsupported' as any,
        apiKey: 'test-key',
        model: 'test-model',
      };

      expect(() => {
        LLMServiceFactory.create(config, logger);
      }).toThrow('不支持的LLM提供商: unsupported');
    });
  });

  describe('createTestService', () => {
    it('应该创建测试LLM服务', () => {
      const service = LLMServiceFactory.createTestService(logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建测试LLM服务', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      });
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      const validConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 30000,
      };

      const result = LLMServiceFactory.validateConfig(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少提供商', () => {
      const invalidConfig = {
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LLM提供商不能为空');
    });

    it('应该检测缺少API密钥', () => {
      const invalidConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LLM API密钥不能为空');
    });

    it('应该检测缺少模型名称', () => {
      const invalidConfig = {
        provider: 'openai',
        apiKey: 'test-key',
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LLM模型名称不能为空');
    });

    it('应该检测无效的最大令牌数', () => {
      const invalidConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        maxTokens: -1,
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('最大令牌数必须大于0');
    });

    it('应该检测无效的温度参数', () => {
      const invalidConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 3.0, // 超出范围0-2
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('温度参数必须在0-2之间');
    });

    it('应该检测无效的超时时间', () => {
      const invalidConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        timeout: -1,
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('超时时间必须大于0');
    });

    it('应该验证Azure特定配置', () => {
      const invalidConfig = {
        provider: 'azure',
        apiKey: 'test-key',
        model: 'gpt-35-turbo',
        // 缺少projectId和deploymentName
      };

      const result = LLMServiceFactory.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Azure项目ID不能为空');
      expect(result.errors).toContain('Azure部署名称不能为空');
    });
  });

  describe('getSupportedProviders', () => {
    it('应该返回支持的提供商列表', () => {
      const providers = LLMServiceFactory.getSupportedProviders();
      
      expect(providers).toEqual(['openai', 'anthropic', 'azure', 'openai_compatible']);
    });
  });

  describe('getDefaultConfig', () => {
    it('应该返回OpenAI默认配置', () => {
      const config = LLMServiceFactory.getDefaultConfig('openai');
      
      expect(config.provider).toBe('openai');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.model).toBe('gpt-3.5-turbo');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
      expect(config.timeout).toBe(30000);
    });

    it('应该返回Anthropic默认配置', () => {
      const config = LLMServiceFactory.getDefaultConfig('anthropic');
      
      expect(config.provider).toBe('anthropic');
      expect(config.baseUrl).toBe('https://api.anthropic.com');
      expect(config.model).toBe('claude-3-sonnet-20240229');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
      expect(config.timeout).toBe(30000);
    });

    it('应该返回Azure默认配置', () => {
      const config = LLMServiceFactory.getDefaultConfig('azure');
      
      expect(config.provider).toBe('azure');
      expect(config.apiVersion).toBe('2024-02-15-preview');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
      expect(config.timeout).toBe(30000);
    });

    it('应该返回OpenAI兼容提供商默认配置', () => {
      const config = LLMServiceFactory.getDefaultConfig('openai_compatible');
      
      expect(config.provider).toBe('openai_compatible');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
      expect(config.timeout).toBe(30000);
    });

    it('应该对未知提供商抛出错误', () => {
      expect(() => {
        LLMServiceFactory.getDefaultConfig('unknown' as any);
      }).toThrow('未知的LLM提供商: unknown');
    });
  });

  describe('便捷函数', () => {
    it('createLLMServiceFromConfig应该调用createFromConfig', () => {
      const service = createLLMServiceFromConfig(mockConfig, logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建LLM服务', expect.any(Object));
    });

    it('createTestLLMService应该调用createTestService', () => {
      const service = createTestLLMService(logger);
      
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('创建测试LLM服务', expect.any(Object));
    });
  });
});