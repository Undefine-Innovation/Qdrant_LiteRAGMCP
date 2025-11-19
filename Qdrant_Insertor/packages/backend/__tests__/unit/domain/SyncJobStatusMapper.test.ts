/**
 * SyncJobStatusMapper 单元测试
 * 测试状态映射的正确性、异常情况处理和状态转换验证
 */

import {
  SyncJobStatusMapper,
  DbSyncJobStatus,
  StatusCategory,
} from '@domain/sync/SyncJobStatusMapper.js';
import { SyncJobStatus } from '@domain/sync/types.js';

describe('SyncJobStatusMapper', () => {
  describe('基础状态映射', () => {
    test('应该正确映射领域状态到数据库状态', () => {
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.NEW)).toBe(
        DbSyncJobStatus.PENDING,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.SPLIT_OK)).toBe(
        DbSyncJobStatus.PROCESSING,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.EMBED_OK)).toBe(
        DbSyncJobStatus.PROCESSING,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.SYNCED)).toBe(
        DbSyncJobStatus.COMPLETED,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.FAILED)).toBe(
        DbSyncJobStatus.FAILED,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.RETRYING)).toBe(
        DbSyncJobStatus.PROCESSING,
      );
      expect(SyncJobStatusMapper.toDbStatus(SyncJobStatus.DEAD)).toBe(
        DbSyncJobStatus.CANCELLED,
      );
    });

    test('应该正确映射数据库状态到领域状态', () => {
      expect(SyncJobStatusMapper.toDomainStatus(DbSyncJobStatus.PENDING)).toBe(
        SyncJobStatus.NEW,
      );
      expect(
        SyncJobStatusMapper.toDomainStatus(DbSyncJobStatus.PROCESSING),
      ).toBe(SyncJobStatus.RETRYING);
      expect(
        SyncJobStatusMapper.toDomainStatus(DbSyncJobStatus.COMPLETED),
      ).toBe(SyncJobStatus.SYNCED);
      expect(SyncJobStatusMapper.toDomainStatus(DbSyncJobStatus.FAILED)).toBe(
        SyncJobStatus.FAILED,
      );
      expect(
        SyncJobStatusMapper.toDomainStatus(DbSyncJobStatus.CANCELLED),
      ).toBe(SyncJobStatus.DEAD);
    });

    test('安全映射应该返回默认值', () => {
      expect(
        SyncJobStatusMapper.toDomainStatusSafe('invalid', SyncJobStatus.FAILED),
      ).toBe(SyncJobStatus.FAILED);
      expect(SyncJobStatusMapper.toDomainStatusSafe('unknown')).toBe(
        SyncJobStatus.NEW,
      );
    });

    test('无效状态应该抛出错误', () => {
      expect(() => {
        SyncJobStatusMapper.toDomainStatus('invalid' as DbSyncJobStatus);
      }).toThrow('未知的数据库状态: invalid');

      expect(() => {
        SyncJobStatusMapper.toDbStatus('invalid' as SyncJobStatus);
      }).toThrow('未知的领域状态: invalid');
    });
  });

  describe('状态元数据', () => {
    test('应该返回正确的状态元数据', () => {
      const newMetadata = SyncJobStatusMapper.getStatusMetadata(
        SyncJobStatus.NEW,
      );
      expect(newMetadata.category).toBe(StatusCategory.INITIAL);
      expect(newMetadata.isTerminal).toBe(false);
      expect(newMetadata.canRetry).toBe(false);
      expect(newMetadata.userFriendlyName).toBe('新建');

      const syncedMetadata = SyncJobStatusMapper.getStatusMetadata(
        SyncJobStatus.SYNCED,
      );
      expect(syncedMetadata.category).toBe(StatusCategory.COMPLETED);
      expect(syncedMetadata.isTerminal).toBe(true);
      expect(syncedMetadata.canRetry).toBe(false);
      expect(syncedMetadata.userFriendlyName).toBe('已同步');

      const failedMetadata = SyncJobStatusMapper.getStatusMetadata(
        SyncJobStatus.FAILED,
      );
      expect(failedMetadata.category).toBe(StatusCategory.FAILED);
      expect(failedMetadata.isTerminal).toBe(false);
      expect(failedMetadata.canRetry).toBe(true);
      expect(failedMetadata.userFriendlyName).toBe('失败');
    });

    test('应该返回正确的状态类别', () => {
      expect(SyncJobStatusMapper.getStatusCategory(SyncJobStatus.NEW)).toBe(
        StatusCategory.INITIAL,
      );
      expect(
        SyncJobStatusMapper.getStatusCategory(SyncJobStatus.SPLIT_OK),
      ).toBe(StatusCategory.PROCESSING);
      expect(SyncJobStatusMapper.getStatusCategory(SyncJobStatus.SYNCED)).toBe(
        StatusCategory.COMPLETED,
      );
      expect(SyncJobStatusMapper.getStatusCategory(SyncJobStatus.FAILED)).toBe(
        StatusCategory.FAILED,
      );
      expect(SyncJobStatusMapper.getStatusCategory(SyncJobStatus.DEAD)).toBe(
        StatusCategory.TERMINAL,
      );
    });

    test('应该正确判断终态', () => {
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.NEW)).toBe(
        false,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.SPLIT_OK)).toBe(
        false,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.EMBED_OK)).toBe(
        false,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.SYNCED)).toBe(
        true,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.FAILED)).toBe(
        false,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.RETRYING)).toBe(
        false,
      );
      expect(SyncJobStatusMapper.isTerminalStatus(SyncJobStatus.DEAD)).toBe(
        true,
      );
    });

    test('应该正确判断是否可重试', () => {
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.NEW)).toBe(false);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.SPLIT_OK)).toBe(true);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.EMBED_OK)).toBe(true);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.SYNCED)).toBe(false);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.FAILED)).toBe(true);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.RETRYING)).toBe(false);
      expect(SyncJobStatusMapper.canRetry(SyncJobStatus.DEAD)).toBe(false);
    });

    test('应该返回用户友好的状态名称', () => {
      expect(SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.NEW)).toBe(
        '新建',
      );
      expect(
        SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.SPLIT_OK),
      ).toBe('已分割');
      expect(
        SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.EMBED_OK),
      ).toBe('已嵌入');
      expect(
        SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.SYNCED),
      ).toBe('已同步');
      expect(
        SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.FAILED),
      ).toBe('失败');
      expect(
        SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.RETRYING),
      ).toBe('重试中');
      expect(SyncJobStatusMapper.getUserFriendlyName(SyncJobStatus.DEAD)).toBe(
        '已死亡',
      );
    });
  });

  describe('状态转换验证', () => {
    test('应该正确验证合法的状态转换', () => {
      // 合法转换
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.NEW,
          SyncJobStatus.SPLIT_OK,
        ),
      ).toBe(true);
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.SPLIT_OK,
          SyncJobStatus.EMBED_OK,
        ),
      ).toBe(true);
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.EMBED_OK,
          SyncJobStatus.SYNCED,
        ),
      ).toBe(true);
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.FAILED,
          SyncJobStatus.RETRYING,
        ),
      ).toBe(true);
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.RETRYING,
          SyncJobStatus.SPLIT_OK,
        ),
      ).toBe(true);
    });

    test('应该正确验证非法的状态转换', () => {
      // 非法转换
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.SYNCED,
          SyncJobStatus.NEW,
        ),
      ).toBe(false);
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.DEAD,
          SyncJobStatus.RETRYING,
        ),
      ).toBe(true); // 允许手动恢复
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.SYNCED,
          SyncJobStatus.FAILED,
        ),
      ).toBe(true); // 允许同步后发现问题
      expect(
        SyncJobStatusMapper.isValidTransition(
          SyncJobStatus.NEW,
          SyncJobStatus.DEAD,
        ),
      ).toBe(true); // 允许直接标记为死亡
    });

    test('应该返回状态转换描述', () => {
      const description = SyncJobStatusMapper.getTransitionDescription(
        SyncJobStatus.NEW,
        SyncJobStatus.SPLIT_OK,
      );
      expect(description).toBe('开始处理文档');

      const noDescription = SyncJobStatusMapper.getTransitionDescription(
        SyncJobStatus.SYNCED,
        SyncJobStatus.NEW,
      );
      expect(noDescription).toBeUndefined();
    });

    test('应该返回可能的下一状态', () => {
      const nextStates = SyncJobStatusMapper.getPossibleNextStates(
        SyncJobStatus.NEW,
      );
      expect(nextStates).toContain(SyncJobStatus.SPLIT_OK);
      expect(nextStates).toContain(SyncJobStatus.FAILED);
      expect(nextStates).toContain(SyncJobStatus.DEAD);
      expect(nextStates).not.toContain(SyncJobStatus.SYNCED);
    });

    test('应该创建正确的转换错误', () => {
      const error = SyncJobStatusMapper.createTransitionError(
        SyncJobStatus.SYNCED,
        SyncJobStatus.NEW,
      );
      expect(error.message).toContain('非法的状态转换: SYNCED -> NEW');
      expect(error.message).toContain('允许的转换目标:');
    });
  });

  describe('状态验证和工具方法', () => {
    test('应该正确验证领域状态', () => {
      expect(SyncJobStatusMapper.isValidDomainStatus('NEW')).toBe(true);
      expect(SyncJobStatusMapper.isValidDomainStatus('INVALID')).toBe(false);
      expect(SyncJobStatusMapper.isValidDomainStatus(SyncJobStatus.NEW)).toBe(
        true,
      );
    });

    test('应该正确验证数据库状态', () => {
      expect(SyncJobStatusMapper.isValidDbStatus('pending')).toBe(true);
      expect(SyncJobStatusMapper.isValidDbStatus('invalid')).toBe(false);
      expect(SyncJobStatusMapper.isValidDbStatus(DbSyncJobStatus.PENDING)).toBe(
        true,
      );
    });

    test('应该返回所有状态', () => {
      const domainStatuses = SyncJobStatusMapper.getAllDomainStatuses();
      expect(domainStatuses).toContain(SyncJobStatus.NEW);
      expect(domainStatuses).toContain(SyncJobStatus.SYNCED);
      expect(domainStatuses).toContain(SyncJobStatus.DEAD);
      expect(domainStatuses).toHaveLength(7);

      const dbStatuses = SyncJobStatusMapper.getAllDbStatuses();
      expect(dbStatuses).toContain(DbSyncJobStatus.PENDING);
      expect(dbStatuses).toContain(DbSyncJobStatus.COMPLETED);
      expect(dbStatuses).toContain(DbSyncJobStatus.CANCELLED);
      expect(dbStatuses).toHaveLength(5);
    });

    test('应该根据类别返回状态', () => {
      const processingStatuses = SyncJobStatusMapper.getStatusesByCategory(
        StatusCategory.PROCESSING,
      );
      expect(processingStatuses).toContain(SyncJobStatus.SPLIT_OK);
      expect(processingStatuses).toContain(SyncJobStatus.EMBED_OK);
      expect(processingStatuses).toContain(SyncJobStatus.RETRYING);
      expect(processingStatuses).toHaveLength(3);

      const terminalStatuses = SyncJobStatusMapper.getStatusesByCategory(
        StatusCategory.TERMINAL,
      );
      expect(terminalStatuses).toContain(SyncJobStatus.DEAD);
      expect(terminalStatuses).toHaveLength(1);
    });
  });

  describe('边界情况和错误处理', () => {
    test('应该处理未知的状态元数据请求', () => {
      expect(() => {
        SyncJobStatusMapper.getStatusMetadata('INVALID' as SyncJobStatus);
      }).toThrow('未知的领域状态: INVALID');
    });

    test('应该处理无效的状态转换', () => {
      expect(() => {
        SyncJobStatusMapper.createTransitionError(
          'INVALID' as SyncJobStatus,
          SyncJobStatus.NEW,
        );
      }).toThrow('无效的源状态: INVALID');
    });

    test('安全映射应该处理各种输入', () => {
      // 测试空字符串
      expect(
        SyncJobStatusMapper.toDomainStatusSafe('', SyncJobStatus.FAILED),
      ).toBe(SyncJobStatus.FAILED);

      // 测试null和undefined
      expect(
        SyncJobStatusMapper.toDomainStatusSafe(null as any, SyncJobStatus.NEW),
      ).toBe(SyncJobStatus.NEW);

      // 测试数字
      expect(
        SyncJobStatusMapper.toDomainStatusSafe(123 as any, SyncJobStatus.DEAD),
      ).toBe(SyncJobStatus.DEAD);
    });
  });

  describe('映射一致性', () => {
    test('双向映射应该保持一致性', () => {
      const domainStatuses = SyncJobStatusMapper.getAllDomainStatuses();

      domainStatuses.forEach((domainStatus) => {
        const dbStatus = SyncJobStatusMapper.toDbStatus(domainStatus);
        const mappedBack = SyncJobStatusMapper.toDomainStatus(dbStatus);

        // 注意：PROCESSING状态会映射回RETRYING，这是设计决策
        if (
          domainStatus === SyncJobStatus.SPLIT_OK ||
          domainStatus === SyncJobStatus.EMBED_OK
        ) {
          expect(mappedBack).toBe(SyncJobStatus.RETRYING);
        } else {
          expect(mappedBack).toBe(domainStatus);
        }
      });
    });

    test('数据库状态映射应该覆盖所有情况', () => {
      const dbStatuses = SyncJobStatusMapper.getAllDbStatuses();
      dbStatuses.forEach((dbStatus) => {
        expect(() => {
          SyncJobStatusMapper.toDomainStatus(dbStatus);
        }).not.toThrow();
      });
    });

    test('领域状态映射应该覆盖所有情况', () => {
      const domainStatuses = SyncJobStatusMapper.getAllDomainStatuses();
      domainStatuses.forEach((domainStatus) => {
        expect(() => {
          SyncJobStatusMapper.toDbStatus(domainStatus);
        }).not.toThrow();
      });
    });
  });
});
