/**
 * EmbedStep - 嵌入生成步骤
 * 负责为每个文档块生成向量嵌入
 * 输入：分块列表、元数据、嵌入策略键名
 * 输出：带向量的分块列表
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  EmbedStepInput,
  EmbedStepInputSchema,
  EmbedStepOutput,
  EmbedStepOutputSchema,
} from '../schemas/index.js';
import { StrategyRegistry } from '@infrastructure/strategies/StrategyRegistry.js';

/**
 * EmbedStep 实现
 * 使用注册的嵌入策略为块生成向量
 */
export class EmbedStep implements Step<EmbedStepInput, EmbedStepOutput> {
  readonly name = 'EmbedStep';

  /**
   * 创建 EmbedStep 实例
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
  async validate(input: EmbedStepInput): Promise<void> {
    try {
      // 应用Zod默认值
      const validatedInput = EmbedStepInputSchema.parse(input);

      // 确保embeddingKey有值，如果没有使用默认值
      const embeddingKey = validatedInput.embeddingKey || 'default';

      // 验证嵌入策略是否已注册
      try {
        this.strategyRegistry.getEmbedding(embeddingKey);
      } catch (error) {
        this.logger.error(`[${this.name}] 嵌入策略 '${embeddingKey}' 未注册`);
        throw error;
      }

      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行嵌入生成
   * @param input 步骤输入
   * @returns 嵌入结果
   */
  async run(input: EmbedStepInput): Promise<EmbedStepOutput> {
    try {
      // 应用Zod默认值并确保embeddingKey有值
      const validatedInput = EmbedStepInputSchema.parse(input);
      const embeddingKey = validatedInput.embeddingKey || 'default';

      this.logger.info(
        `[${this.name}] 开始生成嵌入, docId: ${input.docId}, 块数: ${input.chunks.length}, 策略: ${embeddingKey}`,
      );

      // 获取嵌入提供者
      const embeddingProvider =
        this.strategyRegistry.getEmbedding(embeddingKey);

      // 准备要嵌入的文本
      const textsToEmbed = input.chunks.map((chunk) => chunk.content);

      // 生成嵌入
      const embeddings = await embeddingProvider.generateBatch(textsToEmbed);

      if (!embeddings || embeddings.length === 0) {
        this.logger.error(`[${this.name}] 嵌入结果为空, docId: ${input.docId}`);
        throw new Error('嵌入生成失败: 返回结果为空');
      }

      // 组合块和向量
      const embeddedChunks = input.chunks.map((chunk, index) => ({
        index: chunk.index,
        content: chunk.content,
        title: chunk.title,
        titleChain: chunk.titleChain,
        vector: embeddings[index],
      }));

      const output: EmbedStepOutput = {
        docId: input.docId,
        embeddedChunks,
        metadata: input.metadata,
      };

      // 验证输出
      EmbedStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 嵌入生成完成, docId: ${input.docId}, 生成 ${embeddedChunks.length} 个向量`,
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
    context: StepContext<EmbedStepInput, EmbedStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(`[${this.name}] 步骤出错`, {
      error: error.message,
      docId: context.input?.docId,
      duration: context.duration,
    });
  }
}
