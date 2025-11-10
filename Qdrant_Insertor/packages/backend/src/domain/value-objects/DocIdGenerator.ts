import { DocId } from '../entities/types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 文档ID生成器
 * 负责生成唯一的文档ID
 */
export class DocIdGenerator {
  /**
   * 生成新的文档ID
   * @returns {DocId} 新的文档ID
   */
  public static generate(): DocId {
    // 生成UUID并添加doc_前缀
    const uuid = uuidv4();
    return `doc_${uuid}` as DocId;
  }

  /**
   * 验证文档ID格式
   * @param id 文档ID
   * @returns {boolean} 是否有效
   */
  public static isValid(id: string): id is DocId {
    // 检查是否以doc_开头
    return typeof id === 'string' && id.startsWith('doc_') && id.length > 4;
  }

  /**
   * 从字符串解析文档ID
   * @param id 字符串ID
   * @returns {DocId | null} 文档ID或null
   */
  public static parse(id: string): DocId | null {
    if (DocIdGenerator.isValid(id)) {
      return id as DocId;
    }
    return null;
  }
}
