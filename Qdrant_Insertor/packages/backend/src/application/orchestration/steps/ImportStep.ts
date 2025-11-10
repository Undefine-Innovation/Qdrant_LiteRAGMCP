/**
 * ImportStep - 文档导入步骤
 * 负责从上传的文件中提取原始内容
 * 输入：文件Buffer、文件名、MIME类型
 * 输出：docId、原始内容、文档元数据
 */

import { Logger } from '@logging/logger.js';
import { Step, StepContext } from '../core/Step.js';
import {
  ImportStepInput,
  ImportStepInputSchema,
  ImportStepOutput,
  ImportStepOutputSchema,
} from '../schemas/index.js';
import { IStreamFileLoader } from '@domain/services/stream-loader.js';
import { DocId } from '@domain/entities/types.js';
import { makeDocId } from '@domain/utils/id.js';

/**
 * ImportStep 实现
 * 处理文件加载和初始化
 */
export class ImportStep implements Step<ImportStepInput, ImportStepOutput> {
  readonly name = 'ImportStep';

  /**
   * 创建 ImportStep 实例
   * @param streamFileLoader 流式文件加载器
   * @param logger 日志记录器
   */
  constructor(
    private readonly streamFileLoader: IStreamFileLoader,
    private readonly logger: Logger,
  ) {}

  /**
   * 验证输入
   * @param input 步骤输入
   */
  async validate(input: ImportStepInput): Promise<void> {
    try {
      ImportStepInputSchema.parse(input);
      this.logger.debug(`[${this.name}] 输入验证成功`);
    } catch (error) {
      this.logger.error(`[${this.name}] 输入验证失败`, { error });
      throw error;
    }
  }

  /**
   * 执行导入
   * @param input 步骤输入
   * @returns 导入结果
   */
  async run(input: ImportStepInput): Promise<ImportStepOutput> {
    try {
      this.logger.info(`[${this.name}] 开始处理文件: ${input.fileName}`);

      // 使用流式加载器从Buffer中加载内容
      const loadedFile = await this.streamFileLoader.loadFromBuffer(
        input.fileBuffer,
        input.fileName,
        input.mimeType,
      );

      const content = loadedFile.content;

      if (!content || content.trim().length === 0) {
        this.logger.warn(`[${this.name}] 文件内容为空: ${input.fileName}`);
      }

      // 为避免相同内容导致的docId冲突，添加时间戳前缀
      const uniqueContent = `${Date.now()}_${content}`;

      // 生成文档ID
      const docId = makeDocId(uniqueContent) as DocId;

      const output: ImportStepOutput = {
        docId,
        content: uniqueContent,
        metadata: {
          fileName: input.fileName,
          mimeType: input.mimeType,
          collectionId: input.collectionId,
          docKey: input.docKey || input.fileName,
          docName: input.docName || input.fileName,
        },
      };

      // 验证输出
      ImportStepOutputSchema.parse(output);

      this.logger.info(
        `[${this.name}] 文件导入成功, docId: ${docId}, 内容长度: ${content.length}`,
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
    context: StepContext<ImportStepInput, ImportStepOutput>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[${this.name}] 步骤出错`,
      {
        error: error.message,
        input: context.input,
        duration: context.duration,
      },
    );
    // 不做特殊处理，让错误向上传播给Pipeline处理
  }
}

