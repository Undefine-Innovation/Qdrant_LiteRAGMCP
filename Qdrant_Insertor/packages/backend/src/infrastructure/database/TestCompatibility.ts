/**
 * TypeORM测试兼容性模块
 * 提供测试环境下的兼容性功能
 */

import { DataSource } from 'typeorm';

/**
 * 测试TypeORM兼容性
 * @param dataSource TypeORM数据源
 * @returns 测试结果
 */
export function testTypeORMCompatibility(dataSource: DataSource): {
  success: boolean;
  message: string;
} {
  try {
    // 简单的连接测试
    if (dataSource && dataSource.isInitialized) {
      return {
        success: true,
        message: 'TypeORM dataSource is initialized and compatible',
      };
    }

    return {
      success: false,
      message: 'TypeORM dataSource is not properly initialized',
    };
  } catch (error) {
    return {
      success: false,
      message: `TypeORM compatibility test failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
