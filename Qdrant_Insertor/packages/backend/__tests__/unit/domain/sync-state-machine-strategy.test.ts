// __tests__/unit/domain/sync-state-machine-strategy.test.ts

import { SyncStateMachineStrategy } from '@domain/state-machine/SyncStateMachineStrategy.js';
import { SyncJobStatus, SyncJobEvent } from '@domain/sync/types.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';
import { StateMachineTask } from '@domain/state-machine/types.js';

// Mock 实现
class MockStatePersistence {
  private tasks: Map<string, StateMachineTask> = new Map();

  async saveTask(task: StateMachineTask): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async getTask(taskId: string): Promise<StateMachineTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.status === status,
    );
  }

  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.taskType === taskType,
    );
  }

  async updateTask(
    taskId: string,
    updates: Partial<StateMachineTask>,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.set(taskId, { ...task, ...updates, updatedAt: Date.now() });
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async cleanupExpiredTasks(olderThan: number): Promise<number> {
    return 0;
  }
}

class MockLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }
  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }
  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

class MockSQLiteRepo {
  private docs: Map<string, any> = new Map();
  private chunks: Map<string, any[]> = new Map();

  async getDoc(docId: DocId) {
    return this.docs.get(docId);
  }

  async addChunks(docId: DocId, chunks: any[]) {
    this.chunks.set(docId, chunks);
  }

  async getChunkMetasByDocId(docId: DocId) {
    const chunks = this.chunks.get(docId) || [];
    return chunks.map((chunk, index) => ({
      docId,
      pointId: `${docId}_${index}`,
      chunkIndex: index,
      collectionId: 'test-collection' as CollectionId,
      contentHash: 'hash',
      titleChain: [],
    }));
  }

  async getChunkTexts(pointIds: string[]) {
    const result: Record<string, { content: string }> = {};
    for (const pointId of pointIds) {
      result[pointId] = { content: `Chunk content for ${pointId}` };
    }
    return result;
  }

  async markDocAsSynced(docId: DocId) {
    const doc = this.docs.get(docId);
    if (doc) {
      doc.synced = true;
    }
  }

  setDoc(docId: DocId, doc: any) {
    this.docs.set(docId, doc);
  }
}

class MockQdrantRepo {
  async upsertCollection(collectionId: CollectionId, points: any[]) {
    // Mock implementation
  }
}

class MockEmbeddingProvider {
  async generateBatch(contents: string[]): Promise<number[][]> {
    // 返回模拟的嵌入向量
    return contents.map(() =>
      Array(768)
        .fill(0)
        .map(() => Math.random()),
    );
  }
}

class MockSplitter {
  async split(content: string, options: any): Promise<string[]> {
    // 简单的分割实现
    return content.split('\n').filter((line) => line.trim().length > 0);
  }
}

