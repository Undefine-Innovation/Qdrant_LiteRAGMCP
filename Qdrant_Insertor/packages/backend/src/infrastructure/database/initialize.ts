import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { allEntities } from './entities/index.js';
import { createTypeORMDataSource } from './config.js';

/**
 * 初始化TypeORM数据库连接
 * @param config 应用配置
 * @param logger 日志记录器
 * @returns 初始化的数据源
 */
export async function initializeTypeORMDatabase(
  config: AppConfig,
  logger: Logger,
): Promise<DataSource> {
  try {
    logger.info('正在初始化TypeORM数据库连接...');

    // 创建数据源
    const dataSource = createTypeORMDataSource(
      config,
      logger,
      allEntities as unknown as (() => unknown)[],
    );

    // 初始化连接
    await dataSource.initialize();

    logger.info('TypeORM数据库连接初始化成功', {
      databaseType: config.db.type,
      entitiesCount: allEntities.length,
    });

    // 如果是开发环境且不是测试环境，运行迁移
    if (process.env.NODE_ENV === 'development' && !process.env.JEST_WORKER_ID) {
      logger.info('正在运行TypeORM数据库迁移...');
      await dataSource.runMigrations();
      logger.info('TypeORM数据库迁移完成');
    }

    return dataSource;
  } catch (error) {
    logger.error('TypeORM数据库初始化失败', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      databaseType: config.db.type,
    });
    throw error;
  }
}

/**
 * 关闭TypeORM数据库连接
 * @param dataSource 数据源
 * @param logger 日志记录器
 */
export async function closeTypeORMDatabase(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  try {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      logger.info('TypeORM数据库连接已关闭');
    }
  } catch (error) {
    logger.error('关闭TypeORM数据库连接失败', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

/**
 * 测试TypeORM数据库连接
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 连接是否正常
 */
export async function pingTypeORMDatabase(
  dataSource: DataSource,
  logger: Logger,
): Promise<boolean> {
  try {
    if (!dataSource.isInitialized) {
      return false;
    }

    // 执行简单查询测试连接
    await dataSource.query('SELECT 1');
    return true;
  } catch (error) {
    logger.warn('TypeORM数据库ping检查失败', {
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * 获取TypeORM数据库状态信息
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 数据库状态信息
 */
export async function getTypeORMDatabaseStatus(
  dataSource: DataSource,
  logger: Logger,
): Promise<{
  connected: boolean;
  databaseType: string;
  entitiesCount: number;
  migrationsAvailable: boolean;
}> {
  try {
    const connected = dataSource.isInitialized;
    const databaseType = dataSource.options.type;
    const entitiesCount = Array.isArray(dataSource.options.entities)
      ? dataSource.options.entities.length
      : 0;

    // 检查是否有待执行的迁移
    let migrationsAvailable = false;
    if (connected) {
      try {
        const migrations = await dataSource.showMigrations();
        migrationsAvailable =
          Array.isArray(migrations) && migrations.length > 0;
      } catch (error) {
        logger.warn('检查迁移状态失败', { error: (error as Error).message });
      }
    }

    return {
      connected,
      databaseType,
      entitiesCount,
      migrationsAvailable,
    };
  } catch (error) {
    logger.error('获取TypeORM数据库状态失败', {
      error: (error as Error).message,
    });
    throw error;
  }
}
