/**
 * 简化状态机测试
 * 验证简化后的状态机功能正确性
 */

import {
  SimplifiedSyncStateMachine,
  SyncStatus,
} from '../../../../src/domain/sync/SimplifiedSyncStateMachine.js';
import { Logger } from '@logging/logger.js';

// Mock logger for testing
const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('SimplifiedSyncStateMachine', () => {
  let stateMachine: SimplifiedSyncStateMachine;
  let docId: string;

  beforeEach(() => {
    stateMachine = new SimplifiedSyncStateMachine(mockLogger);
    docId = 'test-doc-123';
  });

  describe('基本状态管理', () => {
    test('应该创建新任务', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      expect(task).toBeDefined();
      expect(task.status).toBe(SyncStatus.NEW);
      expect(task.retries).toBe(0);
      expect(task.docId).toBe(docId);
    });

    test('应该返回已存在的任务', () => {
      const task1 = stateMachine.getOrCreateTask(docId as any);
      const task2 = stateMachine.getOrCreateTask(docId as any);

      expect(task1.id).toBe(task2.id);
      expect(task1).toBe(task2);
    });
  });

  describe('状态转换', () => {
    test('应该允许有效的状态转换', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      // NEW -> SPLIT_OK
      const result1 = stateMachine.transitionState(
        docId as any,
        SyncStatus.SPLIT_OK,
      );
      expect(result1).toBe(true);
      expect(task.status).toBe(SyncStatus.SPLIT_OK);

      // SPLIT_OK -> EMBED_OK
      const result2 = stateMachine.transitionState(
        docId as any,
        SyncStatus.EMBED_OK,
      );
      expect(result2).toBe(true);
      expect(task.status).toBe(SyncStatus.EMBED_OK);

      // EMBED_OK -> SYNCED
      const result3 = stateMachine.transitionState(
        docId as any,
        SyncStatus.SYNCED,
      );
      expect(result3).toBe(true);
      expect(task.status).toBe(SyncStatus.SYNCED);
    });

    test('应该拒绝无效的状态转换', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      // 尝试无效转换：NEW -> SYNCED
      const result = stateMachine.transitionState(
        docId as any,
        SyncStatus.SYNCED,
      );
      expect(result).toBe(false);
      expect(task.status).toBe(SyncStatus.NEW); // 状态不应改变
    });

    test('应该处理错误状态转换', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      // NEW -> FAILED
      const result1 = stateMachine.transitionState(
        docId as any,
        SyncStatus.FAILED,
        'Test error',
      );
      expect(result1).toBe(true);
      expect(task.status).toBe(SyncStatus.FAILED);
      expect(task.error).toBe('Test error');

      // FAILED -> RETRYING
      const result2 = stateMachine.transitionState(
        docId as any,
        SyncStatus.RETRYING,
      );
      expect(result2).toBe(true);
      expect(task.status).toBe(SyncStatus.RETRYING);
      expect(task.retries).toBe(1);
      expect(task.lastAttemptAt).toBeDefined();
    });
  });

  describe('重试逻辑', () => {
    test('应该正确判断是否可以重试', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      // 初始状态应该可以重试
      stateMachine.transitionState(docId as any, SyncStatus.FAILED);
      expect(stateMachine.canRetry(docId as any)).toBe(true);

      // 模拟3次重试
      for (let i = 0; i < 3; i++) {
        stateMachine.transitionState(docId as any, SyncStatus.RETRYING);
        stateMachine.transitionState(docId as any, SyncStatus.FAILED);
      }

      // 超过重试次数后不应该可以重试
      expect(stateMachine.canRetry(docId as any)).toBe(false);
    });

    test('应该正确判断是否应该标记为DEAD', () => {
      const task = stateMachine.getOrCreateTask(docId as any);

      // 初始失败状态不应该标记为DEAD
      stateMachine.transitionState(docId as any, SyncStatus.FAILED);
      expect(stateMachine.shouldMarkAsDead(docId as any)).toBe(false);

      // 模拟3次重试
      for (let i = 0; i < 3; i++) {
        stateMachine.transitionState(docId as any, SyncStatus.RETRYING);
        stateMachine.transitionState(docId as any, SyncStatus.FAILED);
      }

      // 超过重试次数后应该标记为DEAD
      expect(stateMachine.shouldMarkAsDead(docId as any)).toBe(true);
    });
  });

  describe('任务查询', () => {
    beforeEach(() => {
      // 清理之前的状态机实例
      stateMachine = new SimplifiedSyncStateMachine(mockLogger);

      // 创建多个不同状态的任务
      const docIds = ['doc1', 'doc2', 'doc3', 'doc4'];
      docIds.forEach((id, index) => {
        const task = stateMachine.getOrCreateTask(id as any);

        // 按照状态转换规则进行转换
        if (index === 0) {
          // doc1: NEW -> SPLIT_OK
          const result = stateMachine.transitionState(
            id as any,
            SyncStatus.SPLIT_OK,
          );
          expect(result).toBe(true);
        }
        if (index === 1) {
          // doc2: NEW -> SPLIT_OK -> EMBED_OK
          stateMachine.transitionState(id as any, SyncStatus.SPLIT_OK);
          const result = stateMachine.transitionState(
            id as any,
            SyncStatus.EMBED_OK,
          );
          expect(result).toBe(true);
        }
        if (index === 2) {
          // doc3: NEW -> SPLIT_OK -> EMBED_OK -> SYNCED
          stateMachine.transitionState(id as any, SyncStatus.SPLIT_OK);
          stateMachine.transitionState(id as any, SyncStatus.EMBED_OK);
          const result = stateMachine.transitionState(
            id as any,
            SyncStatus.SYNCED,
          );
          expect(result).toBe(true);
        }
        if (index === 3) {
          // doc4: NEW -> FAILED
          const result = stateMachine.transitionState(
            id as any,
            SyncStatus.FAILED,
          );
          expect(result).toBe(true);
        }
      });
    });

    test('应该正确统计各状态的任务数量', () => {
      const stats = stateMachine.getStats();

      expect(stats[SyncStatus.NEW]).toBe(0); // 没有NEW状态的任务
      expect(stats[SyncStatus.SPLIT_OK]).toBe(1);
      expect(stats[SyncStatus.EMBED_OK]).toBe(1);
      expect(stats[SyncStatus.SYNCED]).toBe(1);
      expect(stats[SyncStatus.FAILED]).toBe(1);
    });

    test('应该返回所有任务', () => {
      const allTasks = stateMachine.getAllTasks();
      expect(allTasks).toHaveLength(4); // 4个测试任务
    });

    test('应该返回指定状态的任务数量', () => {
      const count = stateMachine.getTaskCountByStatus(SyncStatus.SYNCED);
      expect(count).toBe(1);
    });
  });

  describe('任务清理', () => {
    test('应该清理已完成的任务', () => {
      // 创建新的状态机实例以避免干扰其他测试
      const cleanupStateMachine = new SimplifiedSyncStateMachine(mockLogger);
      const cleanupDocId = 'cleanup-test-doc';

      const task = cleanupStateMachine.getOrCreateTask(cleanupDocId as any);

      // 标记为已完成 (需要按照状态转换规则)
      cleanupStateMachine.transitionState(
        cleanupDocId as any,
        SyncStatus.SPLIT_OK,
      );
      cleanupStateMachine.transitionState(
        cleanupDocId as any,
        SyncStatus.EMBED_OK,
      );
      const transitionResult = cleanupStateMachine.transitionState(
        cleanupDocId as any,
        SyncStatus.SYNCED,
      );
      expect(transitionResult).toBe(true);

      // 模拟时间过去（超过24小时）
      task.updatedAt = Date.now() - 25 * 60 * 60 * 1000; // 25小时前

      cleanupStateMachine.cleanupCompletedTasks();

      // 任务应该被清理
      const cleanedTask = cleanupStateMachine.getTaskStatus(
        cleanupDocId as any,
      );
      expect(cleanedTask).toBeUndefined();
    });
  });
});
