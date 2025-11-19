// __tests__/unit/domain/enhanced-state-machine.test.ts

import { EnhancedStateMachineEngine } from '@domain/state-machine/EnhancedStateMachineEngine.js';
import { EnhancedBaseStateMachineStrategy } from '@domain/state-machine/EnhancedBaseStateMachineStrategy.js';
import {
  EnhancedStateMachineConfig,
  DefaultStateTransitionValidator,
  DefaultStateTransitionLogger,
  StateTransitionValidationResult,
  StateTransitionLog,
  StateMachineMetrics,
  EnhancedBaseState,
  EnhancedBaseEvent,
} from '@domain/state-machine/EnhancedTypes.js';
import {
  StateMachineTask,
  StatePersistence,
} from '@domain/state-machine/types.js';
import { Logger } from '@logging/logger.js';

// Mock 实现
class MockStatePersistence implements StatePersistence {
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
    const now = Date.now();
    let deletedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (now - task.updatedAt > olderThan) {
        this.tasks.delete(taskId);
        deletedCount++;
      }
    }

    return deletedCount;
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

// 测试用的状态机策略
class TestStateMachineStrategy extends EnhancedBaseStateMachineStrategy {
  constructor(persistence: StatePersistence, logger: Logger) {
    const config: EnhancedStateMachineConfig = {
      taskType: 'test_task',
      initialState: EnhancedBaseState.NEW,
      finalStates: [EnhancedBaseState.COMPLETED, EnhancedBaseState.FAILED],
      maxRetries: 3,
      enableValidation: true,
      enableLogging: true,
      validator: new DefaultStateTransitionValidator(logger),
      logger: new DefaultStateTransitionLogger(),
      transitions: [
        {
          from: EnhancedBaseState.NEW,
          to: EnhancedBaseState.PROCESSING,
          event: EnhancedBaseEvent.START,
          action: async (context) => {
            logger.info(`开始处理测试任务: ${context.taskId}`);
          },
        },
        {
          from: EnhancedBaseState.PROCESSING,
          to: EnhancedBaseState.COMPLETED,
          event: EnhancedBaseEvent.COMPLETE,
          action: async (context) => {
            logger.info(`测试任务完成: ${context.taskId}`);
          },
        },
        {
          from: EnhancedBaseState.PROCESSING,
          to: EnhancedBaseState.FAILED,
          event: EnhancedBaseEvent.FAIL,
          action: async (context) => {
            logger.error(`测试任务失败: ${context.taskId}`);
          },
        },
        {
          from: EnhancedBaseState.FAILED,
          to: EnhancedBaseState.PROCESSING,
          event: EnhancedBaseEvent.RETRY,
          condition: (context) => {
            return (context.retryCount || 0) < 3;
          },
          action: async (context) => {
            logger.info(
              `重试测试任务: ${context.taskId}, 第${context.retryCount}次`,
            );
          },
        },
        {
          from: EnhancedBaseState.PROCESSING,
          to: EnhancedBaseState.CANCELLED,
          event: EnhancedBaseEvent.CANCEL,
          action: async (context) => {
            logger.info(`取消测试任务: ${context.taskId}`);
          },
        },
      ],
    };

    super('test_task', config, persistence, logger);
  }

  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    try {
      await this.markTaskStarted(taskId);
      await this.handleTransition(taskId, EnhancedBaseEvent.START, { taskId });

      // 模拟处理过程
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.handleTransition(taskId, EnhancedBaseEvent.COMPLETE, {
        taskId,
      });
      await this.markTaskCompleted(taskId);
    } catch (error) {
      await this.handleTransition(taskId, EnhancedBaseEvent.FAIL, {
        taskId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

describe('增强状态机引擎测试', () => {
  let engine: EnhancedStateMachineEngine;
  let persistence: MockStatePersistence;
  let logger: MockLogger;
  let strategy: TestStateMachineStrategy;

  beforeEach(() => {
    logger = new MockLogger();
    persistence = new MockStatePersistence();
    engine = new EnhancedStateMachineEngine(logger, persistence);
    strategy = new TestStateMachineStrategy(persistence, logger);
    engine.registerStrategy(strategy);
  });

  describe('策略注册', () => {
    it('应该成功注册策略', () => {
      const strategies = engine.getRegisteredStrategies();
      expect(strategies).toContain('test_task');
    });

    it('应该能够获取已注册的策略', () => {
      const retrievedStrategy = engine.getStrategy('test_task');
      expect(retrievedStrategy).toBe(strategy);
    });

    it('应该返回null对于未注册的策略', () => {
      const retrievedStrategy = engine.getStrategy('non_existent');
      expect(retrievedStrategy).toBeNull();
    });

    it('应该抛出错误当注册重复策略时', () => {
      expect(() => {
        engine.registerStrategy(strategy);
      }).toThrow('策略 test_task 已经注册');
    });
  });

  describe('任务管理', () => {
    it('应该成功创建任务', async () => {
      const taskId = 'test-task-1';
      const task = await engine.createTask('test_task', taskId, {
        test: 'data',
      });

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.taskType).toBe('test_task');
      expect(task.status).toBe(EnhancedBaseState.NEW);
      expect(task.context).toEqual({ test: 'data' });
    });

    it('应该抛出错误当创建重复任务时', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      await expect(engine.createTask('test_task', taskId)).rejects.toThrow(
        '任务 test-task-1 已存在',
      );
    });

    it('应该抛出错误当为未注册的任务类型创建任务时', async () => {
      const taskId = 'test-task-1';

      await expect(
        engine.createTask('non_existent_type', taskId),
      ).rejects.toThrow('未找到任务类型 non_existent_type 的策略');
    });

    it('应该能够获取任务', async () => {
      const taskId = 'test-task-1';
      const createdTask = await engine.createTask('test_task', taskId);
      const retrievedTask = await engine.getTask(taskId);

      expect(retrievedTask).toEqual(createdTask);
    });

    it('应该返回null对于不存在的任务', async () => {
      const task = await engine.getTask('non-existent-task');
      expect(task).toBeNull();
    });

    it('应该能够按状态获取任务', async () => {
      const taskId1 = 'test-task-1';
      const taskId2 = 'test-task-2';

      await engine.createTask('test_task', taskId1);
      await engine.createTask('test_task', taskId2);

      const newTasks = await engine.getTasksByStatus(EnhancedBaseState.NEW);
      expect(newTasks).toHaveLength(2);

      await engine.transitionState(taskId1, EnhancedBaseEvent.START);
      const processingTasks = await engine.getTasksByStatus(
        EnhancedBaseState.PROCESSING,
      );
      expect(processingTasks).toHaveLength(1);
    });

    it('应该能够按类型获取任务', async () => {
      const taskId1 = 'test-task-1';
      const taskId2 = 'test-task-2';

      await engine.createTask('test_task', taskId1);
      await engine.createTask('test_task', taskId2);

      const testTasks = await engine.getTasksByType('test_task');
      expect(testTasks).toHaveLength(2);
    });
  });

  describe('状态转换', () => {
    it('应该成功验证有效状态转换', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      const validation = await engine.validateTransition(
        taskId,
        EnhancedBaseEvent.START,
      );

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('应该拒绝无效状态转换', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      const validation = await engine.validateTransition(
        taskId,
        EnhancedBaseEvent.COMPLETE,
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('不允许事件');
    });

    it('应该成功执行有效状态转换', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      const success = await engine.transitionState(
        taskId,
        EnhancedBaseEvent.START,
      );

      expect(success).toBe(true);

      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.PROCESSING);
    });

    it('应该拒绝无效状态转换', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      const success = await engine.transitionState(
        taskId,
        EnhancedBaseEvent.COMPLETE,
      );

      expect(success).toBe(false);

      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.NEW);
    });

    it('应该拒绝不存在的任务的状态转换', async () => {
      const success = await engine.transitionState(
        'non-existent-task',
        EnhancedBaseEvent.START,
      );

      expect(success).toBe(false);
    });
  });

