import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { BatchService } from '@application/services/batch/BatchService.js';
import { CollectionService } from '@application/services/core/CollectionService.js';
import { DocumentService } from '@application/services/core/DocumentService.js';
import { BaseRepository } from '@infrastructure/database/repositories/BaseRepository.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { TestDataFactory } from '../../integration/test-data-factory.js';

/**
 * 性能测试套件配置
 */
export interface PerformanceTestSuite {
  dataSource: DataSource;
  logger: Logger;
  config: AppConfig;
  batchService: BatchService;
  collectionService: CollectionService;
  documentService: DocumentService;
  testCollection: Collection;
}

/**
 * 性能测试描述函数
 */
export function describePerformance(name: string, fn: () => void) {
  describe(`[Performance] ${name}`, () => {
    // 增加测试超时时间
    jest.setTimeout(60000); // 60秒

    // 在每个测试前进行性能基准测试
    beforeEach(() => {
      // 记录初始内存使用
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const initialMemory = process.memoryUsage();
        console.log(
          `Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        );
      }
    });

    // 在每个测试后进行性能分析
    afterEach(() => {
      // 记录最终内存使用
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const finalMemory = process.memoryUsage();
        console.log(
          `Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        );

        // 触发垃圾回收（如果可用）
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
      }
    });

    fn();
  });
}

/**
 * 设置性能测试套件
 */
export function setupPerformanceSuite(): PerformanceTestSuite {
  // 创建模拟的Logger
  const mockLogger: Logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any;

  // 创建测试配置
  const testConfig: AppConfig = {
    database: {
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      logging: false,
    },
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      collection: 'test-performance-collection',
      vectorSize: 1536,
    },
  } as AppConfig;

  // 创建内存数据源
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [Collection],
    synchronize: true,
    logging: false,
  });

  // 创建仓库实例
  const baseRepository = new BaseRepository(dataSource, mockLogger);
  const docRepository = new DocRepository(dataSource, mockLogger);
  const chunkRepository = new ChunkRepository(dataSource, mockLogger);

  // 创建服务实例
  const collectionService = new CollectionService(baseRepository, mockLogger);
  const documentService = new DocumentService(
    docRepository,
    chunkRepository,
    mockLogger,
  );
  const batchService = new BatchService(
    documentService,
    collectionService,
    mockLogger,
  );

  // 创建测试集合
  const testCollection = TestDataFactory.createCollection({
    name: 'Performance Test Collection',
    description: 'Collection for performance testing',
  });

  return {
    dataSource,
    logger: mockLogger,
    config: testConfig,
    batchService,
    collectionService,
    documentService,
    testCollection,
  };
}

/**
 * 性能测量工具
 */
export class PerformanceMeasurer {
  private measurements: Array<{
    name: string;
    duration: number;
    timestamp: number;
  }> = [];

  /**
   * 开始测量
   */
  start(name: string): () => number {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.measurements.push({
        name,
        duration,
        timestamp: Date.now(),
      });

      console.log(`[Performance] ${name}: ${duration}ms`);
      return duration;
    };
  }

  /**
   * 测量异步函数
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const endMeasurement = this.start(name);
    const result = await fn();
    const duration = endMeasurement();

    return { result, duration };
  }

  /**
   * 获取测量结果
   */
  getMeasurements(): Array<{
    name: string;
    duration: number;
    timestamp: number;
  }> {
    return [...this.measurements];
  }

  /**
   * 获取指定名称的测量结果
   */
  getMeasurementsByName(
    name: string,
  ): Array<{ duration: number; timestamp: number }> {
    return this.measurements
      .filter((m) => m.name === name)
      .map((m) => ({ duration: m.duration, timestamp: m.timestamp }));
  }

  /**
   * 计算统计信息
   */
  getStatistics(name?: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    median: number;
    p95: number;
    p99: number;
  } {
    const measurements = name
      ? this.getMeasurementsByName(name)
      : this.measurements.map((m) => ({
          duration: m.duration,
          timestamp: m.timestamp,
        }));

    if (measurements.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        p95: 0,
        p99: 0,
      };
    }

    const durations = measurements.map((m) => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / count;
    const min = durations[0];
    const max = durations[count - 1];
    const median = durations[Math.floor(count / 2)];
    const p95 = durations[Math.floor(count * 0.95)];
    const p99 = durations[Math.floor(count * 0.99)];

    return {
      count,
      total,
      average,
      min,
      max,
      median,
      p95,
      p99,
    };
  }

  /**
   * 重置测量
   */
  reset(): void {
    this.measurements = [];
  }

  /**
   * 打印统计报告
   */
  printReport(name?: string): void {
    const stats = this.getStatistics(name);
    const title = name
      ? `Performance Statistics for ${name}`
      : 'Overall Performance Statistics';

    console.log(`\n=== ${title} ===`);
    console.log(`Count: ${stats.count}`);
    console.log(`Total: ${stats.total}ms`);
    console.log(`Average: ${stats.average.toFixed(2)}ms`);
    console.log(`Min: ${stats.min}ms`);
    console.log(`Max: ${stats.max}ms`);
    console.log(`Median: ${stats.median}ms`);
    console.log(`95th percentile: ${stats.p95}ms`);
    console.log(`99th percentile: ${stats.p99}ms`);
    console.log('==================\n');
  }
}

