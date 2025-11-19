import { DataSource, EntityTarget, Repository, ObjectLiteral, FindOptionsWhere } from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository统计功能
 * 提供统计相关操作
 */
export class BaseRepositoryStatistics<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryStatistics实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: EntityTarget<T>,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取Repository实例
   * @returns {Repository<T>} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository(this.entity);
  }

  /**
   * 获取统计信息
   * @param groupBy 分组字段
   * @param where 查询条件
   * @returns 统计信息
   */
  async getStatistics(
    groupBy: string,
    where?: FindOptionsWhere<T> | Record<string, unknown>,
  ): Promise<Record<string, number>> {
    try {
      const repository = this.getRepository();
      const results = await repository
        .createQueryBuilder()
        .select([`${groupBy}`, 'COUNT(*) as count'])
        .where((where as unknown) || {})
        .groupBy(groupBy)
        .getRawMany();

      const statistics: Record<string, number> = {};
      for (const result of results) {
        if (result && typeof result === 'object') {
          const key = String((result as Record<string, unknown>)[groupBy]);
          const count = (result as Record<string, unknown>).count;
          statistics[key] =
            typeof count === 'string'
              ? parseInt(count, 10)
              : (count as number) || 0;
        }
      }
      return statistics;
    } catch (error) {
      this.logger.error(`获取统计信息失败`, {
        groupBy,
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
