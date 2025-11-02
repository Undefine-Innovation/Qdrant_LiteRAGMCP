// src/infrastructure/state-machine/StatePersistence.ts

import Database from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import {
  StatePersistence as IStatePersistence,
  StateMachineTask,
} from '@domain/state-machine/types.js';

/**
 * 数据库行类型定义
 */
interface TaskDatabaseRow {
  id: string;
  task_type: string;
  status: string;
  data: string;
  retries: number;
  last_attempt_at: number;
  error?: string;
  created_at: number;
  updated_at: number;
  started_at?: number;
  completed_at?: number;
  progress?: number;
  context?: string;
  error_message?: string;
}

/**
 * 内存状态持久化实现
 * 用于开发和测试环境，不提供持久化存储
 */
/**
 * 内存状态持久化实现
 * 用于开发和测试环境，不提供持久化存储
 */
export class InMemoryStatePersistence implements IStatePersistence {
  private tasks: Map<string, StateMachineTask> = new Map();

  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 保存任务状态
   * @param task 要保存的任务
   */
  async saveTask(task: StateMachineTask): Promise<void> {
    this.tasks.set(task.id, { ...task });
    this.logger.debug(`保存任务状态: ${task.id}, 状态: ${task.status}`);
  }

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务状态或null
   */
  async getTask(taskId: string): Promise<StateMachineTask | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  /**
   * 获取指定状态的任务列表
   * @param status 状态
   * @returns 任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.status === status)
      .map(task => ({ ...task }));
  }

  /**
   * 获取指定类型的任务列表
   * @param taskType 任务类型
   * @returns 任务列表
   */
  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.taskType === taskType)
      .map(task => ({ ...task }));
  }

  /**
   * 更新任务状态
   * @param taskId 任务ID
   * @param updates 更新内容
   */
  async updateTask(taskId: string, updates: Partial<StateMachineTask>): Promise<void> {
    const existingTask = this.tasks.get(taskId);
    if (!existingTask) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const updatedTask = {
      ...existingTask,
      ...updates,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    this.logger.debug(`更新任务状态: ${taskId}, 更新字段: ${Object.keys(updates).join(', ')}`);
  }

  /**
   * 删除任务
   * @param taskId 任务ID
   */
  async deleteTask(taskId: string): Promise<void> {
    const deleted = this.tasks.delete(taskId);
    if (!deleted) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    this.logger.debug(`删除任务: ${taskId}`);
  }

  /**
   * 清理过期任务
   * @param olderThan 过期时间阈值（毫秒）
   * @returns 删除的任务数量
   */
  async cleanupExpiredTasks(olderThan: number): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      // 清理已完成或失败且超过指定时间的任务
      const isFinalState = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status);
      const isExpired = now - task.updatedAt > olderThan;

      if (isFinalState && isExpired) {
        this.tasks.delete(taskId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.info(`清理了 ${deletedCount} 个过期任务`);
    }

    return deletedCount;
  }
}

/**
 * SQLite状态持久化实现
 * 用于生产环境，提供持久化存储
 */
/**
 * SQLite状态持久化实现
 * 用于生产环境，提供持久化存储
 */
export class SQLiteStatePersistence implements IStatePersistence {
  /**
   * 构造函数
   * @param db SQLite数据库实例
   * @param logger 日志记录器
   */
  /**
   * 构造函数
   * @param db SQLite数据库实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly db: Database.Database, // SQLite数据库实例
    private readonly logger: Logger
  ) {}

  /**
   * 保存任务状态到数据库
   * @param task 要保存的任务
   */
  async saveTask(task: StateMachineTask): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO state_machine_tasks (
        id, task_type, status, retries, last_attempt_at, error,
        created_at, updated_at, started_at, completed_at, progress, context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const contextJson = task.context ? JSON.stringify(task.context) : null;

    const stmt = this.db.prepare(query);
    stmt.run(
      task.id,
      task.taskType,
      task.status,
      task.retries,
      task.lastAttemptAt || null,
      task.error || null,
      task.createdAt,
      task.updatedAt,
      task.startedAt || null,
      task.completedAt || null,
      task.progress,
      contextJson,
    );

    this.logger.debug(`保存任务状态到数据库: ${task.id}, 状态: ${task.status}`);
  }

