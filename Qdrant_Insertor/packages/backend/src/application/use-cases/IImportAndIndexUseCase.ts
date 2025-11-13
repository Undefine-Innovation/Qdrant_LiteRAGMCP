import { Doc, CollectionId } from '@domain/entities/types.js';

/**
 * 导入和索引用例输入
 */
export interface ImportAndIndexInput {
  /**
   * 文档内容
   */
  content: string;

  /**
   * 文档标题
   */
  title: string;

  /**
   * 集合ID
   */
  collectionId: CollectionId;

  /**
   * 文件名
   */
  fileName?: string;

  /**
   * MIME类型
   */
  mimeType?: string;

  /**
   * 元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 导入和索引用例输出
 */
export interface ImportAndIndexOutput {
  /**
   * 创建的文档
   */
  doc: Doc;

  /**
   * 处理的块数量
   */
  chunkCount: number;

  /**
   * 处理时间（毫秒）
   */
  processingTime: number;
}

/**
 * 导入并索引用例接口
 */
export interface IImportAndIndexUseCase {
  /**
   * 执行导入和索引
   * @param input - 输入参数
   * @returns 输出结果
   */
  execute(input: ImportAndIndexInput): Promise<ImportAndIndexOutput>;
}
