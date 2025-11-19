import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '@api/contracts/Error.js';
import { logger } from '@logging/logger.js';

/**
 * 数据库连接检查中间件
 * 在请求处理之前验证数据库连接状态
 * 如果连接未就绪，返回503 Service Unavailable错误
 * @param _req Express请求对象
 * @param res Express响应对象
 * @param next Express下一个中间件函数
 * @returns Promise<void>
 */
export const dbConnectionCheck = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 从全局状态获取TypeORM DataSource实例
    // 这个会从app实例的locals中获取
    const dataSource = res.locals.typeormDataSource;

    if (!dataSource) {
      logger.error('TypeORM DataSource未在中间件中配置', {
        resLocalsKeys: Object.keys(res.locals || {}),
        hasTypeormDataSource: !!res.locals?.typeormDataSource,
      });
      void res
        .status(500)
        .json(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            'Database connection not available. Please try again later.',
            500,
          ).toJSON(),
        );
      return;
    }

    // 验证DataSource是否已初始化
    if (!dataSource.isInitialized) {
      logger.error('Database connection is not initialized', {
        dataSourceType: dataSource?.options?.type,
        isInitialized: dataSource?.isInitialized,
        timestamp: new Date().toISOString(),
      });
      void res
        .status(500)
        .json(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            'Database connection is not initialized. Please try again later.',
            500,
          ).toJSON(),
        );
      return;
    }

    // 执行简单的ping测试
    try {
      await dataSource.query('SELECT 1');
      next();
    } catch (pingError) {
      logger.error('Database ping failed', {
        error: (pingError as Error).message,
        timestamp: new Date().toISOString(),
      });
      void res
        .status(500)
        .json(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            'Database connection test failed. Please try again later.',
            500,
          ).toJSON(),
        );
    }
  } catch (error) {
    logger.error('Database connection check middleware error', {
      error: (error as Error).message,
    });
    void res
      .status(500)
      .json(
        new AppError(
          ErrorCode.INTERNAL_ERROR,
          'An error occurred while checking database connection.',
          500,
        ).toJSON(),
      );
  }
};
