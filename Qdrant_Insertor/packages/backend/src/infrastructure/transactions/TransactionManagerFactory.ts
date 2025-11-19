import { Logger } from '@logging/logger.js';
import { ITransactionManager } from '@domain/repositories/ITransactionManager.js';
import { TypeORMTransactionManager } from './TypeORMTransactionManager.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { DataSource } from 'typeorm';

/**
 * 事务管理器工厂类
 * 根据配置创建TypeORM事务管理器实例
 * 注意：已弃用legacy TransactionManager，仅使用TypeORM
 */
export class TransactionManagerFactory {
  /**
   * 创建事务管理器实例
   *
   * @param dependencies 依赖项
   * @param dependencies.dataSource TypeORM数据源
   * @param dependencies.qdrantRepo Qdrant仓库实例
   * @param dependencies.logger 日志记录器
   * @returns 事务管理器实例
   */
  static create(dependencies: {
    dataSource: DataSource;
    qdrantRepo: IQdrantRepo;
    logger: Logger;
  }): ITransactionManager {
    const { dataSource, qdrantRepo, logger } = dependencies;

    if (!dataSource) {
      throw new Error(
        'Cannot create transaction manager: DataSource is required',
      );
    }

    logger.info('Creating TypeORM transaction manager');
    return new TypeORMTransactionManager(
      dataSource,
      qdrantRepo,
      logger,
    ) as ITransactionManager;
  }

  /**
   * 根据应用配置自动创建事务管理器
   *
   * @param dependencies 依赖项
   * @param dependencies.dataSource TypeORM数据源
   * @param dependencies.qdrantRepo Qdrant仓库实例
   * @param dependencies.logger 日志记录器
   * @returns 事务管理器实例
   */
  static createFromAppConfig(dependencies: {
    dataSource: DataSource;
    qdrantRepo: IQdrantRepo;
    logger: Logger;
  }): ITransactionManager {
    return this.create(dependencies);
  }
}
