import { BaseValueObject } from './base.js';

/**
 * 集合名称值对象
 * 包含名称验证和业务规则
 */
export class CollectionName extends BaseValueObject<string> {
  /**
   * 最大集合名称长度
   */
  private static readonly MAX_NAME_LENGTH = 255;

  /**
   * 最小集合名称长度
   */
  private static readonly MIN_NAME_LENGTH = 1;

  /**
   * 集合名称的有效字符正则表达式
   * 允许字母、数字、下划线、连字符和点
   */
  private static readonly VALID_NAME_PATTERN = /^[\p{L}\p{N}._\- ]+$/u;

  /**
   * 保留的集合名称（不允许使用）
   */
  private static readonly RESERVED_NAMES = [
    'system',
    'admin',
    'root',
    'default',
    'public',
    'private',
    'api',
    'config',
    'settings',
    'temp',
    'tmp',
    'test',
    'dev',
    'prod',
    'staging',
  ];

  /**
   * 创建集合名称值对象
   * @param name 集合名称
   * @returns CollectionName实例
   * @throws {Error} 当名称无效时抛出错误
   */
  public static create(name: string): CollectionName {
    return new CollectionName(name);
  }

  /**
   * 私有构造函数
   * @param name 集合名称
   */
  private constructor(name: string) {
    super(name);
    this.validate(name);
  }

  /**
   * 验证集合名称
   * @param name 要验证的名称
   * @throws {Error} 当名称无效时抛出错误
   */
  protected validate(name: string): void {
    if (typeof name !== 'string') {
      throw new Error('Collection name must be a string');
    }

    // 检查长度
    if (name.length < CollectionName.MIN_NAME_LENGTH) {
      throw new Error('Collection name cannot be empty');
    }

    if (name.length > CollectionName.MAX_NAME_LENGTH) {
      throw new Error(
        `Collection name cannot exceed ${CollectionName.MAX_NAME_LENGTH} characters`,
      );
    }

    // 检查是否为空或仅包含空白字符
    if (name.trim().length === 0) {
      throw new Error('Collection name cannot be empty or whitespace only');
    }

    // 检查字符有效性
    if (!CollectionName.VALID_NAME_PATTERN.test(name)) {
      throw new Error(
        'Collection name can only contain letters (including Unicode), numbers, underscores, hyphens, and dots',
      );
    }

    // 检查是否为保留名称
    const normalizedName = name.toLowerCase().trim();
    if (CollectionName.RESERVED_NAMES.includes(normalizedName)) {
      throw new Error(
        `'${name}' is a reserved collection name and cannot be used`,
      );
    }

    // 检查是否以点开头或结尾（在某些文件系统中可能有特殊含义）
    if (name.startsWith('.') || name.endsWith('.')) {
      throw new Error('Collection name cannot start or end with a dot');
    }

    // 检查是否包含连续的点
    if (name.includes('..')) {
      throw new Error('Collection name cannot contain consecutive dots');
    }
  }

  /**
   * 比较两个集合名称是否相等
   * @param otherValue 另一个集合名称值
   * @returns 是否相等
   */
  protected isEqual(otherValue: string): boolean {
    // 集合名称比较不区分大小写
    return this.value.toLowerCase() === otherValue.toLowerCase();
  }

  /**
   * 获取规范化的集合名称（小写）
   * @returns 规范化的名称
   */
  public getNormalizedName(): string {
    return this.value.toLowerCase().trim();
  }

  /**
   * 检查名称是否为系统保留名称
   * @param name 要检查的名称
   * @returns 是否为保留名称
   */
  public static isReservedName(name: string): boolean {
    const normalizedName = name.toLowerCase().trim();
    return CollectionName.RESERVED_NAMES.includes(normalizedName);
  }

  /**
   * 检查名称格式是否有效
   * @param name 要检查的名称
   * @returns 是否有效
   */
  public static isValidFormat(name: string): boolean {
    if (typeof name !== 'string') {
      return false;
    }

    if (
      name.length < CollectionName.MIN_NAME_LENGTH ||
      name.length > CollectionName.MAX_NAME_LENGTH
    ) {
      return false;
    }

    if (name.trim().length === 0) {
      return false;
    }

    if (!CollectionName.VALID_NAME_PATTERN.test(name)) {
      return false;
    }

    if (name.startsWith('.') || name.endsWith('.')) {
      return false;
    }

    if (name.includes('..')) {
      return false;
    }

    return true;
  }

  /**
   * 获取名称的显示格式（首字母大写）
   * @returns 显示格式的名称
   */
  public getDisplayName(): string {
    return this.value.charAt(0).toUpperCase() + this.value.slice(1);
  }

  /**
   * 检查名称是否包含特定前缀
   * @param prefix 要检查的前缀
   * @param caseSensitive 是否区分大小写
   * @returns 是否包含前缀
   */
  public hasPrefix(prefix: string, caseSensitive: boolean = false): boolean {
    if (caseSensitive) {
      return this.value.startsWith(prefix);
    }
    return this.value.toLowerCase().startsWith(prefix.toLowerCase());
  }

  /**
   * 检查名称是否包含特定后缀
   * @param suffix 要检查的后缀
   * @param caseSensitive 是否区分大小写
   * @returns 是否包含后缀
   */
  public hasSuffix(suffix: string, caseSensitive: boolean = false): boolean {
    if (caseSensitive) {
      return this.value.endsWith(suffix);
    }
    return this.value.toLowerCase().endsWith(suffix.toLowerCase());
  }
}
