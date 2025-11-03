import type Database from 'better-sqlite3';

export type ScrapeResultRecord = {
  id: string; // `${taskId}` or generated
  taskId: string;
  url: string;
  title?: string;
  content?: string;
  links?: Array<{ url: string; text?: string; title?: string }>;
  status: 'PENDING' | 'IMPORTED' | 'DELETED';
  created_at: number;
  updated_at: number;
  imported_doc_id?: string | null;
};

type Row = {
  id: string;
  task_id: string;
  url: string;
  title?: string | null;
  content?: string | null;
  links?: string | null; // JSON
  status: string;
  created_at: number;
  updated_at: number;
  imported_doc_id?: string | null;
};

export class ScrapeResultsTable {
  constructor(private readonly db: Database.Database) {
    this.ensureTable();
  }

  private ensureTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS scrape_results (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT,
        links TEXT,
        status TEXT NOT NULL,
        imported_doc_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scrape_results_status ON scrape_results(status);
      CREATE INDEX IF NOT EXISTS idx_scrape_results_task ON scrape_results(task_id);
      CREATE INDEX IF NOT EXISTS idx_scrape_results_created ON scrape_results(created_at);
    `;
    this.db.exec(sql);
  }

  private map(row: Row): ScrapeResultRecord {
    return {
      id: row.id,
      taskId: row.task_id,
      url: row.url,
      title: row.title ?? undefined,
      content: row.content ?? undefined,
      links: row.links ? (JSON.parse(row.links) as ScrapeResultRecord['links']) : undefined,
      status: row.status as ScrapeResultRecord['status'],
      imported_doc_id: row.imported_doc_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  create(rec: Omit<ScrapeResultRecord, 'created_at' | 'updated_at'>): string {
    const now = Date.now();
    const sql = `INSERT OR REPLACE INTO scrape_results
      (id, task_id, url, title, content, links, status, imported_doc_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const stmt = this.db.prepare(sql);
    stmt.run(
      rec.id,
      rec.taskId,
      rec.url,
      rec.title ?? null,
      rec.content ?? null,
      rec.links ? JSON.stringify(rec.links) : null,
      rec.status,
      rec.imported_doc_id ?? null,
      now,
      now,
    );
    return rec.id;
  }

  getById(id: string): ScrapeResultRecord | null {
    const row = this.db.prepare(`SELECT * FROM scrape_results WHERE id = ?`).get(id) as Row | undefined;
    return row ? this.map(row) : null;
  }

  list(params?: { status?: ScrapeResultRecord['status']; taskId?: string; limit?: number; offset?: number; includeContent?: boolean }): ScrapeResultRecord[] {
    const where: string[] = [];
    const values: any[] = [];
    if (params?.status) {
      where.push('status = ?');
      values.push(params.status);
    }
    if (params?.taskId) {
      where.push('task_id = ?');
      values.push(params.taskId);
    }
    const limit = Math.max(0, params?.limit ?? 0);
    const offset = Math.max(0, params?.offset ?? 0);
    const sql = `SELECT * FROM scrape_results ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC ${limit ? 'LIMIT ?' : ''} ${limit ? 'OFFSET ?' : ''}`.trim();
    const bind = limit ? [...values, limit, offset] : values;
    const rows = this.db.prepare(sql).all(...bind) as Row[];
    const includeContent = params?.includeContent !== false ? params?.includeContent : false;
    return rows.map((r) => {
      const rec = this.map(r);
      if (!includeContent) {
        rec.content = undefined;
      }
      return rec;
    });
  }

  getTaskGroups(params?: { limit?: number; offset?: number }): Array<{
    taskId: string;
    total: number;
    pending: number;
    imported: number;
    deleted: number;
    first_at: number;
    last_at: number;
  }> {
    const limit = Math.max(0, params?.limit ?? 0);
    const offset = Math.max(0, params?.offset ?? 0);
    const sql = `
      SELECT
        task_id as taskId,
        COUNT(1) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'IMPORTED' THEN 1 ELSE 0 END) as imported,
        SUM(CASE WHEN status = 'DELETED' THEN 1 ELSE 0 END) as deleted,
        MIN(created_at) as first_at,
        MAX(created_at) as last_at
      FROM scrape_results
      GROUP BY task_id
      ORDER BY last_at DESC
      ${limit ? 'LIMIT ?' : ''}
      ${limit ? 'OFFSET ?' : ''}
    `.trim();
    const rows = this.db.prepare(sql).all(...(limit ? [limit, offset] : [])) as any[];
    return rows.map((r) => ({
      taskId: String(r.taskId),
      total: Number(r.total ?? 0),
      pending: Number(r.pending ?? 0),
      imported: Number(r.imported ?? 0),
      deleted: Number(r.deleted ?? 0),
      first_at: Number(r.first_at ?? 0),
      last_at: Number(r.last_at ?? 0),
    }));
  }

  deleteByTask(taskId: string): void {
    const now = Date.now();
    this.db
      .prepare(`UPDATE scrape_results SET status = 'DELETED', updated_at = ? WHERE task_id = ? AND status = 'PENDING'`)
      .run(now, taskId);
  }

  markImported(id: string, docId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      `UPDATE scrape_results SET status = 'IMPORTED', imported_doc_id = ?, updated_at = ? WHERE id = ?`,
    );
    stmt.run(docId, now, id);
  }

  delete(id: string): void {
    this.db.prepare(`UPDATE scrape_results SET status = 'DELETED', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  }
}
