/**
 * API层主导出文件
 * 按照DDD架构重新组织，导出所有API相关的路由和中间件
 */

// 路由定义
export * from './routes/index.js';

// 中间件
export * from './middleware/Index.js';

// API契约
export * from './contracts/index.js';

// 监控API
export * from './Monitoring.js';

// Swagger配置
// export * from './swagger/swagger-config.js'; // 暂时注释
