/**
 * TypeORM数据库模块导出文件
 * 统一导出所有数据库相关的功能
 */

/**
 * 配置相关导出
 */
export {
  DatabaseConnectionManager,
  createTypeORMConfig,
  createTypeORMDataSource,
  DatabaseConnectionStatus,
} from './config.js';

/**
 * 初始化相关导出
 */
export {
  initializeTypeORMDatabase,
  closeTypeORMDatabase,
  pingTypeORMDatabase,
  getTypeORMDatabaseStatus,
} from './initialize.js';

/**
 * 测试兼容性相关导出
 */
export { testTypeORMCompatibility } from './TestCompatibility.js';

/**
 * 实体相关导出
 */
export { allEntities } from './entities/index.js';

/**
 * Repository相关导出
 */
export {
  BaseRepository,
  CollectionRepository,
  DocRepository,
  ChunkRepository,
  TypeORMRepository,
} from './repositories/index.js';
