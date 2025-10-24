import Database from 'better-sqlite3';
import { SyncJob, SyncJobStatus } from '../../../domain/sync/types.js';
import { ErrorCategory } from '../../../domain/sync/retry.js';

/**
 * 数据库行接口
 */
interface SyncJobRow {
  id: string;
  docId: string;
  status: string;
  retries: number;
  last_attempt_at?: number;
  error?: string;
  created_at: number;
  updated_at: number;
  started_at?: number;
  completed_at?: number;
  duration_ms?: number;
  error_category?: string;
  last_retry_strategy?: string;
  progress: number;
}

/**
 * 同步作业数据库访问对象
 */
export class SyncJobsTable {
  constructor(private db: Database.Database) {}

  /**
   * 创建同步作业
   */
  create(job: Omit<SyncJob, 'id'>): string {
    const id = `sync_${job.docId}_${Date.now()}`;
    const stmt = this.db.prepare(`
      INSERT INTO sync_jobs (
        id, docId, status, retries, last_attempt_at, error, 
        created_at, updated_at, started_at, error_category, 
        last_retry_strategy, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      job.docId,
      job.status,
      job.retries,
      job.lastAttemptAt || null,
      job.error || null,
      job.createdAt,
      job.updatedAt,
      null, // started_at
      null, // error_category
      null, // last_retry_strategy
      0 // progress
    );

    return id;
  }

  /**
   * 更新同步作业
   */
  update(id: string, updates: Partial<SyncJob & {
    started_at?: number;
    completed_at?: number;
    duration_ms?: number;
    error_category?: ErrorCategory;
    last_retry_strategy?: string;
    progress?: number;
  }>): boolean {
    const fields = [];
    const values = [];

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
    if (updates.started_at !== undefined) {
      fields.push('started_at = ?');
      values.push(updates.started_at);
    }
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completed_at);
    }
    if (updates.duration_ms !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.duration_ms);
    }
    if (updates.error_category !== undefined) {
      fields.push('error_category = ?');
      values.push(updates.error_category);
    }
    if (updates.last_retry_strategy !== undefined) {
      fields.push('last_retry_strategy = ?');
      values.push(updates.last_retry_strategy);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE sync_jobs 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 根据ID获取同步作业
   */
  getById(id: string): SyncJob | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_jobs WHERE id = ?
    `);
    
    const row = stmt.get(id) as SyncJobRow;
    if (!row) return null;

    return this.mapRowToSyncJob(row);
  }

  /**
   * 根据文档ID获取同步作业
   */
  getByDocId(docId: string): SyncJob | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_jobs WHERE docId = ? ORDER BY updated_at DESC LIMIT 1
    `);
    
    const row = stmt.get(docId) as SyncJobRow;
    if (!row) return null;

    return this.mapRowToSyncJob(row);
  }

  /**
   * 获取所有同步作业
   */
  getAll(limit?: number, offset?: number): SyncJob[] {
    let query = 'SELECT * FROM sync_jobs ORDER BY updated_at DESC';
    const params: (number | string)[] = [];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as SyncJobRow[];

    return rows.map(row => this.mapRowToSyncJob(row));
  }

  /**
   * 根据状态获取同步作业
   */
  getByStatus(status: SyncJobStatus, limit?: number): SyncJob[] {
    let query = 'SELECT * FROM sync_jobs WHERE status = ? ORDER BY updated_at DESC';
    const params: (string | number)[] = [status];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as SyncJobRow[];

    return rows.map(row => this.mapRowToSyncJob(row));
  }

  /**
   * 获取指定状态的作业数量
   */
  getCountByStatus(status: SyncJobStatus): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_jobs WHERE status = ?
    `);
    
    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  /**
   * 获取作业统计信息
   */
  getStats(): {
    total: number;
    byStatus: Record<SyncJobStatus, number>;
    avgDuration: number;
    successRate: number;
  } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM sync_jobs');
    const totalResult = totalStmt.get() as { count: number };

    const statusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM sync_jobs GROUP BY status
    `);
    const statusResults = statusStmt.all() as { status: SyncJobStatus; count: number }[];

    const durationStmt = this.db.prepare(`
      SELECT AVG(duration_ms) as avg_duration FROM sync_jobs 
      WHERE duration_ms IS NOT NULL
    `);
    const durationResult = durationStmt.get() as { avg_duration: number };

    const successStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'SYNCED' THEN 1 ELSE 0 END) as successful
      FROM sync_jobs
    `);
    const successResult = successStmt.get() as { total: number; successful: number };

    const byStatus: Record<SyncJobStatus, number> = {
      [SyncJobStatus.NEW]: 0,
      [SyncJobStatus.SPLIT_OK]: 0,
      [SyncJobStatus.EMBED_OK]: 0,
      [SyncJobStatus.SYNCED]: 0,
      [SyncJobStatus.FAILED]: 0,
      [SyncJobStatus.RETRYING]: 0,
      [SyncJobStatus.DEAD]: 0,
    };

    statusResults.forEach(result => {
      byStatus[result.status] = result.count;
    });

    return {
      total: totalResult.count,
      byStatus,
      avgDuration: durationResult.avg_duration || 0,
      successRate: successResult.total > 0 ? successResult.successful / successResult.total : 0,
    };
  }

  /**
   * 清理过期的同步作业
   */
  cleanup(olderThanDays: number = 7): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const stmt = this.db.prepare(`
      DELETE FROM sync_jobs 
      WHERE updated_at < ? 
      AND status IN ('SYNCED', 'DEAD')
    `);
    
    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * 将数据库行映射为SyncJob对象
   */
  private mapRowToSyncJob(row: SyncJobRow): SyncJob {
    return {
      id: row.id,
      docId: row.docId,
      status: row.status as SyncJobStatus,
      retries: row.retries,
      lastAttemptAt: row.last_attempt_at,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 检查数据库连接是否存活
   */
  ping(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}