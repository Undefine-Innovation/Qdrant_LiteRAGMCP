import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import Database from 'better-sqlite3';

/**
 * 执行架构一致性修复脚本
 * @param config 应用配置
 * @param logger 日志记录器
 */
export async function runSchemaConsistencyFix(
  config: AppConfig,
  logger: Logger,
): Promise<void> {
  if (config.db.type !== 'sqlite' || !config.db.path) {
    logger.warn('架构一致性修复仅适用于SQLite数据库');
    return;
  }

  logger.info('开始执行架构一致性修复...');

  try {
    // 读取迁移脚本
    const migrationPath = join(__dirname, 'schema-consistency-fix.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // 连接数据库
    const db = new Database(config.db.path);

    try {
      // 执行迁移脚本
      logger.info('执行数据库迁移脚本...');
      db.exec(migrationSQL);
      logger.info('数据库迁移脚本执行成功');
    } finally {
      // 关闭数据库连接
      db.close();
    }

    logger.info('架构一致性修复完成');
  } catch (error) {
    logger.error('架构一致性修复失败', { error });
    throw error;
  }
}
