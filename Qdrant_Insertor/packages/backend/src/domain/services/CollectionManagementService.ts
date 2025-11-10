import { Collection } from '../entities/Collection.js';
import { Doc } from '../entities/Doc.js';
import { CollectionAggregate } from '../aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '../aggregates/DocumentAggregate.js';
import { CollectionName } from '../value-objects/CollectionName.js';
import { DocumentContent } from '../value-objects/DocumentContent.js';
import { CollectionId, DocId } from '../entities/types.js';
import { IEventPublisher } from '../events/IEventPublisher.js';
import {
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  DocumentAddedToCollectionEvent,
  DocumentRemovedFromCollectionEvent,
} from '../events/DomainEvents.js';
import { Logger } from '../../infrastructure/logging/logger.js';

/**
 * 集合管理领域服务接口
 */
export interface ICollectionManagementService {
  /**
   * 创建新集合
   * @param name 集合名称
   * @param description 集合描述
   * @returns 创建的集合聚合
   */
  createCollection(
    name: string,
    description?: string,
  ): Promise<CollectionAggregate>;

  /**
   * 更新集合信息
   * @param collectionAggregate 集合聚合
   * @param name 新的集合名称
   * @param description 新的集合描述
   * @returns 更新后的集合聚合
   */
  updateCollection(
    collectionAggregate: CollectionAggregate,
    name?: string,
    description?: string,
  ): Promise<CollectionAggregate>;

  /**
   * 添加文档到集合
   * @param collectionAggregate 集合聚合
   * @param docId 文档ID
   * @param docKey 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns 创建的文档聚合
   */
  addDocumentToCollection(
    collectionAggregate: CollectionAggregate,
    docId: DocId,
    docKey: string,
    content: string,
    name?: string,
    mime?: string,
  ): Promise<DocumentAggregate>;

  /**
   * 从集合中移除文档
   * @param collectionAggregate 集合聚合
   * @param docId 文档ID
   * @returns 是否成功移除
   */
  removeDocumentFromCollection(
    collectionAggregate: CollectionAggregate,
    docId: DocId,
  ): Promise<boolean>;

  /**
   * 验证集合名称
   * @param name 集合名称
   * @returns 验证结果
   */
  validateCollectionName(name: string): { isValid: boolean; errors: string[] };

  /**
   * 检查集合是否可以删除
   * @param collectionAggregate 集合聚合
   * @returns 是否可以删除
   */
  canDeleteCollection(collectionAggregate: CollectionAggregate): boolean;

  /**
   * 获取集合统计信息
   * @param collectionAggregate 集合聚合
   * @returns 统计信息
   */
  getCollectionStatistics(collectionAggregate: CollectionAggregate): {
    documentCount: number;
    activeDocumentCount: number;
    completedDocumentCount: number;
    totalContentLength: number;
    averageDocumentSize: number;
  };

  /**
   * 检查文档键是否在集合中唯一
   * @param collectionAggregate 集合聚合
   * @param docKey 文档键值
   * @param excludeDocId 排除的文档ID（用于更新时检查）
   * @returns 是否唯一
   */
  isDocumentKeyUnique(
    collectionAggregate: CollectionAggregate,
    docKey: string,
    excludeDocId?: DocId,
  ): boolean;
}

/**
 * 集合管理领域服务实现
 * 负责集合和文档的管理业务逻辑
 */
