import { DataSource } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';

/**
 * 简化的文档统计功能
 * 提供各种统计和聚合查询
 */
export class SimplifiedDocStatistics extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 获取文档统计信息
   * @param collectionId 可选的集合ID，如果提供则只统计该集合
   * @returns 文档统计信息
   */
  async getDocStatistics(collectionId?: CollectionId): Promise<{
    total: number;
    new: number;
    processing: number;
    completed: number;
    failed: number;
    deleted: number;
    totalSize: number;
  }> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN doc.status = :new THEN 1 ELSE 0 END)', 'new')
        .addSelect(
          'SUM(CASE WHEN doc.status = :processing THEN 1 ELSE 0 END)',
          'processing',
        )
        .addSelect(
          'SUM(CASE WHEN doc.status = :completed THEN 1 ELSE 0 END)',
          'completed',
        )
        .addSelect(
          'SUM(CASE WHEN doc.status = :failed THEN 1 ELSE 0 END)',
          'failed',
        )
        .addSelect(
          'SUM(CASE WHEN doc.deleted = true THEN 1 ELSE 0 END)',
          'deleted',
        )
        .addSelect('SUM(doc.size_bytes)', 'totalSize')
        .setParameters({
          new: 'new',
          processing: 'processing',
          completed: 'completed',
          failed: 'failed',
        });

      if (collectionId) {
        queryBuilder.where('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const result = await queryBuilder.getRawOne();

      // 处理空结果的情况
      if (!result) {
        return {
          total: 0,
          new: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          deleted: 0,
          totalSize: 0,
        };
      }

      return {
        total: parseInt(result.total, 10) || 0,
        new: parseInt(result.new, 10) || 0,
        processing: parseInt(result.processing, 10) || 0,
        completed: parseInt(result.completed, 10) || 0,
        failed: parseInt(result.failed, 10) || 0,
        deleted: parseInt(result.deleted, 10) || 0,
        totalSize: parseInt(result.totalSize, 10) || 0,
      };
    } catch (error) {
      this.logger.error(`获取文档统计信息失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取集合文档统计
   * @returns 各集合的文档统计信息数组
   */
  async getCollectionStatistics(): Promise<
    Array<{
      collectionId: CollectionId;
      total: number;
      new: number;
      processing: number;
      completed: number;
      failed: number;
      totalSize: number;
      avgSize: number;
    }>
  > {
    try {
      const results = await this.repository
        .createQueryBuilder('doc')
        .select('doc.collectionId', 'collectionId')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN doc.status = :new THEN 1 ELSE 0 END)', 'new')
        .addSelect(
          'SUM(CASE WHEN doc.status = :processing THEN 1 ELSE 0 END)',
          'processing',
        )
        .addSelect(
          'SUM(CASE WHEN doc.status = :completed THEN 1 ELSE 0 END)',
          'completed',
        )
        .addSelect(
          'SUM(CASE WHEN doc.status = :failed THEN 1 ELSE 0 END)',
          'failed',
        )
        .addSelect('SUM(doc.size_bytes)', 'totalSize')
        .addSelect('AVG(doc.size_bytes)', 'avgSize')
        .where('doc.deleted = :deleted', { deleted: false })
        .groupBy('doc.collectionId')
        .orderBy('total', 'DESC')
        .setParameters({
          new: 'new',
          processing: 'processing',
          completed: 'completed',
          failed: 'failed',
          deleted: false,
        })
        .getRawMany();

      return results.map((result) => ({
        collectionId: result.collectionId,
        total: parseInt(result.total, 10) || 0,
        new: parseInt(result.new, 10) || 0,
        processing: parseInt(result.processing, 10) || 0,
        completed: parseInt(result.completed, 10) || 0,
        failed: parseInt(result.failed, 10) || 0,
        totalSize: parseInt(result.totalSize, 10) || 0,
        avgSize: Math.round(parseFloat(result.avgSize) || 0),
      }));
    } catch (error) {
      this.logger.error(`获取集合文档统计失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档大小分布统计
   * @param collectionId 可选的集合ID，如果提供则只统计该集合
   * @returns 文档大小分布统计信息
   */
  async getSizeDistribution(collectionId?: CollectionId): Promise<
    Array<{
      sizeRange: string;
      count: number;
      percentage: number;
    }>
  > {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select([
          'CASE ' +
            "WHEN doc.size_bytes < 1024 THEN '< 1KB' " +
            "WHEN doc.size_bytes < 10240 THEN '1KB-10KB' " +
            "WHEN doc.size_bytes < 102400 THEN '10KB-100KB' " +
            "WHEN doc.size_bytes < 1048576 THEN '100KB-1MB' " +
            "WHEN doc.size_bytes < 10485760 THEN '1MB-10MB' " +
            "ELSE '> 10MB' " +
            'END',
          'sizeRange',
        ])
        .addSelect('COUNT(*)', 'count')
        .where('doc.deleted = :deleted', { deleted: false });

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const results = await queryBuilder
        .groupBy('sizeRange')
        .orderBy('sizeRange')
        .getRawMany();

      // 计算总数和百分比
      const total = results.reduce(
        (sum, result) => sum + parseInt(result.count, 10),
        0,
      );

      return results.map((result) => ({
        sizeRange: result.sizeRange,
        count: parseInt(result.count, 10),
        percentage:
          total > 0
            ? Math.round((parseInt(result.count, 10) / total) * 100)
            : 0,
      }));
    } catch (error) {
      this.logger.error(`获取文档大小分布统计失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档类型分布统计
   * @param collectionId 可选的集合ID，如果提供则只统计该集合
   * @returns 文档类型分布统计信息
   */
  async getMimeTypeDistribution(collectionId?: CollectionId): Promise<
    Array<{
      mimeType: string;
      count: number;
      percentage: number;
    }>
  > {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select('doc.mime', 'mimeType')
        .addSelect('COUNT(*)', 'count')
        .where('doc.deleted = :deleted', { deleted: false })
        .andWhere('doc.mime IS NOT NULL');

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const results = await queryBuilder
        .groupBy('doc.mime')
        .orderBy('count', 'DESC')
        .getRawMany();

      // 计算总数和百分比
      const total = results.reduce(
        (sum, result) => sum + parseInt(result.count, 10),
        0,
      );

      return results.map((result) => ({
        mimeType: result.mimeType,
        count: parseInt(result.count, 10),
        percentage:
          total > 0
            ? Math.round((parseInt(result.count, 10) / total) * 100)
            : 0,
      }));
    } catch (error) {
      this.logger.error(`获取文档类型分布统计失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档创建时间趋势统计
   * @param days 统计天数，默认为30天
   * @param collectionId 可选的集合ID，如果提供则只统计该集合
   * @returns 文档创建时间趋势统计信息
   */
  async getCreationTrend(
    days: number = 30,
    collectionId?: CollectionId,
  ): Promise<
    Array<{
      date: string;
      count: number;
      cumulative: number;
    }>
  > {
    try {
      const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select('DATE(doc.created_at)', 'date')
        .addSelect('COUNT(*)', 'count')
        .where('doc.created_at >= :startTime', { startTime })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const results = await queryBuilder
        .groupBy('DATE(doc.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany();

      // 计算累积值
      let cumulative = 0;
      return results.map((result) => {
        const count = parseInt(result.count, 10);
        cumulative += count;
        return {
          date: result.date,
          count,
          cumulative,
        };
      });
    } catch (error) {
      this.logger.error(`获取文档创建时间趋势统计失败`, {
        days,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取处理效率统计
   * @param days 统计天数，默认为30天
   * @param collectionId 可选的集合ID，如果提供则只统计该集合
   * @returns 处理效率统计信息
   */
  async getProcessingEfficiency(
    days: number = 30,
    collectionId?: CollectionId,
  ): Promise<{
    totalProcessed: number;
    avgProcessingTime: number;
    successRate: number;
    failureRate: number;
  }> {
    try {
      const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select('COUNT(*)', 'total')
        .addSelect(
          'SUM(CASE WHEN doc.status = :completed THEN 1 ELSE 0 END)',
          'completed',
        )
        .addSelect(
          'SUM(CASE WHEN doc.status = :failed THEN 1 ELSE 0 END)',
          'failed',
        )
        .addSelect('AVG(doc.updated_at - doc.created_at)', 'avgProcessingTime')
        .where('doc.created_at >= :startTime', { startTime })
        .andWhere('doc.deleted = :deleted', { deleted: false })
        .andWhere('doc.status IN (:...statuses)', {
          statuses: ['completed', 'failed'],
        });

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const result = await queryBuilder
        .setParameters({
          completed: 'completed',
          failed: 'failed',
        })
        .getRawOne();

      const totalProcessed = parseInt(result?.total || '0', 10);
      const completedCount = parseInt(result?.completed || '0', 10);
      const failedCount = parseInt(result?.failed || '0', 10);
      const avgProcessingTime = parseFloat(result?.avgProcessingTime || '0');

      return {
        totalProcessed,
        avgProcessingTime: Math.round(avgProcessingTime),
        successRate:
          totalProcessed > 0
            ? Math.round((completedCount / totalProcessed) * 100)
            : 0,
        failureRate:
          totalProcessed > 0
            ? Math.round((failedCount / totalProcessed) * 100)
            : 0,
      };
    } catch (error) {
      this.logger.error(`获取处理效率统计失败`, {
        days,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
