import { BaseValueObject } from './base.js';

/**
 * 文档内容值对象
 * 包含内容验证和业务规则
 */
export class DocumentContent extends BaseValueObject<string> {
  /**
   * 最大文档内容长度（字符数）
   */
  private static readonly MAX_CONTENT_LENGTH = 10_000_000;

  /**
   * 最小文档内容长度（字符数）
   */
  private static readonly MIN_CONTENT_LENGTH = 1;

  /**
   * 创建文档内容值对象
   * @param content 文档内容
   * @returns DocumentContent实例
   * @throws {Error} 当内容无效时抛出错误
   */
  public static create(content: string): DocumentContent {
    return new DocumentContent(content);
  }

  /**
   * 私有构造函数
   * @param content 文档内容
   */
  private constructor(content: string) {
    super(content);
    this.validate(content);
  }

  /**
   * 验证文档内容
   * @param content 要验证的内容
   * @throws {Error} 当内容无效时抛出错误
   */
  protected validate(content: string): void {
    if (typeof content !== 'string') {
      throw new Error('Document content must be a string');
    }

    if (content.length < DocumentContent.MIN_CONTENT_LENGTH) {
      throw new Error(
        `Document content must be at least ${DocumentContent.MIN_CONTENT_LENGTH} character long`,
      );
    }

    if (content.length > DocumentContent.MAX_CONTENT_LENGTH) {
      throw new Error(
        `Document content cannot exceed ${DocumentContent.MAX_CONTENT_LENGTH} characters`,
      );
    }

    // 检查是否包含有效的文本内容（不仅仅是空白字符）
    if (content.trim().length === 0) {
      throw new Error('Document content cannot be empty or whitespace only');
    }
  }

  /**
   * 比较两个文档内容是否相等
   * @param otherValue 另一个文档内容值
   * @returns 是否相等
   */
  protected isEqual(otherValue: string): boolean {
    return this.value === otherValue;
  }

  /**
   * 获取内容长度
   * @returns 内容字符数
   */
  public getLength(): number {
    return this.value.length;
  }

  /**
   * 获取内容字节大小（UTF-8编码）
   * @returns 内容字节大小
   */
  public getByteSize(): number {
    return Buffer.from(this.value, 'utf8').length;
  }

  /**
   * 检查内容是否为空
   * @returns 是否为空
   */
  public isEmpty(): boolean {
    return this.value.trim().length === 0;
  }

  /**
   * 获取内容的前N个字符的预览
   * @param maxLength 预览最大长度
   * @returns 内容预览
   */
  public getPreview(maxLength: number = 100): string {
    if (maxLength <= 0) {
      return '';
    }

    const preview = this.value.substring(0, maxLength);
    return this.value.length > maxLength ? `${preview}...` : preview;
  }

  /**
   * 检查内容是否包含指定文本
   * @param searchText 要搜索的文本
   * @param caseSensitive 是否区分大小写
   * @returns 是否包含
   */
  public contains(searchText: string, caseSensitive: boolean = false): boolean {
    if (caseSensitive) {
      return this.value.includes(searchText);
    }
    return this.value.toLowerCase().includes(searchText.toLowerCase());
  }

  /**
   * 获取内容的单词数
   * @returns 单词数
   */
  public getWordCount(): number {
    // 简单的单词计数，按空白字符分割
    const words = this.value.trim().split(/\s+/);
    return words.filter((word) => word.length > 0).length;
  }

  /**
   * 获取内容的行数
   * @returns 行数
   */
  public getLineCount(): number {
    return this.value.split('\n').length;
  }
}
