/**
 * RetrievalStep - 检索步骤
 * 负责执行向量检索和关键词检索，并支持融合
 * 输入：查询文本、集合ID、限制数量、检索和融合策略
 * 输出：融合后的检索结果
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  RetrievalStepInput,
  RetrievalStepInputSchema,
  RetrievalStepOutput,
  RetrievalStepOutputSchema,
} from '../schemas/index.js';
import { StrategyRegistry } from '@infrastructure/strategies/StrategyRegistry.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

/**
 * RetrievalStep 实现
 * 执行混合检索（向量 + 关键词）
 */
export class RetrievalStep
  implements Step<RetrievalStepInput, RetrievalStepOutput>
{
  readonly name = 'RetrievalStep';

  /**
   * 创建 RetrievalStep 实例
   * @param strategyRegistry 策略注册表
   * @param embeddingProvider 嵌入提供者（用于查询向量化）
   * @param logger 日志记录器
   */
  constructor(
    private readonly strategyRegistry: StrategyRegistry,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly logger: Logger,
  ) {}

  /**
   * 验证输入
   * @param input 步骤输入
   */
  async validate(input: RetrievalStepInput): Promise<void> {
    try {
      RetrievalStepInputSchema.parse(input);

      // 验证检索策略是否已注册
      try {
        this.strategyRegistry.getRetriever(input.retrieverKey);
      } catch (error) {
        this.logger.error(
          `[${this.name}] 检索策略 '${input.retrieverKey}' 未注册`,
        );
        throw error;
      }

      // 验证融合策略（如果指定）
      if (input.fusionKey) {
        try {
          this.strategyRegistry.getFusion(input.fusionKey);
        } catch (error) {
          this.logger.error(
            `[${this.name}] 融合策略 '${input.fusionKey}' 未注册`,
          );
          throw error;
        }
      }

      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行检索
   * @param input 步骤输入
   * @returns 检索结果
   */
  async run(input: RetrievalStepInput): Promise<RetrievalStepOutput> {
    try {
      this.logger.info(
        `[${this.name}] 开始检索, 查询: "${input.query}", 集合: ${input.collectionId}`,
      );

      // 获取检索器
      const retriever = this.strategyRegistry.getRetriever(input.retrieverKey);

      // 执行关键词检索
      const keywordResults = await retriever.searchInCollection(
        input.query,
        input.collectionId,
        input.keywordLimit,
      );

      this.logger.debug(
        `[${this.name}] 关键词检索结果: ${keywordResults.length} 条`,
      );

      // TODO: 向量检索需要嵌入查询，但当前 retriever 接口只有关键词检索
      // 为避免依赖过多，暂时只使用关键词检索结果
      const vectorResults: unknown[] = [];

      // 融合结果（暂时仅使用关键词结果）
      let finalResults: unknown[] = keywordResults;

      if (input.fusionKey && vectorResults.length > 0) {
        const fusionStrategy = this.strategyRegistry.getFusion(input.fusionKey);
        finalResults = await fusionStrategy.fuse([
          keywordResults,
          vectorResults,
        ]);
        this.logger.debug(
          `[${this.name}] 融合后结果: ${finalResults.length} 条`,
        );
      }

      // 转换为输出格式
      const results = (
        finalResults as Array<{
          pointId: string;
          content: string;
          title?: string;
          docId: string;
          chunkIndex: number;
          collectionId?: string;
          titleChain?: string;
          relevanceScore?: number;
        }>
      ).map((result) => ({
        pointId: result.pointId as PointId,
        content: result.content,
        title: result.title,
        docId: result.docId as DocId,
        chunkIndex: result.chunkIndex,
        collectionId: (result.collectionId ||
          input.collectionId) as CollectionId,
        titleChain: result.titleChain,
        score: result.relevanceScore || 0,
      }));

      const output: RetrievalStepOutput = {
        query: input.query,
        results,
      };

      // 验证输出
      RetrievalStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 检索完成, 返回 ${results.length} 条结果`,
      );

      return output;
    } catch (error) {
      this.logger.error(`[${this.name}] 执行失败`, { error, input });
      throw error;
    }
  }

  /**
   * 错误处理
   * @param context 步骤上下文
   * @param error 错误
   */
  async onError(
    context: StepContext<RetrievalStepInput, RetrievalStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(`[${this.name}] 步骤出错`, {
      error: error.message,
      query: context.input?.query,
      duration: context.duration,
    });
  }
}
