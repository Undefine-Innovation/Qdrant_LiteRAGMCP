import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { TypeORMRepositoryDatabase } from './TypeORMRepositoryDatabase.js';

/**
 * TypeORM Repository实现
 * 替代原有的同步SQLiteRepo，提供异步操作
 * 注意：虽然实现了 ISQLiteRepo 接口方法，但由于 TypeORM 的异步性质，
 * 某些同步方法返回空值或抛出错误。应通过类型断言使用此类。
 * 
 * 重构后的版本，将功能拆分为多个模块以提高可维护性
 */
export class TypeORMRepository extends TypeORMRepositoryDatabase {
  /**
   * 创建TypeORMRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   */
  constructor(
    dataSource: DataSource,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ) {
    super(dataSource, logger, qdrantRepo);
  }
}