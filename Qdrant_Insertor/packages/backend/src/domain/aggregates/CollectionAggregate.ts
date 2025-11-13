import { Collection } from '../entities/Collection.js';
import { Doc } from '../entities/Doc.js';
import { CollectionId, DocId } from '../entities/types.js';
import { CollectionName } from '../value-objects/CollectionName.js';
import { DocumentContent } from '../value-objects/DocumentContent.js';
import { IDomainEvent } from '../events/IDomainEventInterface.js';
import { AggregateRoot } from './AggregateRoot.js';

// 导入新的事件实现
import {
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  DocumentAddedToCollectionEvent,
  DocumentRemovedFromCollectionEvent,
} from '../events/DomainEvents.js';

// 为了向后兼容，保留原有的事件类型导出
/**
 *
 */
export type CollectionDomainEvent =
  import('../events/IDomainEventInterface.js').CollectionDomainEvent;
/**
 *
 */
export { CollectionCreatedEvent, CollectionUpdatedEvent };
/**
 *
 */
export { DocumentAddedToCollectionEvent as DocumentAddedEvent };
/**
 *
 */
export { DocumentRemovedFromCollectionEvent as DocumentRemovedEvent };

/**
 * 集合聚合根
 * 封装集合及其关联文档的业务逻辑
 */
export class CollectionAggregate extends AggregateRoot {
  private readonly _collection: Collection;
  private readonly _documents: Map<DocId, Doc>;

  /**
   * 构造函数
   * @param collection 集合实体
   * @param documents 文档实体数组
   */
  private constructor(collection: Collection, documents: Doc[] = []) {
    super();
    this._collection = collection;
    this._documents = new Map(documents.map((doc) => [doc.id, doc]));
  }

  /**
   * 创建新的集合聚合
   * @param id 集合ID
   * @param name 集合名称
   * @param description 集合描述
   * @returns CollectionAggregate实例
   */
  public static create(
    id: CollectionId,
    name: string,
    description?: string,
  ): CollectionAggregate {
    const collection = Collection.create(id, name, description);
    const aggregate = new CollectionAggregate(collection);

    // 添加领域事件
    aggregate.addDomainEvent(new CollectionCreatedEvent(id, name, description));

    return aggregate;
  }

  /**
   * 从现有数据重建集合聚合（用于从数据库加载）
   * @param collection 集合实体
   * @param documents 文档实体数组
   * @returns CollectionAggregate实例
   */
  public static reconstitute(
    collection: Collection,
    documents: Doc[] = [],
  ): CollectionAggregate {
    return new CollectionAggregate(collection, documents);
  }

  /**
   * 从数据库加载集合聚合（静态方法）
   * @param collectionId 集合ID
   * @param repository 集合仓储
   * @param repository.getCollectionById 按ID获取集合的方法
   * @param repository.getDocumentsByCollectionId 按集合ID获取文档的方法
   * @returns Promise<CollectionAggregate>
   */
  public static async load(
    collectionId: CollectionId,
    repository: {
      getCollectionById: (id: CollectionId) => Promise<Collection | null>;
      getDocumentsByCollectionId: (id: CollectionId) => Promise<Doc[]>;
    },
  ): Promise<CollectionAggregate> {
    // 从仓储加载集合数据
    const collection = await repository.getCollectionById(collectionId);
    if (!collection) {
      throw new Error(`Collection with id ${collectionId} not found`);
    }

    // 从仓储加载文档数据
    const documents = await repository.getDocumentsByCollectionId(collectionId);

    // 重建聚合
    return CollectionAggregate.reconstitute(collection, documents);
  }

  /**
   * 更新集合描述
   * @param description 新的描述
   */
  public updateDescription(description?: string): void {
    this._collection.updateDescription(description);

    // 添加领域事件
    this.addDomainEvent(
      new CollectionUpdatedEvent(this._collection.id, undefined, description),
    );
  }

  /**
   * 更新集合名称
   * @param name 新的名称
   */
  public updateName(name: string): void {
    const oldName = this._collection.name;
    this._collection.updateName(name);

    // 添加领域事件
    this.addDomainEvent(
      new CollectionUpdatedEvent(this._collection.id, name, undefined),
    );
  }

  /**
   * 添加文档到集合
   * @param docId 文档ID
   * @param docKey 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns 创建的文档实体
   */
  public addDocument(
    docId: DocId,
    docKey: string,
    content: string,
    name?: string,
    mime?: string,
  ): Doc {
    // 检查文档键是否已存在
    if (this.hasDocumentWithKey(docKey)) {
      throw new Error(
        `Document with key '${docKey}' already exists in collection`,
      );
    }

    const doc = Doc.create(
      docId,
      this._collection.id,
      docKey,
      content,
      name,
      mime,
    );
    this._documents.set(doc.id, doc);

    // 添加领域事件
    this.addDomainEvent(
      new DocumentAddedToCollectionEvent(
        this._collection.id,
        doc.id,
        docKey,
        name,
      ),
    );

    return doc;
  }

