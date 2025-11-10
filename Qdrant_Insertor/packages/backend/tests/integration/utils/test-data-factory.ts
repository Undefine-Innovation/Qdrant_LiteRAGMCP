/**
 * 测试数据工厂
 * 用于生成测试用的模拟数据
 */

import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { ChunkMeta } from '@infrastructure/database/entities/ChunkMeta.js';
// SyncJobEntity removed - DB-backed sync jobs disabled
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { ScrapeResults } from '@infrastructure/database/entities/ScrapeResults.js';
import { Event } from '@infrastructure/database/entities/Event.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * 测试数据工厂类
 */
export class TestDataFactory {
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

  /**
   * 创建测试集合
   */
  static createCollection(overrides: Partial<Collection> = {}): Collection {
    const collection = new Collection();
    const now = Date.now();
    
    // 手动设置ID和collectionId，确保它们有值
    const id = this.generateId('collection');
    collection.id = id;
    collection.collectionId = overrides.collectionId || id;
    // 如果调用方显式提供了 id，则以其为准（并同步 collectionId 作为默认）
    if ((overrides as any).id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overrideId = (overrides as any).id as any;
      collection.id = overrideId;
      if (!overrides.collectionId) {
        collection.collectionId = overrideId;
      }
    }
    
    // 只有在overrides中没有明确提供name时才使用默认值
    if (overrides.name !== undefined) {
      collection.name = overrides.name;
    } else {
      collection.name = `test_collection_${this.randomString(5)}`;
    }
    
    collection.description =
      overrides.description ||
      `Test collection description ${this.randomString(10)}`;
      
    // 不手动设置时间戳，让TypeORM的@BeforeInsert和@BeforeUpdate处理
    // 但如果overrides中明确提供了时间戳，则使用它们
    collection.created_at = overrides.created_at ?? now;
    collection.updated_at = overrides.updated_at ?? now;

    // 防止 overrides 覆盖重要字段
    const { created_at, updated_at, id: overrideId, collectionId: overrideCollectionId, ...safeOverrides } = overrides;
    return Object.assign(collection, safeOverrides);
  }

  /**
   * 创建测试文档
   */
  static createDoc(overrides: Partial<Doc> = {}): Doc {
    const doc = new Doc();
    doc.id = this.generateId('doc') as DocId;
    doc.docId = overrides.docId || this.generateId('doc');
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
    doc.is_deleted = overrides.is_deleted ?? false;
    doc.status = overrides.status || 'new';

    // 只有在没有提供时间戳时才设置默认值，让TypeORM管理
    if (!overrides.created_at && !overrides.updated_at) {
      // 不设置时间戳，让BaseEntity的@BeforeInsert处理
    } else {
      // 如果提供了时间戳，使用提供的值
      if (overrides.created_at) doc.created_at = overrides.created_at;
      if (overrides.updated_at) doc.updated_at = overrides.updated_at;
    }

    // 应用其他覆盖，但排除已处理的时间戳字段
    const { created_at, updated_at, ...safeOverrides } = overrides;
    return Object.assign(doc, safeOverrides);
  }

  /**
   * 创建测试块
   */
  static createChunk(overrides: Partial<Chunk> = {}): Chunk {
    const chunk = new Chunk();
    chunk.id = this.generateId('chunk');
    chunk.pointId = overrides.pointId || (this.generateId('point') as PointId);
    chunk.docId = overrides.docId || (this.generateId('doc') as DocId);
    chunk.collectionId =
      overrides.collectionId || (this.generateId('collection') as CollectionId);
    chunk.chunkMetaId = overrides.chunkMetaId || this.generateId('chunkmeta');
    chunk.chunkIndex = overrides.chunkIndex ?? this.randomNumber(0, 10);
    chunk.title = overrides.title || `Chunk Title ${this.randomString(5)}`;
    chunk.content =
      overrides.content || `Test chunk content ${this.randomString(30)}`;
    // 不手动设置时间戳，让 TypeORM 自动管理
    // chunk.created_at = overrides.created_at || this.randomDate().getTime();
    // chunk.updated_at = overrides.updated_at || new Date().getTime();

    // 防止 overrides 覆盖时间戳字段
    const { created_at, updated_at, ...safeOverrides } = overrides;
    return Object.assign(chunk, safeOverrides);
  }

