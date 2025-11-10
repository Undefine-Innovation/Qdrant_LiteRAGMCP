import { DocumentContent } from '../value-objects/DocumentContent.js';
import { CollectionId, DocId } from './types.js';

/**
 * 文档状态枚举
 */
export enum DocStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELETED = 'deleted',
}

/**
 * 文档领域实体
 * 包含业务规则和行为，符合DDD规范
 */
export class Doc {
  /**
   * 文档唯一标识符
   */
  private readonly _id: DocId;

  /**
   * 所属集合ID
   */
  private readonly _collectionId: CollectionId;

  /**
   * 文档键值
   */
  private readonly _key: string;

  /**
   * 文档名称
   */
  private _name?: string;

  /**
   * 文档大小（字节）
   */
  private _sizeBytes?: number;

  /**
   * MIME类型
   */
  private _mime?: string;

  /**
   * 文档内容值对象（非持久化）
   */
  private _content?: DocumentContent;

  /**
   * 文档状态
   */
  private _status: DocStatus;

  /**
   * 是否已删除
   */
  private _isDeleted: boolean;

  /**
   * 创建时间戳
   */
  private readonly _createdAt: number;

  /**
   * 更新时间戳
   */
  private _updatedAt: number;

  /**
   * 私有构造函数，使用工厂方法创建实例
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param name 文档名称
   * @param sizeBytes 文档大小
   * @param mime MIME类型
   * @param content 文档内容
   * @param status 文档状态
   * @param isDeleted 是否已删除
   * @param createdAt 创建时间戳
   * @param updatedAt 更新时间戳
   */
  private constructor(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    name?: string,
    sizeBytes?: number,
    mime?: string,
    content?: DocumentContent,
    status: DocStatus = DocStatus.NEW,
    isDeleted: boolean = false,
    createdAt?: number,
    updatedAt?: number,
  ) {
    this._id = id;
    this._collectionId = collectionId;
    this._key = key;
    this._name = name;
    this._sizeBytes = sizeBytes;
    this._mime = mime;
    this._content = content;
    this._status = status;
    this._isDeleted = isDeleted;
    this._createdAt = createdAt || Date.now();
    this._updatedAt = updatedAt || this._createdAt;
  }

  /**
   * 创建新的文档实体
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns Doc实例
   * @throws {Error} 当参数无效时抛出错误
   */
  public static create(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    content: string,
    name?: string,
    mime?: string,
  ): Doc {
    // 验证必需参数
    if (!key || key.trim().length === 0) {
      throw new Error('Document key cannot be empty');
    }

    const documentContent = DocumentContent.create(content);
    const sizeBytes = Buffer.from(content, 'utf8').length;

    return new Doc(
      id,
      collectionId,
      key,
      name,
      sizeBytes,
      mime,
      documentContent,
      DocStatus.NEW,
      false,
    );
  }

  /**
   * 从现有数据重建文档实体（用于从数据库加载）
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param name 文档名称
   * @param sizeBytes 文档大小
   * @param mime MIME类型
   * @param status 文档状态
   * @param isDeleted 是否已删除
   * @param createdAt 创建时间戳
   * @param updatedAt 更新时间戳
   * @returns Doc实例
   */
  public static reconstitute(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    name?: string,
    sizeBytes?: number,
    mime?: string,
    status: DocStatus = DocStatus.NEW,
    isDeleted: boolean = false,
    createdAt?: number,
    updatedAt?: number,
  ): Doc {
    return new Doc(
      id,
      collectionId,
      key,
      name,
      sizeBytes,
      mime,
      undefined, // 从数据库加载时内容可能不可用
      status,
      isDeleted,
      createdAt,
      updatedAt,
    );
  }

  /**
   * 更新文档内容
   * @param content 新的文档内容
   */
  public updateContent(content: string): void {
    const documentContent = DocumentContent.create(content);
    this._content = documentContent;
    this._sizeBytes = documentContent.getByteSize();
    this._updatedAt = Date.now();
  }

  /**
   * 更新文档元数据
   * @param name 文档名称
   * @param mime MIME类型
   */
  public updateMetadata(name?: string, mime?: string): void {
    this._name = name;
    this._mime = mime;
    this._updatedAt = Date.now();
  }

  /**
   * 标记文档为处理中
   */
  public markAsProcessing(): void {
    this._status = DocStatus.PROCESSING;
    this._updatedAt = Date.now();
  }

  /**
   * 标记文档为已完成
   */
  public markAsCompleted(): void {
    this._status = DocStatus.COMPLETED;
    this._updatedAt = Date.now();
  }

  /**
   * 标记文档为失败
   */
  public markAsFailed(): void {
    this._status = DocStatus.FAILED;
    this._updatedAt = Date.now();
  }

  /**
   * 软删除文档
   */
  public softDelete(): void {
    this._isDeleted = true;
    this._status = DocStatus.DELETED;
    this._updatedAt = Date.now();
  }

  /**
   * 恢复已删除的文档
   */
  public restore(): void {
    if (!this._isDeleted) {
      throw new Error('Cannot restore a document that is not deleted');
    }
    this._isDeleted = false;
    this._status = DocStatus.NEW;
    this._updatedAt = Date.now();
  }

  /**
   * 检查文档是否可以被处理
   * @returns 是否可以处理
   */
  public canBeProcessed(): boolean {
    return (
      !this._isDeleted &&
      (this._status === DocStatus.NEW || this._status === DocStatus.FAILED)
    );
  }

  /**
   * 检查文档是否可以被删除
   * @returns 是否可以删除
   */
  public canBeDeleted(): boolean {
    return !this._isDeleted;
  }