export class CollectionManagementService
  implements ICollectionManagementService
{
  /**
   * 最大集合名称长度
   */
  private static readonly MAX_COLLECTION_NAME_LENGTH = 100;

  /**
   * 最小集合名称长度
   */
  private static readonly MIN_COLLECTION_NAME_LENGTH = 1;

  /**
   * 最大集合描述长度
   */
  private static readonly MAX_COLLECTION_DESCRIPTION_LENGTH = 1000;

  /**
   * 最大文档数量限制
   */
  private static readonly MAX_DOCUMENTS_PER_COLLECTION = 10000;

  /**
   * 构造函数
   * @param eventPublisher 事件发布器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Logger,
  ) {}

  /**
   * 创建新集合
   * @param name 集合名称
   * @param description 集合描述
   * @returns 创建的集合聚合
   */
  public async createCollection(
    name: string,
    description?: string,
  ): Promise<CollectionAggregate> {
    // 验证集合名称
    const nameValidation = this.validateCollectionName(name);
    if (!nameValidation.isValid) {
      throw new Error(
        `Invalid collection name: ${nameValidation.errors.join(', ')}`,
      );
    }

    // 验证描述
    if (
      description &&
      description.length >
        CollectionManagementService.MAX_COLLECTION_DESCRIPTION_LENGTH
    ) {
      throw new Error(
        `Collection description cannot exceed ${CollectionManagementService.MAX_COLLECTION_DESCRIPTION_LENGTH} characters`,
      );
    }

    // 生成集合ID
    const collectionId = this.generateCollectionId();

    // 创建集合聚合
    const collectionAggregate = CollectionAggregate.create(
      collectionId,
      name,
      description,
    );

    // 发布领域事件
    await this.publishDomainEvents(collectionAggregate);

    return collectionAggregate;
  }

  /**
   * 更新集合信息
   * @param collectionAggregate 集合聚合
   * @param name 新的集合名称
   * @param description 新的集合描述
   * @returns 更新后的集合聚合
   */
  public async updateCollection(
    collectionAggregate: CollectionAggregate,
    name?: string,
    description?: string,
  ): Promise<CollectionAggregate> {
    // 验证新名称（如果提供）
    if (name && name !== collectionAggregate.name) {
      const nameValidation = this.validateCollectionName(name);
      if (!nameValidation.isValid) {
        throw new Error(
          `Invalid collection name: ${nameValidation.errors.join(', ')}`,
        );
      }
    }

    // 验证新描述（如果提供）
    if (
      description &&
      description.length >
        CollectionManagementService.MAX_COLLECTION_DESCRIPTION_LENGTH
    ) {
      throw new Error(
        `Collection description cannot exceed ${CollectionManagementService.MAX_COLLECTION_DESCRIPTION_LENGTH} characters`,
      );
    }

    // 更新集合
    if (name || description !== undefined) {
      collectionAggregate.updateDescription(description);
    }

    // 发布领域事件
    await this.publishDomainEvents(collectionAggregate);

    return collectionAggregate;
  }

  /**
   * 添加文档到集合
   * @param collectionAggregate 集合聚合
   * @param docId 文档ID
   * @param docKey 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns 创建的文档聚合
   */
  public async addDocumentToCollection(
    collectionAggregate: CollectionAggregate,
    docId: DocId,
    docKey: string,
    content: string,
    name?: string,
    mime?: string,
  ): Promise<DocumentAggregate> {
    // 验证文档键唯一性
    if (!this.isDocumentKeyUnique(collectionAggregate, docKey)) {
      throw new Error(
        `Document with key '${docKey}' already exists in collection`,
      );
    }

    // 验证文档内容
    try {
      DocumentContent.create(content);
    } catch (error) {
      throw new Error(
        `Invalid document content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // 检查集合文档数量限制
    if (
      collectionAggregate.getDocumentCount() >=
      CollectionManagementService.MAX_DOCUMENTS_PER_COLLECTION
    ) {
      throw new Error(
        `Collection cannot contain more than ${CollectionManagementService.MAX_DOCUMENTS_PER_COLLECTION} documents`,
      );
    }

    // 添加文档到集合
    const doc = collectionAggregate.addDocument(
      docId,
      docKey,
      content,
      name,
      mime,
    );

    // 创建文档聚合
    const documentAggregate = DocumentAggregate.reconstitute(doc);

    // 发布领域事件
    await this.publishDomainEvents(collectionAggregate);
    await this.publishDomainEvents(documentAggregate);

    return documentAggregate;
  }

  /**
   * 从集合中移除文档
   * @param collectionAggregate 集合聚合
   * @param docId 文档ID
   * @returns 是否成功移除
   */
  public async removeDocumentFromCollection(
    collectionAggregate: CollectionAggregate,
    docId: DocId,
  ): Promise<boolean> {
    // 检查文档是否存在
    const doc = collectionAggregate.getDocument(docId);
    if (!doc) {
      return false;
    }

    // 检查文档是否可以被删除
    if (!doc.canBeDeleted()) {
      throw new Error(`Document ${docId} cannot be deleted`);
    }

    // 从集合中移除文档
    const removed = collectionAggregate.removeDocument(docId);

    if (removed) {
      // 发布领域事件
      await this.publishDomainEvents(collectionAggregate);
    }

    return removed;
  }

  /**
   * 验证集合名称
   * @param name 集合名称
   * @returns 验证结果
   */
  public validateCollectionName(name: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查名称长度
    if (!name || name.trim().length === 0) {
      errors.push('Collection name cannot be empty');
    }

    const trimmedName = name.trim();
    if (
      trimmedName.length <
      CollectionManagementService.MIN_COLLECTION_NAME_LENGTH
    ) {
      errors.push(
        `Collection name must be at least ${CollectionManagementService.MIN_COLLECTION_NAME_LENGTH} character long`,
      );
    }

    if (
      trimmedName.length >
      CollectionManagementService.MAX_COLLECTION_NAME_LENGTH
    ) {
      errors.push(
        `Collection name cannot exceed ${CollectionManagementService.MAX_COLLECTION_NAME_LENGTH} characters`,
      );
    }

    try {
      // 使用值对象验证
      CollectionName.create(trimmedName);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Invalid collection name',
      );
    }

    // 检查名称是否包含有效字符
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fff\s]+$/.test(trimmedName)) {
      errors.push(
        'Collection name can only contain letters, numbers, underscores, hyphens, and spaces',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查集合是否可以删除
   * @param collectionAggregate 集合聚合
   * @returns 是否可以删除
   */
  public canDeleteCollection(
    collectionAggregate: CollectionAggregate,
  ): boolean {
    // 检查集合本身是否可以删除
    if (!collectionAggregate.collection.canBeDeleted()) {
      return false;
    }

    // 检查是否有活跃文档
    if (collectionAggregate.getDocumentCount() > 0) {
      return false;
    }

    return true;
  }

  /**
   * 获取集合统计信息
   * @param collectionAggregate 集合聚合
   * @returns 统计信息
   */
  public getCollectionStatistics(collectionAggregate: CollectionAggregate): {
    documentCount: number;
    activeDocumentCount: number;
    completedDocumentCount: number;
    totalContentLength: number;
    averageDocumentSize: number;
  } {
    const documents = collectionAggregate.getActiveDocuments();
    const documentCount = documents.length;
    const completedDocumentCount =
      collectionAggregate.getCompletedDocumentCount();

    let totalContentLength = 0;
    for (const doc of documents) {
      if (doc.content) {
        totalContentLength += doc.content.getLength();
      }
    }

    const averageDocumentSize =
      documentCount > 0 ? totalContentLength / documentCount : 0;

    return {
      documentCount,
      activeDocumentCount: documentCount,
      completedDocumentCount,
      totalContentLength,
      averageDocumentSize,
    };
  }

  /**
   * 检查文档键是否在集合中唯一
   * @param collectionAggregate 集合聚合
   * @param docKey 文档键值
   * @param excludeDocId 排除的文档ID（用于更新时检查）
   * @returns 是否唯一
   */
  public isDocumentKeyUnique(
    collectionAggregate: CollectionAggregate,
    docKey: string,
    excludeDocId?: DocId,
  ): boolean {
    const documents = collectionAggregate.getActiveDocuments();

    for (const doc of documents) {
      if (doc.key === docKey && doc.id !== excludeDocId) {
        return false;
      }
    }

    return true;
  }

  /**
   * 生成集合ID
   * @returns 集合ID
   */
  private generateCollectionId(): CollectionId {
    return `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as CollectionId;
  }

  /**
   * 发布领域事件
   * @param aggregate 聚合根
   */
  private async publishDomainEvents(
    aggregate: CollectionAggregate | DocumentAggregate,
  ): Promise<void> {
    const events = aggregate.getDomainEvents();

    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    aggregate.clearDomainEvents();
  }
}
