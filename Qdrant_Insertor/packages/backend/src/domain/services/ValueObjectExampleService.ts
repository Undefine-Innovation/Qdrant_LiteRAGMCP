import {
  DocumentContent,
  CollectionName,
  ChunkContent,
  EmbeddingVector,
} from '../value-objects/index.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';

/**
 * 值对象使用示例服务
 * 展示如何正确使用和操作值对象
 */
export class ValueObjectExampleService {
  /**
   * 创建集合示例
   * @param name 集合名称
   * @returns 创建的集合信息
   */
  public createCollectionExample(name: string): {
    collectionId: CollectionId;
    name: CollectionName;
    success: boolean;
    message: string;
  } {
    try {
      // 使用值对象验证集合名称
      const collectionName = CollectionName.create(name);
      const collectionId = this.generateCollectionId();

      return {
        collectionId,
        name: collectionName,
        success: true,
        message: `Collection '${collectionName.getDisplayName()}' created successfully`,
      };
    } catch (error) {
      return {
        collectionId: '' as CollectionId,
        name: CollectionName.create('default'), // 使用默认值
        success: false,
        message: `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 处理文档内容示例
   * @param content 原始文档内容
   * @returns 处理后的文档信息
   */
  public processDocumentContent(content: string): {
    docId: DocId;
    content: DocumentContent;
    metadata: {
      length: number;
      wordCount: number;
      lineCount: number;
      byteSize: number;
      preview: string;
    };
  } {
    try {
      // 使用值对象验证和处理文档内容
      const documentContent = DocumentContent.create(content);
      const docId = this.generateDocId(content);

      return {
        docId,
        content: documentContent,
        metadata: {
          length: documentContent.getLength(),
          wordCount: documentContent.getWordCount(),
          lineCount: documentContent.getLineCount(),
          byteSize: documentContent.getByteSize(),
          preview: documentContent.getPreview(100),
        },
      };
    } catch (error) {
      throw new Error(
        `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 处理块内容示例
   * @param content 原始块内容
   * @param chunkIndex 块索引
   * @returns 处理后的块信息
   */
  public processChunkContent(
    content: string,
    chunkIndex: number,
  ): {
    pointId: PointId;
    content: ChunkContent;
    metadata: {
      length: number;
      wordCount: number;
      complexity: number;
      keywords: string[];
      suitableForSearch: boolean;
    };
  } {
    try {
      // 使用值对象验证和处理块内容
      const chunkContent = ChunkContent.create(content);
      const docId = this.generateDocId(content); // 简化示例，实际应该从文档获取
      const pointId = this.generatePointId(docId, chunkIndex);

      return {
        pointId,
        content: chunkContent,
        metadata: {
          length: chunkContent.getLength(),
          wordCount: chunkContent.getWordCount(),
          complexity: chunkContent.calculateComplexity(),
          keywords: chunkContent.extractKeywords(5),
          suitableForSearch: chunkContent.isSuitableForSearch(),
        },
      };
    } catch (error) {
      throw new Error(
        `Chunk processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 处理嵌入向量示例
   * @param vectorData 原始向量数据
   * @returns 处理后的向量信息
   */
  public processEmbeddingVector(vectorData: number[]): {
    vector: EmbeddingVector;
    metadata: {
      dimensions: number;
      l2Norm: number;
      l1Norm: number;
      infinityNorm: number;
      max: number;
      min: number;
      mean: number;
      standardDeviation: number;
      isNormalized: boolean;
    };
  } {
    try {
      // 使用值对象验证和处理嵌入向量
      const vector = EmbeddingVector.create(vectorData);

      return {
        vector,
        metadata: {
          dimensions: vector.getDimensions(),
          l2Norm: vector.getL2Norm(),
          l1Norm: vector.getL1Norm(),
          infinityNorm: vector.getInfinityNorm(),
          max: vector.getMax(),
          min: vector.getMin(),
          mean: vector.getMean(),
          standardDeviation: vector.getStandardDeviation(),
          isNormalized: vector.isNormalized(),
        },
      };
    } catch (error) {
      throw new Error(
        `Vector processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 向量相似度计算示例
   * @param vector1 第一个向量
   * @param vector2 第二个向量
   * @returns 相似度信息
   */
  public calculateVectorSimilarity(
    vector1: number[],
    vector2: number[],
  ): {
    cosineSimilarity: number;
    euclideanDistance: number;
    manhattanDistance: number;
    dotProduct: number;
  } {
    try {
      const v1 = EmbeddingVector.create(vector1);
      const v2 = EmbeddingVector.create(vector2);

      return {
        cosineSimilarity: v1.cosineSimilarity(v2),
        euclideanDistance: v1.euclideanDistance(v2),
        manhattanDistance: v1.manhattanDistance(v2),
        dotProduct: v1.dotProduct(v2),
      };
    } catch (error) {
      throw new Error(
        `Similarity calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 集合名称验证示例
   * @param names 要验证的名称列表
   * @returns 验证结果
   */
  public validateCollectionNames(names: string[]): Array<{
    name: string;
    isValid: boolean;
    isReserved: boolean;
    error?: string;
  }> {
    return names.map((name) => {
      try {
        const collectionName = CollectionName.create(name);
        return {
          name,
          isValid: true,
          isReserved: CollectionName.isReservedName(name),
        };
      } catch (error) {
        return {
          name,
          isValid: false,
          isReserved: CollectionName.isReservedName(name),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 文档内容搜索示例
   * @param content 文档内容
   * @param searchTerm 搜索词
   * @returns 搜索结果
   */
  public searchInDocument(
    content: string,
    searchTerm: string,
  ): {
    content: DocumentContent;
    searchTerm: string;
    contains: boolean;
    caseSensitiveContains: boolean;
    preview: string;
  } {
    try {
      const documentContent = DocumentContent.create(content);

      return {
        content: documentContent,
        searchTerm,
        contains: documentContent.contains(searchTerm, false),
        caseSensitiveContains: documentContent.contains(searchTerm, true),
        preview: documentContent.getPreview(200),
      };
    } catch (error) {
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 生成集合ID（简化示例）
   * @returns 生成的集合ID
   */
  private generateCollectionId(): CollectionId {
    return `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as CollectionId;
  }

  /**
   * 生成文档ID（简化示例）
   * @param content 文档内容
   * @returns 生成的文档ID
   */
  private generateDocId(content: string): DocId {
    // 简化的ID生成，实际应该使用hashContent函数
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as DocId;
  }

  /**
   * 生成点ID（简化示例）
   * @param docId 文档ID
   * @param chunkIndex 块索引
   * @returns 生成的点ID
   */
  private generatePointId(docId: DocId, chunkIndex: number): PointId {
    return `${docId}_${chunkIndex}` as PointId;
  }
}
