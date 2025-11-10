/**
 * SyncJobStatusMapper - 统一的同步作业状态映射器
 *
 * 解决状态映射分散问题，提供：
 * 1. 数据库状态到领域状态的映射
 * 2. 领域状态到数据库状态的映射
 * 3. 状态验证和转换逻辑
 * 4. 状态转换的合法性检查
 */

import { SyncJobStatus } from './types.js';

/**
 * 数据库状态枚举
 * 定义数据库中实际存储的状态值
 */
export enum DbSyncJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 状态类别枚举
 * 用于状态分组和业务逻辑判断
 */
export enum StatusCategory {
  INITIAL = 'initial', // 初始状态
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 失败状态
  TERMINAL = 'terminal', // 终态（不可恢复）
}

/**
 * 状态转换规则
 * 定义合法的状态转换路径
 */
interface StatusTransitionRule {
  from: SyncJobStatus;
  to: SyncJobStatus;
  description?: string;
}

/**
 * 状态元数据
 * 包含状态的额外信息
 */
interface StatusMetadata {
  category: StatusCategory;
  description: string;
  isTerminal: boolean;
  canRetry: boolean;
  userFriendlyName: string;
}

/**
 * 统一的同步作业状态映射器
 */
export class SyncJobStatusMapper {
  /**
   * 领域状态到数据库状态的映射表
   */
  private static readonly DOMAIN_TO_DB_MAP: Record<
    SyncJobStatus,
    DbSyncJobStatus
  > = {
    [SyncJobStatus.NEW]: DbSyncJobStatus.PENDING,
    [SyncJobStatus.SPLIT_OK]: DbSyncJobStatus.PROCESSING,
    [SyncJobStatus.EMBED_OK]: DbSyncJobStatus.PROCESSING,
    [SyncJobStatus.SYNCED]: DbSyncJobStatus.COMPLETED,
    [SyncJobStatus.FAILED]: DbSyncJobStatus.FAILED,
    [SyncJobStatus.RETRYING]: DbSyncJobStatus.PROCESSING,
    [SyncJobStatus.DEAD]: DbSyncJobStatus.CANCELLED,
  };

  /**
   * 数据库状态到领域状态的映射表
   */
  private static readonly DB_TO_DOMAIN_MAP: Record<
    DbSyncJobStatus,
    SyncJobStatus
  > = {
    [DbSyncJobStatus.PENDING]: SyncJobStatus.NEW,
    [DbSyncJobStatus.PROCESSING]: SyncJobStatus.RETRYING, // 默认处理状态为重试
    [DbSyncJobStatus.COMPLETED]: SyncJobStatus.SYNCED,
    [DbSyncJobStatus.FAILED]: SyncJobStatus.FAILED,
    [DbSyncJobStatus.CANCELLED]: SyncJobStatus.DEAD,
  };

  /**
   * 状态元数据映射表
   */
  private static readonly STATUS_METADATA: Record<
    SyncJobStatus,
    StatusMetadata
  > = {
    [SyncJobStatus.NEW]: {
      category: StatusCategory.INITIAL,
      description: '新创建的同步作业，等待处理',
      isTerminal: false,
      canRetry: false,
      userFriendlyName: '新建',
    },
    [SyncJobStatus.SPLIT_OK]: {
      category: StatusCategory.PROCESSING,
      description: '文档分割完成，等待嵌入生成',
      isTerminal: false,
      canRetry: true,
      userFriendlyName: '已分割',
    },
    [SyncJobStatus.EMBED_OK]: {
      category: StatusCategory.PROCESSING,
      description: '嵌入生成完成，等待向量插入',
      isTerminal: false,
      canRetry: true,
      userFriendlyName: '已嵌入',
    },
    [SyncJobStatus.SYNCED]: {
      category: StatusCategory.COMPLETED,
      description: '同步完成，所有步骤均已成功执行',
      isTerminal: true,
      canRetry: false,
      userFriendlyName: '已同步',
    },
    [SyncJobStatus.FAILED]: {
      category: StatusCategory.FAILED,
      description: '同步失败，可以重试',
      isTerminal: false,
      canRetry: true,
      userFriendlyName: '失败',
    },
    [SyncJobStatus.RETRYING]: {
      category: StatusCategory.PROCESSING,
      description: '正在重试失败的同步操作',
      isTerminal: false,
      canRetry: false,
      userFriendlyName: '重试中',
    },
    [SyncJobStatus.DEAD]: {
      category: StatusCategory.TERMINAL,
      description: '同步作业已死亡，无法恢复',
      isTerminal: true,
      canRetry: false,
      userFriendlyName: '已死亡',
    },
  };

