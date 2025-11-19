import { CollectionAggregate } from './CollectionAggregate.js';
import { DocumentAggregate } from './DocumentAggregate.js';
import { CollectionId, DocId } from '../entities/types.js';

/**
 * 聚合间业务规则验证器
 * 定义跨聚合的业务规则和一致性约束
 */
export class AggregateBusinessRules {
  /**
   * 验证文档是否可以被添加到集合
   * @param collectionAggregate 集合聚合
   * @param documentAggregate 文档聚合
   * @returns 验证结果
   */
  public static validateDocumentAddition(
    collectionAggregate: CollectionAggregate,
    documentAggregate: DocumentAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查文档是否属于正确的集合
    if (documentAggregate.collectionId !== collectionAggregate.id) {
      errors.push(
        `Document ${documentAggregate.id} does not belong to collection ${collectionAggregate.id}`,
      );
    }

    // 检查文档键是否已存在
    if (collectionAggregate.hasDocumentWithKey(documentAggregate.key)) {
      errors.push(
        `Document with key '${documentAggregate.key}' already exists in collection`,
      );
    }

    // 检查文档是否已被删除
    if (documentAggregate.isDeleted) {
      errors.push(
        `Cannot add deleted document ${documentAggregate.id} to collection`,
      );
    }

    // 检查集合是否为系统集合（系统集合可能有特殊规则）
    if (
      collectionAggregate.name.startsWith('system-') ||
      collectionAggregate.name.startsWith('admin-') ||
      collectionAggregate.name.startsWith('internal-')
    ) {
      // 系统集合可能只允许特定类型的文档
      if (!this.isDocumentAllowedInSystemCollection(documentAggregate)) {
        errors.push(
          `Document ${documentAggregate.id} is not allowed in system collection ${collectionAggregate.id}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证文档是否可以从集合中移除
   * @param collectionAggregate 集合聚合
   * @param documentAggregate 文档聚合
   * @returns 验证结果
   */
  public static validateDocumentRemoval(
    collectionAggregate: CollectionAggregate,
    documentAggregate: DocumentAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查文档是否属于集合
    if (documentAggregate.collectionId !== collectionAggregate.id) {
      errors.push(
        `Document ${documentAggregate.id} does not belong to collection ${collectionAggregate.id}`,
      );
    }

    // 检查文档是否可以被删除
    if (!documentAggregate.canBeDeleted()) {
      errors.push(`Document ${documentAggregate.id} cannot be deleted`);
    }

    // 检查文档是否正在处理中
    if (documentAggregate.document.isProcessing()) {
      errors.push(
        `Cannot remove document ${documentAggregate.id} while it is being processed`,
      );
    }

    // 检查系统集合的特殊规则
    if (
      collectionAggregate.name.startsWith('system-') ||
      collectionAggregate.name.startsWith('admin-') ||
      collectionAggregate.name.startsWith('internal-')
    ) {
      if (!this.isDocumentRemovableFromSystemCollection(documentAggregate)) {
        errors.push(
          `Document ${documentAggregate.id} cannot be removed from system collection ${collectionAggregate.id}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证集合是否可以被删除
   * @param collectionAggregate 集合聚合
   * @returns 验证结果
   */
  public static validateCollectionDeletion(
    collectionAggregate: CollectionAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查集合是否可以被删除
    if (!collectionAggregate.canBeDeleted()) {
      errors.push(`Collection ${collectionAggregate.id} cannot be deleted`);
    }

    // 检查集合是否为系统集合
    if (
      collectionAggregate.name.startsWith('system-') ||
      collectionAggregate.name.startsWith('admin-') ||
      collectionAggregate.name.startsWith('internal-')
    ) {
      errors.push(
        `System collection ${collectionAggregate.id} cannot be deleted`,
      );
    }

    // 检查集合中是否还有活跃文档
    if (collectionAggregate.getDocumentCount() > 0) {
      errors.push(
        `Cannot delete collection ${collectionAggregate.id} with ${collectionAggregate.getDocumentCount()} active documents`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证文档处理是否可以开始
   * @param documentAggregate 文档聚合
   * @returns 验证结果
   */
  public static validateDocumentProcessingStart(
    documentAggregate: DocumentAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查文档是否可以被处理
    if (!documentAggregate.canBeProcessed()) {
      errors.push(`Document ${documentAggregate.id} cannot be processed`);
    }

    // 检查文档是否有内容
    if (!documentAggregate.content) {
      errors.push(`Document ${documentAggregate.id} has no content to process`);
    }

    // 检查文档是否为文本类型
    if (!documentAggregate.document.isTextDocument()) {
      errors.push(
        `Document ${documentAggregate.id} is not a text document and cannot be processed`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证文档处理是否可以完成
   * @param documentAggregate 文档聚合
   * @returns 验证结果
   */
  public static validateDocumentProcessingCompletion(
    documentAggregate: DocumentAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查文档是否正在处理中
    if (!documentAggregate.document.isProcessing()) {
      errors.push(
        `Document ${documentAggregate.id} is not in processing state`,
      );
    }

    // 检查是否有块
    if (documentAggregate.getChunkCount() === 0) {
      errors.push(`Document ${documentAggregate.id} has no chunks to complete`);
    }

    // 检查所有块是否已完成
    const incompleteChunks = documentAggregate
      .getChunks()
      .filter((chunk) => !chunk.isCompleted());
    if (incompleteChunks.length > 0) {
      errors.push(
        `Document ${documentAggregate.id} has ${incompleteChunks.length} incomplete chunks`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证跨聚合引用的一致性
   * @param collectionAggregates 集合聚合数组
   * @param documentAggregates 文档聚合数组
   * @returns 验证结果
   */
  public static validateCrossAggregateConsistency(
    collectionAggregates: CollectionAggregate[],
    documentAggregates: DocumentAggregate[],
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 创建集合ID映射
    const collectionMap = new Map<CollectionId, CollectionAggregate>(
      collectionAggregates.map((col) => [col.id, col]),
    );

    // 验证每个文档的集合引用
    for (const doc of documentAggregates) {
      const collection = collectionMap.get(doc.collectionId);
      if (!collection) {
        errors.push(
          `Document ${doc.id} references non-existent collection ${doc.collectionId}`,
        );
        continue;
      }

      // 检查文档是否在集合中
      if (!collection.hasDocument(doc.id)) {
        errors.push(
          `Document ${doc.id} is not in its referenced collection ${doc.collectionId}`,
        );
      }
    }

    // 验证集合中的文档数量一致性
    for (const collection of collectionAggregates) {
      const actualDocCount = documentAggregates.filter(
        (doc) => doc.collectionId === collection.id && !doc.isDeleted,
      ).length;

      if (actualDocCount !== collection.getDocumentCount()) {
        errors.push(
          `Collection ${collection.id} document count mismatch: expected ${collection.getDocumentCount()}, actual ${actualDocCount}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查文档是否允许在系统集合中
   * @param documentAggregate 文档聚合
   * @returns 是否允许
   */
  private static isDocumentAllowedInSystemCollection(
    documentAggregate: DocumentAggregate,
  ): boolean {
    // 这里可以实现特定的业务规则
    // 例如，系统集合可能只允许特定类型的文档

    // 示例规则：系统集合只允许JSON或XML文档
    const allowedMimeTypes = [
      'application/json',
      'application/xml',
      'text/plain',
    ];

    return allowedMimeTypes.includes(
      documentAggregate.document.mime || 'text/plain',
    );
  }

  /**
   * 检查文档是否可以从系统集合中移除
   * @param documentAggregate 文档聚合
   * @returns 是否可以移除
   */
  private static isDocumentRemovableFromSystemCollection(
    documentAggregate: DocumentAggregate,
  ): boolean {
    // 这里可以实现特定的业务规则
    // 例如，某些关键文档可能不能从系统集合中移除

    // 示例规则：已完成处理的文档不能从系统集合中移除
    return !documentAggregate.document.isCompleted();
  }
}

/**
 * 聚合间事件处理器
 * 处理跨聚合的领域事件和最终一致性
 */
export class AggregateEventHandler {
  /**
   * 处理文档添加到集合的事件
   * @param collectionAggregate 集合聚合
   * @param documentAggregate 文档聚合
   */
  public static handleDocumentAdded(
    collectionAggregate: CollectionAggregate,
    documentAggregate: DocumentAggregate,
  ): void {
    // 更新集合的统计信息
    // 这里可以触发集合的更新事件或通知

    // 记录审计日志
    console.log(
      `Document ${documentAggregate.id} added to collection ${collectionAggregate.id}`,
    );
  }

  /**
   * 处理文档从集合移除的事件
   * @param collectionAggregate 集合聚合
   * @param documentAggregate 文档聚合
   */
  public static handleDocumentRemoved(
    collectionAggregate: CollectionAggregate,
    documentAggregate: DocumentAggregate,
  ): void {
    // 更新集合的统计信息
    // 这里可以触发集合的更新事件或通知

    // 记录审计日志
    console.log(
      `Document ${documentAggregate.id} removed from collection ${collectionAggregate.id}`,
    );
  }

  /**
   * 处理文档状态变更的事件
   * @param documentAggregate 文档聚合
   * @param oldStatus 旧状态
   * @param newStatus 新状态
   */
  public static handleDocumentStatusChanged(
    documentAggregate: DocumentAggregate,
    oldStatus: string,
    newStatus: string,
  ): void {
    // 根据状态变更执行相应的业务逻辑
    switch (newStatus) {
      case 'completed':
        // 通知相关集合更新统计信息
        console.log(`Document ${documentAggregate.id} processing completed`);
        break;
      case 'failed':
        // 记录失败信息，可能需要重试
        console.log(`Document ${documentAggregate.id} processing failed`);
        break;
      case 'processing':
        // 开始处理，可能需要分配资源
        console.log(`Document ${documentAggregate.id} processing started`);
        break;
    }
  }

  /**
   * 处理块嵌入生成完成的事件
   * @param documentAggregate 文档聚合
   * @param chunkId 块ID
   */
  public static handleChunkEmbeddingGenerated(
    documentAggregate: DocumentAggregate,
    chunkId: string,
  ): void {
    // 检查是否所有块都已生成嵌入
    const completedChunks = documentAggregate.getCompletedChunkCount();
    const totalChunks = documentAggregate.getChunkCount();

    if (completedChunks === totalChunks && totalChunks > 0) {
      // 所有块都已完成，可以标记文档为已完成
      console.log(
        `All chunks for document ${documentAggregate.id} have embeddings`,
      );
    }
  }

  /**
   * 处理集合删除的事件
   * @param collectionAggregate 集合聚合
   */
  public static handleCollectionDeleted(
    collectionAggregate: CollectionAggregate,
  ): void {
    // 清理相关资源
    // 通知相关系统组件

    // 记录审计日志
    console.log(`Collection ${collectionAggregate.id} deleted`);
  }
}

/**
 * 聚合间协调器
 * 协调多个聚合之间的操作和一致性
 */
export class AggregateCoordinator {
  /**
   * 协调文档在集合间的移动
   * @param documentAggregate 文档聚合
   * @param sourceCollectionAggregate 源集合聚合
   * @param targetCollectionAggregate 目标集合聚合
   * @returns 操作结果
   */
  public static moveDocumentBetweenCollections(
    documentAggregate: DocumentAggregate,
    sourceCollectionAggregate: CollectionAggregate,
    targetCollectionAggregate: CollectionAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证源集合
    if (!sourceCollectionAggregate.hasDocument(documentAggregate.id)) {
      errors.push(
        `Document ${documentAggregate.id} is not in source collection ${sourceCollectionAggregate.id}`,
      );
    }

    // 验证目标集合
    if (targetCollectionAggregate.hasDocumentWithKey(documentAggregate.key)) {
      errors.push(
        `Document with key '${documentAggregate.key}' already exists in target collection ${targetCollectionAggregate.id}`,
      );
    }

    // 验证文档状态
    if (documentAggregate.document.isProcessing()) {
      errors.push(
        `Cannot move document ${documentAggregate.id} while it is being processed`,
      );
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // 执行移动操作
    try {
      // 从源集合移除（使用不可变操作）
      const updatedSourceCollection = sourceCollectionAggregate.withoutDocument(
        documentAggregate.id,
      );

      // 添加到目标集合（使用不可变操作）
      const updatedTargetCollection = targetCollectionAggregate.withDocument(
        documentAggregate.id,
        documentAggregate.key,
        documentAggregate.content?.getValue() || '',
        documentAggregate.name,
        documentAggregate.document.mime,
      );

      // 注意：在实际应用中，这里需要返回更新后的聚合实例
      // 或者通过领域事件来处理状态变更
      return { isValid: true, errors: [] };
    } catch (error) {
      errors.push(
        `Failed to move document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { isValid: false, errors };
    }
  }

  /**
   * 协调批量文档操作
   * @param documentAggregates 文档聚合数组
   * @param operation 操作类型
   * @returns 操作结果
   */
  public static coordinateBatchDocumentOperation(
    documentAggregates: DocumentAggregate[],
    operation: 'delete' | 'process' | 'restore',
  ): { isValid: boolean; errors: string[]; successCount: number } {
    const errors: string[] = [];
    let successCount = 0;

    for (const doc of documentAggregates) {
      try {
        switch (operation) {
          case 'delete':
            if (doc.canBeDeleted()) {
              doc.softDelete();
              successCount++;
            } else {
              errors.push(`Document ${doc.id} cannot be deleted`);
            }
            break;
          case 'process':
            if (doc.canBeProcessed()) {
              doc.startProcessing();
              successCount++;
            } else {
              errors.push(`Document ${doc.id} cannot be processed`);
            }
            break;
          case 'restore':
            if (doc.isDeleted) {
              doc.restore();
              successCount++;
            } else {
              errors.push(
                `Document ${doc.id} is not deleted and cannot be restored`,
              );
            }
            break;
        }
      } catch (error) {
        errors.push(
          `Failed to ${operation} document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      successCount,
    };
  }
}
