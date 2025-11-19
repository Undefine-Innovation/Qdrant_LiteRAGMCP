import { DocId } from '@domain/entities/types.js';

/**
 * @interface IGraphService
 * @description 定义图谱服务接口，用于从文档中提取和存储图谱信息
 *              这是一个占位接口，未来将实现具体的图谱提取和存储逻辑
 */
export interface IGraphService {
  /**
   * @method extractAndStoreGraph
   * @description 从指定文档中提取图谱信息并进行存储
   * @param {DocId} docId - 文档的唯一标识符
   * @returns {Promise<void>} - 表示操作完成的Promise
   */
  extractAndStoreGraph(docId: DocId): Promise<void>;
}