  /**
   * 从集合中移除文档
   * @param docId 文档ID
   * @returns 是否成功移除
   */
  public removeDocument(docId: DocId): boolean {
    const doc = this._documents.get(docId);
    if (!doc) {
      return false;
    }

    // 检查文档是否可以被删除
    if (!doc.canBeDeleted()) {
      throw new Error(`Document ${docId} cannot be deleted`);
    }

    // 软删除文档
    doc.softDelete();
    this._documents.delete(docId);

    // 添加领域事件
    this.addDomainEvent(
      new DocumentRemovedFromCollectionEvent(
        this._collection.id,
        docId,
        doc.key,
        'Document removed from collection',
      ),
    );

    return true;
  }

  /**
   * 获取集合中的文档
   * @param docId 文档ID
   * @returns 文档实体或undefined
   */
  public getDocument(docId: DocId): Doc | undefined {
    return this._documents.get(docId);
  }

  /**
   * 获取集合中的所有文档
   * @returns 文档实体数组
   */
  public getDocuments(): Doc[] {
    return Array.from(this._documents.values());
  }

  /**
   * 获取集合中的活跃文档（未删除的文档）
   * @returns 活跃文档数组
   */
  public getActiveDocuments(): Doc[] {
    return this.getDocuments().filter((doc) => !doc.isDeleted);
  }

  /**
   * 检查集合是否包含指定文档
   * @param docId 文档ID
   * @returns 是否包含
   */
  public hasDocument(docId: DocId): boolean {
    return this._documents.has(docId);
  }

  /**
   * 检查集合是否包含指定键的文档
   * @param docKey 文档键值
   * @returns 是否包含
   */
  public hasDocumentWithKey(docKey: string): boolean {
    return Array.from(this._documents.values()).some(
      (doc) => doc.key === docKey && !doc.isDeleted,
    );
  }

  /**
   * 获取集合中的文档数量
   * @returns 文档数量
   */
  public getDocumentCount(): number {
    return this.getActiveDocuments().length;
  }

  /**
   * 获取集合中的已完成文档数量
   * @returns 已完成文档数量
   */
  public getCompletedDocumentCount(): number {
    return this.getActiveDocuments().filter((doc) => doc.isCompleted()).length;
  }

  /**
   * 检查集合是否可以被删除
   * @returns 是否可以删除
   */
  public canBeDeleted(): boolean {
    // 系统集合不能删除
    if (!this._collection.canBeDeleted()) {
      return false;
    }

    // 如果有活跃文档，不能删除
    if (this.getDocumentCount() > 0) {
      return false;
    }

    return true;
  }

  /**
   * 验证聚合状态
   * @returns 验证结果
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证集合
    const collectionValidation = this._collection.validate();
    if (!collectionValidation.isValid) {
      errors.push(...collectionValidation.errors);
    }

    // 验证文档
    for (const doc of this._documents.values()) {
      const docValidation = doc.validate();
      if (!docValidation.isValid) {
        errors.push(`Document ${doc.id}: ${docValidation.errors.join(', ')}`);
      }

      // 验证文档是否属于此集合
      if (doc.collectionId !== this._collection.id) {
        errors.push(
          `Document ${doc.id} does not belong to collection ${this._collection.id}`,
        );
      }
    }

    // 验证文档键唯一性
    const docKeys = Array.from(this._documents.values())
      .filter((doc) => !doc.isDeleted)
      .map((doc) => doc.key);

    const uniqueKeys = new Set(docKeys);
    if (docKeys.length !== uniqueKeys.size) {
      errors.push('Document keys must be unique within collection');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 实现AggregateRoot的抽象方法
   * @returns 聚合根ID
   */
  public getId(): string {
    return this._collection.id;
  }

  /**
   * 实现AggregateRoot的抽象方法
   * @returns 聚合根类型
   */
  public getAggregateType(): string {
    return 'CollectionAggregate';
  }

  // Getters
  /**
   * 获取集合实体
   * @returns 集合实体
   */
  get collection(): Collection {
    return this._collection;
  }

  /**
   * 获取集合ID
   * @returns 集合ID
   */
  get id(): CollectionId {
    return this._collection.id;
  }

  /**
   * 获取集合名称
   * @returns 集合名称
   */
  get name(): string {
    return this._collection.name;
  }

  /**
   * 获取集合描述
   * @returns 集合描述
   */
  get description(): string | undefined {
    return this._collection.description;
  }

  /**
   * 获取创建时间戳
   * @returns 创建时间戳
   */
  get createdAt(): number {
    return this._collection.createdAt;
  }

  /**
   * 获取更新时间戳
   * @returns 更新时间戳
   */
  get updatedAt(): number {
    return this._collection.updatedAt;
  }
}
