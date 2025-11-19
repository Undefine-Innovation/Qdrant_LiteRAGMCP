/**
 * RerankStep - 重排序步骤
 * 负责对检索结果进行重排序和过滤
 * 输入：查询文本、检索结果、重排序策略、结果限制
 * 输出：重排序后的结果、重排序耗时
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  RerankStepInput,
  RerankStepInputSchema,
  RerankStepOutput,
  RerankStepOutputSchema,
} from '../schemas/index.js';
import { StrategyRegistry } from '@infrastructure/strategies/StrategyRegistry.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

/**
 * RerankStep 实现
 * 使用重排序策略对结果进行重新排序
 */
export class RerankStep implements Step<RerankStepInput, RerankStepOutput> {
  readonly name = 'RerankStep';

  /**
   * 创建 RerankStep 实例
   * @param strategyRegistry 策略注册表
   * @param logger 日志记录器
   */
  constructor(
    private readonly strategyRegistry: StrategyRegistry,
    private readonly logger: Logger,
  ) {}

  /**
   * 验证输入
   * @param input 步骤输入
   */
  async validate(input: RerankStepInput): Promise<void> {
    try {
      RerankStepInputSchema.parse(input);

      // 验证重排序策略是否已注册
      try {
        this.strategyRegistry.getRerank(input.rerankKey);
      } catch (error) {
        this.logger.error(
          `[${this.name}] 重排序策略 '${input.rerankKey}' 未注册`,
        );
        throw error;
      }

      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行重排序
   * @param input 步骤输入
   * @returns 重排序结果
   */
  async run(input: RerankStepInput): Promise<RerankStepOutput> {
    const startTime = Date.now();

    try {
      this.logger.info(
        `[${this.name}] 开始重排序, 查询: "${input.query}", 结果数: ${input.results.length}, 策略: ${input.rerankKey}`,
      );

      // 如果没有结果，直接返回
      if (!input.results || input.results.length === 0) {
        this.logger.warn(`[${this.name}] 输入结果为空，直接返回`);
        return {
          query: input.query,
          results: [],
          rerankerDuration: 0,
        };
      }

      // 获取重排序策略
      const rerankStrategy = this.strategyRegistry.getRerank(input.rerankKey);

      // 执行重排序
      const rerankedResults = await rerankStrategy.rerank(
        input.query,
        input.results.map((r) => ({
          pointId: r.pointId,
          content: r.content,
          title: r.title,
          docId: r.docId,
          chunkIndex: r.chunkIndex,
          collectionId: r.collectionId,
          titleChain: r.titleChain,
          score: r.score,
        })),
        input.limit,
      );

      // 转换为输出格式
      const results = (
        rerankedResults as Array<{
          pointId: string;
          content: string;
          title?: string;
          docId: string;
          chunkIndex: number;
          collectionId: string;
          titleChain?: string;
          score: number;
        }>
      )
        .slice(0, input.limit)
        .map((result) => ({
          pointId: result.pointId,
          content: result.content,
          title: result.title,
          docId: result.docId,
          chunkIndex: result.chunkIndex,
          collectionId: result.collectionId,
          titleChain: result.titleChain,
          score: result.score,
        }));

      const duration = Date.now() - startTime;

      const output: RerankStepOutput = {
        query: input.query,
        results: results as RerankStepOutput['results'],
        rerankerDuration: duration,
      };

      // 验证输出
      RerankStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 重排序完成, 返回 ${results.length} 条结果, 耗时 ${duration}ms`,
      );

      return output;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[${this.name}] 执行失败`, { error, input });

      // 返回错误状态但不中断流程
      return {
        query: input.query,
        results: input.results.slice(
          0,
          input.limit,
        ) as RerankStepOutput['results'],
        rerankerDuration: duration,
      };
    }
  }

  /**
   * 错误处理
   * @param context 步骤上下文
   * @param error 错误
   */
  async onError(
    context: StepContext<RerankStepInput, RerankStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(`[${this.name}] 步骤出错`, {
      error: error.message,
      query: context.input?.query,
      duration: context.duration,
    });
  }
}
