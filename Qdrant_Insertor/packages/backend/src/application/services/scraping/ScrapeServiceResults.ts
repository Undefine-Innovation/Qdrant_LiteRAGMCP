import { Logger } from '@logging/logger.js';
import { ScrapeStatus } from '@domain/entities/scrape.js';
import { IStateMachineEngine } from '@domain/state-machine/types.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IImportService } from '@application/services/index.js';

type ResultStatus = 'PENDING' | 'IMPORTED' | 'DELETED';

type StoredScrapeResult = {
  id: string;
  taskId: string;
  url: string;
  title?: string;
  content?: string;
  links?: Array<{ url: string; text?: string; title?: string }>;
  status: ResultStatus;
  created_at: number;
  updated_at: number;
  imported_doc_id?: string | null;
  snippet?: string;
  metadata?: Record<string, unknown>;
};

export type ScrapeResultRecord = StoredScrapeResult;

/**
 * ��ȡ������������
 * ʹ���ڴ� Map �ṩ��Ҫ�Ľӿ�
 */
export class ScrapeServiceResults {
  private readonly results = new Map<string, StoredScrapeResult>();

  constructor(
    private readonly stateMachine: IStateMachineEngine,
    private readonly logger: Logger,
    private readonly sqliteRepo: ISQLiteRepo | null = null,
    private readonly importService: IImportService | null = null,
  ) {}

  private mapStatus(status: ScrapeStatus | ResultStatus): ResultStatus {
    if (status === 'IMPORTED' || status === 'PENDING' || status === 'DELETED') {
      return status;
    }
    if (status === ScrapeStatus.COMPLETED) {
      return 'IMPORTED';
    }
    return 'PENDING';
  }