  /**
   * 创建测试块元数据
   */
  static createChunkMeta(overrides: Partial<ChunkMeta> = {}): ChunkMeta {
    const chunkMeta = new ChunkMeta();
    chunkMeta.id = this.generateId('chunkmeta');
    chunkMeta.docId = overrides.docId || (this.generateId('doc') as DocId);
    chunkMeta.collectionId =
      overrides.collectionId || (this.generateId('collection') as CollectionId);
    chunkMeta.chunkIndex = overrides.chunkIndex ?? this.randomNumber(0, 10);
    chunkMeta.contentHash =
      overrides.contentHash || `hash-${this.randomString(20)}`;
    chunkMeta.tokenCount = overrides.tokenCount || this.randomNumber(50, 500);
    chunkMeta.embeddingStatus = overrides.embeddingStatus || 'pending';
    chunkMeta.syncedAt = overrides.syncedAt || this.randomDate().getTime();
    chunkMeta.error = overrides.error || null;
    chunkMeta.pointId =
      overrides.pointId || (this.generateId('point') as PointId);

    // 只有在没有提供时间戳时才设置默认值，让TypeORM管理
    if (!overrides.created_at && !overrides.updated_at) {
      // 不设置时间戳，让BaseEntity的@BeforeInsert处理
    } else {
      // 如果提供了时间戳，使用提供的值
      if (overrides.created_at) chunkMeta.created_at = overrides.created_at;
      if (overrides.updated_at) chunkMeta.updated_at = overrides.updated_at;
    }

    // 应用其他覆盖，但排除已处理的时间戳字段
    const { created_at, updated_at, ...safeOverrides } = overrides;
    return Object.assign(chunkMeta, safeOverrides);
  }

  /**
   * 创建测试同步作业
   */
  // createSyncJob removed - DB-backed SyncJob entity/table no longer present

  /**
   * 创建测试系统指标
   */
  static createSystemMetrics(
    overrides: Partial<SystemMetrics> = {},
  ): SystemMetrics {
    const metrics = new SystemMetrics();
    metrics.id = this.generateId('metrics');

    const metricName =
      overrides.metric_name ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (overrides as any).name ||
      `metric-${this.randomString(5)}`;
    const metricValue =
      overrides.metric_value ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (overrides as any).value ||
      this.randomNumber(0, 1000);
    const metricUnit =
      overrides.metric_unit ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (overrides as any).unit ||
      'count';

    metrics.metric_name = metricName;
    metrics.metric_value = metricValue;
    metrics.metric_unit = metricUnit;
    metrics.metric_type = overrides.metric_type || 'gauge';
    metrics.timestamp = overrides.timestamp || this.randomDate().getTime();
    metrics.source = overrides.source || 'test-suite';
    metrics.description =
      overrides.description || 'generated from TestDataFactory';

    if (overrides.tags) {
      metrics.tags =
        typeof overrides.tags === 'string'
          ? overrides.tags
          : JSON.stringify(overrides.tags);
    } else {
      metrics.tags = JSON.stringify({ source: 'test' });
    }

    metrics.created_at = overrides.created_at || this.randomDate().getTime();
    metrics.updated_at = overrides.updated_at || Date.now();

    return Object.assign(metrics, overrides);
  }

  /**
   * 创建测试告警规则
   */
  static createAlertRule(overrides: Partial<AlertRules> = {}): AlertRules {
    const alertRule = new AlertRules();
    alertRule.id = this.generateId('alertrule');
    alertRule.name = overrides.name || `Alert Rule ${this.randomString(5)}`;
    alertRule.condition = overrides.condition || 'metric > threshold';
    alertRule.threshold = overrides.threshold || 80;
    alertRule.enabled = overrides.enabled ?? true;
    alertRule.metricName = overrides.metricName || 'cpu_usage';
    alertRule.conditionOperator = overrides.conditionOperator || '>';
    alertRule.thresholdValue = overrides.thresholdValue || 80;
    alertRule.severity = overrides.severity || 'medium';
    alertRule.created_at = overrides.created_at || this.randomDate().getTime();
    alertRule.updated_at = overrides.updated_at || new Date().getTime();

    return Object.assign(alertRule, overrides);
  }

