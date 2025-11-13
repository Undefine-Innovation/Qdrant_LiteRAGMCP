import {
  IImportAndIndexUseCase,
  ImportAndIndexInput,
  ImportAndIndexOutput,
} from '@domain/interfaces/use-cases/index.js';
import { Doc, CollectionId } from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';
import { Pipeline } from '../orchestration/core/Pipeline.js';
import {
  ImportStepInput,
  SplitStepInput,
  EmbedStepInput,
  IndexStepInput,
  IndexStepOutput,
} from '../orchestration/schemas/index.js';
import {
  ImportStep,
  SplitStep,
  EmbedStep,
  IndexStep,
} from '../orchestration/steps/index.js';
import { SyncJobStatus } from '@domain/sync/types.js';

/**
 * 导入并索引用例实现
 *
 * 负责协调完整的文档导入-索引流程（使用 Pipeline 编排）：
 * - 构建 Pipeline：ImportStep → SplitStep → EmbedStep → IndexStep
 * - 执行管线
 * - 返回导入结果
 *
 * 这是用例层作为适配器，连接 REST API 和 Pipeline 编排层。
 */
export class ImportAndIndexUseCase implements IImportAndIndexUseCase {
  /**
   * 创建导入并索引用例实例
   *
   * @param importStep 导入步骤
   * @param splitStep 分块步骤
   * @param embedStep 嵌入步骤
   * @param indexStep 索引步骤
   * @param logger 日志记录器
   */
  constructor(
    private readonly importStep: ImportStep,
    private readonly splitStep: SplitStep,
    private readonly embedStep: EmbedStep,
    private readonly indexStep: IndexStep,
    private readonly logger: Logger,
  ) {}

  /**
   * 执行导入和索引用例
   *
   * 流程：
   * 1. 导入：从 Buffer → 原始内容
   * 2. 分块：分割内容
   * 3. 嵌入：生成向量
   * 4. 索引：存储到 Qdrant + SQLite
   *
   * @param input 包含文件和集合信息的输入
   * @returns 返回导入后的文档
   *
   * @throws {AppError} 如果管线执行失败
   */
  async execute(input: ImportAndIndexInput): Promise<ImportAndIndexOutput> {
    const { content, title, collectionId, fileName, mimeType, metadata } =
      input;
    const startTime = Date.now();

    this.logger.debug('开始执行导入并索引用例', {
      title,
      collectionId,
      fileName,
      mimeType,
    });

    try {
      // 构建 Pipeline
      const pipeline = new Pipeline(this.logger);
      pipeline.addStep(this.importStep);
      pipeline.addStep(this.splitStep);
      pipeline.addStep(this.embedStep);
      pipeline.addStep(this.indexStep);

      // 准备 ImportStep 输入
      const importInput: ImportStepInput = {
        fileBuffer: Buffer.from(content),
        fileName: fileName || title,
        mimeType: mimeType || 'text/plain',
        collectionId: collectionId,
        docKey: fileName || title,
        docName: title,
      };

      // 执行管线
      const result = await pipeline.execute(importInput);

      if (!result.success) {
        throw new Error(
          `管线执行失败: ${result.failedStep || 'unknown'} - ${result.error?.message || 'unknown error'}`,
        );
      }

      // 提取最终结果（IndexStep 输出）
      const indexOutput = result.output as IndexStepOutput;

      // 转换为 Doc 格式返回
      const doc: Doc = {
        id: indexOutput.docId,
        collectionId: indexOutput.collectionId,
        key: fileName || title,
        name: title,
        size_bytes: Buffer.byteLength(content),
        mime: mimeType || 'text/plain',
        status:
          indexOutput.status === 'success'
            ? SyncJobStatus.SYNCED
            : SyncJobStatus.FAILED,
      };

      const processingTime = Date.now() - startTime;

      this.logger.debug('导入并索引用例执行成功', {
        docId: doc.id,
        collectionId: doc.collectionId,
        status: indexOutput.status,
        processingTime,
      });

      return {
        doc,
        chunkCount: indexOutput.indexedChunkCount || 0,
        processingTime,
      };
    } catch (error) {
      this.logger.error('导入并索引用例执行失败', {
        error,
        title,
        collectionId,
      });
      throw error;
    }
  }
}