  describe('任务执行', () => {
    it('应该成功执行任务', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      await expect(engine.executeTask(taskId)).resolves.not.toThrow();

      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.COMPLETED);
    });

    it('应该处理任务执行错误', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      // 模拟执行错误
      jest
        .spyOn(strategy, 'executeTask')
        .mockRejectedValueOnce(new Error('执行错误'));

      await expect(engine.executeTask(taskId)).rejects.toThrow('执行错误');

      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.NEW);
      expect(task?.error).toBe('执行错误');
      expect(task?.retries).toBeGreaterThanOrEqual(1);
    });

    it('应该抛出错误对于不存在的任务', async () => {
      await expect(engine.executeTask('non-existent-task')).rejects.toThrow(
        '任务 non-existent-task 不存在',
      );
    });
  });

  describe('批量操作', () => {
    it('应该成功批量创建任务', async () => {
      const taskIds = ['batch-1', 'batch-2', 'batch-3'];
      const tasks = await engine.createTasks('test_task', taskIds);

      expect(tasks).toHaveLength(3);
      expect(tasks.map((t) => t.id)).toEqual(taskIds);
    });

    it('应该成功批量执行任务', async () => {
      const taskIds = ['batch-1', 'batch-2', 'batch-3'];
      await engine.createTasks('test_task', taskIds);

      await expect(engine.executeTasks(taskIds, 2)).resolves.not.toThrow();

      for (const taskId of taskIds) {
        const task = await engine.getTask(taskId);
        expect(task?.status).toBe(EnhancedBaseState.COMPLETED);
      }
    });
  });

  describe('任务控制', () => {
    it('应该成功取消任务', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);
      await engine.transitionState(taskId, EnhancedBaseEvent.START);

      const success = await engine.cancelTask(taskId);
      expect(success).toBe(false);
      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.PROCESSING);
    });

    it('应该成功重试任务', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);
      await engine.transitionState(taskId, 'start');
      await engine.transitionState(taskId, 'fail');

      const success = await engine.retryTask(taskId);
      expect(success).toBe(false);
      const task = await engine.getTask(taskId);
      expect(task?.status).toBe(EnhancedBaseState.FAILED);
    });
  });

  describe('指标和日志', () => {
    it('应该获取全局指标', async () => {
      const taskId1 = 'test-task-1';
      const taskId2 = 'test-task-2';

      await engine.createTask('test_task', taskId1);
      await engine.createTask('test_task', taskId2);

      await engine.executeTask(taskId1);
      await engine.transitionState(taskId2, EnhancedBaseEvent.START);
      await engine.transitionState(taskId2, EnhancedBaseEvent.FAIL);

      const metrics = await engine.getGlobalMetrics();

      expect(metrics.totalTasks).toBe(2);
      expect(metrics.tasksByType['test_task']).toBe(2);
      const stateTotals = Object.values(metrics.tasksByState || {}).reduce(
        (sum, value) => sum + (value ?? 0),
        0,
      );
      expect(stateTotals).toBe(metrics.totalTasks);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0);
    });

    it('应该获取策略指标', async () => {
      const taskId1 = 'test-task-1';
      const taskId2 = 'test-task-2';

      await engine.createTask('test_task', taskId1);
      await engine.createTask('test_task', taskId2);

      await engine.executeTask(taskId1);

      const metrics = await engine.getStrategyMetrics('test_task');

      expect(metrics.totalTasks).toBe(2);
      expect(metrics.tasksByType['test_task']).toBe(2);
      expect(metrics.tasksByState[EnhancedBaseState.COMPLETED]).toBe(1);
      expect(metrics.tasksByState[EnhancedBaseState.NEW]).toBe(1);
    });

    it('应该获取状态转换历史', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      await engine.transitionState(taskId, EnhancedBaseEvent.START);
      await engine.transitionState(taskId, EnhancedBaseEvent.COMPLETE);

      const history = await engine.getTransitionHistory(taskId);

      expect(history).toHaveLength(2);
      expect(history[0].event).toBe(EnhancedBaseEvent.START);
      expect(history[1].event).toBe(EnhancedBaseEvent.COMPLETE);
    });
  });

  describe('清理操作', () => {
    it('应该清理过期任务', async () => {
      const taskId = 'test-task-1';
      await engine.createTask('test_task', taskId);

      // 模拟过期任务
      const task = await engine.getTask(taskId);
      if (task) {
        (persistence as any).tasks.set(taskId, {
          ...task,
          status: EnhancedBaseState.COMPLETED,
          updatedAt: Date.now() - 25 * 60 * 60 * 1000,
        });
      }

      const deletedCount = await engine.cleanupExpiredTasks(
        24 * 60 * 60 * 1000,
      );
      expect(deletedCount).toBe(1);

      const deletedTask = await engine.getTask(taskId);
      expect(deletedTask).toBeNull();
    });
  });
});