  /**
   * 创建测试告警历史
   */
  static createAlertHistory(
    overrides: Partial<AlertHistory> = {},
  ): AlertHistory {
    const alertHistory = new AlertHistory();
    alertHistory.id = this.generateId('alerthistory');
    alertHistory.ruleId =
      overrides.ruleId || (this.generateId('alertrule') as string);
    alertHistory.status = overrides.status || 'triggered';
    alertHistory.message =
      overrides.message || `Alert triggered: ${this.randomString(10)}`;
    alertHistory.severity = overrides.severity || 'medium';
    alertHistory.triggeredAt =
      overrides.triggeredAt || this.randomDate().getTime();
    alertHistory.resolvedAt = overrides.resolvedAt || null;
    alertHistory.created_at =
      overrides.created_at || this.randomDate().getTime();
    alertHistory.updated_at = overrides.updated_at || new Date().getTime();

    return Object.assign(alertHistory, overrides);
  }

  /**
   * 创建测试系统健康
   */
  static createSystemHealth(
    overrides: Partial<SystemHealth> = {},
  ): SystemHealth {
    const systemHealth = new SystemHealth();
    systemHealth.id = this.generateId('health');
    systemHealth.component =
      overrides.component || `component-${this.randomString(5)}`;
    systemHealth.status = overrides.status || 'healthy';
    systemHealth.message = overrides.message || 'Component is healthy';
    systemHealth.lastCheck = overrides.lastCheck || this.randomDate().getTime();
    systemHealth.details = overrides.details || {
      responseTime: this.randomNumber(10, 100),
    };
    systemHealth.created_at =
      overrides.created_at || this.randomDate().getTime();
    systemHealth.updated_at = overrides.updated_at || new Date().getTime();

    return Object.assign(systemHealth, overrides);
  }

  /**
   * 创建测试爬虫结果
   */
  static createScrapeResults(
    overrides: Partial<ScrapeResults> = {},
  ): ScrapeResults {
    const scrapeResult = new ScrapeResults();
    scrapeResult.id = this.generateId('scrape');
    scrapeResult.url =
      overrides.url || `https://example.com/${this.randomString(5)}`;
    scrapeResult.title =
      overrides.title || `Page Title ${this.randomString(5)}`;
    scrapeResult.content =
      overrides.content || `Page content ${this.randomString(50)}`;
    scrapeResult.status = overrides.status || 'completed';
    scrapeResult.error = overrides.error || null;
    scrapeResult.scrapedAt = overrides.scrapedAt || this.randomDate().getTime();
    scrapeResult.metadata = overrides.metadata || {
      wordCount: this.randomNumber(100, 1000),
    };
    scrapeResult.created_at =
      overrides.created_at || this.randomDate().getTime();
    scrapeResult.updated_at = overrides.updated_at || new Date().getTime();

    return Object.assign(scrapeResult, overrides);
  }

  /**
   * 创建测试事件
   */
  static createEvent(overrides: Partial<Event> = {}): Event {
    const event = new Event();
    event.id = this.generateId('event');
    event.type = overrides.type || 'test-event';
    event.aggregateId =
      overrides.aggregateId || (this.generateId('aggregate') as string);
    event.aggregateType = overrides.aggregateType || 'TestAggregate';
    event.data = overrides.data || { test: 'data', value: this.randomNumber() };
    event.version = overrides.version || 1;
    event.occurredAt = overrides.occurredAt || this.randomDate().getTime();
    event.processedAt = overrides.processedAt || null;
    event.created_at = overrides.created_at || this.randomDate().getTime();
    event.updated_at = overrides.updated_at || new Date().getTime();

    return Object.assign(event, overrides);
  }

  /**
   * 创建完整的测试数据集（集合、文档、块）
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
          // 为每个块创建元数据（先创建，以便获取其ID）
          const chunkMeta = this.createChunkMeta({
            docId: doc.id,
            collectionId: collection.id,
            chunkIndex: k,
            pointId: this.generateId('point') as PointId,
            embeddingStatus: 'completed',
          });
          chunkMetas.push(chunkMeta);

          const chunk = this.createChunk({
            docId: doc.id,
            collectionId: collection.id,
            chunkIndex: k,
            chunkMetaId: chunkMeta.id,
            pointId: chunkMeta.pointId,
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
}

// Re-export common test helpers from shared setup and assertions so tests can
// import everything from this single module path (matches historical .js imports).
export {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  getTestLogger,
} from '../setup.js';

export { TestAssertions } from './test-assertions';