  private ensureResult(id: string): StoredScrapeResult {
    if (!this.results.has(id)) {
      const record: StoredScrapeResult = {
        id,
        taskId: `task_${id}`,
        url: 'https://example.com',
        status: 'PENDING',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      this.results.set(id, record);
    }
    return this.results.get(id)!;
  }

  async getScrapeResult(id: string): Promise<StoredScrapeResult | null> {
    return this.results.get(id) ?? null;
  }

  async listScrapeResults(params?: {
    status?: ResultStatus;
    taskId?: string;
    limit?: number;
    offset?: number;
    includeContent?: boolean;
  }): Promise<StoredScrapeResult[]> {
    const all = Array.from(this.results.values());
    const filtered = all.filter((result) => {
      if (params?.status && result.status !== params.status) return false;
      if (params?.taskId && result.taskId !== params.taskId) return false;
      return true;
    });

    const start = params?.offset || 0;
    const end = params?.limit ? start + params.limit : undefined;
    return filtered.slice(start, end).map((result) => {
      if (params?.includeContent) {
        return { ...result };
      }

      const { content, snippet, ...rest } = result;
      return rest;
    });
  }

  validateScrapeResult(result: Partial<StoredScrapeResult>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!result.id) errors.push('ID����Ϊ��');
    if (!result.taskId) errors.push('taskId����Ϊ��');
    if (!result.url) errors.push('URL����Ϊ��');
    if (!result.status) errors.push('״̬����Ϊ��');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  formatScrapeResult(
    result: StoredScrapeResult,
    includeContent: boolean = false,
  ): StoredScrapeResult {
    if (includeContent) {
      return { ...result };
    }

    const { content, snippet, ...rest } = result;
    return rest as StoredScrapeResult;
  }

  async deleteScrapeResult(id: string): Promise<{ success: boolean }> {
    const existed = this.results.delete(id);
    return { success: existed };
  }

  async batchDeleteScrapeResults(
    ids: string[],
  ): Promise<{ success: boolean; deleted: number }> {
    let deleted = 0;
    for (const id of ids) {
      if (this.results.delete(id)) {
        deleted += 1;
      }
    }
    return { success: deleted === ids.length, deleted };
  }

  async importScrapeResult(
    id: string,
    collectionId: CollectionId,
    name?: string,
  ): Promise<{ success: boolean; docId?: DocId; error?: string }> {
    const result = this.results.get(id);
    if (!result) {
      return { success: false, error: 'RESULT_NOT_FOUND' };
    }

    const docId =
      (result.imported_doc_id as DocId | undefined) ||
      (`doc_${result.id}` as DocId);

    this.results.set(id, {
      ...result,
      status: 'IMPORTED',
      imported_doc_id: docId,
      updated_at: Date.now(),
    });

    return { success: true, docId };
  }

  async batchImportScrapeResults(
    taskIds: string[],
    collectionId: string,
    namePrefix?: string,
  ): Promise<{
    success: boolean;
    imported: number;
    errors?: Array<{ id: string; error: string }>;
  }> {
    let imported = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const taskId of taskIds) {
      const matches = [...this.results.values()].filter(
        (result) => result.taskId === taskId && result.status === 'PENDING',
      );

      if (matches.length === 0) {
        errors.push({ id: taskId, error: 'NO_PENDING_RESULT' });
        continue;
      }

      for (const result of matches) {
        const importResult = await this.importScrapeResult(
          result.id,
          collectionId as CollectionId,
          namePrefix,
        );
        if (importResult.success) {
          imported += 1;
        } else {
          errors.push({
            id: result.id,
            error: importResult.error || 'UNKNOWN',
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      imported,
      errors: errors.length ? errors : undefined,
    };
  }

  async getScrapeResultStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    imported: number;
    pending: number;
  }> {
    const stats = {
      total: this.results.size,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      imported: 0,
      pending: 0,
    };

    for (const result of this.results.values()) {
      stats.byStatus[result.status] = (stats.byStatus[result.status] || 0) + 1;
      const typeKey =
        (result.metadata?.taskType as string | undefined) || 'UNKNOWN';
      stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;

      if (result.status === 'IMPORTED') {
        stats.imported += 1;
      } else if (result.status === 'PENDING') {
        stats.pending += 1;
      }
    }

    return stats;
  }

  async cleanupOldScrapeResults(
    olderThanDays: number = 30,
  ): Promise<{ deleted: number }> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [id, result] of this.results.entries()) {
      if (result.updated_at < cutoff) {
        this.results.delete(id);
        deleted += 1;
      }
    }

    return { deleted };
  }

  async createScrapeResult(
    taskId: string,
    status: ScrapeStatus,
    title?: string,
    content?: string,
    links?: Array<{ url: string; text?: string; title?: string }>,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const id = `result_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: StoredScrapeResult = {
      id,
      taskId,
      url: (metadata?.url as string) || '',
      title,
      content,
      links,
      status: this.mapStatus(status),
      created_at: Date.now(),
      updated_at: Date.now(),
      snippet:
        content && content.length > 100
          ? `${content.slice(0, 100)}...`
          : content,
      metadata,
    };
    this.results.set(id, record);
    return id;
  }

  async updateScrapeResultStatus(
    id: string,
    status: ResultStatus,
  ): Promise<{ success: boolean }> {
    const result = this.results.get(id);
    if (!result) {
      return { success: false };
    }

    this.results.set(id, {
      ...result,
      status,
      updated_at: Date.now(),
    });
    return { success: true };
  }

  async searchScrapeResults(
    query: string,
    options?: {
      status?: ResultStatus;
      taskId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    results: StoredScrapeResult[];
    total: number;
    hasMore: boolean;
  }> {
    const lowerQuery = query.toLowerCase();
    const filtered = Array.from(this.results.values()).filter((result) => {
      if (options?.status && result.status !== options.status) {
        return false;
      }
      if (options?.taskId && result.taskId !== options.taskId) {
        return false;
      }
      return (
        result.title?.toLowerCase().includes(lowerQuery) ||
        result.content?.toLowerCase().includes(lowerQuery) ||
        result.url.toLowerCase().includes(lowerQuery)
      );
    });

    const offset = options?.offset || 0;
    const limit = options?.limit ?? filtered.length;
    const results = filtered.slice(offset, offset + limit);

    return {
      results,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  }

  async getScrapeResultSummary(id: string): Promise<{
    id: string;
    taskId: string;
    url: string;
    title: string;
    status: string;
    linkCount: number;
    contentLength: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const result = this.results.get(id);
    if (!result) {
      throw new Error(`��ȡ��� ${id} ������`);
    }

    return {
      id: result.id,
      taskId: result.taskId,
      url: result.url,
      title: result.title || '�ޱ���',
      status: result.status,
      linkCount: result.links?.length || 0,
      contentLength: result.content?.length || 0,
      createdAt: new Date(result.created_at).toISOString(),
      updatedAt: new Date(result.updated_at).toISOString(),
    };
  }
}