  /**
   * 从数据库获取任务状态
   * @param taskId 任务ID
   * @returns 任务状态或null
   */
  async getTask(taskId: string): Promise<StateMachineTask | null> {
    const query = `
      SELECT * FROM state_machine_tasks WHERE id = ?
    `;

    const stmt = this.db.prepare(query);
    const row = stmt.get(taskId) as TaskDatabaseRow | undefined;
    if (!row) {
      return null;
    }

    return this.mapRowToTask(row);
  }

  /**
   * 从数据库获取指定状态的任务列表
   * @param status 状态
   * @returns 任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    const query = `
      SELECT * FROM state_machine_tasks WHERE status = ? ORDER BY updated_at DESC
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(status) as TaskDatabaseRow[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 从数据库获取指定类型的任务列表
   * @param taskType 任务类型
   * @returns 任务列表
   */
  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    const query = `
      SELECT * FROM state_machine_tasks WHERE task_type = ? ORDER BY updated_at DESC
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(taskType) as TaskDatabaseRow[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 更新数据库中的任务状态
   * @param taskId 任务ID
   * @param updates 更新内容
   */
  async updateTask(taskId: string, updates: Partial<StateMachineTask>): Promise<void> {
    const fields = [];
    const values = [];

    // 构建动态更新字段
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.retries !== undefined) {
      fields.push('retries = ?');
      values.push(updates.retries);
    }
    if (updates.lastAttemptAt !== undefined) {
      fields.push('last_attempt_at = ?');
      values.push(updates.lastAttemptAt);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?');
      values.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context ? JSON.stringify(updates.context) : null);
    }

    // 添加更新时间
    fields.push('updated_at = ?');
    values.push(Date.now());

    // 添加WHERE条件
    values.push(taskId);

    const query = `
      UPDATE state_machine_tasks SET ${fields.join(', ')} WHERE id = ?
    `;

    const stmt = this.db.prepare(query);
    const result = stmt.run(values);
    if (result.changes === 0) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    this.logger.debug(`更新任务状态到数据库: ${taskId}, 更新字段: ${Object.keys(updates).join(', ')}`);
  }

  /**
   * 从数据库删除任务
   * @param taskId 任务ID
   */
  async deleteTask(taskId: string): Promise<void> {
    const query = `DELETE FROM state_machine_tasks WHERE id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(taskId);

    if (result.changes === 0) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    this.logger.debug(`从数据库删除任务: ${taskId}`);
  }

  /**
   * 从数据库清理过期任务
   * @param olderThan 过期时间阈值（毫秒）
   * @returns 删除的任务数量
   */
  async cleanupExpiredTasks(olderThan: number): Promise<number> {
    const now = Date.now();
    const cutoffTime = now - olderThan;

    const query = `
      DELETE FROM state_machine_tasks
      WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED')
      AND updated_at < ?
    `;

    const stmt = this.db.prepare(query);
    const result = stmt.run(cutoffTime);
    const deletedCount = result.changes || 0;

    if (deletedCount > 0) {
      this.logger.info(`从数据库清理了 ${deletedCount} 个过期任务`);
    }

    return deletedCount;
  }

  /**
   * 初始化数据库表结构
   */
  /**
   * 初始化数据库表结构
   */
  async initializeTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS state_machine_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL,
        retries INTEGER DEFAULT 0,
        last_attempt_at INTEGER,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        progress INTEGER DEFAULT 0,
        context TEXT
      )
    `;

    // 创建索引的查询
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_status ON state_machine_tasks (status)`,
      `CREATE INDEX IF NOT EXISTS idx_task_type ON state_machine_tasks (task_type)`,
      `CREATE INDEX IF NOT EXISTS idx_updated_at ON state_machine_tasks (updated_at)`
    ];

    this.db.exec(query);
    indexQueries.forEach(indexQuery => {
      this.db.exec(indexQuery);
    });
    
    this.logger.info('状态机任务表初始化完成');
  }

  /**
   * 将数据库行映射为StateMachineTask对象
   */
  private mapRowToTask(row: TaskDatabaseRow): StateMachineTask {
    return {
      id: row.id,
      taskType: row.task_type,
      status: row.status,
      retries: row.retries,
      lastAttemptAt: row.last_attempt_at,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      progress: row.progress || 0,
      context: row.context ? JSON.parse(row.context) : undefined,
    };
  }
}