import { apiClient } from './api-client.js';

/**
 * 图谱相关API
 */
export const graphApi = {
  /**
   * 提取文档图谱
   */
  extractGraph: async (docId: string): Promise<{ message: string }> => {
    return apiClient.post(`/docs/${docId}/extract-graph`);
  },
};
