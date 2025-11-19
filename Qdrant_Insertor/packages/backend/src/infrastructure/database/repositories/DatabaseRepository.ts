import {
  DataSource,
  Repository,
  EntityTarget,
  DeepPartial,
  FindOptionsWhere,
  FindOptionsOrder,
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AbstractRepository } from './AbstractRepository.js';
import {
  IDatabaseRepository,
  DatabaseConfig,
  ITransactionContext,
} from '@domain/repositories/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * 数据库仓库抽象类
 * 扩展AbstractRepository，添加数据库特定操作
 */
export abstract class DatabaseRepository<T extends ObjectLiteral, ID>
  extends AbstractRepository<T, ID>
  implements IDatabaseRepository<T, ID>
{
  protected readonly config: DatabaseConfig;
  protected qdrantRepo?: IQdrantRepo;

  constructor(
    dataSource: DataSource,
    entityClass: EntityTarget<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ) {
    super(dataSource, entityClass, logger);
    this.config = config;
    this.qdrantRepo = qdrantRepo;
  }

  /**
   * 删除集合及其所有关联数据
   * @param collectionId 集合ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    try {
      this.logger.debug(`Deleting collection and related data`, {
        collectionId,
      });

      // 在事务中执行删除操作
      await this.executeInTransaction(async (context) => {
        // 删除集合相关的所有数据
        await this.deleteCollectionData(collectionId, context);

        // 如果有Qdrant仓库，也删除Qdrant中的数据
        if (this.qdrantRepo) {
          await this.qdrantRepo.deletePointsByCollection(collectionId);
        }
      });

      this.logger.info(`Successfully deleted collection and related data`, {
        collectionId,
      });
    } catch (error) {
      this.handleError(`Failed to delete collection`, error, { collectionId });
    }
  }

  /**
   * 删除文档及其所有关联数据
   * @param docId 文档ID
   * @returns 是否成功删除
   */
  async deleteDoc(docId: DocId): Promise<boolean> {
    try {
      this.logger.debug(`Deleting document and related data`, { docId });

      // 在事务中执行删除操作
      const result = await this.executeInTransaction(async (context) => {
        // 删除文档相关的所有数据
        const deleted = await this.deleteDocumentData(docId, context);

        // 如果有Qdrant仓库，也删除Qdrant中的数据
        if (this.qdrantRepo) {
          await this.qdrantRepo.deletePointsByDoc(docId);
        }

        return deleted;
      });

      if (result) {
        this.logger.info(`Successfully deleted document and related data`, {
          docId,
        });
      } else {
        this.logger.warn(`No document found to delete`, { docId });
      }

      return result;
    } catch (error) {
      this.handleError(`Failed to delete document`, error, { docId });
    }
  }

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param params 查询参数
   * @returns 查询结果
   */
  async executeQuery(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    try {
      this.logger.debug(`Executing raw SQL query`, { query, params });

      // TypeORM DataSource exposes `query` for raw SQL
      const ds = this.dataSource as unknown as {
        query: (q: string, p?: unknown[]) => Promise<Array<Record<string, unknown>>>;
      };

      const result = await ds.query(query, params || []);

      this.logger.debug(`Raw SQL query executed successfully`, {
        query,
        params,
        resultCount: Array.isArray(result) ? result.length : 0,
      });

      return result;
    } catch (error) {
      this.handleError(`Failed to execute raw SQL query`, error, {
        query,
        params,
      });
    }
  }

  /**
   * 开始事务
   * @returns 事务上下文
   */
  async beginTransaction(): Promise<ITransactionContext> {
    try {
      this.logger.debug(`Starting database transaction`);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const context: ITransactionContext = {
        transactionId: this.generateTransactionId(),
        isActive: true,
        startTime: Date.now(),
        isolationLevel: 'READ_COMMITTED',

        commit: async () => {
          await queryRunner.commitTransaction();
          await queryRunner.release();
          context.isActive = false;
        },

        rollback: async () => {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          context.isActive = false;
        },

        createSavepoint: async (savepointName: string) => {
          await queryRunner.query(`SAVEPOINT ${savepointName}`);
        },

        rollbackToSavepoint: async (savepointName: string) => {
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        },

        releaseSavepoint: async (savepointName: string) => {
          await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
        },
      };

      this.logger.info(`Database transaction started`, {
        transactionId: context.transactionId,
      });
      return context;
    } catch (error) {
      this.handleError(`Failed to start database transaction`, error);
    }
  }

  /**
   * 提交事务
   * @param context 事务上下文
   */
  async commitTransaction(context: ITransactionContext): Promise<void> {
    try {
      this.logger.debug(`Committing database transaction`, {
        transactionId: context.transactionId,
      });
      await context.commit();
      this.logger.info(`Database transaction committed`, {
        transactionId: context.transactionId,
      });
    } catch (error) {
      this.handleError(`Failed to commit database transaction`, error, {
        transactionId: context.transactionId,
      });
    }
  }

  /**
   * 回滚事务
   * @param context 事务上下文
   */
  async rollbackTransaction(context: ITransactionContext): Promise<void> {
    try {
      this.logger.debug(`Rolling back database transaction`, {
        transactionId: context.transactionId,
      });
      await context.rollback();
      this.logger.info(`Database transaction rolled back`, {
        transactionId: context.transactionId,
      });
    } catch (error) {
      this.handleError(`Failed to rollback database transaction`, error, {
        transactionId: context.transactionId,
      });
    }
  }

  /**
   * 在事务中执行操作
   * @param operation 事务操作函数
   * @returns 操作结果
   */
  async executeInTransaction<T>(
    operation: (context: ITransactionContext) => Promise<T>,
  ): Promise<T> {
    const context = await this.beginTransaction();
    try {
      const result = await operation(context);
      await this.commitTransaction(context);
      return result;
    } catch (error) {
      await this.rollbackTransaction(context);
      throw error;
    }
  }

  /**
   * 获取数据库连接状态
   * @returns 连接状态信息
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    lastChecked: Date;
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        lastChecked: new Date(),
        responseTime,
      };
    } catch (error) {
      this.logger.warn(`Database connection check failed`, { error });
      return {
        connected: false,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * 执行数据库健康检查
   * @returns 健康检查结果
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: Record<string, number>;
  }> {
    const issues: string[] = [];
    const metrics: Record<string, number> = {};

    try {
      // 检查连接状态
      const connectionStatus = await this.getConnectionStatus();
      metrics.responseTime = connectionStatus.responseTime || 0;

      if (!connectionStatus.connected) {
        issues.push('Database connection failed');
      }

      // 检查表是否存在
      const tableCheck = await this.checkTablesExist();
      metrics.tableCount = tableCheck.existingTables.length;

      if (tableCheck.missingTables.length > 0) {
        issues.push(`Missing tables: ${tableCheck.missingTables.join(', ')}`);
      }

      return {
        healthy: issues.length === 0,
        issues,
        metrics,
      };
    } catch (error) {
      issues.push(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        healthy: false,
        issues,
        metrics,
      };
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getDatabaseStatistics(): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalQueries: number;
    averageQueryTime: number;
    [key: string]: number;
  }> {
    try {
      // 这里应该根据具体的数据库类型实现统计查询
      const stats = await this.getDatabaseSpecificStatistics();

      return {
        totalConnections: 0,
        activeConnections: 0,
        totalQueries: 0,
        averageQueryTime: 0,
        ...stats,
      };
    } catch (error) {
      this.handleError(`Failed to get database statistics`, error);
    }
  }

  /**
   * 获取Qdrant仓库实例
   * @returns Qdrant仓库实例
   */
  getQdrantRepository(): IQdrantRepo | undefined {
    return this.qdrantRepo;
  }

  /**
   * 设置Qdrant仓库实例
   * @param qdrantRepo Qdrant仓库实例
   */
  setQdrantRepository(qdrantRepo: IQdrantRepo): void {
    this.qdrantRepo = qdrantRepo;
    this.logger.info(`Qdrant repository set for ${this.getEntityName()}`);
  }

  /**
   * 同步数据到Qdrant
   * @param options 同步选项
   * @param options.collectionId 集合ID过滤
   * @param options.docId 文档ID过滤
   * @param options.force 强制同步
   * @returns 同步结果
   */
  async syncToQdrant(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const syncedCollections = 0;
    const syncedDocuments = 0;
    const syncedChunks = 0;

    try {
      if (!this.qdrantRepo) {
        errors.push('Qdrant repository not available');
        return {
          success: false,
          syncedCollections: 0,
          syncedDocuments: 0,
          syncedChunks: 0,
          errors,
        };
      }

      this.logger.info(`Starting sync to Qdrant`, { options });

      // 实现具体的同步逻辑
      const syncResult = await this.performQdrantSync(options);

      this.logger.info(`Sync to Qdrant completed`, syncResult);
      return syncResult;
    } catch (error) {
      errors.push(
        `Sync to Qdrant failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.handleError(`Failed to sync to Qdrant`, error, { options });

      return {
        success: false,
        syncedCollections,
        syncedDocuments,
        syncedChunks,
        errors,
      };
    }
  }

  /**
   * 从Qdrant同步数据
   * @param options 同步选项
   * @param options.collectionId 集合ID过滤
   * @param options.docId 文档ID过滤
   * @param options.force 强制同步
   * @returns 同步结果
   */
  async syncFromQdrant(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const syncedCollections = 0;
    const syncedDocuments = 0;
    const syncedChunks = 0;

    try {
      if (!this.qdrantRepo) {
        errors.push('Qdrant repository not available');
        return {
          success: false,
          syncedCollections: 0,
          syncedDocuments: 0,
          syncedChunks: 0,
          errors,
        };
      }

      this.logger.info(`Starting sync from Qdrant`, { options });

      // 实现具体的同步逻辑
      const syncResult = await this.performQdrantSyncFrom(options);

      this.logger.info(`Sync from Qdrant completed`, syncResult);
      return syncResult;
    } catch (error) {
      errors.push(
        `Sync from Qdrant failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.handleError(`Failed to sync from Qdrant`, error, { options });

      return {
        success: false,
        syncedCollections,
        syncedDocuments,
        syncedChunks,
        errors,
      };
    }
  }

  /**
   * 生成事务ID
   * @returns 事务ID
   */
  protected generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 删除集合相关数据（子类实现）
   * @param collectionId 集合ID
   * @param context 事务上下文
   */
  protected abstract deleteCollectionData(
    collectionId: CollectionId,
    context: ITransactionContext,
  ): Promise<void>;

  /**
   * 删除文档相关数据（子类实现）
   * @param docId 文档ID
   * @param context 事务上下文
   * @returns 是否成功删除
   */
  protected abstract deleteDocumentData(
    docId: DocId,
    context: ITransactionContext,
  ): Promise<boolean>;

  /**
   * 检查表是否存在
   * @returns 检查结果
   */
  protected abstract checkTablesExist(): Promise<{
    existingTables: string[];
    missingTables: string[];
  }>;

  /**
   * 获取数据库特定统计信息（子类实现）
   * @returns 统计信息
   */
  protected abstract getDatabaseSpecificStatistics(): Promise<
    Record<string, number>
  >;

  /**
   * 执行Qdrant同步（子类实现）
   * @param options 同步选项
   * @returns 同步结果
   */
  protected abstract performQdrantSync(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }>;

  /**
   * 从Qdrant执行同步（子类实现）
   * @param options 同步选项
   * @returns 同步结果
   */
  protected abstract performQdrantSyncFrom(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }>;

  // 以下方法需要实现，但为了简化暂时提供基础实现
  async optimizeTables(tableName?: string): Promise<{
    optimized: string[];
    errors: string[];
  }> {
    return { optimized: [], errors: ['Not implemented'] };
  }

  async backupData(
    backupPath: string,
    options?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    backupPath: string;
    size: number;
    duration: number;
  }> {
    return {
      success: false,
      backupPath: '',
      size: 0,
      duration: 0,
    };
  }

  async restoreData(
    backupPath: string,
    options?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    restoredTables: string[];
    errors: string[];
    duration: number;
  }> {
    return {
      success: false,
      restoredTables: [],
      errors: ['Not implemented'],
      duration: 0,
    };
  }

  async migrateData(targetVersion: string): Promise<{
    success: boolean;
    migrations: Array<{
      version: string;
      description: string;
      duration: number;
    }>;
    errors: string[];
  }> {
    return {
      success: false,
      migrations: [],
      errors: ['Not implemented'],
    };
  }
}
