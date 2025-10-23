import { DocId } from '../domain/types.js';
import { IGraphService } from '../domain/graph.js';

/**
 * @class GraphService
 * @description 图谱服务实现。
 *              目前仅为占位实现，未来将包含从文档中提取和存储图谱信息的具体逻辑。
 */
export class GraphService implements IGraphService {
  /**
   * @method extractAndStoreGraph
   * @description 从指定文档中提取图谱信息并进行存储。
   *              当前为占位实现，不执行任何操作。
   * @param {DocId} docId - 文档的唯一标识符。
   * @returns {Promise<void>} - 表示操作完成的 Promise。
   */
  async extractAndStoreGraph(docId: DocId): Promise<void> {
    console.log(
      `GraphService: Extracting and storing graph for document ID: ${docId}`,
    );
    // TODO: 未来在此处添加图谱提取和存储的实际逻辑
  }
}
