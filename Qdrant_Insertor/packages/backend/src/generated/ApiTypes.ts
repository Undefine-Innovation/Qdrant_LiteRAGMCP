/**
 * Generated API Types - 占位符
 * 暂时手动定义，稍后从 OpenAPI 自动生成
 */

export interface paths {
  '/api/collections': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            collectionId: string;
            name: string;
            description?: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              id: string;
              collectionId: string;
              name: string;
              description?: string;
              created_at: number;
              updated_at: number;
            };
          };
        };
      };
    };
  };
  '/api/docs': {
    get: {
      parameters: {
        query?: {
          page?: number;
          limit?: number;
          sort?: string;
          order?: string;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              data: Array<{
                docId: string;
                name: string;
                collectionId: string;
                created_at: number;
                updated_at: number;
              }>;
              pagination: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
                hasNext: boolean;
                hasPrev: boolean;
              };
            };
          };
        };
      };
    };
  };
}

export type { paths };
