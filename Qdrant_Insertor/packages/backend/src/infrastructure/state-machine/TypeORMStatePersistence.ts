import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
import { StateMachineTask } from '@domain/state-machine/types.js';

/**
 * TypeORM状态持久化实现
 * 用于生产环境，提供持久化存储
 */
/**
 * TypeORM状态持久化实现
 * 用于生产环境，提供持久化存储
 */
export class TypeORMStatePersistence {
  /**
   * 构造函数
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * 保存任务状态到数据库
   * @param task 要保存的任务
   */
  async saveTask(task: StateMachineTask): Promise<void> {
    try {
      const contextJson = task.context ? JSON.stringify(task.context) : null;

      await this.dataSource.query(
        `
        INSERT OR REPLACE INTO state_machine_tasks (
          id, task_type, status, retries, last_attempt_at, error,
          created_at, updated_at, started_at, completed_at, progress, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
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
        ],
      );

      this.logger.debug(
        `保存任务状态到数据库: ${task.id}, 状态: ${task.status}`,
      );
    } catch (error) {
      this.logger.error(`保存任务状态失败: ${task.id}`, { error });
      throw error;
    }
  }

  /**
   * 从数据库获取任务状态
   * @param taskId 任务ID
   * @returns 任务状态或null
   */
  async getTask(taskId: string): Promise<StateMachineTask | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT * FROM state_machine_tasks WHERE id = ?`,
        [taskId],
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.mapRowToTask(rows[0]);
    } catch (error) {
      this.logger.error(`获取任务状态失败: ${taskId}`, { error });
      throw error;
    }
  }

  /**
   * 从数据库获取指定状态的任务列表
   * @param status 状态
   * @returns 任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT * FROM state_machine_tasks WHERE status = ? ORDER BY updated_at DESC`,
        [status],
      );

      return rows.map((row: Record<string, unknown>) => this.mapRowToTask(row));
    } catch (error) {
      this.logger.error(`获取指定状态任务列表失败: ${status}`, { error });
      throw error;
    }
  }

  /**
   * 从数据库获取指定类型的任务列表
   * @param taskType 任务类型
   * @returns 任务列表
   */
  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT * FROM state_machine_tasks WHERE task_type = ? ORDER BY updated_at DESC`,
        [taskType],
      );

      return rows.map((row: Record<string, unknown>) => this.mapRowToTask(row));
    } catch (error) {
      this.logger.error(`获取指定类型任务列表失败: ${taskType}`, { error });
      throw error;
    }
  }

  /**
   * 更新数据库中的任务状态
   * @param taskId 任务ID
   * @param updates 更新内容
   */
  async updateTask(
    taskId: string,
    updates: Partial<StateMachineTask>,
  ): Promise<void> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

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

      const query = `UPDATE state_machine_tasks SET ${fields.join(', ')} WHERE id = ?`;

      const result = await this.dataSource.query(query, values);

      if (!result || result.changes === 0) {
        throw new Error(`任务 ${taskId} 不存在`);
      }

      this.logger.debug(
        `更新任务状态到数据库: ${taskId}, 更新字段: ${Object.keys(updates).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`更新任务状态失败: ${taskId}`, { error });
      throw error;
    }
  }

  /**
   * 从数据库删除任务
   * @param taskId 任务ID
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `DELETE FROM state_machine_tasks WHERE id = ?`,
        [taskId],
      );

      if (!result || result.changes === 0) {
        throw new Error(`任务 ${taskId} 不存在`);
      }

      this.logger.debug(`从数据库删除任务: ${taskId}`);
    } catch (error) {
      this.logger.error(`删除任务失败: ${taskId}`, { error });
      throw error;
    }
  }

  /**
   * 从数据库清理过期任务
   * @param olderThan 过期时间阈值（毫秒）
   * @returns 删除的任务数量
   */
  async cleanupExpiredTasks(olderThan: number): Promise<number> {
    try {
      const now = Date.now();
      const cutoffTime = now - olderThan;

      const result = await this.dataSource.query(
        `
        DELETE FROM state_machine_tasks
        WHERE status IN (?, ?, ?)
        AND updated_at < ?
        `,
        [
          DbSyncJobStatus.COMPLETED,
          DbSyncJobStatus.FAILED,
          DbSyncJobStatus.CANCELLED,
          cutoffTime,
        ],
      );

      const deletedCount = result?.changes || 0;

      if (deletedCount > 0) {
        this.logger.info(`从数据库清理了 ${deletedCount} 个过期任务`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('清理过期任务失败', { error });
      throw error;
    }
  }

  /**
   * 初始化数据库表结构
   */
  async initializeTable(): Promise<void> {
    try {
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
        `CREATE INDEX IF NOT EXISTS idx_updated_at ON state_machine_tasks (updated_at)`,
      ];

      await this.dataSource.query(query);

      for (const indexQuery of indexQueries) {
        await this.dataSource.query(indexQuery);
      }

      this.logger.info('状态机任务表初始化完成');
    } catch (error) {
      this.logger.error('状态机任务表初始化失败', { error });
      throw error;
    }
  }

  /**
   * 将数据库行映射为StateMachineTask对象
   * @param row 数据库行对象
   * @returns StateMachineTask对象
   */
  /**
   * 将数据库行映射为StateMachineTask对象
   * @param row 数据库行对象
   * @returns StateMachineTask对象
   */
  private mapRowToTask(row: Record<string, unknown>): StateMachineTask {
    return {
      id: row.id as string,
      taskType: row.task_type as string,
      status: row.status as string,
      retries: row.retries as number,
      lastAttemptAt: row.last_attempt_at as number | undefined,
      error: row.error as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      startedAt: row.started_at as number | undefined,
      completedAt: row.completed_at as number | undefined,
      progress: (row.progress as number) || 0,
      context: row.context
        ? (JSON.parse(row.context as string) as Record<string, unknown>)
        : undefined,
    };
  }
}
