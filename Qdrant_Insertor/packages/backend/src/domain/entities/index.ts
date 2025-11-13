/**
 * 领域实体模块主导出文件
 * 导出所有实体相关的类型和实现
 */

// 核心实体类
export { Collection as CollectionEntity } from './Collection.js';
export { Doc as DocEntity } from './Doc.js';
export { Chunk as ChunkEntity } from './Chunk.js';

// 实体状态枚举
export { DocStatus } from './Doc.js';
export { ChunkStatus } from './Chunk.js';

// 实体类型定义
export * from './types.js';

// 其他实体（保持向后兼容）
export * from './embedding.js';
export * from './graph.js';
export * from './scrape.js';
