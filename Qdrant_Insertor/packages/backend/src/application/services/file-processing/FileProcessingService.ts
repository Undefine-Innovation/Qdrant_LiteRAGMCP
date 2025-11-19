// 为了消除与 `EnhancedFileProcessingService` 的重复实现，
// 将本模块轻量化为对增强实现的重导出（保持现有导入点不变）。
// 这样可以在不修改大量引用的情况下快速获得更完整的实现。
export { EnhancedFileProcessingService as FileProcessingService } from './EnhancedFileProcessingService.js';
