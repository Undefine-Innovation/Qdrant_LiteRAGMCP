import Database from "better-sqlite3";
import {
  makeCollectionId,
  makeVersionId,
  makeDocId,
  makePointId,
  parsePointId,
  hashContent,
} from "../utils/id.js";

export interface Collection {
  collectionId: string;
  name: string;
  description?: string;
  created_at: number;
}

export interface Version {
  versionId: string;
  collectionId: string;
  name: string;
  description?: string;
  status: string;
  is_current?: boolean;
  created_at: number;
  updated_at?: number;
}

export interface Doc {
  docId: string;
  versionId: string;
  collectionId: string;
  key: string;
  name?: string;
  content: string;
  size_bytes?: number;
  mime?: string;
  created_at: number;
  updated_at?: number;
  is_deleted?: boolean;
}

export interface Chunk {
  pointId: string;
  docId: string;
  versionId: string;
  collectionId: string;
  chunkIndex: number;
  titleChain?: string;
  contentHash?: string;
  created_at: number;
  content: string;
}

export interface ChunkWithVector extends Chunk {
  vector: number[];
}

export interface SearchResult {
  pointId: string;
  content: string;
  title?: string;
  versionId: string;
  docId: string;
  chunkIndex: number;
  is_current?: boolean;
}

export class DB {
  private db: Database.Database;

  constructor(private dbPath: string) {
    this.db = new Database(dbPath);
    this.bootstrap();
  }

  public init() {
    this.bootstrap();
  }


