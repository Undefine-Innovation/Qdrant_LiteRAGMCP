/**
 * LLM服务接口
 * 提供与外部大语言模型服务的交互能力，主要用于语义分块
 */

/**
 * LLM提供商类型
 */
export type LLMProvider = 'openai' | 'anthropic' | 'azure' | 'openai_compatible';

/**
 * LLM模型配置
 */
export interface LLMModelConfig {
  /**
   * 模型名称
   */
  model: string;
  
  /**
   * API密钥
   */
  apiKey: string;
  
  /**
   * API基础URL
   */
  baseUrl?: string;
  
  /**
   * 最大令牌数
   */
  maxTokens?: number;
  
  /**
   * 温度参数（控制随机性）
   */
  temperature?: number;
  
  /**
   * 超时时间（毫秒）
   */
  timeout?: number;
  
  /**
   * 自定义请求头
   */
  headers?: Record<string, string>;
}

/**
 * 语义分块请求参数
 */
export interface SemanticSplitRequest {
  /**
   * 要分块的文本内容
   */
  text: string;
  
  /**
   * 目标块大小（字符数）
   */
  targetChunkSize?: number;
  
  /**
   * 块重叠大小（字符数）
   */
  chunkOverlap?: number;
  
  /**
   * 最大块数量
   */
  maxChunks?: number;
  
  /**
   * 分块策略提示
   */
  strategy?: 'coherent' | 'topic-based' | 'semantic' | 'balanced';
  
  /**
   * 额外的系统提示
   */
  systemPrompt?: string;
}

/**
 * 语义分块结果
 */
export interface SemanticSplitResult {
  /**
   * 分块后的文本数组
   */
  chunks: string[];
  
  /**
   * 每个块的标题或主题
   */
  chunkTitles?: string[];
  
  /**
   * 每个块的摘要
   */
  chunkSummaries?: string[];
  
  /**
   * 使用的令牌数
   */
  tokensUsed?: number;
  
  /**
   * 处理时间（毫秒）
   */
  processingTime?: number;
}

/**
 * LLM服务接口
 */
export interface ILLMService {
  /**
   * 获取LLM提供商类型
   */
  getProvider(): LLMProvider;
  
  /**
   * 获取当前模型配置
   */
  getModelConfig(): LLMModelConfig;
  
  /**
   * 执行语义分块
   * @param request - 语义分块请求参数
   * @returns 语义分块结果
   */
  semanticSplit(request: SemanticSplitRequest): Promise<SemanticSplitResult>;
  
  /**
   * 批量语义分块
   * @param requests - 语义分块请求数组
   * @returns 语义分块结果数组
   */
  batchSemanticSplit(requests: SemanticSplitRequest[]): Promise<SemanticSplitResult[]>;
  
  /**
   * 检查服务是否可用
   * @returns 服务可用性状态
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * 获取模型信息
   * @returns 模型信息
   */
  getModelInfo(): Promise<{
    name: string;
    provider: LLMProvider;
    maxTokens: number;
    contextWindow: number;
  }>;
}