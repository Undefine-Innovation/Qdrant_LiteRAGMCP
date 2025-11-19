import { apiClient } from './api-client.js';
import {
  HealthCheckResponse,
  DetailedHealthCheckResponse,
} from '../types/index.js';

/**
 * 通用API
 */
export const commonApi = {
  /**
   * 简单健康检查
   */
  healthCheck: async (): Promise<HealthCheckResponse> => {
    return apiClient.get('/health');
  },

  /**
   * 详细健康检查
   */
  detailedHealthCheck: async (): Promise<DetailedHealthCheckResponse> => {
    return apiClient.get('/healthz');
  },
};
