import { CollectionAggregate } from './CollectionAggregate.js';
import { DocumentAggregate } from './DocumentAggregate.js';
import { Collection } from '../entities/Collection.js';
import { Doc } from '../entities/Doc.js';
import { Chunk } from '../entities/Chunk.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';

/**
 * 聚合工厂
 * 负责创建和重建聚合实例
 */
export class AggregateFactory {
  /**
   * 创建新的集合聚合
   * @param id 集合ID
   * @param name 集合名称
   * @param description 集合描述
   * @returns CollectionAggregate实例
   */
  public static createCollection(
    id: CollectionId,
    name: string,
    description?: string,
  ): CollectionAggregate {
    return CollectionAggregate.create(id, name, description);
  }

  /**
   * 从现有数据重建集合聚合
   * @param collection 集合实体
   * @param documents 文档实体数组
   * @returns CollectionAggregate实例
   */
  public static reconstituteCollection(
    collection: Collection,
    documents: Doc[] = [],
  ): CollectionAggregate {
    return CollectionAggregate.reconstitute(collection, documents);
  }

  /**
   * 创建新的文档聚合
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns DocumentAggregate实例
   */
  public static createDocument(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    content: string,
    name?: string,
    mime?: string,
  ): DocumentAggregate {
    return DocumentAggregate.create(id, collectionId, key, content, name, mime);
  }

  /**
   * 从现有数据重建文档聚合
   * @param document 文档实体
   * @param chunks 块实体数组
   * @returns DocumentAggregate实例
   */
  public static reconstituteDocument(
    document: Doc,
    chunks: Chunk[] = [],
  ): DocumentAggregate {
    return DocumentAggregate.reconstitute(document, chunks);
  }

  /**
   * 批量创建文档聚合
   * @param documentsData 文档数据数组
   * @returns DocumentAggregate实例数组
   */
  public static createDocuments(
    documentsData: Array<{
      id: DocId;
      collectionId: CollectionId;
      key: string;
      content: string;
      name?: string;
      mime?: string;
    }>,
  ): DocumentAggregate[] {
    return documentsData.map((data) =>
      this.createDocument(
        data.id,
        data.collectionId,
        data.key,
        data.content,
        data.name,
        data.mime,
      ),
    );
  }

  /**
   * 批量重建文档聚合
   * @param documentsWithChunks 文档和块数据数组
   * @returns DocumentAggregate实例数组
   */
  public static reconstituteDocuments(
    documentsWithChunks: Array<{
      document: Doc;
      chunks: Chunk[];
    }>,
  ): DocumentAggregate[] {
    return documentsWithChunks.map((data) =>
      this.reconstituteDocument(data.document, data.chunks),
    );
  }

  /**
   * 创建完整的集合聚合（包含文档和块）
   * @param collectionData 集合数据
   * @param collectionData.id
   * @param collectionData.name
   * @param collectionData.description
   * @param documentsWithChunks 文档和块数据数组
   * @returns CollectionAggregate实例
   */
  public static createCompleteCollection(
    collectionData: {
      id: CollectionId;
      name: string;
      description?: string;
    },
    documentsWithChunks: Array<{
      id: DocId;
      key: string;
      content: string;
      name?: string;
      mime?: string;
      chunks?: Array<{
        pointId: PointId;
        chunkIndex: number;
        content: string;
        title?: string;
      }>;
    }> = [],
  ): CollectionAggregate {
    // 创建集合聚合
    const collectionAggregate = this.createCollection(
      collectionData.id,
      collectionData.name,
      collectionData.description,
    );

    // 为每个文档创建文档聚合并添加到集合
    for (const docData of documentsWithChunks) {
      const documentAggregate = this.createDocument(
        docData.id,
        collectionData.id,
        docData.key,
        docData.content,
        docData.name,
        docData.mime,
      );

      // 添加块到文档聚合
      if (docData.chunks) {
        for (const chunkData of docData.chunks) {
          documentAggregate.addChunk(
            chunkData.pointId,
            chunkData.chunkIndex,
            chunkData.content,
            chunkData.title,
          );
        }
      }

      // 将文档添加到集合聚合
      collectionAggregate.addDocument(
        docData.id,
        docData.key,
        docData.content,
        docData.name,
        docData.mime,
      );
    }

    return collectionAggregate;
  }