  /**
   * 合法的状态转换规则
   */
  private static readonly VALID_TRANSITIONS: StatusTransitionRule[] = [
    // 初始状态转换
    {
      from: SyncJobStatus.NEW,
      to: SyncJobStatus.SPLIT_OK,
      description: '开始处理文档',
    },
    {
      from: SyncJobStatus.NEW,
      to: SyncJobStatus.FAILED,
      description: '处理失败',
    },
    {
      from: SyncJobStatus.NEW,
      to: SyncJobStatus.DEAD,
      description: '永久失败',
    },

    // 处理中状态转换
    {
      from: SyncJobStatus.SPLIT_OK,
      to: SyncJobStatus.EMBED_OK,
      description: '分割完成，开始嵌入',
    },
    {
      from: SyncJobStatus.SPLIT_OK,
      to: SyncJobStatus.FAILED,
      description: '嵌入生成失败',
    },
    {
      from: SyncJobStatus.SPLIT_OK,
      to: SyncJobStatus.DEAD,
      description: '永久失败',
    },

    {
      from: SyncJobStatus.EMBED_OK,
      to: SyncJobStatus.SYNCED,
      description: '嵌入完成，同步成功',
    },
    {
      from: SyncJobStatus.EMBED_OK,
      to: SyncJobStatus.FAILED,
      description: '向量插入失败',
    },
    {
      from: SyncJobStatus.EMBED_OK,
      to: SyncJobStatus.DEAD,
      description: '永久失败',
    },

    // 失败状态转换
    {
      from: SyncJobStatus.FAILED,
      to: SyncJobStatus.RETRYING,
      description: '开始重试',
    },
    {
      from: SyncJobStatus.FAILED,
      to: SyncJobStatus.DEAD,
      description: '重试次数超限',
    },

    // 重试状态转换
    {
      from: SyncJobStatus.RETRYING,
      to: SyncJobStatus.SPLIT_OK,
      description: '重试成功，回到处理流程',
    },
    {
      from: SyncJobStatus.RETRYING,
      to: SyncJobStatus.EMBED_OK,
      description: '重试成功，回到处理流程',
    },
    {
      from: SyncJobStatus.RETRYING,
      to: SyncJobStatus.FAILED,
      description: '重试失败',
    },
    {
      from: SyncJobStatus.RETRYING,
      to: SyncJobStatus.DEAD,
      description: '重试次数超限',
    },

    // 终态转换（特殊情况下可能发生）
    {
      from: SyncJobStatus.SYNCED,
      to: SyncJobStatus.FAILED,
      description: '同步后发现问题，标记为失败',
    },
    {
      from: SyncJobStatus.DEAD,
      to: SyncJobStatus.RETRYING,
      description: '手动恢复，重新尝试',
    },
  ];

  /**
   * 将领域状态转换为数据库状态
   * @param domainStatus 领域状态
   * @returns 数据库状态
   */
  public static toDbStatus(domainStatus: SyncJobStatus): DbSyncJobStatus {
    const dbStatus = this.DOMAIN_TO_DB_MAP[domainStatus];
    if (!dbStatus) {
      throw new Error(`未知的领域状态: ${domainStatus}`);
    }
    return dbStatus;
  }

  /**
   * 将数据库状态转换为领域状态
   * @param dbStatus 数据库状态
   * @returns 领域状态
   */
  public static toDomainStatus(dbStatus: DbSyncJobStatus): SyncJobStatus {
    const domainStatus = this.DB_TO_DOMAIN_MAP[dbStatus];
    if (!domainStatus) {
      throw new Error(`未知的数据库状态: ${dbStatus}`);
    }
    return domainStatus;
  }

  /**
   * 安全地将数据库状态转换为领域状态
   * 如果状态未知，返回默认状态
   * @param dbStatus 数据库状态
   * @param defaultStatus 默认状态
   * @returns 领域状态
   */
  public static toDomainStatusSafe(
    dbStatus: string,
    defaultStatus: SyncJobStatus = SyncJobStatus.NEW,
  ): SyncJobStatus {
    try {
      return this.toDomainStatus(dbStatus as DbSyncJobStatus);
    } catch {
      return defaultStatus;
    }
  }

  /**
   * 获取状态的元数据
   * @param status 领域状态
   * @returns 状态元数据
   */
  public static getStatusMetadata(status: SyncJobStatus): StatusMetadata {
    const metadata = this.STATUS_METADATA[status];
    if (!metadata) {
      throw new Error(`未知的领域状态: ${status}`);
    }
    return metadata;
  }