  private bootstrap() {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");

    const tx = this.db.transaction(() => {
      this.db.exec(`
CREATE TABLE IF NOT EXISTS collections (
  collectionId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  versionId TEXT PRIMARY KEY,
  collectionId TEXT NOT NULL,
  name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'EDITING',
  is_current INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docs (
  docId TEXT PRIMARY KEY,
  versionId TEXT NOT NULL,
  key TEXT,
  name TEXT,
  content TEXT, -- 保存原始全文内容，便于直接读取
  size_bytes INTEGER,
  mime TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY(versionId) REFERENCES versions(versionId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_meta (
  pointId TEXT PRIMARY KEY,
  docId TEXT NOT NULL,
  versionId TEXT NOT NULL,
  collectionId TEXT NOT NULL,
  chunkIndex INTEGER NOT NULL,
  titleChain TEXT,
  contentHash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(docId) REFERENCES docs(docId) ON DELETE CASCADE,
  FOREIGN KEY(versionId) REFERENCES versions(versionId) ON DELETE CASCADE,
  FOREIGN KEY(collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

-- FTS5 使用外部内容，便于回表
CREATE TABLE IF NOT EXISTS chunks (
  pointId TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY(pointId) REFERENCES chunk_meta(pointId) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5
USING fts5(content, title, pointId UNINDEXED, content='' , tokenize='unicode61');
      `);
    });
    tx();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  public close() {
    this.db.close();
  }

  createCollection(name: string, description?: string): Collection {
    const collectionId = makeCollectionId();
    const createdAt = Date.now();
    const stmt = this.db.prepare(`
                INSERT INTO collections (collectionId, name, description, created_at)
                VALUES (?, ?, ?, ?)`);
    this.transaction(() => {
      stmt.run(collectionId, name, description ?? null, createdAt);
    });
    return { collectionId, name, description, created_at: createdAt };
  }
  getCollectionById(collectionId: string): Collection | null {
    const stmt = this.db.prepare(`
    SELECT * FROM collections WHERE collectionId = ?
  `);
    const row = stmt.get(collectionId);
    return row ? this.rowToCollection(row) : null;
  }

  getCollectionByName(name: string): Collection | null {
    const stmt = this.db.prepare(`
    SELECT * FROM collections WHERE name = ?
  `);
    const row = stmt.get(name);
    return row ? this.rowToCollection(row) : null;
  }

  listCollections(): Collection[] {
    const stmt = this.db.prepare(
      `SELECT * FROM collections ORDER BY created_at DESC`,
    );
    const rows = stmt.all() as Collection[];
    if (rows.length === 0) {
      console.log('listCollections: no collections found');
      return [];
    }
    return rows.map(this.rowToCollection);
  }

  updateCollection(collectionId: string, name?: string, description?: string): Collection | null {
    const existingCollection = this.getCollectionById(collectionId);
    if (!existingCollection) {
      console.warn('updateCollection: no such collectionId', collectionId);
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE collections
      SET name = COALESCE(?, name), description = COALESCE(?, description)
      WHERE collectionId = ?
    `);
    this.transaction(() => {
      stmt.run(name ?? null, description ?? null, collectionId);
    });
    return this.getCollectionById(collectionId);
  }

  deleteCollection(collectionId: string): void {
    const collection = this.getCollectionById(collectionId);
    if (!collection) {
      console.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    this.transaction(() => {
      const docsToSoftDelete = this.db
        .prepare(`SELECT docId FROM docs WHERE versionId IN (SELECT versionId FROM versions WHERE collectionId = ?)`)
        .all(collectionId) as { docId: string }[];

      for (const doc of docsToSoftDelete) {
        this.deleteDoc(doc.docId);
      }

      this.db.prepare(`DELETE FROM versions WHERE collectionId = ?`).run(collectionId);
      this.db.prepare(`DELETE FROM collections WHERE collectionId = ?`).run(collectionId);
    });
    console.log(`Collection ${collectionId} and its associated versions, docs, and chunks have been deleted.`);
  }

  createVersion(collectionId: string, name: string, description?: string): Version {
    const versionId = makeVersionId();
    const createdAt = Date.now();
    const updatedAt = createdAt;
    const stmt = this.db.prepare(`
      INSERT INTO versions (versionId, collectionId, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    this.transaction(() => {
      stmt.run(
        versionId,
        collectionId,
        name,
        description ?? null,
        'EDITING',
        createdAt,
        updatedAt,
      );
    });
    return {
      versionId,
      collectionId,
      name,
      description: description ?? undefined,
      status: 'EDITING',
      is_current: false,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }
  getVersion(versionId: string): Version | null {
    const stmt = this.db.prepare(`
      SELECT * FROM versions WHERE versionId = ?
    `);
    const row = stmt.get(versionId) as Version | undefined;
    if (!row) return null;
    return {
      versionId: row.versionId,
      collectionId: row.collectionId,
      name: row.name,
      description: row.description ?? undefined,
      status: row.status,
      is_current: !!row.is_current,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
    };
  }

  listVersions(collectionId: string): Version[] {
    const stmt = this.db.prepare(`
      SELECT * FROM versions WHERE collectionId = ? ORDER BY created_at DESC
    `);
    const rows = stmt.all(collectionId);
    return rows.map((row: any) => ({
      ...(row as Version),
      name: row.name,
      description: row.description ?? undefined,
      is_current: !!row.is_current,
      updated_at: row.updated_at ?? undefined,
    }));
  }

  setVersionStatus(versionId: string, status: Version['status']): void {
    const stmt = this.db.prepare(`
      UPDATE versions SET status = ?, updated_at = ? WHERE versionId = ?
    `);
    this.transaction(() => {
      stmt.run(status, Date.now(), versionId);
    });
  }
  setCurrentVersion(versionId: string, collectionId: string): void {
    const clearStmt = this.db.prepare(`
    UPDATE versions SET is_current = 0 WHERE collectionId = ?
  `);
    const setStmt = this.db.prepare(`
    UPDATE versions SET is_current = 1 WHERE versionId = ?
  `);

    this.transaction(() => {
      clearStmt.run(collectionId);
      setStmt.run(versionId);
    });
  }

  getCurrentVersionId(collectionId: string): string | null {
    const stmt = this.db.prepare(`
      SELECT versionId FROM versions WHERE collectionId = ? AND is_current = 1
    `);
    const row = stmt.get(collectionId) as { versionId: string } | undefined;
    console.log('getCurrentVersionId', collectionId, row);
    return row ? row.versionId : null;
  }

  deleteVersion(versionId: string): boolean {
    const version = this.getVersion(versionId);
    if (!version) {
      console.warn('deleteVersion: no such versionId', versionId);
      return false;
    }

    this.transaction(() => {
      const docIdsToDelete = this.db
        .prepare(`SELECT docId FROM docs WHERE versionId = ?`)
        .all(versionId) as { docId: string }[];

      for (const doc of docIdsToDelete) {
        this.deleteDoc(doc.docId);
      }

      this.db.prepare(`DELETE FROM versions WHERE versionId = ?`).run(versionId);
    });
    console.log(`Version ${versionId} and its associated documents and chunks have been deleted.`);
    return true;
  }
  createDoc(
    versionId: string,
    collectionId: string,
    key: string,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Doc {
    const docId = makeDocId(content);
    const size_bytes = typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength;
    const createdAt = Date.now();
    const existingDocWithSameContent = this.getDocById(docId);
    if (existingDocWithSameContent) {
      return existingDocWithSameContent;
    }

    const row = this.db
      .prepare(
        `SELECT d.*, v.collectionId FROM docs d JOIN versions v ON d.versionId = v.versionId WHERE d.versionId=? AND d.key=? AND d.is_deleted=0`,
      )
      .get(versionId, key);
    if (row) {
      return this.rowToDoc(row);
    }
    const stmt = this.db.prepare(`
        INSERT INTO docs (
        docId, versionId, key, name,
        content, size_bytes, mime,
        created_at, updated_at, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.transaction(() => {
      stmt.run(
        docId,
        versionId,
        key,
        name ?? null,
        typeof content === 'string' ? content : new TextDecoder().decode(content),
        size_bytes,
        mime === undefined ? null : mime,
        createdAt,
        createdAt,
        0,
      );
    });

    // content字段从chunks表中获取，避免返回空内容
    const contentRow = this.db.prepare(`SELECT content FROM chunks_fts5 WHERE pointId LIKE ? LIMIT 1`).get(`${docId}%`) as { content?: string } | undefined;
    const contentStr = contentRow && contentRow.content ? contentRow.content : (typeof content === 'string' ? content : new TextDecoder().decode(content));

    return {
      docId,
      versionId,
      collectionId,
      key,
      name: name ?? undefined,
      size_bytes,
      mime: mime === undefined ? undefined : mime,
      created_at: createdAt,
      updated_at: createdAt,
      is_deleted: false,
      content: contentStr,
    };
  }

  getAllDocs(): Doc[] {
    const stmt = this.db.prepare(`
      SELECT d.*, v.collectionId
      FROM docs d
      JOIN versions v ON d.versionId = v.versionId
      WHERE d.is_deleted = 0
      ORDER BY d.created_at DESC
    `);
    const rows = stmt.all();
    if (rows.length === 0) {
      console.log('getAllDocs: no documents found');
      return [];
    }
    return rows.map(this.rowToDoc);
  }

  getDocById(docId: string): Doc | null {
    const stmt = this.db.prepare(`
      SELECT * FROM docs WHERE docId = ? AND is_deleted = 0
    `);
    const row = stmt.get(docId);
    if (!row) {
      // console.error('getDocById: no such docId', docId); // 移除错误日志，避免测试噪音
      return null;
    }
    return this.rowToDoc(row);
  }

  getDocByKey(versionId: string, key: string): Doc | null {
    const row = this.db
      .prepare(
        `SELECT * FROM docs WHERE versionId=? AND key=? AND is_deleted=0`,
      )
      .get(versionId, key);
    if (!row) {
      console.error('getDocByKey: no such doc', versionId, key);
      return null;
    }
    return this.rowToDoc(row);
  }

  listDocs(versionId: string): Doc[] {
    const stmt = this.db.prepare(`
      SELECT * FROM docs WHERE versionId = ? AND is_deleted = 0
    `);
    const rows = stmt.all(versionId);
    if (rows.length === 0) {
      console.log('listDocs: no docs for versionId', versionId);
      return [];
    }
    return rows.map(this.rowToDoc.bind(this));
  }

  updateDoc(docId: string, content: string | Uint8Array, name?: string, mime?: string): Doc | null {
    const existingDoc = this.getDocById(docId);
    if (!existingDoc) {
      console.error('updateDoc: Document not found', docId);
      return null;
    }

    const newDocId = makeDocId(content);
    const size_bytes = typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength;
    const updatedAt = Date.now();

    const stmt = this.db.prepare(`
      UPDATE docs
      SET docId = ?, name = ?, content = ?, size_bytes = ?, mime = ?, updated_at = ?
      WHERE docId = ?
    `);
    const updateChunkMetaStmt = this.db.prepare(`
      UPDATE chunk_meta SET docId = ? WHERE docId = ?
    `);
    this.transaction(() => {
      // 先更新 docs 表，避免外键约束冲突
      stmt.run(
        newDocId,
        name ?? null,
        typeof content === 'string' ? content : new TextDecoder().decode(content),
        size_bytes,
        mime === undefined ? null : mime,
        updatedAt,
        docId
      );
      // 更新 chunk_meta 表中的 docId，保持一致
      updateChunkMetaStmt.run(newDocId, docId);
      // 再删除旧的 chunks，确保事务原子性
      this.deleteChunksByDoc(docId);
    });

    return this.getDocById(newDocId);
  }

  deleteDoc(docId: string): boolean {
    const doc = this.getDocById(docId);
    if (!doc) {
      console.warn('deleteDoc: no such docId', docId);
      return false;
    }

    this.transaction(() => {
      this.db.prepare(`UPDATE docs SET is_deleted = 1, updated_at = ? WHERE docId = ?`).run(Date.now(), docId);
      this.deleteChunksByDoc(docId);
    });
    return true;
  }

  getDocIdsByVersion(versionId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT docId FROM docs WHERE versionId = ? AND is_deleted = 0
    `);
    const rows = stmt.all(versionId) as { docId: string }[];
    return rows.map(row => row.docId);
  }

  insertChunkBatch(args: {
    collectionId: string;
    versionId: string;
    docId: string;
    metas: Array<{
      pointId: string;
      chunkIndex: number;
      titleChain?: string;
      contentHash?: string;
    }>;
    texts: Array<{ pointId: string; content: string; title?: string }>;
    createdAt?: number;
  }): { inserted: number } {
   const stmtMeta = this.db.prepare(`
      INSERT INTO chunk_meta (
         pointId, docId, versionId, collectionId, chunkIndex , titleChain, contentHash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pointId) DO UPDATE SET docId=excluded.docId, versionId=excluded.versionId, collectionId=excluded.collectionId, chunkIndex=excluded.chunkIndex, titleChain=excluded.titleChain, contentHash=excluded.contentHash, created_at=excluded.created_at
    `);
   const stmtChunks = this.db.prepare(`
     INSERT INTO chunks (
       content, title , pointId
     ) VALUES (?, ?, ?)
     ON CONFLICT(pointId) DO UPDATE SET content=excluded.content, title=excluded.title
   `);
   const stmtChunksFts5 = this.db.prepare(
     `INSERT INTO chunks_fts5 (content, title, pointId) VALUES (?, ?, ?)`
   );
    const createdAt = args.createdAt ?? Date.now();
    this.transaction(() => {
      if (args.metas.length !== args.texts.length) {
        throw new Error('Metas and texts length mismatch');
      }
      if (args.metas.length === 0 || args.texts.length === 0) {
        throw new Error('No metas or texts to insert');
      }
      for (let i = 0; i < args.metas.length; i++) {
        if (args.metas[i].pointId !== args.texts[i].pointId) {
          throw new Error(`PointId mismatch at index ${i}`);
        }
      }
      for (let i = 0; i < args.metas.length; i++) {
        const meta = args.metas[i];
        const text = args.texts[i];
        stmtMeta.run(
          meta.pointId,
          args.docId,
          args.versionId,
          args.collectionId,
          meta.chunkIndex,
          meta.titleChain ?? null,
          meta.contentHash ?? null,
          createdAt,
        );
        stmtChunks.run(text.content, text.title ?? null, text.pointId);
        stmtChunksFts5.run(text.content, text.title ?? null, text.pointId);
        console.log(`Inserted chunk into chunks_fts5: pointId=${text.pointId}`);
      }
    });
    return { inserted: args.metas.length };
  }

  getChunkMeta(pointId: string): Chunk | null {
    const stmt = this.db.prepare(`
      SELECT * FROM chunk_meta WHERE pointId = ?
    `);
    const row = stmt.get(pointId);
    if (!row) {
      const { docId } = parsePointId(pointId);
      console.warn(
        'getChunkMeta: no such pointId',
        pointId,
        'from docId',
        docId,
      );
      return null;
    }
    return this.rowToChunk(row);
  }
  getChunkTexts(
    pointIds: string[],
  ): Record<string, { content: string; title?: string }> | null {
    if (pointIds.length === 0) {
      return {};
    }

    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
  SELECT pointId, content, title FROM chunks WHERE pointId IN (${placeholders})
`);
    const rows = stmt.all(...pointIds) as Array<{ pointId: string; content: string; title?: string }>;

    if (rows.length === 0) {
      console.warn('getChunkTexts: no chunks found');
      return {};
    }

    return rows.reduce(
      (
        acc: Record<string, { content: string; title?: string }>,
        row: { pointId: string; content: string; title?: string },
      ) => {
        acc[row.pointId] = {
          content: row.content,
          title: row.title ?? undefined,
        };
        return acc;
      },
      {} as Record<string, { content: string; title?: string }>,
    );
  }
  getChunkMetasByVersion(versionId: string): Chunk[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chunk_meta WHERE versionId = ? ORDER BY chunkIndex ASC
    `);
    const rows = stmt.all(versionId);
    if (rows.length === 0) {
      console.warn(
        'getChunkMetasByVersion: no chunks found for versionId',
        versionId)
      return [];
    }
    return rows.map(this.rowToChunk.bind(this));
  }
  deleteChunksByDoc(docId: string): void {
    let ids = this.db
      .prepare(`SELECT pointId FROM chunk_meta WHERE docId=?`)
      .all(docId) as { pointId: string }[];
    if (ids.length === 0) {
      // 容错，防止脏数据导致删除失败
      ids = this.db
        .prepare(`SELECT pointId FROM chunks_fts5 WHERE pointId LIKE ?`)
        .all(`${docId}%`) as { pointId: string }[];
      if (ids.length === 0) {
        console.warn('deleteChunksByDoc: no chunks for', docId);
        return;
      }
    }
    const pointIds = ids.map((r) => r.pointId);
    const ph = pointIds.map(() => '?').join(',');

    const delChunks = this.db.prepare(
      `DELETE FROM chunks WHERE pointId IN (${ph})`,
    );
    const delMeta = this.db.prepare(`DELETE FROM chunk_meta WHERE docId=?`);

    this.transaction(() => {
      delChunks.run(...pointIds);
      delMeta.run(docId);
    });
  }

  searchKeyword(params: {
    collectionId: string;
    query: string;
    limit?: number;
    latestOnly?: boolean;
    filters?: { [key: string]: any };
  }): SearchResult[] {
    const limit = params.limit ?? 10;
    // 参数顺序：collectionId, MATCH 查询词, 其他过滤参数..., limit
    // 为避免查询词恰好为 FTS5 解析为列名（如 “match”）导致报错，将其包裹双引号
    const safeQuery =
      `"${params.query.replace(/"/g, '""')}"`; // 内部双引号转义
    const queryParams: any[] = [params.collectionId, safeQuery];
    let filterSql = '';

    if (params.filters) {
      for (const key in params.filters) {
        if (Object.prototype.hasOwnProperty.call(params.filters, key)) {
          if (['versionId', 'docId', 'collectionId', 'chunkIndex'].includes(key)) {
            filterSql += ` AND chunk_meta.${key} = ?`;
            queryParams.push(params.filters[key]);
          } else if (key === 'status') {
            filterSql += ` AND versions.${key} = ?`;
            queryParams.push(params.filters[key]);
          }
        }
      }
    }

    const sql = `
    SELECT
      chunk_meta.pointId,
      chunks_fts5.content,
      chunks_fts5.title,
      chunk_meta.versionId,
      chunk_meta.docId,
      chunk_meta.chunkIndex,
      versions.is_current
    FROM chunks_fts5
    JOIN chunk_meta ON chunks_fts5.pointId = chunk_meta.pointId
    JOIN versions   ON chunk_meta.versionId = versions.versionId
    JOIN docs       ON chunk_meta.docId = docs.docId
    WHERE chunk_meta.collectionId = ?
      AND docs.is_deleted = 0
      AND chunks_fts5 MATCH (?)
      ${params.latestOnly ? 'AND versions.is_current = 1' : ''}
      ${filterSql}
    ORDER BY bm25(chunks_fts5) ASC
    LIMIT ?
  `;
    // 末尾追加 limit
    queryParams.push(limit);

    let rows: any[] = [];
    try {
      const stmt = this.db.prepare(sql);
      rows = stmt.all(...queryParams);
    } catch (err: any) {
      console.error('searchKeyword SQL error:', err.message, sql, queryParams);
      throw err;
    }

    if (rows.length === 0) {
      console.log('searchKeyword: no results for query', params.query);
      return [];
    }

    return rows.map((row: any) => ({
      ...(row as SearchResult),
      is_current: !!row.is_current,
    }));
  }

  getChunksByPointIds(
    pointIds: string[],
    collectionId: string,
    latestOnly: boolean = false,
  ): SearchResult[] {
    if (pointIds.length === 0) {
      return [];
    }

    const placeholders = pointIds.map(() => '?').join(',');
    const sql = `
      SELECT
        cm.pointId,
        c.content,
        c.title,
        cm.versionId,
        cm.docId,
        cm.chunkIndex,
        v.is_current
      FROM chunk_meta cm
      JOIN chunks_fts5 c ON cm.pointId = c.pointId
      JOIN versions v ON cm.versionId = v.versionId
      JOIN docs d ON cm.docId = d.docId
      WHERE cm.pointId IN (${placeholders})
        AND cm.collectionId = ?
        AND d.is_deleted = 0
        ${latestOnly ? 'AND v.is_current = 1' : ''}
      ORDER BY cm.chunkIndex ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...pointIds, collectionId);

    return rows.map((row: any) => ({
      ...(row as SearchResult),
      is_current: !!row.is_current,
    }));
  }

  finalizeVersion(temporaryVersionId: string): { finalVersionId: string; isNew: boolean } {
    const docIds = this.getDocIdsByVersion(temporaryVersionId);
    docIds.sort();
    const combinedDocIds = docIds.join('|');
    const finalVersionId = hashContent(combinedDocIds);

    const existingVersion = this.getVersion(finalVersionId);

    if (existingVersion) {
      this.transaction(() => {
        this.db.prepare(`UPDATE docs SET versionId = ?, updated_at = ? WHERE versionId = ?`)
          .run(finalVersionId, Date.now(), temporaryVersionId);

        this.db.prepare(`UPDATE chunk_meta SET versionId = ? WHERE versionId = ?`)
          .run(finalVersionId, temporaryVersionId);

        this.db.prepare(`DELETE FROM versions WHERE versionId = ?`)
          .run(temporaryVersionId);
      });
      return { finalVersionId, isNew: false };
    } else {
      this.transaction(() => {
        // 先插入新版本记录，确保外键约束通过
        const tempVersion = this.getVersion(temporaryVersionId);
        if (!tempVersion) {
          throw new Error(`Version ${temporaryVersionId} does not exist`);
        }
        const createdAt = tempVersion.created_at;
        const updatedAt = Date.now();
        this.db.prepare(`
          INSERT INTO versions (versionId, collectionId, name, description, status, is_current, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(finalVersionId, tempVersion.collectionId, tempVersion.name, tempVersion.description, 'ACTIVE', 0, createdAt, updatedAt);

        // 更新 docs 表 versionId
        this.db.prepare(`UPDATE docs SET versionId = ? WHERE versionId = ?`)
          .run(finalVersionId, temporaryVersionId);
        // 更新 chunk_meta 表 versionId
        this.db.prepare(`UPDATE chunk_meta SET versionId = ? WHERE versionId = ?`)
          .run(finalVersionId, temporaryVersionId);
        // 删除临时版本
        this.db.prepare(`DELETE FROM versions WHERE versionId = ?`)
          .run(temporaryVersionId);
      });
      return { finalVersionId, isNew: true };
    }
  }

  private rowToCollection(row: any): Collection {
    return {
      collectionId: row.collectionId,
      name: row.name,
      description: row.description ?? undefined,
      created_at: row.created_at,
    };
  }

  private rowToDoc(row: any): Doc {
    return {
      docId: row.docId,
      versionId: row.versionId,
      collectionId: row.collectionId ?? (
        // docs 表无 collectionId 字段时，尝试通过 versionId 反查
        (() => {
          try {
            const v = this.db.prepare('SELECT collectionId FROM versions WHERE versionId = ?').get(row.versionId) as { collectionId?: string } | undefined;
            return v && v.collectionId ? v.collectionId : undefined;
          } catch {
            return undefined;
          }
        })()
      ),
      key: row.key,
      name: row.name ?? undefined,
      content: row.content ?? '',
      size_bytes: row.size_bytes ?? undefined,
      mime: row.mime ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
      is_deleted: !!row.is_deleted,
    };
  }

  private rowToChunk(row: any): Chunk {
    const contentRow = this.db.prepare(`SELECT content FROM chunks_fts5 WHERE pointId = ?`).get(row.pointId) as { content: string } | undefined;
    const content = contentRow ? contentRow.content : '';

    return {
      pointId: row.pointId,
      docId: row.docId,
      versionId: row.versionId,
      collectionId: row.collectionId,
      chunkIndex: row.chunkIndex,
      titleChain: row.titleChain ?? undefined,
      contentHash: row.contentHash ?? undefined,
      created_at: row.created_at,
      content: content,
    };
  }

  stats(): {
    collections: number;
    versions: number;
    docs: number;
    chunks: number;
  } {
    const collections = this.db.prepare(`SELECT COUNT(*) FROM collections`).get() as { 'COUNT(*)': number };
    const versions = this.db.prepare(`SELECT COUNT(*) FROM versions`).get() as { 'COUNT(*)': number };
    const docs = this.db.prepare(`SELECT COUNT(*) FROM docs WHERE is_deleted = 0`).get() as { 'COUNT(*)': number };
    const chunks = this.db.prepare(`SELECT COUNT(*) FROM chunk_meta`).get() as { 'COUNT(*)': number };
    return {
      collections: collections['COUNT(*)'],
      versions: versions['COUNT(*)'],
      docs: docs['COUNT(*)'],
      chunks: chunks['COUNT(*)'],
    };
  }

  ping(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (e) {
      console.error('Database ping failed:', e);
      return false;
    }
  }
}