  /**
   * 重建完整的集合聚合（包含文档和块）
   * @param collection 集合实体
   * @param documentsWithChunks 文档和块数据数组
   * @returns CollectionAggregate实例
   */
  public static reconstituteCompleteCollection(
    collection: Collection,
    documentsWithChunks: Array<{
      document: Doc;
      chunks: Chunk[];
    }> = [],
  ): CollectionAggregate {
    // 重建集合聚合
    const collectionAggregate = this.reconstituteCollection(collection);

    // 为每个文档重建文档聚合
    for (const { document, chunks } of documentsWithChunks) {
      const documentAggregate = this.reconstituteDocument(document, chunks);

      // 将文档添加到集合聚合
      collectionAggregate.addDocument(
        document.id,
        document.key,
        document.contentValue || '',
        document.name,
        document.mime,
      );
    }

    return collectionAggregate;
  }

  /**
   * 从原始数据创建文档聚合（用于导入）
   * @param rawData 原始文档数据
   * @param rawData.id
   * @param rawData.collectionId
   * @param rawData.key
   * @param rawData.content
   * @param rawData.name
   * @param rawData.mime
   * @param rawData.chunks
   * @returns DocumentAggregate实例
   */
  public static createDocumentFromRawData(rawData: {
    id: DocId;
    collectionId: CollectionId;
    key: string;
    content: string;
    name?: string;
    mime?: string;
    chunks?: Array<{
      pointId: PointId;
      chunkIndex: number;
      content: string;
      title?: string;
      embedding?: number[];
      titleChain?: string;
    }>;
  }): DocumentAggregate {
    // 创建文档聚合
    const documentAggregate = this.createDocument(
      rawData.id,
      rawData.collectionId,
      rawData.key,
      rawData.content,
      rawData.name,
      rawData.mime,
    );

    // 添加块到文档聚合
    if (rawData.chunks) {
      for (const chunkData of rawData.chunks) {
        const chunk = documentAggregate.addChunk(
          chunkData.pointId,
          chunkData.chunkIndex,
          chunkData.content,
          chunkData.title,
        );

        // 如果有嵌入向量，设置它
        if (chunkData.embedding) {
          documentAggregate.setChunkEmbedding(
            chunkData.pointId,
            chunkData.embedding,
          );
        }

        // 如果有标题链，设置它
        if (chunkData.titleChain) {
          chunk.setTitleChain(chunkData.titleChain);
        }
      }
    }

    return documentAggregate;
  }

  /**
   * 验证聚合数据完整性
   * @param collectionAggregate 集合聚合
   * @returns 验证结果
   */
  public static validateCollectionAggregate(
    collectionAggregate: CollectionAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证集合聚合本身
    const aggregateValidation = collectionAggregate.validate();
    if (!aggregateValidation.isValid) {
      errors.push(...aggregateValidation.errors);
    }

    // 验证文档与集合的关系
    for (const doc of collectionAggregate.getDocuments()) {
      if (doc.collectionId !== collectionAggregate.id) {
        errors.push(
          `Document ${doc.id} does not belong to collection ${collectionAggregate.id}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证文档聚合数据完整性
   * @param documentAggregate 文档聚合
   * @returns 验证结果
   */
  public static validateDocumentAggregate(
    documentAggregate: DocumentAggregate,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证文档聚合本身
    const aggregateValidation = documentAggregate.validate();
    if (!aggregateValidation.isValid) {
      errors.push(...aggregateValidation.errors);
    }

    // 验证块与文档的关系
    for (const chunk of documentAggregate.getChunks()) {
      if (chunk.docId !== documentAggregate.id) {
        errors.push(
          `Chunk ${chunk.pointId} does not belong to document ${documentAggregate.id}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
