/**
 * 统一的测试数据工厂
 * 整合前后端测试数据创建逻辑，减少重复代码
 */

import {
  Collection,
  Doc,
  Chunk,
  ChunkMeta,
  SystemMetrics,
  AlertRules,
  AlertHistory,
  SystemHealth,
  ScrapeResults,
  Event,
} from '@infrastructure/database/entities/index.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

// 前端类型定义（简化版，避免循环依赖）
interface FrontendCollection {
  collectionId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
}

interface FrontendDocument {
  docId: string;
  collectionId: string;
  name: string;
  type?: string;
  size?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
}

interface FrontendSearchResult {
  content: string;
  score: number;
  metadata: {
    docId: string;
    docName: string;
    collectionId: string;
    collectionName: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

/**
 * 统一测试数据工厂
 */
export class UnifiedDataFactory {
  /**
   * 生成随机ID
   */
  static generateId(prefix: string = 'test'): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 生成随机字符串
   */
  static randomString(length: number = 10): string {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  }

  /**
   * 生成随机数字
   */
  static randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 生成随机日期
   */
  static randomDate(daysAgo: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * daysAgo);
    return date;
  }

  /**
   * 生成随机布尔值
   */
  static randomBoolean(): boolean {
    return Math.random() < 0.5;
  }

  // ==================== 后端实体工厂 ====================

  /**
   * 创建测试集合（后端）
   */
  static createCollection(overrides: Partial<Collection> = {}): Collection {
    const collection = new Collection();
    const now = Date.now();
    const collectionId = this.generateId('collection');

    collection.id = collectionId;
    collection.collectionId = overrides.collectionId || collectionId;
    collection.name =
      overrides.name || `Test Collection ${this.randomString(5)}`;
    collection.description =
      overrides.description ||
      `Test collection description ${this.randomString(10)}`;
    collection.status = overrides.status || 'active';
    collection.deleted = overrides.deleted ?? false;
    collection.documentCount = overrides.documentCount || 0;
    collection.chunkCount = overrides.chunkCount || 0;
    collection.created_at = overrides.created_at ?? now;
    collection.updated_at = overrides.updated_at ?? now;

    // 应用其他覆盖，但排除已处理的字段
    const {
      created_at,
      updated_at,
      id: overrideId,
      collectionId: overrideCollectionId,
      ...safeOverrides
    } = overrides;
    return Object.assign(collection, safeOverrides);
  }

  /**
   * 创建测试文档（后端）
   */
  static createDoc(overrides: Partial<Doc> = {}): Doc {
    const doc = new Doc();
    const docId = this.generateId('doc');
    const now = Date.now();

    doc.id = docId;
    doc.docId = overrides.docId || docId;
    doc.collectionId =
      overrides.collectionId || (this.generateId('collection') as CollectionId);
    doc.key = overrides.key || `doc-${this.randomString(8)}`;
    doc.name = overrides.name || `Test Document ${this.randomString(5)}`;
    doc.size_bytes = overrides.size_bytes || this.randomNumber(1000, 100000);
    doc.mime = overrides.mime || 'text/plain';
    doc.content =
      overrides.content || `Test document content ${this.randomString(50)}`;
    doc.content_hash =
      overrides.content_hash || `hash-${this.randomString(20)}`;
    doc.status = overrides.status || 'new';
    doc.deleted = overrides.deleted ?? false;
    doc.created_at = overrides.created_at ?? now;
    doc.updated_at = overrides.updated_at ?? now;

    // 应用其他覆盖，但排除已处理的字段
    const {
      created_at,
      updated_at,
      id: overrideId,
      ...safeOverrides
    } = overrides;
    return Object.assign(doc, safeOverrides);
  }

  /**
   * 创建测试块（后端）
   */
  static createChunk(overrides: Partial<Chunk> = {}): Chunk {
    const chunk = new Chunk();
    const now = Date.now();

    chunk.id = this.generateId('chunk');
    chunk.pointId = overrides.pointId || (this.generateId('point') as PointId);
    chunk.docId = overrides.docId || (this.generateId('doc') as DocId);
    chunk.collectionId =
      overrides.collectionId || (this.generateId('collection') as CollectionId);
    chunk.chunkIndex = overrides.chunkIndex ?? this.randomNumber(0, 10);
    chunk.title = overrides.title || `Chunk Title ${this.randomString(5)}`;
    chunk.content =
      overrides.content || `Test chunk content ${this.randomString(30)}`;
    chunk.contentLength = overrides.contentLength || chunk.content.length;
    chunk.embeddingStatus = overrides.embeddingStatus || 'pending';
    chunk.syncStatus = overrides.syncStatus || 'pending';
    chunk.created_at = overrides.created_at ?? now;
    chunk.updated_at = overrides.updated_at ?? now;

    // 应用其他覆盖，但排除已处理的字段
    const {
      created_at,
      updated_at,
      id: overrideId,
      ...safeOverrides
    } = overrides;
    return Object.assign(chunk, safeOverrides);
  }

  /**
   * 创建多个测试块（支持自定义ID数组）
   */
  static createChunks(
    count: number,
    options: {
      pointIds?: PointId[];
      docIds?: DocId[];
      collectionIds?: CollectionId[];
      title?: string;
      content?: string;
      [key: string]: unknown;
    } = {},
  ): Chunk[] {
    return Array.from({ length: count }, (_, index) =>
      this.createChunk({
        id: this.generateId('chunk'),
        pointId:
          options.pointIds?.[index] || (this.generateId('point') as PointId),
        docId: options.docIds?.[index] || (this.generateId('doc') as DocId),
        collectionId:
          options.collectionIds?.[index] ||
          (this.generateId('collection') as CollectionId),
        chunkIndex: index,
        title: options.title || `Chunk Title ${this.randomString(5)}`,
        content: options.content,
        ...options,
      }),
    );
  }

  /**
   * 创建部分块数据（用于创建操作）
   */
  static createPartialChunks(
    count: number,
    options: {
      pointIds?: PointId[];
      docIds?: DocId[];
      collectionIds?: CollectionId[];
      title?: string;
      content?: string;
      [key: string]: unknown;
    } = {},
  ): Partial<Chunk>[] {
    return Array.from({ length: count }, (_, index) => ({
      pointId:
        options.pointIds?.[index] || (this.generateId('point') as PointId),
      docId: options.docIds?.[index] || (this.generateId('doc') as DocId),
      collectionId:
        options.collectionIds?.[index] ||
        (this.generateId('collection') as CollectionId),
      chunkIndex: index,
      title: options.title || `Test Chunk ${index}`,
      content: options.content || `Test chunk content ${index}`,
      ...options,
    }));
  }

  /**
   * 创建测试块元数据（后端）
   */
  static createChunkMeta(overrides: Partial<ChunkMeta> = {}): ChunkMeta {
    const chunkMeta = new ChunkMeta();
    const now = Date.now();

    chunkMeta.id = this.generateId('chunkmeta');
    chunkMeta.pointId =
      overrides.pointId || (this.generateId('point') as PointId);
    chunkMeta.docId = overrides.docId || (this.generateId('doc') as DocId);
    chunkMeta.collectionId =
      overrides.collectionId || (this.generateId('collection') as CollectionId);
    chunkMeta.chunkIndex = overrides.chunkIndex ?? this.randomNumber(0, 10);
    chunkMeta.contentHash =
      overrides.contentHash || `hash-${this.randomString(20)}`;
    chunkMeta.tokenCount = overrides.tokenCount || this.randomNumber(50, 500);
    chunkMeta.embeddingStatus = overrides.embeddingStatus || 'pending';
    chunkMeta.created_at = overrides.created_at ?? now;
    chunkMeta.updated_at = overrides.updated_at ?? now;

    // 应用其他覆盖，但排除已处理的字段
    const {
      created_at,
      updated_at,
      id: overrideId,
      ...safeOverrides
    } = overrides;
    return Object.assign(chunkMeta, safeOverrides);
  }

  /**
   * 创建测试系统指标（后端）
   */
  static createSystemMetrics(
    overrides: Partial<SystemMetrics> = {},
  ): SystemMetrics {
    const metrics = new SystemMetrics();
    const now = Date.now();

    metrics.id = this.generateId('metrics');
    metrics.metric_name =
      overrides.metric_name || `metric-${this.randomString(5)}`;
    metrics.metric_value = overrides.metric_value ?? this.randomNumber(0, 1000);
    metrics.metric_unit = overrides.metric_unit || 'count';
    metrics.metric_type = overrides.metric_type || 'gauge';
    metrics.timestamp = overrides.timestamp || this.randomDate().getTime();
    metrics.source = overrides.source || 'test-suite';
    metrics.description =
      overrides.description || 'generated from UnifiedDataFactory';
    metrics.tags = overrides.tags
      ? JSON.stringify(overrides.tags)
      : JSON.stringify({ source: 'test' });
    metrics.created_at = overrides.created_at ?? now;
    metrics.updated_at = overrides.updated_at ?? now;

    // 应用其他覆盖，但排除已处理的字段
    const {
      created_at,
      updated_at,
      id: overrideId,
      ...safeOverrides
    } = overrides;
    return Object.assign(metrics, safeOverrides);
  }

  // ==================== 前端类型工厂 ====================

  /**
   * 创建测试集合（前端）
   */
  static createFrontendCollection(
    overrides: Partial<FrontendCollection> = {},
  ): FrontendCollection {
    const now = new Date().toISOString();

    return {
      collectionId: overrides.collectionId || this.generateId('collection'),
      name: overrides.name || `Test Collection ${this.randomString(5)}`,
      description:
        overrides.description ||
        `Test collection description ${this.randomString(10)}`,
      createdAt: overrides.createdAt || now,
      updatedAt: overrides.updatedAt || now,
      documentCount: overrides.documentCount || 0,
      ...overrides,
    };
  }

  /**
   * 创建测试文档（前端）
   */
  static createFrontendDocument(
    overrides: Partial<FrontendDocument> = {},
  ): FrontendDocument {
    const now = new Date().toISOString();

    return {
      docId: overrides.docId || this.generateId('doc'),
      collectionId: overrides.collectionId || this.generateId('collection'),
      name: overrides.name || `Test Document ${this.randomString(5)}.txt`,
      type: overrides.type || 'text/plain',
      size: overrides.size || this.randomNumber(1000, 100000),
      status: overrides.status || 'synced',
      content:
        overrides.content || `Test document content ${this.randomString(50)}`,
      createdAt: overrides.createdAt || now,
      updatedAt: overrides.updatedAt || now,
      ...overrides,
    };
  }

  /**
   * 创建测试搜索结果（前端）
   */
  static createFrontendSearchResult(
    overrides: Partial<FrontendSearchResult> = {},
  ): FrontendSearchResult {
    return {
      content:
        overrides.content || `Search result content ${this.randomString(30)}`,
      score: overrides.score ?? 0.9 - Math.random() * 0.3,
      metadata: {
        docId: overrides.metadata?.docId || this.generateId('doc'),
        docName:
          overrides.metadata?.docName ||
          `Test Document ${this.randomString(5)}.txt`,
        collectionId:
          overrides.metadata?.collectionId || this.generateId('collection'),
        collectionName:
          overrides.metadata?.collectionName ||
          `Test Collection ${this.randomString(5)}`,
        chunkIndex: overrides.metadata?.chunkIndex ?? this.randomNumber(0, 10),
        totalChunks:
          overrides.metadata?.totalChunks ?? this.randomNumber(5, 20),
        ...overrides.metadata,
      },
      ...overrides,
    };
  }

  // ==================== 批量创建方法 ====================

  /**
   * 创建多个测试集合（后端）
   */
  static createCollections(
    count: number,
    overrides: Partial<Collection> = {},
  ): Collection[] {
    return Array.from({ length: count }, (_, index) =>
      this.createCollection({
        ...overrides,
        name: overrides.name || `Test Collection ${index + 1}`,
        collectionId:
          overrides.collectionId || this.generateId(`collection-${index + 1}`),
      }),
    );
  }

  /**
   * 创建多个测试文档（后端）
   */
  static createDocs(count: number, overrides: Partial<Doc> = {}): Doc[] {
    return Array.from({ length: count }, (_, index) =>
      this.createDoc({
        ...overrides,
        name: overrides.name || `Test Document ${index + 1}`,
        docId: overrides.docId || this.generateId(`doc-${index + 1}`),
      }),
    );
  }

  /**
   * 创建多个测试集合（前端）
   */
  static createFrontendCollections(
    count: number,
    overrides: Partial<FrontendCollection> = {},
  ): FrontendCollection[] {
    return Array.from({ length: count }, (_, index) =>
      this.createFrontendCollection({
        ...overrides,
        name: overrides.name || `Test Collection ${index + 1}`,
        collectionId:
          overrides.collectionId || this.generateId(`collection-${index + 1}`),
      }),
    );
  }

  /**
   * 创建多个测试文档（前端）
   */
  static createFrontendDocs(
    count: number,
    overrides: Partial<FrontendDocument> = {},
  ): FrontendDocument[] {
    return Array.from({ length: count }, (_, index) =>
      this.createFrontendDocument({
        ...overrides,
        name: overrides.name || `Test Document ${index + 1}.txt`,
        docId: overrides.docId || this.generateId(`doc-${index + 1}`),
      }),
    );
  }

  /**
   * 创建多个测试搜索结果（前端）
   */
  static createFrontendSearchResults(
    count: number,
    overrides: Partial<FrontendSearchResult> = {},
  ): FrontendSearchResult[] {
    return Array.from({ length: count }, (_, index) =>
      this.createFrontendSearchResult({
        ...overrides,
        score: overrides.score ?? 0.9 - index * 0.1,
        metadata: {
          chunkIndex: overrides.metadata?.chunkIndex ?? index,
          docId: overrides.metadata?.docId || this.generateId('doc'),
          docName:
            overrides.metadata?.docName ||
            `Test Document ${this.randomString(5)}`,
          collectionId:
            overrides.metadata?.collectionId || this.generateId('collection'),
          collectionName:
            overrides.metadata?.collectionName ||
            `Test Collection ${this.randomString(5)}`,
          totalChunks: overrides.metadata?.totalChunks || 1,
        },
      }),
    );
  }

  // ==================== 完整数据集创建 ====================

  /**
   * 创建完整的测试数据集（后端）
   */
  static createCompleteDataSet(
    overrides: {
      collectionCount?: number;
      docsPerCollection?: number;
      chunksPerDoc?: number;
    } = {},
  ): {
    collections: Collection[];
    docs: Doc[];
    chunks: Chunk[];
    chunkMetas: ChunkMeta[];
  } {
    const {
      collectionCount = 2,
      docsPerCollection = 3,
      chunksPerDoc = 5,
    } = overrides;

    const collections: Collection[] = [];
    const docs: Doc[] = [];
    const chunks: Chunk[] = [];
    const chunkMetas: ChunkMeta[] = [];

    // 创建集合
    for (let i = 0; i < collectionCount; i++) {
      const collection = this.createCollection({
        name: `Test Collection ${i + 1}`,
        description: `Description for collection ${i + 1}`,
      });
      collections.push(collection);

      // 为每个集合创建文档
      for (let j = 0; j < docsPerCollection; j++) {
        const doc = this.createDoc({
          collectionId: collection.id,
          name: `Document ${j + 1} in ${collection.name}`,
          content: `Content for document ${j + 1} in collection ${i + 1}`,
        });
        docs.push(doc);

        // 为每个文档创建块
        for (let k = 0; k < chunksPerDoc; k++) {
          const pointId = this.generateId('point') as PointId;

          // 创建块元数据
          const chunkMeta = this.createChunkMeta({
            docId: doc.id,
            collectionId: collection.id,
            chunkIndex: k,
            pointId,
            embeddingStatus: 'completed',
          });
          chunkMetas.push(chunkMeta);

          // 创建块
          const chunk = this.createChunk({
            docId: doc.id,
            collectionId: collection.id,
            chunkIndex: k,
            chunkMetaId: chunkMeta.id,
            pointId,
            title: `Chunk ${k + 1} of ${doc.name}`,
            content: `Content for chunk ${k + 1} in document ${j + 1}`,
          });
          chunks.push(chunk);
        }
      }
    }

    return {
      collections,
      docs,
      chunks,
      chunkMetas,
    };
  }

  /**
   * 创建完整的测试数据集（前端）
   */
  static createCompleteFrontendDataSet(
    overrides: {
      collectionCount?: number;
      docsPerCollection?: number;
    } = {},
  ): {
    collections: FrontendCollection[];
    docs: FrontendDocument[];
  } {
    const { collectionCount = 2, docsPerCollection = 3 } = overrides;

    const collections: FrontendCollection[] = [];
    const docs: FrontendDocument[] = [];

    // 创建集合
    for (let i = 0; i < collectionCount; i++) {
      const collection = this.createFrontendCollection({
        name: `Test Collection ${i + 1}`,
        description: `Description for collection ${i + 1}`,
      });
      collections.push(collection);

      // 为每个集合创建文档
      for (let j = 0; j < docsPerCollection; j++) {
        const doc = this.createFrontendDocument({
          collectionId: collection.collectionId,
          name: `Document ${j + 1} in ${collection.name}`,
          content: `Content for document ${j + 1} in collection ${i + 1}`,
        });
        docs.push(doc);
      }
    }

    return {
      collections,
      docs,
    };
  }
}

// 导出类型定义，供测试使用
export type { FrontendCollection, FrontendDocument, FrontendSearchResult };
