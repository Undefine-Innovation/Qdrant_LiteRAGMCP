/**
 * 测试工具库统一导出
 * 提供所有测试工具函数的统一入口
 */

// Mock工厂和设置
export {
  MockFactory,
  MockSetupHelpers,
  CommonTestScenarios,
} from './test-mocks.js';

// 断言工具
export {
  DatabaseAssertions,
  ApiAssertions,
  CommonAssertions,
  BusinessAssertions,
  DB,
  API,
  Common,
  Business,
} from './test-assertions.js';

// 统一数据工厂
export { UnifiedDataFactory } from './unified-data-factory.js';

// 测试设置和清理
export {
  TestEnvironmentManager,
  TestHelpers,
  setupGlobalTestEnvironment,
  getTestEnvironmentManager,
} from './test-setup.js';

// 向后兼容的导出
export { TestDataFactory } from '../integration/test-data-factory.js';
export {
  initializeTestDatabase,
  cleanupTestDatabase,
  resetTestDatabase,
  getTestDataSource,
  getTestConfig,
  getTestLogger,
  withTestTransaction,
  createTestData,
  validateDatabaseState,
  TestUtils,
} from '../integration/setup.js';
export { TestAssertions } from '../integration/test-assertions.js';