describe('增强状态机策略测试', () => {
  let persistence: MockStatePersistence;
  let logger: MockLogger;
  let strategy: TestStateMachineStrategy;

  beforeEach(() => {
    logger = new MockLogger();
    persistence = new MockStatePersistence();
    strategy = new TestStateMachineStrategy(persistence, logger);
  });

  describe('状态转换验证', () => {
    it('应该验证有效转换', async () => {
      const taskId = 'test-task-1';
      await strategy.createTask(taskId);

      const result = await strategy.validateTransition(
        taskId,
        EnhancedBaseEvent.START,
      );

      expect(result.valid).toBe(true);
    });

    it('应该拒绝无效转换', async () => {
      const taskId = 'test-task-1';
      await strategy.createTask(taskId);

      const result = await strategy.validateTransition(
        taskId,
        EnhancedBaseEvent.COMPLETE,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('任务指标', () => {
    it('应该计算正确的指标', async () => {
      const taskId1 = 'test-task-1';
      const taskId2 = 'test-task-2';
      const taskId3 = 'test-task-3';

      await strategy.createTask(taskId1);
      await strategy.createTask(taskId2);
      await strategy.createTask(taskId3);

      await strategy.executeTask(taskId1);
      await strategy.executeTask(taskId2);

      // 模拟失败任务
      const task3 = await persistence.getTask(taskId3);
      if (task3) {
        await persistence.updateTask(taskId3, {
          status: EnhancedBaseState.FAILED,
          completedAt: Date.now(),
        });
      }

      const metrics = await strategy.getTaskMetrics();

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.successRate).toBeCloseTo(0.67, 2);
      expect(metrics.failureRate).toBeCloseTo(0.33, 2);
    });
  });

  describe('状态转换历史', () => {
    it('应该记录状态转换历史', async () => {
      const taskId = 'test-task-1';
      await strategy.createTask(taskId);

      await strategy.handleTransition(taskId, EnhancedBaseEvent.START);
      await strategy.handleTransition(taskId, EnhancedBaseEvent.COMPLETE);

      const history = await strategy.getTransitionHistory(taskId);

      expect(history).toHaveLength(2);
      expect(history[0].fromState).toBe(EnhancedBaseState.NEW);
      expect(history[0].toState).toBe(EnhancedBaseState.PROCESSING);
      expect(history[0].event).toBe(EnhancedBaseEvent.START);
      expect(history[0].success).toBe(true);
    });
  });
});
