// 导出API客户端和基础类型
export {
  apiClient,
} from './api-client.js';

export type {
  ApiResponse,
  ApiError,
  PaginationQueryParams,
} from './api-client.js';

// 导出各个API模块
export { collectionsApi } from './collections-api.js';
export { documentsApi } from './documents-api.js';
export { searchApi } from './search-api.js';
export { batchApi } from './batch-api.js';
export { monitoringApi } from './monitoring-api.js';
export { graphApi } from './graph-api.js';
export { commonApi } from './common-api.js';

// 导出默认实例
export { apiClient as default } from './api-client.js';