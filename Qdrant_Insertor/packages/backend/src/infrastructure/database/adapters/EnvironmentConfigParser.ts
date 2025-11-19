import {
  DatabaseConfig,
  DatabaseType,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * 环境变量配置解析器
 * 从环境变量中读取数据库配置
 */
export class EnvironmentConfigParser {
  /**
   * 从环境变量解析数据库配置
   * @returns 数据库配置
   */
  static parseFromEnv(): DatabaseConfig {
    const dbType = process.env.DB_TYPE?.toLowerCase();

    if (dbType === 'postgres' || dbType === 'postgresql') {
      return {
        type: DatabaseType.POSTGRESQL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'qdrant_rag',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
        connectionTimeout: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || '10000',
        ),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
      };
    } else {
      return {
        type: DatabaseType.SQLITE,
        path: process.env.DB_PATH || './data/app.db',
        maxConnections: 1,
        minConnections: 1,
        connectionTimeout: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || '30000',
        ),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
      };
    }
  }

  /**
   * 验证必需的环境变量
   * @returns 验证结果
   */
  static validateEnvVars(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const dbType = process.env.DB_TYPE?.toLowerCase();

    if (!dbType) {
      errors.push('DB_TYPE环境变量未设置');
    } else if (dbType === 'postgres' || dbType === 'postgresql') {
      if (!process.env.DB_HOST) errors.push('DB_HOST环境变量未设置');
      if (!process.env.DB_USERNAME) errors.push('DB_USERNAME环境变量未设置');
      if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD环境变量未设置');
      if (!process.env.DB_NAME) errors.push('DB_NAME环境变量未设置');
    } else if (dbType === 'sqlite') {
      // SQLite的路径是可选的，有默认值
    } else {
      errors.push(`不支持的数据库类型: ${dbType}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取环境变量配置摘要
   * @returns 配置摘要（隐藏敏感信息）
   */
  static getConfigSummary(): {
    dbType: string;
    config: Partial<DatabaseConfig>;
    masked: boolean;
  } {
    const config = this.parseFromEnv();
    const masked: Partial<DatabaseConfig> = { ...config };

    // 隐藏敏感信息
    if (typeof masked.password === 'string' && masked.password.length > 0) {
      masked.password = '***';
    }

    return {
      dbType: config.type,
      config: masked,
      masked: true,
    };
  }

  /**
   * 检查环境变量是否完整
   * @returns 检查结果
   */
  static checkEnvCompleteness(): {
    complete: boolean;
    missing: string[];
    optional: string[];
  } {
    const dbType = process.env.DB_TYPE?.toLowerCase();
    const missing: string[] = [];
    const optional: string[] = [];

    if (!dbType) {
      missing.push('DB_TYPE');
    } else if (dbType === 'postgres' || dbType === 'postgresql') {
      // PostgreSQL必需的环境变量
      if (!process.env.DB_HOST) missing.push('DB_HOST');
      if (!process.env.DB_USERNAME) missing.push('DB_USERNAME');
      if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
      if (!process.env.DB_NAME) missing.push('DB_NAME');

      // PostgreSQL可选的环境变量
      if (!process.env.DB_PORT) optional.push('DB_PORT');
      if (!process.env.DB_SSL) optional.push('DB_SSL');
      if (!process.env.DB_MAX_CONNECTIONS) optional.push('DB_MAX_CONNECTIONS');
      if (!process.env.DB_MIN_CONNECTIONS) optional.push('DB_MIN_CONNECTIONS');
      if (!process.env.DB_CONNECTION_TIMEOUT)
        optional.push('DB_CONNECTION_TIMEOUT');
      if (!process.env.DB_IDLE_TIMEOUT) optional.push('DB_IDLE_TIMEOUT');
    } else if (dbType === 'sqlite') {
      // SQLite可选的环境变量
      if (!process.env.DB_PATH) optional.push('DB_PATH');
      if (!process.env.DB_CONNECTION_TIMEOUT)
        optional.push('DB_CONNECTION_TIMEOUT');
      if (!process.env.DB_IDLE_TIMEOUT) optional.push('DB_IDLE_TIMEOUT');
    }

    return {
      complete: missing.length === 0,
      missing,
      optional,
    };
  }

  /**
   * 验证环境变量值的格式
   * @returns 验证结果
   */
  static validateEnvFormats(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const dbType = process.env.DB_TYPE?.toLowerCase();

    if (dbType === 'postgres' || dbType === 'postgresql') {
      // 验证端口号
      const port = process.env.DB_PORT;
      if (port && isNaN(parseInt(port))) {
        errors.push('DB_PORT必须是有效的数字');
      } else if (port) {
        const portNum = parseInt(port);
        if (portNum <= 0 || portNum > 65535) {
          errors.push('DB_PORT必须在1-65535范围内');
        }
      }

      // 验证连接数
      const maxConnections = process.env.DB_MAX_CONNECTIONS;
      if (maxConnections && isNaN(parseInt(maxConnections))) {
        errors.push('DB_MAX_CONNECTIONS必须是有效的数字');
      }

      const minConnections = process.env.DB_MIN_CONNECTIONS;
      if (minConnections && isNaN(parseInt(minConnections))) {
        errors.push('DB_MIN_CONNECTIONS必须是有效的数字');
      }

      // 验证超时时间
      const connectionTimeout = process.env.DB_CONNECTION_TIMEOUT;
      if (connectionTimeout && isNaN(parseInt(connectionTimeout))) {
        errors.push('DB_CONNECTION_TIMEOUT必须是有效的数字');
      }

      const idleTimeout = process.env.DB_IDLE_TIMEOUT;
      if (idleTimeout && isNaN(parseInt(idleTimeout))) {
        errors.push('DB_IDLE_TIMEOUT必须是有效的数字');
      }

      // 验证SSL设置
      const ssl = process.env.DB_SSL;
      if (ssl && ssl !== 'true' && ssl !== 'false') {
        errors.push('DB_SSL必须是true或false');
      }
    } else if (dbType === 'sqlite') {
      // 验证SQLite的超时时间
      const connectionTimeout = process.env.DB_CONNECTION_TIMEOUT;
      if (connectionTimeout && isNaN(parseInt(connectionTimeout))) {
        errors.push('DB_CONNECTION_TIMEOUT必须是有效的数字');
      }

      const idleTimeout = process.env.DB_IDLE_TIMEOUT;
      if (idleTimeout && isNaN(parseInt(idleTimeout))) {
        errors.push('DB_IDLE_TIMEOUT必须是有效的数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取默认环境变量值
   * @returns 默认环境变量值
   */
  static getDefaultEnvValues(): Record<string, string> {
    return {
      DB_TYPE: 'sqlite',
      DB_PATH: './data/app.db',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: '',
      DB_NAME: 'qdrant_rag',
      DB_SSL: 'false',
      DB_MAX_CONNECTIONS: '20',
      DB_MIN_CONNECTIONS: '5',
      DB_CONNECTION_TIMEOUT: '10000',
      DB_IDLE_TIMEOUT: '300000',
    };
  }

  /**
   * 生成环境变量配置示例
   * @param dbType 数据库类型
   * @returns 配置示例
   */
  static generateEnvExample(dbType: DatabaseType): string {
    const defaults = this.getDefaultEnvValues();

    if (dbType === DatabaseType.POSTGRESQL) {
      return `# PostgreSQL数据库配置
DB_TYPE=postgres
DB_HOST=${defaults.DB_HOST}
DB_PORT=${defaults.DB_PORT}
DB_USERNAME=${defaults.DB_USERNAME}
DB_PASSWORD=your_password_here
DB_NAME=${defaults.DB_NAME}
DB_SSL=${defaults.DB_SSL}
DB_MAX_CONNECTIONS=${defaults.DB_MAX_CONNECTIONS}
DB_MIN_CONNECTIONS=${defaults.DB_MIN_CONNECTIONS}
DB_CONNECTION_TIMEOUT=${defaults.DB_CONNECTION_TIMEOUT}
DB_IDLE_TIMEOUT=${defaults.DB_IDLE_TIMEOUT}`;
    } else {
      return `# SQLite数据库配置
DB_TYPE=sqlite
DB_PATH=${defaults.DB_PATH}
DB_CONNECTION_TIMEOUT=${defaults.DB_CONNECTION_TIMEOUT}
DB_IDLE_TIMEOUT=${defaults.DB_IDLE_TIMEOUT}`;
    }
  }
}