  /**
   * 检查文档是否可以被恢复
   * @returns 是否可以恢复
   */
  public canBeRestored(): boolean {
    return this._isDeleted;
  }

  /**
   * 检查文档是否已完成处理
   * @returns 是否已完成
   */
  public isCompleted(): boolean {
    return this._status === DocStatus.COMPLETED;
  }

  /**
   * 检查文档是否正在处理中
   * @returns 是否正在处理
   */
  public isProcessing(): boolean {
    return this._status === DocStatus.PROCESSING;
  }

  /**
   * 检查文档是否处理失败
   * @returns 是否失败
   */
  public isFailed(): boolean {
    return this._status === DocStatus.FAILED;
  }

  /**
   * 检查文档是否为文本类型
   * @returns 是否为文本类型
   */
  public isTextDocument(): boolean {
    if (!this._mime) {
      return true; // 默认认为是文本
    }
    return (
      this._mime.startsWith('text/') ||
      this._mime === 'application/json' ||
      this._mime === 'application/xml'
    );
  }

  /**
   * 检查文档是否为二进制类型
   * @returns 是否为二进制类型
   */
  public isBinaryDocument(): boolean {
    return !this.isTextDocument();
  }

  /**
   * 获取内容预览
   * @param maxLength 预览最大长度
   * @returns 内容预览
   */
  public getContentPreview(maxLength: number = 100): string {
    if (!this._content) {
      return '';
    }
    return this._content.getPreview(maxLength);
  }

  /**
   * 获取内容的单词数
   * @returns 单词数
   */
  public getContentWordCount(): number {
    if (!this._content) {
      return 0;
    }
    return this._content.getWordCount();
  }

  /**
   * 获取内容的行数
   * @returns 行数
   */
  public getContentLineCount(): number {
    if (!this._content) {
      return 0;
    }
    return this._content.getLineCount();
  }

  /**
   * 检查内容是否包含指定文本
   * @param searchText 要搜索的文本
   * @param caseSensitive 是否区分大小写
   * @returns 是否包含
   */
  public contentContains(
    searchText: string,
    caseSensitive: boolean = false,
  ): boolean {
    if (!this._content) {
      return false;
    }
    return this._content.contains(searchText, caseSensitive);
  }

  /**
   * 验证文档状态
   * @returns 验证结果
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证键值
    if (!this._key || this._key.trim().length === 0) {
      errors.push('Document key cannot be empty');
    }

    // 验证内容（如果存在）
    if (this._content) {
      try {
        DocumentContent.create(this._content.getValue());
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'Invalid document content',
        );
      }
    }

    // 验证大小
    if (this._sizeBytes !== undefined && this._sizeBytes < 0) {
      errors.push('Document size cannot be negative');
    }

    // 验证时间戳
    if (this._createdAt <= 0) {
      errors.push('Created at timestamp must be positive');
    }

    if (this._updatedAt < this._createdAt) {
      errors.push('Updated at timestamp cannot be earlier than created at');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Getters
  /**
   * 获取文档ID
   * @returns 文档ID
   */
  get id(): DocId {
    return this._id;
  }

  /**
   * 获取集合ID
   * @returns 集合ID
   */
  get collectionId(): CollectionId {
    return this._collectionId;
  }

  /**
   * 获取文档键值
   * @returns 文档键值
   */
  get key(): string {
    return this._key;
  }

  /**
   * 获取文档名称
   * @returns 文档名称
   */
  get name(): string | undefined {
    return this._name;
  }

  /**
   * 获取文档大小（字节）
   * @returns 文档大小
   */
  get sizeBytes(): number | undefined {
    return this._sizeBytes;
  }

  /**
   * 获取MIME类型
   * @returns MIME类型
   */
  get mime(): string | undefined {
    return this._mime;
  }

  /**
   * 获取文档内容值对象
   * @returns 文档内容值对象
   */
  get content(): DocumentContent | undefined {
    return this._content;
  }

  /**
   * 获取文档内容值
   * @returns 文档内容值
   */
  get contentValue(): string | undefined {
    return this._content?.getValue();
  }

  /**
   * 获取文档状态
   * @returns 文档状态
   */
  get status(): DocStatus {
    return this._status;
  }

  /**
   * 获取是否已删除标志
   * @returns 是否已删除
   */
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  /**
   * 获取创建时间戳
   * @returns 创建时间戳
   */
  get createdAt(): number {
    return this._createdAt;
  }

  /**
   * 获取更新时间戳
   * @returns 更新时间戳
   */
  get updatedAt(): number {
    return this._updatedAt;
  }

  /**
   * 转换为纯对象（用于序列化）
   * @returns 纯对象表示
   */
  public toObject(): {
    docId: DocId;
    collectionId: CollectionId;
    key: string;
    name?: string;
    size_bytes?: number;
    mime?: string;
    content?: string;
    status: DocStatus;
    is_deleted: boolean;
    created_at: number;
    updated_at: number;
  } {
    return {
      docId: this._id,
      collectionId: this._collectionId,
      key: this._key,
      name: this._name,
      size_bytes: this._sizeBytes,
      mime: this._mime,
      content: this._content?.getValue(),
      status: this._status,
      is_deleted: this._isDeleted,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }

  /**
   * 检查两个文档实体是否相等
   * @param other 另一个文档实体
   * @returns 是否相等
   */
  public equals(other: Doc): boolean {
    if (this === other) {
      return true;
    }

    if (!(other instanceof Doc)) {
      return false;
    }

    return this._id === other._id;
  }
}
