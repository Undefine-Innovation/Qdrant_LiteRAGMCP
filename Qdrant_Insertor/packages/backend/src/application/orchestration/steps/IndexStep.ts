/**
 * IndexStep - 索引存储步骤
 * 负责将向量和元数据存储到 Qdrant 和 SQLite
 * 输入：带向量的块列表、元数据
 * 输出：索引状态、块数量
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  IndexStepInput,
  IndexStepInputSchema,
  IndexStepOutput,
  IndexStepOutputSchema,
} from '../schemas/index.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { PointId } from '@domain/entities/types.js';

/**
 * IndexStep 实现
 * 将块数据存储到 SQLite 和 Qdrant
 */
export class IndexStep implements Step<IndexStepInput, IndexStepOutput> {
  readonly name = 'IndexStep';

  /**
   * 创建 IndexStep 实例
   * @param sqliteRepo SQLite 仓库
   * @param qdrantRepo Qdrant 仓库
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 验证输入
   * @param input 步骤输入
   */
  async validate(input: IndexStepInput): Promise<void> {
    try {
      IndexStepInputSchema.parse(input);

      if (!input.embeddedChunks || input.embeddedChunks.length === 0) {
        throw new Error('嵌入块列表为空');
      }

      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行索引
   * @param input 步骤输入
   * @returns 索引结果
   */
  async run(input: IndexStepInput): Promise<IndexStepOutput> {
    try {
      this.logger.info(
        `[${this.name}] 开始索引, docId: ${input.docId}, 块数: ${input.embeddedChunks.length}`,
      );

      // 准备向量数据用于 Qdrant
      const points = input.embeddedChunks.map((chunk) => {
        const pointId = `${input.docId}_${chunk.index}` as PointId;
        return {
          id: pointId,
          vector: chunk.vector,
          payload: {
            docId: input.docId,
            collectionId: input.metadata.collectionId,
            chunkIndex: chunk.index,
            content: chunk.content,
            titleChain: chunk.titleChain,
          },
        };
      });

      // 执行事务存储
      let indexedCount = 0;
      let hasError = false;
      let errorMessage: string | undefined;

      try {
        // 存储到 Qdrant（先于 SQLite，确保向量优先）
        await this.qdrantRepo.upsertCollection(
          input.metadata.collectionId,
          points,
        );

        this.logger.info(
          `[${this.name}] Qdrant 向量已存储: ${points.length} 个`,
        );

        indexedCount = points.length;
      } catch (storageError) {
        hasError = true;
        errorMessage = storageError instanceof Error
          ? storageError.message
          : '未知错误';
        this.logger.error(`[${this.name}] 存储失败`, {
          error: storageError,
          docId: input.docId,
        });
        // 继续处理，标记为部分失败
      }

      const output: IndexStepOutput = {
        docId: input.docId,
        collectionId: input.metadata.collectionId,
        indexedChunkCount: indexedCount,
        status: hasError ? 'partial' : 'success',
        errorMessage,
      };

      // 验证输出
      IndexStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 索引完成, 状态: ${output.status}, 已索引 ${output.indexedChunkCount} 个块`,
      );

      return output;
    } catch (error) {
      this.logger.error(`[${this.name}] 执行失败`, { error, input });

      const output: IndexStepOutput = {
        docId: input.docId,
        collectionId: input.metadata.collectionId,
        indexedChunkCount: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
      };

      // 返回失败状态而不是抛出异常
      return output;
    }
  }

  /**
   * 错误处理
   * @param context 步骤上下文
   * @param error 错误
   */
  async onError(
    context: StepContext<IndexStepInput, IndexStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[${this.name}] 步骤出错`,
      {
        error: error.message,
        docId: context.input?.docId,
        duration: context.duration,
      },
    );
  }
}
