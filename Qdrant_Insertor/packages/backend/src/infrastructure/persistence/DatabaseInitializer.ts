import type { Database } from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import { DatabaseStatusChecker } from './DatabaseStatusChecker.js';
import { DatabaseSchemaManager } from './DatabaseSchemaManager.js';

/**
 * 数据库初始化状态枚举
 */
export enum DatabaseInitStatus {
  /** 未初始化 */
  NOT_INITIALIZED = 'not_initialized',
  /** 正在初始化 */
  INITIALIZING = 'initializing',
  /** 已初始化 */
  INITIALIZED = 'initialized',
  /** 初始化错误 */
  ERROR = 'error',
}

/**
 * 数据库初始化结果接口
 */
export interface DatabaseInitResult {
  /** 是否成功 */
  success: boolean;
  /** 初始化状态 */
  status: DatabaseInitStatus;
  /** 结果消息 */
  message: string;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（毫秒） */
  duration?: number;
}

/**
 * 数据库状态信息接口
 */
export interface DatabaseStatus {
  /** 数据库文件是否存在 */
  exists: boolean;
  /** 数据库是否已初始化 */
  initialized: boolean;
  /** 数据库文件路径 */
  path: string;
  /** 数据库文件大小（字节） */
  size?: number;
  /** 表数量 */
  tableCount?: number;
}

/**
 * 数据库初始化器
 * 负责检查数据库状态并执行初始化操作
 */
export class DatabaseInitializer {
  /** 是否已初始化 */
  private isInitialized = false;
  /** 初始化Promise，防止并发初始化 */
  private initializationPromise: Promise<DatabaseInitResult> | null = null;

  private readonly statusChecker: DatabaseStatusChecker;
  private readonly schemaManager: DatabaseSchemaManager;

  /**
   * 构造函数
   * @param db - 数据库实例
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   */
  constructor(
    private readonly db: Database,
    private readonly dbPath: string,
    private readonly logger: Logger,
  ) {
    this.statusChecker = new DatabaseStatusChecker(db, dbPath, logger);
    this.schemaManager = new DatabaseSchemaManager(db, logger);
  }

  /**
   * 检查数据库初始化状态
   * @returns 数据库初始化状态
   */
  async checkInitializationStatus(): Promise<DatabaseInitStatus> {
    try {
      // 检查数据库文件是否存在
      const dbExists = await this.statusChecker.checkDatabaseFileExists();
      if (!dbExists) {
        return DatabaseInitStatus.NOT_INITIALIZED;
      }

      // 检查关键表是否存在
      const hasAllTables = this.statusChecker.checkRequiredTablesExist();

      if (!hasAllTables) {
        return DatabaseInitStatus.NOT_INITIALIZED;
      }

      // 检查是否需要应用监控架构更新
      const needsMonitoringUpdate =
        await this.schemaManager.needsMonitoringSchemaUpdate();
      if (needsMonitoringUpdate) {
        return DatabaseInitStatus.NOT_INITIALIZED;
      }

      return DatabaseInitStatus.INITIALIZED;
    } catch (error) {
      this.logger.error('检查数据库初始化状态失败', error);
      return DatabaseInitStatus.ERROR;
    }
  }

  /**
   * 初始化数据库
   * @returns 初始化结果
   */
  async initialize(): Promise<DatabaseInitResult> {
    // 防止重复初始化
    if (this.isInitialized) {
      return {
        success: true,
        status: DatabaseInitStatus.INITIALIZED,
        message: '数据库已初始化',
      };
    }

    // 防止并发初始化
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * 执行实际的初始化操作
   * @returns 初始化结果
   */
  private async performInitialization(): Promise<DatabaseInitResult> {
    const startTime = Date.now();

    try {
      this.logger.info('开始数据库初始化...');

      // 确保数据库目录存在
      await this.statusChecker.ensureDatabaseDirectory();

      // 检查初始化状态
      const status = await this.checkInitializationStatus();

      if (status === DatabaseInitStatus.INITIALIZED) {
        this.isInitialized = true;
        const duration = Date.now() - startTime;
        return {
          success: true,
          status: DatabaseInitStatus.INITIALIZED,
          message: '数据库已初始化',
          duration,
        };
      }

      // 执行初始化SQL
      await this.schemaManager.executeInitialSchema();
      await this.schemaManager.executeMonitoringSchema();

      this.isInitialized = true;
      const duration = Date.now() - startTime;

      this.logger.info(`数据库初始化完成，耗时: ${duration}ms`);

      return {
        success: true,
        status: DatabaseInitStatus.INITIALIZED,
        message: '数据库初始化成功',
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`数据库初始化失败: ${errorMessage}`, error);

      return {
        success: false,
        status: DatabaseInitStatus.ERROR,
        message: '数据库初始化失败',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * 获取数据库状态信息
   * @returns 数据库状态信息
   */
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    try {
      const fileInfo = await this.statusChecker.getDatabaseFileInfo();
      const initialized =
        (await this.checkInitializationStatus()) ===
        DatabaseInitStatus.INITIALIZED;
      const tableCount = this.statusChecker.getTableCount();

      return {
        exists: fileInfo.exists,
        initialized,
        path: this.dbPath,
        size: fileInfo.size,
        tableCount,
      };
    } catch (error) {
      this.logger.error('获取数据库状态失败', error);
      return {
        exists: false,
        initialized: false,
        path: this.dbPath,
      };
    }
  }

  /**
   * 重置初始化状态（仅用于测试环境）
   */
  resetInitializationState(): void {
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}
