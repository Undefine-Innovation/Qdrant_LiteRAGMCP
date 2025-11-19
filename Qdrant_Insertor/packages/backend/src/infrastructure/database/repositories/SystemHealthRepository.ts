import { DataSource, LessThan, FindOptionsWhere } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { SystemHealth } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * SystemHealth Repository实现
 * 继承BaseRepository，提供SystemHealth特定的数据库操作
 */
export class SystemHealthRepository extends BaseRepository<SystemHealth> {
  /**
   * 创建SystemHealthRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, SystemHealth, logger);
  }

  /**
   * 获取最新的系统健康状态
   * @param limit 限制数量
   * @returns 系统健康状态数组
   */
  async findLatest(limit: number = 10): Promise<SystemHealth[]> {
    try {
      const results = await this.repository!.find({
        order: {
          created_at: 'DESC',
        },
        take: limit,
      });
      return results;
    } catch (error) {
      this.logger.error('获取最新系统健康状态失败', { error });
      throw error;
    }
  }

  /**
   * 根据状态获取系统健康状态
   * @param status 健康状态
   * @returns 系统健康状态数组
   */
  async findByStatus(
    status: 'healthy' | 'degraded' | 'unhealthy',
  ): Promise<SystemHealth[]> {
    try {
      const results = await this.repository!.find({
        where: {
          status,
        },
      });
      return results;
    } catch (error) {
      this.logger.error('根据状态获取系统健康状态失败', { error });
      throw error;
    }
  }

  /**
   * 获取所有健康状态记录 - 兼容旧DAO接口
   * @returns 系统健康状态数组
   */
  async getAll(): Promise<SystemHealth[]> {
    try {
      const results = await this.repository!.find({
        order: {
          created_at: 'DESC',
        },
      });
      return results;
    } catch (error) {
      this.logger.error('获取所有健康状态失败', { error });
      throw error;
    }
  }

  /**
   * 根据组件获取健康状态 - 兼容旧DAO接口
   * @param component 组件名称
   * @returns 系统健康状态或null
   */
  async getByComponent(component: string): Promise<SystemHealth | null> {
    try {
      const result = await this.repository!.findOne({
        where: {
          component,
        },
        order: {
          created_at: 'DESC',
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error('根据组件获取健康状态失败', { component, error });
      throw error;
    }
  }

  /**
   * 获取整体健康状态 - 兼容旧DAO接口
   * @returns 整体健康状态对象
   */
  async getOverallHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components?: Record<string, SystemHealth>;
  }> {
    try {
      const healthList = await this.repository!.find({
        order: {
          created_at: 'DESC',
        },
      });

      if (healthList.length === 0) {
        return { status: 'unhealthy', components: {} };
      }

      // 根据最近的健康记录判断整体状态
      const statuses = healthList.map((h: SystemHealth) => h.status);
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (statuses.includes('unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (statuses.includes('degraded')) {
        overallStatus = 'degraded';
      }

      const components: Record<string, SystemHealth> = {};
      for (const health of healthList) {
        components[health.component] = health;
      }

      return {
        status: overallStatus,
        components,
      };
    } catch (error) {
      this.logger.error('获取整体健康状态失败', { error });
      return { status: 'unhealthy', components: {} };
    }
  }

  /**
   * 获取不健康的组件 - 兼容旧DAO接口
   * @returns 不健康的组件列表
   */
  async getUnhealthyComponents(): Promise<SystemHealth[]> {
    try {
      const results = await this.repository!.find({
        where: {
          status: 'unhealthy',
        },
      });
      return results;
    } catch (error) {
      this.logger.error('获取不健康的组件失败', { error });
      return [];
    }
  }

  /**
   * 清理旧的健康状态数据
   * @param olderThanDays 多少天之前的数据
   * @returns 删除的记录数
   */
  async cleanup(olderThanDays: number): Promise<number> {
    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const result = await this.repository!.delete({
        created_at: LessThan(cutoffTime),
      });

      return result.affected || 0;
    } catch (error) {
      this.logger.error('清理旧健康状态数据失败', { olderThanDays, error });
      return 0;
    }
  }

  /**
   * Upsert健康状态 - 按component字段进行upsert
   * @param data 健康状态数据
   * @returns 创建或更新后的健康状态
   */
  async upsert(data: Partial<SystemHealth>): Promise<SystemHealth> {
    try {
      // 如果component不存在，抛出错误
      if (!data.component) {
        throw new Error('component字段是必需的');
      }

      // 查找是否存在相同component的记录
      const existing = await this.repository!.findOne({
        where: {
          component: data.component,
        } as FindOptionsWhere<SystemHealth>,
        order: {
          created_at: 'DESC',
        },
      });

      if (existing) {
        // 更新现有记录
        Object.assign(existing, data);
        existing.created_at = Date.now(); // 更新时间戳
        const result = await this.repository!.save(existing);
        this.logger.debug('更新健康状态成功', { component: data.component });
        return result;
      } else {
        // 创建新记录
        const entity = this.repository!.create({
          ...data,
          created_at: Date.now(),
          id: undefined, // 让数据库生成ID
        });
        const result = await this.repository!.save(entity);
        this.logger.debug('创建健康状态成功', { component: data.component });
        return result;
      }
    } catch (error) {
      this.logger.error('Upsert健康状态失败', { data, error });
      throw error;
    }
  }
}
