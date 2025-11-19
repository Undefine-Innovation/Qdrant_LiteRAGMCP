import { Logger } from '@logging/logger.js';
import { TypeORMRepositoryChunks } from './TypeORMRepositoryChunks.js';

/**
 * TypeORM Repository 数据库连接和初始化操作方法
 */
export class TypeORMRepositoryDatabase extends TypeORMRepositoryChunks {
  /**
   * 初始化数据库
   * @param dbPath 数据库文件路径
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  async initializeDatabase(
    dbPath: string,
    logger: Logger,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // TypeORM会自动初始化数据库，这里只记录日志
      await this.dataSource.initialize();

      logger.info(`TypeORM数据库初始化成功`, { dbPath });

      return {
        success: true,
        message: `数据库初始化成功: ${dbPath}`,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(`TypeORM数据库初始化失败`, {
        dbPath,
        error: errorMessage,
      });

      return {
        success: false,
        message: `数据库初始化失败: ${dbPath}`,
        error: errorMessage,
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.info(`TypeORM数据库连接已关闭`);
      }
    } catch (error) {
      this.logger.error(`关闭数据库连接失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查数据库连接是否存活
   * @returns 如果连接响应正常则返回true，否则返回false
   */
  ping(): boolean {
    // 为了保持接口兼容性，这里返回false
    // 实际使用应该调用异步版本
    this.logger.warn(`ping是同步方法，请使用asyncPing`);
    return false;
  }

  /**
   * 异步版本的ping
   * @returns 如果连接响应正常则返回true，否则返回false
   */
  async asyncPing(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }

      // 执行简单查询测试连接
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.warn(`数据库ping检查失败`, {
        error: (error as Error).message,
      });
      return false;
    }
  }
}