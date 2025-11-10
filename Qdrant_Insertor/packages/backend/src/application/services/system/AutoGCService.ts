import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IAutoGCService } from '@domain/repositories/IAutoGCService.js';
import { Logger } from '@logging/logger.js'; // 确保导入的是 .js 文件
import { AppConfig } from '@config/config.js';
import { CollectionId, PointId, ChunkMeta } from '@domain/entities/types.js';

/**
 * 自动垃圾回收服务实现
 * 负责清理孤儿向量和无关元数据
 */
export class AutoGCService implements IAutoGCService {
  /**
   * 创建自动垃圾回收服务实例
   * @param sqliteRepo SQLite 仓库实例
   * @param qdrantRepo Qdrant 仓库实例
   * @param logger 日志记录器
   * @param config 应用配置
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly config: AppConfig,
  ) {}

  /**
   * 执行垃圾回收任务
   * 包括双端比对、删除孤儿向量、删除无关元数据和清理历史垃圾
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

      this.logger.info('AutoGCService: 垃圾回收完成');
    } catch (error) {
      this.logger.error(
        `AutoGCService: 垃圾回收过程中发生错误: ${(error as Error).message}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * 处理单个集合的垃圾回收
   * @param collectionId - 要处理的集合 ID
   */
  private async processCollectionGC(collectionId: CollectionId): Promise<void> {
    this.logger.info(`AutoGCService: 对集合${collectionId} 执行双端比对。`);

    // 1. 从 SQLite 获取所有 pointId
    const sqliteChunkMetas =
      await this.sqliteRepo.getChunkMetasByCollectionId(collectionId);
    const sqlitePointIds = new Set(
      sqliteChunkMetas.map((cm: ChunkMeta) => cm.pointId),
    );
    this.logger.info(
      `AutoGCService: SQLite 中集合${collectionId}有${sqlitePointIds.size} 个块元数据。`,
    );

    // 2. 从 Qdrant 获取所有 pointId
    const qdrantPointIds = new Set(
      await this.qdrantRepo.getAllPointIdsInCollection(collectionId),
    );
    this.logger.info(
      `AutoGCService: Qdrant 中集合${collectionId}有${qdrantPointIds.size} 个向量。`,
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
      if (!qdrantPointIds.has(sqliteId as PointId)) {
        orphanSqlitePointIds.push(sqliteId as PointId);
      }
    }

    // 4. 执行清理操作
    if (orphanQdrantPointIds.length > 0) {
      this.logger.info(
        `AutoGCService: 发现 ${orphanQdrantPointIds.length} 个孤儿向量，正在从 Qdrant 删除。`,
      );
      await this.qdrantRepo.deletePoints(collectionId, orphanQdrantPointIds);
    } else {
      this.logger.info('AutoGCService: 未发现孤儿向量');
    }

    if (orphanSqlitePointIds.length > 0) {
      this.logger.info(
        `AutoGCService: 发现 ${orphanSqlitePointIds.length} 个无关元数据，正在从 SQLite 删除。`,
      );
      await this.sqliteRepo.asyncTransaction(async () => {
        await this.sqliteRepo.deleteBatch(orphanSqlitePointIds);
      });
    } else {
      this.logger.info('AutoGCService: 未发现孤儿元数据');
    }
  }

  /**
   * 清理所有标记为已删除的文档及其关联数据
   */
  private async cleanupDeletedDocs(): Promise<void> {
    this.logger.info('AutoGCService: 开始清理已删除的文档');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deletedDocs = await (this.sqliteRepo.docs as any).findDeleted();
    if (deletedDocs.length === 0) {
      this.logger.info('AutoGCService: 未发现已删除的文档');
      return;
    }

    for (const doc of deletedDocs) {
      this.logger.info(`AutoGCService: 清理文档 ${doc.id} (已删除)`);
      try {
        const chunkMetas = await this.sqliteRepo.getChunkMetasByDocId(doc.id);
        const pointIdsToDelete = chunkMetas.map((cm: ChunkMeta) => cm.pointId);

        if (pointIdsToDelete.length > 0) {
          this.logger.info(
            `AutoGCService: 从 Qdrant 删除文档 ${doc.id} 的 ${pointIdsToDelete.length} 个向量。`,
          );
          await this.qdrantRepo.deletePoints(
            doc.collectionId,
            pointIdsToDelete,
          );
        } else {
          this.logger.info(
            `AutoGCService: 文档 ${doc.id} 没有关联的块元数据，跳过 Qdrant 删除。`,
          );
        }

        await this.sqliteRepo.asyncTransaction(async () => {
          if (pointIdsToDelete.length > 0) {
            this.logger.info(
              `AutoGCService: 从 SQLite 删除文档 ${doc.id} 的 ${pointIdsToDelete.length} 个块元数据和 FTS 索引。`,
            );
            await this.sqliteRepo.deleteBatch(pointIdsToDelete);
          }
          this.logger.info(`AutoGCService: 硬删除文档${doc.id} 的记录。`);
          await this.sqliteRepo.asyncDeleteDoc(doc.id);
        });
        this.logger.info(`AutoGCService: 文档 ${doc.id} 清理完成。`);
      } catch (error) {
        this.logger.error(
          `AutoGCService: 清理文档 ${doc.id} 时发生错误: ${(error as Error).message}`,
          { docId: doc.id, error },
        );
      }
    }
    this.logger.info('AutoGCService: 已删除文档清理完成');
  }
}
