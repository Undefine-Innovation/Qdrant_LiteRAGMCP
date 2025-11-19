/**
 * Generated API Client
 * 此文件由 contracts/openapi.yaml 自动生成
 * 仅供新代码使用
 */

import type { paths } from './api-types.js';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

class APIClient {
  constructor(private baseURL: string = '/api') {}

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseURL);

    // 添加查询参数
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  // Collections API
  async createCollection(
    body: paths['/api/collections']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request('post', '/api/collections', { body });
  }

  // Documents API
  async uploadDocument(collectionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${this.baseURL}/api/collections/${collectionId}/docs`,
      {
        method: 'POST',
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async listDocuments(
    params?: paths['/api/docs']['get']['parameters']['query'],
  ) {
    return this.request('get', '/api/docs', { params });
  }

  async getDocument(docId: string) {
    return this.request('get', `/api/docs/${docId}`);
  }

  async deleteDocument(docId: string) {
    return this.request('delete', `/api/docs/${docId}`);
  }

  async resyncDocument(docId: string) {
    return this.request('put', `/api/docs/${docId}/resync`);
  }
}

export const apiClient = new APIClient();
export default APIClient;
