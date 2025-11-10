/**
 * Jest teardown - 全局测试清理
 */

// 全局清理函数
export default async function globalTeardown() {
  // 清理全局测试数据源引用
  if ((globalThis as any).__TEST_DATASOURCE) {
    const dataSource = (globalThis as any).__TEST_DATASOURCE;
    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    } catch (error) {
      console.error('Error cleaning up global test datasource:', error);
    } finally {
      delete (globalThis as any).__TEST_DATASOURCE;
    }
  }

  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }

  // 清理所有定时器
  jest.clearAllTimers();
  
  // 确保进程退出
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}