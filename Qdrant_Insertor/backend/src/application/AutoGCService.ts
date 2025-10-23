import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';
import { Logger } from '../logger.js'; // 确保导入的是 .js 文件
import { AppConfig } from '../config.js';
import { CollectionId, PointId, ChunkMeta } from '@domain/types.js';

export class AutoGCService {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly config: AppConfig,
  ) {}

  /**
   * 执行垃圾回收任务。
   * 包括双端比对、删除孤儿向量、删除无关元数据和清理历史垃圾。
   */
  public async runGC(): Promise<void> {
    this.logger.info('AutoGCService: 开始执行垃圾回收...');
    try {
      const collectionIds = await this.sqliteRepo.getAllCollectionIds();
      this.logger.info(
        `AutoGCService: 发现 ${collectionIds.length} 个集合进行垃圾回收。`,
      );

      for (const collectionId of collectionIds) {
        this.logger.info(
          `AutoGCService: 处理集合 ${collectionId} 的垃圾回收。`,
        );
        await this.processCollectionGC(collectionId);
      }

      await this.cleanupDeletedDocs();

      this.logger.info('AutoGCService: 垃圾回收完成。');
    } catch (error) {
      this.logger.error(
        `AutoGCService: 垃圾回收过程中发生错误: ${(error as Error).message}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * 处理单个集合的垃圾回收。
   * @param collectionId - 要处理的集合 ID。
   */
  private async processCollectionGC(collectionId: CollectionId): Promise<void> {
    this.logger.info(`AutoGCService: 对集合 ${collectionId} 执行双端比对。`);

    // 1. 从 SQLite 获取所有 pointId
    const sqliteChunkMetas =
      this.sqliteRepo.chunkMeta.listByCollectionId(collectionId);
    const sqlitePointIds = new Set(
      sqliteChunkMetas.map((cm: ChunkMeta) => cm.pointId),
    );
    this.logger.info(
      `AutoGCService: SQLite 中集合 ${collectionId} 有 ${sqlitePointIds.size} 个块元数据。`,
    );

    // 2. 从 Qdrant 获取所有 pointId
    const qdrantPointIds = new Set(
      await this.qdrantRepo.getAllPointIdsInCollection(collectionId),
    );
    this.logger.info(
      `AutoGCService: Qdrant 中集合 ${collectionId} 有 ${qdrantPointIds.size} 个向量。`,
    );

    // 3. 比对并识别孤儿数据
    const orphanQdrantPointIds: PointId[] = []; // Qdrant 中有，SQLite 中没有
    for (const qdrantId of qdrantPointIds) {
      if (!sqlitePointIds.has(qdrantId)) {
        orphanQdrantPointIds.push(qdrantId);
      }
    }

    const orphanSqlitePointIds: PointId[] = []; // SQLite 中有，Qdrant 中没有
    for (const sqliteId of sqlitePointIds) {
      if (!qdrantPointIds.has(sqliteId)) {
        orphanSqlitePointIds.push(sqliteId);
      }
    }

    // 4. 执行清理操作
    if (orphanQdrantPointIds.length > 0) {
      this.logger.info(
        `AutoGCService: 发现 ${orphanQdrantPointIds.length} 个孤儿向量，正在从 Qdrant 删除。`,
      );
      await this.qdrantRepo.deletePoints(collectionId, orphanQdrantPointIds);
    } else {
      this.logger.info('AutoGCService: 未发现孤儿向量。');
    }

    if (orphanSqlitePointIds.length > 0) {
      this.logger.info(
        `AutoGCService: 发现 ${orphanSqlitePointIds.length} 个无关元数据，正在从 SQLite 删除。`,
      );
      this.sqliteRepo.transaction(() => {
        this.sqliteRepo.chunkMeta.deleteBatch(orphanSqlitePointIds);
        this.sqliteRepo.chunksFts5.deleteBatch(orphanSqlitePointIds);
      });
    } else {
      this.logger.info('AutoGCService: 未发现孤儿元数据。');
    }
  }

  /**
   * 清理所有标记为已删除的文档及其关联数据。
   */
  private async cleanupDeletedDocs(): Promise<void> {
    this.logger.info('AutoGCService: 开始清理已删除的文档。');
    const deletedDocs = this.sqliteRepo.docs.listDeletedDocs();
    if (deletedDocs.length === 0) {
      this.logger.info('AutoGCService: 未发现已删除的文档。');
      return;
    }

    for (const doc of deletedDocs) {
      this.logger.info(`AutoGCService: 清理文档 ${doc.docId} (已删除)。`);
      try {
        const chunkMetas = this.sqliteRepo.chunkMeta.listByDocId(doc.docId);
        const pointIdsToDelete = chunkMetas.map((cm) => cm.pointId);

        if (pointIdsToDelete.length > 0) {
          this.logger.info(
            `AutoGCService: 从 Qdrant 删除文档 ${doc.docId} 的 ${pointIdsToDelete.length} 个向量。`,
          );
          await this.qdrantRepo.deletePoints(
            doc.collectionId,
            pointIdsToDelete,
          );
        } else {
          this.logger.info(
            `AutoGCService: 文档 ${doc.docId} 没有关联的块元数据，跳过 Qdrant 删除。`,
          );
        }

        this.sqliteRepo.transaction(() => {
          if (pointIdsToDelete.length > 0) {
            this.logger.info(
              `AutoGCService: 从 SQLite 删除文档 ${doc.docId} 的 ${pointIdsToDelete.length} 个块元数据和 FTS 索引。`,
            );
            this.sqliteRepo.chunkMeta.deleteBatch(pointIdsToDelete);
            this.sqliteRepo.chunksFts5.deleteBatch(pointIdsToDelete);
          }
          this.logger.info(`AutoGCService: 硬删除文档 ${doc.docId} 的记录。`);
          this.sqliteRepo.docs.hardDelete(doc.docId);
        });
        this.logger.info(`AutoGCService: 文档 ${doc.docId} 清理完成。`);
      } catch (error) {
        this.logger.error(
          `AutoGCService: 清理文档 ${doc.docId} 时发生错误: ${(error as Error).message}`,
          { docId: doc.docId, error },
        );
      }
    }
    this.logger.info('AutoGCService: 已删除文档清理完成。');
  }
}
