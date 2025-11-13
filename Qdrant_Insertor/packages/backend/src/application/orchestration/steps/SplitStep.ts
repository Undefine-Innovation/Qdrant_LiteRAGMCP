/**
 * SplitStep - 文档分块步骤
 * 负责将原始文档内容按策略分割成多个块
 * 输入：原始内容、docId、元数据、分块策略键名
 * 输出：分块列表、元数据
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  SplitStepInput,
  SplitStepInputSchema,
  SplitStepOutput,
  SplitStepOutputSchema,
} from '../schemas/index.js';
import { StrategyRegistry } from '@infrastructure/strategies/StrategyRegistry.js';

/**
 * SplitStep 实现
 * 使用注册的分块策略对文档进行分块
 */
export class SplitStep implements Step<SplitStepInput, SplitStepOutput> {
  readonly name = 'SplitStep';

  /**
   * 创建 SplitStep 实例
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
  async validate(input: SplitStepInput): Promise<void> {
    try {
      // 应用Zod schema并获取默认值
      const validatedInput = SplitStepInputSchema.parse(input);

      // 如果原始input缺少splitterKey，则从验证后的输入中获取默认值
      if (!input.splitterKey && validatedInput.splitterKey) {
        (input as SplitStepInput & { splitterKey?: string }).splitterKey =
          validatedInput.splitterKey;
      }

      // 验证分块策略是否已注册
      const splitterKey = input.splitterKey || 'default';
      try {
        this.strategyRegistry.getSplitter(splitterKey);
      } catch (error) {
        this.logger.error(`[${this.name}] 分块策略 '${splitterKey}' 未注册`);
        throw error;
      }

      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行分块
   * @param input 步骤输入
   * @returns 分块结果
   */
  async run(input: SplitStepInput): Promise<SplitStepOutput> {
    try {
      // 确保splitterKey有值，如果没有则使用默认值
      const splitterKey = input.splitterKey || 'default';

      this.logger.info(
        `[${this.name}] 开始分块, docId: ${input.docId}, 策略: ${splitterKey}`,
      );

      // 获取分块策略
      const splitter = this.strategyRegistry.getSplitter(splitterKey);

      // 执行分块
      const documentChunksRaw = await splitter.split(input.content, {
        maxChunkSize: 1000,
        chunkOverlap: 200,
        strategy: 'by_sentences',
      });
      const documentChunks = (documentChunksRaw || []) as unknown[];
      if (documentChunks.length === 0) {
        this.logger.warn(`[${this.name}] 分块结果为空, docId: ${input.docId}`);
      }

      // 将可能的 string | { content } 归一为字符串内容
      const chunks = documentChunks.map((chunk, index) => {
        let content: string;
        if (typeof chunk === 'string') {
          content = chunk;
        } else if (chunk && typeof chunk === 'object' && 'content' in chunk) {
          const chunkObj = chunk as { content: unknown };
          content = typeof chunkObj.content === 'string' ? chunkObj.content : String(chunkObj.content);
        } else {
          content = String(chunk);
        }
        
        return {
          index,
          content,
          title: undefined,
          titleChain: undefined,
        };
      });

      const output: SplitStepOutput = {
        docId: input.docId,
        chunks,
        metadata: input.metadata,
      };

      // 验证输出
      SplitStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 分块完成, 生成 ${chunks.length} 个块, docId: ${input.docId}`,
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
    context: StepContext<SplitStepInput, SplitStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(`[${this.name}] 步骤出错`, {
      error: error.message,
      docId: context.input?.docId,
      duration: context.duration,
    });
  }
}
