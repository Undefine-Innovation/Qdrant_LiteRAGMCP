import { DataSource, FindManyOptions } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AlertHistory } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * AlertHistory Repositoryʵ��
 * �̳�BaseRepository���ṩAlertHistory�ض������ݿ����
 */
export class AlertHistoryRepository extends BaseRepository<AlertHistory> {
  /**
   * ����AlertHistoryRepositoryʵ��
   * @param dataSource TypeORM����Դ
   * @param logger ��־��¼��
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, AlertHistory, logger);
  }

  /**
   * ���ݸ澯����ID��ȡ�澯��ʷ
   * @param ruleId �澯����ID
   * @param limit ��������
   * @returns �澯��ʷ����
   */
  async findByRuleId(
    ruleId: string,
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      return await this.repository.find({
        where: { rule_id: ruleId },
        order: { created_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('���ݸ澯����ID��ȡ�澯��ʷʧ��', { error });
      throw error;
    }
  }

  /**
   * ����ʱ�䷶Χ��ȡ�澯��ʷ
   * @param fieldName ʱ���ֶ�
   * @param startTime ��ʼʱ��
   * @param endTime ����ʱ��
   * @param options ��ѡ��ѯ����
   * @returns AlertHistory[]
   */
  async findByTimeRange(
    fieldName: string,
    startTime: number,
    endTime: number,
    options: FindManyOptions<AlertHistory> = {},
  ): Promise<AlertHistory[]> {
    const mergedOptions: FindManyOptions<AlertHistory> = {
      ...options,
      order: options.order ?? { triggered_at: 'DESC' },
    };
    return super.findByTimeRange(fieldName, startTime, endTime, mergedOptions);
  }

  /**
   * �Դ��� triggered_at �ֶβ�ѯ�澯��ʷ
   * @param startTime ��ʼʱ��
   * @param endTime ����ʱ��
   * @param limit ��������
   * @returns AlertHistory[]
   */
  async findByTriggeredAtRange(
    startTime: number,
    endTime: number,
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    return this.findByTimeRange('triggered_at', startTime, endTime, {
      take: limit,
      order: { triggered_at: 'DESC' },
    });
  }

  /**
   * �������س̶Ȼ�ȡ�澯
   * @param severity �����ȼ�
   * @param limit ����
   * @returns AlertHistory[]
   */
  async findBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      return await this.repository.find({
        where: { severity },
        order: { triggered_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('�������س̶Ȼ�ȡ�澯ʧ��', { error });
      throw error;
    }
  }

  /**
   * ����״̬��ȡ�澯
   * @param status ״̬
   * @param limit ����
   * @returns AlertHistory[]
   */
  async findByStatus(
    status: 'triggered' | 'resolved' | 'suppressed',
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      return await this.repository.find({
        where: { status },
        order: { triggered_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('����״̬��ȡ�澯ʧ��', { error });
      throw error;
    }
  }

  /**
   * ���¸澯״̬
   * @param id ����ID
   * @param status ״̬
   * @param resolvedAt ����ʱ��
   * @returns �Ƿ����½�
   */
  async updateStatus(
    id: string,
    status: 'triggered' | 'resolved' | 'suppressed',
    resolvedAt?: number,
  ): Promise<boolean> {
    try {
      const updateData: { status: typeof status; resolved_at?: number } = {
        status,
      };
      if (resolvedAt) {
        updateData.resolved_at = resolvedAt;
      }
      const result = await this.repository.update({ id }, updateData);
      return (result.affected || 0) > 0;
    } catch (error) {
      this.logger.error('���¸澯״̬ʧ��', { error, id });
      throw error;
    }
  }

  /**
   * �������¸澯״̬
   * @param ids ����ID�б�
   * @param status ״̬
   * @returns ����������
   */
  async updateStatusBatch(
    ids: string[],
    status: 'triggered' | 'resolved' | 'suppressed',
  ): Promise<number> {
    try {
      if (ids.length === 0) {
        return 0;
      }
      const result = await this.repository
        .createQueryBuilder()
        .update(AlertHistory)
        .set({ status })
        .whereInIds(ids)
        .execute();
      return result.affected || 0;
    } catch (error) {
      this.logger.error('�������¸澯״̬ʧ��', { error });
      throw error;
    }
  }

  /**
   * ��ȡ�澯ͳ����Ϣ
   * @returns ��Ϣͳ��
   */
  async getAlertStats(): Promise<{
    total: number;
    triggered: number;
    resolved: number;
    suppressed: number;
  }> {
    try {
      const total = await this.repository.count();
      const triggered = await this.repository.count({
        where: { status: 'triggered' },
      });
      const resolved = await this.repository.count({
        where: { status: 'resolved' },
      });
      const suppressed = await this.repository.count({
        where: { status: 'suppressed' },
      });
      return { total, triggered, resolved, suppressed };
    } catch (error) {
      this.logger.error('��ȡ�澯ͳ��ʧ��', { error });
      throw error;
    }
  }

  /**
   * �����ѽ���ĸ澯ʷ������������
   * @param daysOld �����쳣������
   * @returns ɾ��������
   */
  async cleanupResolvedAlerts(daysOld: number = 30): Promise<number> {
    try {
      const beforeTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from(AlertHistory)
        .where('status = :status AND triggered_at < :beforeTime', {
          status: 'resolved',
          beforeTime,
        })
        .execute();
      return result.affected || 0;
    } catch (error) {
      this.logger.error('�����ѽ���ĸ澯ʧ��', { error });
      throw error;
    }
  }
}
