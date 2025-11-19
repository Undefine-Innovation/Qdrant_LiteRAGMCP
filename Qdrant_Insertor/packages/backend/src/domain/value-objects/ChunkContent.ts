import { BaseValueObject } from './base.js';

/**
 * 块内容值对象
 * 包含内容验证和业务规则
 */
export class ChunkContent extends BaseValueObject<string> {
  /**
   * 最大块内容长度（字符数）
   */
  private static readonly MAX_CONTENT_LENGTH = 50_000;

  /**
   * 最小块内容长度（字符数）
   */
  private static readonly MIN_CONTENT_LENGTH = 10;

  /**
   * 创建块内容值对象
   * @param content 块内容
   * @returns ChunkContent实例
   * @throws {Error} 当内容无效时抛出错误
   */
  public static create(content: string): ChunkContent {
    return new ChunkContent(content);
  }

  /**
   * 私有构造函数
   * @param content 块内容
   */
  private constructor(content: string) {
    super(content);
    this.validate(content);
  }

  /**
   * 验证块内容
   * @param content 要验证的内容
   * @throws {Error} 当内容无效时抛出错误
   */
  protected validate(content: string): void {
    if (typeof content !== 'string') {
      throw new Error('Chunk content must be a string');
    }

    if (content.length < ChunkContent.MIN_CONTENT_LENGTH) {
      throw new Error(
        `Chunk content must be at least ${ChunkContent.MIN_CONTENT_LENGTH} characters long`,
      );
    }

    if (content.length > ChunkContent.MAX_CONTENT_LENGTH) {
      throw new Error(
        `Chunk content cannot exceed ${ChunkContent.MAX_CONTENT_LENGTH} characters`,
      );
    }

    // 检查是否包含有效的文本内容（不仅仅是空白字符）
    if (content.trim().length === 0) {
      throw new Error('Chunk content cannot be empty or whitespace only');
    }

    // 检查是否包含过多的空白字符
    const whitespaceRatio = this.calculateWhitespaceRatio(content);
    if (whitespaceRatio > 0.8) {
      throw new Error('Chunk content contains too much whitespace');
    }
  }

  /**
   * 比较两个块内容是否相等
   * @param otherValue 另一个块内容值
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

  /**
   * 获取内容的句子数（简单估算）
   * @returns 句子数
   */
  public getSentenceCount(): number {
    // 简单的句子计数，按句号、问号、感叹号分割
    const sentences = this.value.split(/[.!?]+/);
    return sentences.filter((sentence) => sentence.trim().length > 0).length;
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
   * 检查内容是否包含代码块（简单检测）
   * @returns 是否包含代码块
   */
  public hasCodeBlocks(): boolean {
    return /```[\s\S]*?```/.test(this.value) || /`[^`]+`/.test(this.value);
  }

  /**
   * 检查内容是否包含链接
   * @returns 是否包含链接
   */
  public hasLinks(): boolean {
    const urlPattern = /https?:\/\/[^\s]+/g;
    return urlPattern.test(this.value);
  }

  /**
   * 提取内容中的所有链接
   * @returns 链接数组
   */
  public extractLinks(): string[] {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const matches = this.value.match(urlPattern);
    return matches || [];
  }

  /**
   * 计算内容的复杂度（简单指标）
   * @returns 复杂度分数（0-1之间）
   */
  public calculateComplexity(): number {
    const wordCount = this.getWordCount();
    const uniqueWords = new Set(this.value.toLowerCase().split(/\s+/)).size;
    const avgWordLength = this.value.replace(/\s/g, '').length / wordCount;

    // 复杂度基于：词汇多样性 + 平均词长 + 特殊字符比例
    const vocabularyDiversity = uniqueWords / wordCount;
    const wordLengthComplexity = Math.min(avgWordLength / 10, 1);
    const specialCharRatio =
      this.value.replace(/[a-zA-Z0-9\s]/g, '').length / this.value.length;

    return (vocabularyDiversity + wordLengthComplexity + specialCharRatio) / 3;
  }

  /**
   * 计算空白字符比例
   * @param content 要计算的内容
   * @returns 空白字符比例
   */
  private calculateWhitespaceRatio(content: string): number {
    const whitespaceCount = (content.match(/\s/g) || []).length;
    return whitespaceCount / content.length;
  }

  /**
   * 检查内容是否适合作为搜索片段
   * @returns 是否适合
   */
  public isSuitableForSearch(): boolean {
    // 检查长度、单词数和复杂度
    const length = this.getLength();
    const wordCount = this.getWordCount();
    const complexity = this.calculateComplexity();

    return (
      length >= 50 && // 至少50个字符
      length <= 2000 && // 不超过2000个字符
      wordCount >= 5 && // 至少5个单词
      complexity >= 0.1 && // 有一定的复杂度
      complexity <= 0.8 // 不太复杂
    );
  }

  /**
   * 获取内容的关键词（简单提取）
   * @param maxKeywords 最大关键词数量
   * @returns 关键词数组
   */
  public extractKeywords(maxKeywords: number = 5): string[] {
    // 简单的关键词提取：移除停用词，统计词频
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
    ]);

    const words = this.value
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    const wordFreq = new Map<string, number>();
    words.forEach((word) => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }
}
