/**
 * OpenAI API兼容的LLM服务相关类型定义
 */

import {
  ILLMService,
  LLMProvider,
  LLMModelConfig,
  SemanticSplitRequest,
  SemanticSplitResult,
} from '@domain/interfaces/llm.js';
import { Logger } from '@logging/logger.js';

/**
 * OpenAI API兼容LLM服务配置
 */
export interface OpenAICompatibleLLMServiceConfig extends LLMModelConfig {
  /**
   * LLM提供商
   */
  provider: LLMProvider;
  
  /**
   * API版本
   */
  apiVersion?: string;
  
  /**
   * 组织ID（OpenAI专用）
   */
  organizationId?: string;
  
  /**
   * 项目ID（Azure专用）
   */
  projectId?: string;
  
  /**
   * 部署名称（Azure专用）
   */
  deploymentName?: string;
}

/**
 * OpenAI API兼容响应结构
 */
export interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM请求构建器
 * 负责构建不同提供商的API请求
 */
export class LLMRequestBuilder {
  constructor(private readonly config: OpenAICompatibleLLMServiceConfig) {}

  /**
   * 构建API URL
   * @returns API URL
   */
  buildApiUrl(): string {
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    
    switch (this.config.provider) {
      case 'openai':
        return `${baseUrl}/chat/completions`;
      case 'anthropic':
        return `${baseUrl}/v1/messages`;
      case 'azure':
        return `${baseUrl}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion || '2024-02-15-preview'}`;
      case 'openai_compatible':
        return `${baseUrl}/chat/completions`;
      default:
        return `${baseUrl}/chat/completions`;
    }
  }

  /**
   * 获取默认基础URL
   * @returns 默认基础URL
   */
  private getDefaultBaseUrl(): string {
    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com';
      case 'azure':
        return `https://${this.config.projectId}.openai.azure.com`;
      case 'openai_compatible':
        return 'https://api.openai.com/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  /**
   * 构建请求头
   * @returns 请求头对象
   */
  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    switch (this.config.provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        if (this.config.organizationId) {
          headers['OpenAI-Organization'] = this.config.organizationId;
        }
        break;
      case 'anthropic':
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'azure':
        headers['api-key'] = this.config.apiKey;
        break;
      case 'openai_compatible':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
      default:
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * 构建请求体
   * @param systemPrompt - 系统提示
   * @param userPrompt - 用户提示
   * @returns 请求体对象
   */
  buildRequestBody(systemPrompt: string, userPrompt: string): Record<string, unknown> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.1,
    };

    // Anthropic使用不同的格式
    if (this.config.provider === 'anthropic') {
      return {
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      };
    }

    return body;
  }
}

/**
 * LLM响应解析器
 * 负责解析不同提供商的API响应
 */
export class LLMResponseParser {
  constructor(private readonly logger: Logger) {}

  /**
   * 解析LLM响应
   * @param response - API响应
   * @param request - 原始请求
   * @returns 语义分块结果
   */
  parseResponse(response: OpenAICompatibleResponse, request: SemanticSplitRequest): SemanticSplitResult {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM响应内容为空');
      }

      // 尝试解析JSON响应
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        // 如果JSON解析失败，尝试提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析LLM响应中的JSON');
        }
      }

      // 验证并返回结果
      const parsedObj = parsed as Record<string, unknown>;
      const chunks = Array.isArray(parsedObj.chunks) ? parsedObj.chunks as string[] : [content];
      const chunkTitles = Array.isArray(parsedObj.titles) ? parsedObj.titles as string[] : undefined;
      const chunkSummaries = Array.isArray(parsedObj.summaries) ? parsedObj.summaries as string[] : undefined;
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        chunks,
        chunkTitles,
        chunkSummaries,
        tokensUsed,
      };
    } catch (error) {
      this.logger.warn('解析LLM响应失败，使用降级策略', { error, response });
      return this.fallbackSplit(request);
    }
  }

  /**
   * 降级分块策略
   * @param request - 语义分块请求
   * @returns 简单分块结果
   */
  private fallbackSplit(request: SemanticSplitRequest): SemanticSplitResult {
    const targetSize = request.targetChunkSize || 1000;
    const overlap = request.chunkOverlap || 100;
    const text = request.text;
    
    // 简单按大小分块
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += targetSize - overlap) {
      const chunk = text.slice(i, i + targetSize);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return {
      chunks,
      processingTime: 0,
    };
  }
}