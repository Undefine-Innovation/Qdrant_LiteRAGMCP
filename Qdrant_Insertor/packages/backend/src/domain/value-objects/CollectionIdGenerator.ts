import { CollectionId } from '../entities/types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 集合ID生成器
 * 负责生成唯一的集合ID
 */
export class CollectionIdGenerator {
  /**
   * 生成新的集合ID
   * @returns {CollectionId} 新的集合ID
   */
  public static generate(): CollectionId {
    // 生成UUID并添加col_前缀
    const uuid = uuidv4();
    return `col_${uuid}` as CollectionId;
  }

  /**
   * 验证集合ID格式
   * @param id 集合ID
   * @returns {boolean} 是否有效
   */
  public static isValid(id: string): id is CollectionId {
    // 检查是否以col_开头
    return typeof id === 'string' && id.startsWith('col_') && id.length > 4;
  }

  /**
   * 从字符串解析集合ID
   * @param id 字符串ID
   * @returns {CollectionId | null} 集合ID或null
   */
  public static parse(id: string): CollectionId | null {
    if (CollectionIdGenerator.isValid(id)) {
      return id as CollectionId;
    }
    return null;
  }
}
