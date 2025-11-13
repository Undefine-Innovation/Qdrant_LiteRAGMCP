import { Logger } from '@logging/logger.js';
import { ISplitter } from '@domain/interfaces/splitter.js';
import { IEmbeddingProvider } from '@domain/interfaces/embedding.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';

/**
 * 融合策略接口
 * 用于合并多个检索结果
 */
export interface IFusionStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 融合多个检索结果列表
   * @param results 多个检索结果数组
   * @param weights 每个结果的权重（可选）
   * @returns 融合后的结果
   */
  fuse(results: unknown[][], weights?: number[]): Promise<unknown[]>;
}

/**
 * 重排序策略接口
 */
export interface IRerankStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 对结果进行重排序
   * @param query 查询文本
   * @param results 待重排序的结果
   * @param limit 返回的最大数量
   * @returns 重排序后的结果
   */
  rerank(query: string, results: unknown[], limit?: number): Promise<unknown[]>;
}

/**
 * 策略注册表
 * 管理所有可插拔的策略实现
 */
export class StrategyRegistry {
  private splitters = new Map<string, ISplitter>();
  private embeddings = new Map<string, IEmbeddingProvider>();
  private retrievers = new Map<string, IKeywordRetriever>();
  private fusions = new Map<string, IFusionStrategy>();
  private reranks = new Map<string, IRerankStrategy>();

  /**
   * 创建 StrategyRegistry 实例
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  // ============ Splitter ============

  /**
   * 注册分块策略
   * @param key 策略键名
   * @param splitter 分块策略实例
   */
  registerSplitter(key: string, splitter: ISplitter): void {
    this.splitters.set(key, splitter);
    this.logger.debug(`已注册 Splitter: ${key}`);
  }

  /**
   * 获取分块策略
   * @param key 策略键名
   * @returns 分块策略实例
   */
  getSplitter(key: string): ISplitter {
    const splitter = this.splitters.get(key);
    if (!splitter) {
      throw new Error(`Splitter '${key}' 未注册`);
    }
    return splitter;
  }

  /**
   * 列出所有分块策略
   * @returns 所有已注册的分块策略键名列表
   */
  listSplitters(): string[] {
    return Array.from(this.splitters.keys());
  }

  // ============ Embedding ============

  /**
   * 注册嵌入策略
   * @param key 策略键名
   * @param embedding 嵌入策略实例
   */
  registerEmbedding(key: string, embedding: IEmbeddingProvider): void {
    this.embeddings.set(key, embedding);
    this.logger.debug(`已注册 EmbeddingProvider: ${key}`);
  }

  /**
   * 获取嵌入策略
   * @param key 策略键名
   * @returns 嵌入策略实例
   */
  getEmbedding(key: string): IEmbeddingProvider {
    const embedding = this.embeddings.get(key);
    if (!embedding) {
      throw new Error(`EmbeddingProvider '${key}' 未注册`);
    }
    return embedding;
  }

  /**
   * 列出所有嵌入策略
   * @returns 所有已注册的嵌入策略键名列表
   */
  listEmbeddings(): string[] {
    return Array.from(this.embeddings.keys());
  }

  // ============ Retriever ============

  /**
   * 注册检索策略
   * @param key 策略键名
   * @param retriever 检索策略实例
   */
  registerRetriever(key: string, retriever: IKeywordRetriever): void {
    this.retrievers.set(key, retriever);
    this.logger.debug(`已注册 Retriever: ${key}`);
  }

  /**
   * 获取检索策略
   * @param key 策略键名
   * @returns 检索策略实例
   */
  getRetriever(key: string): IKeywordRetriever {
    const retriever = this.retrievers.get(key);
    if (!retriever) {
      throw new Error(`Retriever '${key}' 未注册`);
    }
    return retriever;
  }

  /**
   * 列出所有检索策略
   * @returns 所有已注册的检索策略键名列表
   */
  listRetrievers(): string[] {
    return Array.from(this.retrievers.keys());
  }

  // ============ Fusion ============

  /**
   * 注册融合策略
   * @param key 策略键名
   * @param fusion 融合策略实例
   */
  registerFusion(key: string, fusion: IFusionStrategy): void {
    this.fusions.set(key, fusion);
    this.logger.debug(`已注册 FusionStrategy: ${key}`);
  }

  /**
   * 获取融合策略
   * @param key 策略键名
   * @returns 融合策略实例
   */
  getFusion(key: string): IFusionStrategy {
    const fusion = this.fusions.get(key);
    if (!fusion) {
      throw new Error(`FusionStrategy '${key}' 未注册`);
    }
    return fusion;
  }

  /**
   * 列出所有融合策略
   * @returns 所有已注册的融合策略键名列表
   */
  listFusions(): string[] {
    return Array.from(this.fusions.keys());
  }

  // ============ Rerank ============

  /**
   * 注册重排序策略
   * @param key 策略键名
   * @param rerank 重排序策略实例
   */
  registerRerank(key: string, rerank: IRerankStrategy): void {
    this.reranks.set(key, rerank);
    this.logger.debug(`已注册 RerankStrategy: ${key}`);
  }

  /**
   * 获取重排序策略
   * @param key 策略键名
   * @returns 重排序策略实例
   */
  getRerank(key: string): IRerankStrategy {
    const rerank = this.reranks.get(key);
    if (!rerank) {
      throw new Error(`RerankStrategy '${key}' 未注册`);
    }
    return rerank;
  }

  /**
   * 列出所有重排序策略
   * @returns 所有已注册的重排序策略键名列表
   */
  listReranks(): string[] {
    return Array.from(this.reranks.keys());
  }

  // ============ 元信息 ============

  /**
   * 获取所有已注册策略的摘要
   * @returns 包含所有策略类型的摘要对象
   */
  getSummary(): {
    splitters: string[];
    embeddings: string[];
    retrievers: string[];
    fusions: string[];
    reranks: string[];
  } {
    return {
      splitters: this.listSplitters(),
      embeddings: this.listEmbeddings(),
      retrievers: this.listRetrievers(),
      fusions: this.listFusions(),
      reranks: this.listReranks(),
    };
  }
}