/**
 * 内存使用监控器
 */
export class MemoryMonitor {
  private measurements: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  }> = [];

  /**
   * 记录当前内存使用情况
   */
  record(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.measurements.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
      });
    }
  }

  /**
   * 获取内存使用统计
   */
  getStatistics(): {
    count: number;
    minHeapUsed: number;
    maxHeapUsed: number;
    avgHeapUsed: number;
    minHeapTotal: number;
    maxHeapTotal: number;
    avgHeapTotal: number;
  } {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        minHeapUsed: 0,
        maxHeapUsed: 0,
        avgHeapUsed: 0,
        minHeapTotal: 0,
        maxHeapTotal: 0,
        avgHeapTotal: 0,
      };
    }

    const heapUseds = this.measurements.map((m) => m.heapUsed);
    const heapTotals = this.measurements.map((m) => m.heapTotal);

    return {
      count: this.measurements.length,
      minHeapUsed: Math.min(...heapUseds),
      maxHeapUsed: Math.max(...heapUseds),
      avgHeapUsed:
        heapUseds.reduce((sum, val) => sum + val, 0) / heapUseds.length,
      minHeapTotal: Math.min(...heapTotals),
      maxHeapTotal: Math.max(...heapTotals),
      avgHeapTotal:
        heapTotals.reduce((sum, val) => sum + val, 0) / heapTotals.length,
    };
  }

  /**
   * 打印内存使用报告
   */
  printReport(): void {
    const stats = this.getStatistics();

    console.log('\n=== Memory Usage Statistics ===');
    console.log(`Measurements: ${stats.count}`);
    console.log(
      `Heap Used - Min: ${Math.round(stats.minHeapUsed / 1024 / 1024)}MB, Max: ${Math.round(stats.maxHeapUsed / 1024 / 1024)}MB, Avg: ${Math.round(stats.avgHeapUsed / 1024 / 1024)}MB`,
    );
    console.log(
      `Heap Total - Min: ${Math.round(stats.minHeapTotal / 1024 / 1024)}MB, Max: ${Math.round(stats.maxHeapTotal / 1024 / 1024)}MB, Avg: ${Math.round(stats.avgHeapTotal / 1024 / 1024)}MB`,
    );
    console.log('===============================\n');
  }

  /**
   * 重置测量
   */
  reset(): void {
    this.measurements = [];
  }
}

/**
 * 吞吐量计算器
 */
export class ThroughputCalculator {
  /**
   * 计算吞吐量
   */
  static calculate(
    items: number,
    timeMs: number,
  ): {
    itemsPerSecond: number;
    itemsPerMinute: number;
    timePerItem: number;
  } {
    const itemsPerSecond = items / (timeMs / 1000);
    const itemsPerMinute = itemsPerSecond * 60;
    const timePerItem = timeMs / items;

    return {
      itemsPerSecond,
      itemsPerMinute,
      timePerItem,
    };
  }

  /**
   * 格式化吞吐量报告
   */
  static formatReport(
    items: number,
    timeMs: number,
    operation: string,
  ): string {
    const throughput = this.calculate(items, timeMs);

    return [
      `${operation} Performance Report:`,
      `- Items processed: ${items}`,
      `- Total time: ${timeMs}ms`,
      `- Throughput: ${throughput.itemsPerSecond.toFixed(2)} items/second`,
      `- Throughput: ${throughput.itemsPerMinute.toFixed(2)} items/minute`,
      `- Average time per item: ${throughput.timePerItem.toFixed(2)}ms`,
    ].join('\n');
  }
}