  /**
   * 检查状态转换是否合法
   * @param fromStatus 源状态
   * @param toStatus 目标状态
   * @returns 是否合法
   */
  public static isValidTransition(
    fromStatus: SyncJobStatus,
    toStatus: SyncJobStatus,
  ): boolean {
    return this.VALID_TRANSITIONS.some(
      (transition) =>
        transition.from === fromStatus && transition.to === toStatus,
    );
  }

  /**
   * 获取状态转换的描述
   * @param fromStatus 源状态
   * @param toStatus 目标状态
   * @returns 转换描述
   */
  public static getTransitionDescription(
    fromStatus: SyncJobStatus,
    toStatus: SyncJobStatus,
  ): string | undefined {
    const transition = this.VALID_TRANSITIONS.find(
      (t) => t.from === fromStatus && t.to === toStatus,
    );
    return transition?.description;
  }

  /**
   * 获取所有可能的下一状态
   * @param fromStatus 源状态
   * @returns 可能的下一状态列表
   */
  public static getPossibleNextStates(
    fromStatus: SyncJobStatus,
  ): SyncJobStatus[] {
    return this.VALID_TRANSITIONS.filter(
      (transition) => transition.from === fromStatus,
    ).map((transition) => transition.to);
  }

  /**
   * 检查状态是否为终态
   * @param status 领域状态
   * @returns 是否为终态
   */
  public static isTerminalStatus(status: SyncJobStatus): boolean {
    return this.getStatusMetadata(status).isTerminal;
  }

  /**
   * 检查状态是否可以重试
   * @param status 领域状态
   * @returns 是否可以重试
   */
  public static canRetry(status: SyncJobStatus): boolean {
    return this.getStatusMetadata(status).canRetry;
  }

  /**
   * 获取状态类别
   * @param status 领域状态
   * @returns 状态类别
   */
  public static getStatusCategory(status: SyncJobStatus): StatusCategory {
    return this.getStatusMetadata(status).category;
  }

  /**
   * 获取用户友好的状态名称
   * @param status 领域状态
   * @returns 用户友好的状态名称
   */
  public static getUserFriendlyName(status: SyncJobStatus): string {
    return this.getStatusMetadata(status).userFriendlyName;
  }

  /**
   * 获取所有领域状态
   * @returns 所有领域状态列表
   */
  public static getAllDomainStatuses(): SyncJobStatus[] {
    return Object.values(SyncJobStatus);
  }

  /**
   * 获取所有数据库状态
   * @returns 所有数据库状态列表
   */
  public static getAllDbStatuses(): DbSyncJobStatus[] {
    return Object.values(DbSyncJobStatus);
  }

  /**
   * 验证领域状态是否有效
   * @param status 领域状态
   * @returns 是否有效
   */
  public static isValidDomainStatus(status: string): status is SyncJobStatus {
    return Object.values(SyncJobStatus).includes(status as SyncJobStatus);
  }

  /**
   * 验证数据库状态是否有效
   * @param status 数据库状态
   * @returns 是否有效
   */
  public static isValidDbStatus(status: string): status is DbSyncJobStatus {
    return Object.values(DbSyncJobStatus).includes(status as DbSyncJobStatus);
  }

  /**
   * 根据类别获取状态列表
   * @param category 状态类别
   * @returns 该类别的状态列表
   */
  public static getStatusesByCategory(
    category: StatusCategory,
  ): SyncJobStatus[] {
    return Object.entries(this.STATUS_METADATA)
      .filter(([_, metadata]) => metadata.category === category)
      .map(([status, _]) => status as SyncJobStatus);
  }

  /**
   * 创建状态转换验证错误
   * @param fromStatus 源状态
   * @param toStatus 目标状态
   * @returns 错误对象
   * @throws 验证失败时抛出错误
   */
  public static createTransitionError(
    fromStatus: SyncJobStatus,
    toStatus: SyncJobStatus,
  ): Error {
    // 验证输入参数
    if (!fromStatus || !toStatus) {
      throw new Error('状态转换参数不能为空');
    }

    // 验证状态是否有效
    if (!this.isValidDomainStatus(fromStatus)) {
      throw new Error(`无效的源状态: ${fromStatus}`);
    }

    if (!this.isValidDomainStatus(toStatus)) {
      throw new Error(`无效的目标状态: ${toStatus}`);
    }

    const possibleStates = this.getPossibleNextStates(fromStatus);
    return new Error(
      `非法的状态转换: ${fromStatus} -> ${toStatus}。` +
        `允许的转换目标: ${possibleStates.join(', ')}`,
    );
  }
}