describe('同步状态机策略测试', () => {
  let strategy: SyncStateMachineStrategy;
  let persistence: MockStatePersistence;
  let logger: MockLogger;
  let sqliteRepo: MockSQLiteRepo;
  let qdrantRepo: MockQdrantRepo;
  let embeddingProvider: MockEmbeddingProvider;
  let splitter: MockSplitter;

  beforeEach(() => {
    persistence = new MockStatePersistence();
    logger = new MockLogger();
    sqliteRepo = new MockSQLiteRepo();
    qdrantRepo = new MockQdrantRepo();
    embeddingProvider = new MockEmbeddingProvider();
    splitter = new MockSplitter();

    strategy = new SyncStateMachineStrategy(
      sqliteRepo,
      qdrantRepo,
      embeddingProvider,
      splitter,
      persistence,
      logger,
    );
  });

  describe('任务创建', () => {
    it('应该成功创建同步任务', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      expect(taskId).toBeDefined();
      expect(taskId).toContain('sync_test-doc-1_');

      const task = await persistence.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.taskType).toBe('document_sync');
      expect(task?.status).toBe(SyncJobStatus.NEW);
      expect(task?.context?.docId).toBe(docId);
    });

    it('应该获取同步任务状态', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      const syncJob = await strategy.getSyncTaskStatus(docId);

      expect(syncJob).toBeDefined();
      expect(syncJob?.id).toBe(taskId);
      expect(syncJob?.docId).toBe(docId);
      expect(syncJob?.status).toBe(SyncJobStatus.NEW);
    });

    it('应该返回null对于不存在的同步任务', async () => {
      const syncJob = await strategy.getSyncTaskStatus(
        'non-existent-doc' as DocId,
      );
      expect(syncJob).toBeNull();
    });
  });

  describe('状态转换验证', () => {
    it('应该验证有效的状态转换', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      const result = await strategy.validateTransition(
        taskId,
        SyncJobEvent.CHUNKS_SAVED,
      );

      expect(result.valid).toBe(true);
    });

    it('应该拒绝无效的状态转换', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      const result = await strategy.validateTransition(
        taskId,
        SyncJobEvent.VECTORS_INSERTED,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许事件');
    });
  });

  describe('任务执行', () => {
    it('应该成功执行完整的同步流程', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Test Document',
        content:
          'This is a test document\nWith multiple lines\nFor testing purposes',
        collectionId: 'test-collection' as CollectionId,
      });

      await expect(strategy.executeTask(taskId)).resolves.not.toThrow();

      const finalTask = await persistence.getTask(taskId);
      expect(finalTask?.status).toBe(SyncJobStatus.SYNCED);

      const syncJob = await strategy.getSyncTaskStatus(docId);
      expect(syncJob?.status).toBe(SyncJobStatus.SYNCED);
    });

    it('应该处理空内容的文档', async () => {
      const docId = 'empty-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置空内容文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Empty Document',
        content: '',
        collectionId: 'test-collection' as CollectionId,
      });

      await expect(strategy.executeTask(taskId)).resolves.not.toThrow();

      const finalTask = await persistence.getTask(taskId);
      expect(finalTask?.status).toBe(SyncJobStatus.SYNCED);

      const doc = await sqliteRepo.getDoc(docId);
      expect(doc?.synced).toBe(true);
    });

    it('应该处理不存在的文档', async () => {
      const docId = 'non-existent-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      await expect(strategy.executeTask(taskId)).rejects.toThrow(
        '文档 non-existent-doc 未找到',
      );
    });

    it('应该从正确的状态继续执行', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Test Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 手动转换到SPLIT_OK状态
      await strategy.handleTransition(taskId, SyncJobEvent.CHUNKS_SAVED, {
        docId,
      });

      await expect(strategy.executeTask(taskId)).resolves.not.toThrow();

      const finalTask = await persistence.getTask(taskId);
      expect(finalTask?.status).toBe(SyncJobStatus.SYNCED);
    });
  });

  describe('错误处理', () => {
    it('应该处理分割错误', async () => {
      const docId = 'error-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置会导致分割错误的文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Error Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 模拟分割错误
      jest
        .spyOn(splitter, 'split')
        .mockRejectedValueOnce(new Error('分割失败'));

      await expect(strategy.executeTask(taskId)).rejects.toThrow('分割失败');

      const task = await persistence.getTask(taskId);
      expect(task?.status).toBe(SyncJobStatus.FAILED);
    });

    it('应该处理嵌入生成错误', async () => {
      const docId = 'error-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Error Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 模拟嵌入生成错误
      jest
        .spyOn(embeddingProvider, 'generateBatch')
        .mockRejectedValueOnce(new Error('嵌入生成失败'));

      await expect(strategy.executeTask(taskId)).rejects.toThrow(
        '嵌入生成失败',
      );

      const task = await persistence.getTask(taskId);
      expect(task?.status).toBe(SyncJobStatus.FAILED);
    });

    it('应该处理Qdrant插入错误', async () => {
      const docId = 'error-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Error Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 模拟Qdrant插入错误
      jest
        .spyOn(qdrantRepo, 'upsertCollection')
        .mockRejectedValueOnce(new Error('Qdrant插入失败'));

      await expect(strategy.executeTask(taskId)).rejects.toThrow(
        'Qdrant插入失败',
      );

      const task = await persistence.getTask(taskId);
      expect(task?.status).toBe(SyncJobStatus.FAILED);
    });
  });

  describe('重试机制', () => {
    it('应该允许重试失败的任务', async () => {
      const docId = 'retry-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Retry Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 模拟第一次执行失败
      jest
        .spyOn(splitter, 'split')
        .mockRejectedValueOnce(new Error('分割失败'));

      await expect(strategy.executeTask(taskId)).rejects.toThrow('分割失败');

      // 手动重试
      const retrySuccess = await strategy.handleTransition(
        taskId,
        SyncJobEvent.RETRY,
        {
          docId,
          retryCount: 1,
        },
      );

      expect(retrySuccess).toBe(true);

      const task = await persistence.getTask(taskId);
      expect(task?.status).toBe(SyncJobStatus.RETRYING);
      expect(task?.retries).toBe(1);
    });

    it('应该限制重试次数', async () => {
      const docId = 'max-retry-doc' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      // 设置模拟文档
      sqliteRepo.setDoc(docId, {
        id: docId,
        name: 'Max Retry Document',
        content: 'Test content',
        collectionId: 'test-collection' as CollectionId,
      });

      // 模拟多次失败
      for (let i = 0; i < 3; i++) {
        await strategy.handleTransition(taskId, SyncJobEvent.ERROR, { docId });
        await strategy.handleTransition(taskId, SyncJobEvent.RETRY, {
          docId,
          retryCount: i + 1,
        });
      }

      // 尝试第4次重试应该失败
      const retrySuccess = await strategy.handleTransition(
        taskId,
        SyncJobEvent.RETRY,
        {
          docId,
          retryCount: 4,
        },
      );

      expect(retrySuccess).toBe(false);
    });
  });

  describe('任务管理', () => {
    it('应该获取所有同步任务', async () => {
      const docId1 = 'test-doc-1' as DocId;
      const docId2 = 'test-doc-2' as DocId;

      await strategy.createSyncTask(docId1);
      await strategy.createSyncTask(docId2);

      const allTasks = await strategy.getAllSyncTasks();

      expect(allTasks).toHaveLength(2);
      expect(allTasks.map((t) => t.docId)).toContain(docId1);
      expect(allTasks.map((t) => t.docId)).toContain(docId2);
    });

    it('应该按状态获取任务数量', async () => {
      const docId1 = 'test-doc-1' as DocId;
      const docId2 = 'test-doc-2' as DocId;

      const taskId1 = await strategy.createSyncTask(docId1);
      const taskId2 = await strategy.createSyncTask(docId2);

      // 转换一个任务到不同状态
      await strategy.handleTransition(taskId1, SyncJobEvent.CHUNKS_SAVED, {
        docId: docId1,
      });

      const newCount = await strategy.getSyncJobCountByStatus(
        SyncJobStatus.NEW,
      );
      const splitOkCount = await strategy.getSyncJobCountByStatus(
        SyncJobStatus.SPLIT_OK,
      );

      expect(newCount).toBe(1);
      expect(splitOkCount).toBe(1);
    });
  });

  describe('状态转换历史', () => {
    it('应该记录状态转换历史', async () => {
      const docId = 'test-doc-1' as DocId;
      const taskId = await strategy.createSyncTask(docId);

      await strategy.handleTransition(taskId, SyncJobEvent.CHUNKS_SAVED, {
        docId,
      });
      await strategy.handleTransition(taskId, SyncJobEvent.VECTORS_INSERTED, {
        docId,
      });
      await strategy.handleTransition(taskId, SyncJobEvent.META_UPDATED, {
        docId,
      });

      const history = await strategy.getTransitionHistory(taskId);

      expect(history).toHaveLength(3);
      expect(history[0].event).toBe(SyncJobEvent.CHUNKS_SAVED);
      expect(history[1].event).toBe(SyncJobEvent.VECTORS_INSERTED);
      expect(history[2].event).toBe(SyncJobEvent.META_UPDATED);
    });
  });

  describe('任务指标', () => {
    it('应该计算正确的任务指标', async () => {
      const docId1 = 'test-doc-1' as DocId;
      const docId2 = 'test-doc-2' as DocId;
      const docId3 = 'test-doc-3' as DocId;

      await strategy.createSyncTask(docId1);
      await strategy.createSyncTask(docId2);
      await strategy.createSyncTask(docId3);

      // 模拟不同的任务状态
      const taskId1 = (await strategy.getSyncTaskStatus(docId1))?.id!;
      const taskId2 = (await strategy.getSyncTaskStatus(docId2))?.id!;

      await strategy.handleTransition(taskId1, SyncJobEvent.CHUNKS_SAVED, {
        docId: docId1,
      });
      await strategy.handleTransition(taskId1, SyncJobEvent.VECTORS_INSERTED, {
        docId: docId1,
      });
      await strategy.handleTransition(taskId1, SyncJobEvent.META_UPDATED, {
        docId: docId1,
      });

      await strategy.handleTransition(taskId2, SyncJobEvent.ERROR, {
        docId: docId2,
      });

      const metrics = await strategy.getTaskMetrics();

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.tasksByState[SyncJobStatus.NEW]).toBe(1);
      expect(metrics.tasksByState[SyncJobStatus.SYNCED]).toBe(1);
      expect(metrics.tasksByState[SyncJobStatus.FAILED]).toBe(1);
      expect(metrics.successRate).toBeCloseTo(0.33, 2);
      expect(metrics.failureRate).toBeCloseTo(0.33, 2);
    });
  });
});
