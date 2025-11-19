/**
 * 类型转换工具函数
 * 用于处理前后端字段名称差异和类型转换
 */

import {
  Collection,
  Document,
  Chunk,
  SearchResult,
  BatchUploadResponse,
  BatchDeleteResponse,
  BatchOperationProgress,
} from '../types/index.js';

/**
 * 转换后端集合数据为前端格式
 */
export function transformCollection(
  backendCollection: Record<string, unknown>,
): Collection {
  const collectionId =
    (backendCollection.collectionId as string | undefined) ||
    (backendCollection.id as string);
  const createdAt =
    (backendCollection.createdAt as number | undefined) ||
    (backendCollection.created_at as number);
  const updatedAt =
    (backendCollection.updatedAt as number | undefined) ||
    (backendCollection.updated_at as number);

  return {
    ...backendCollection,
    // 保持向后兼容的字段映射
    collectionId,
    createdAt,
    updatedAt,
  } as Collection;
}

/**
 * 转换后端文档数据为前端格式
 */
export function transformDocument(
  backendDocument: Record<string, unknown>,
): Document {
  const sizeBytes =
    (backendDocument.sizeBytes as number | undefined) ||
    (backendDocument.size_bytes as number | undefined);
  const createdAt =
    (backendDocument.createdAt as number) ||
    (backendDocument.created_at as number);
  const updatedAt =
    (backendDocument.updatedAt as number | undefined) ||
    (backendDocument.updated_at as number | undefined);
  const isDeleted =
    (backendDocument.isDeleted as boolean | undefined) !== undefined
      ? (backendDocument.isDeleted as boolean)
      : (backendDocument.is_deleted as boolean | undefined);

  return {
    ...backendDocument,
    // 保持向后兼容的字段映射
    sizeBytes,
    createdAt,
    updatedAt,
    isDeleted,
  } as Document;
}

/**
 * 转换后端块数据为前端格式
 */
export function transformChunk(backendChunk: Record<string, unknown>): Chunk {
  const createdAt =
    (backendChunk.createdAt as number) || (backendChunk.created_at as number);
  const updatedAt =
    (backendChunk.updatedAt as number | undefined) ||
    (backendChunk.updated_at as number | undefined);

  return {
    ...backendChunk,
    // 保持向后兼容的字段映射
    createdAt,
    updatedAt,
  } as Chunk;
}

/**
 * 转换后端搜索结果为前端格式
 */
export function transformSearchResult(
  backendResult: Record<string, unknown>,
): SearchResult {
  // 如果已经是前端格式，直接返回（忽略缺失的字段）
  if (backendResult.metadata) {
    return backendResult as unknown as SearchResult;
  }

  // 转换后端格式为前端格式
  const score = (backendResult.score as number | undefined) || 0;
  const docId = (backendResult.docId as string) || '';
  const collectionId = (backendResult.collectionId as string | undefined) || '';
  const chunkIndex = backendResult.chunkIndex as number | undefined;
  const titleChain = backendResult.titleChain as string | undefined;
  const title = backendResult.title as string | undefined;
  const pointId = backendResult.pointId as string | undefined;
  const content = (backendResult.content as string) || '';

  return {
    ...backendResult,
    score,
    content,
    // 确保score字段有默认值
    // 保持向后兼容的metadata结构
    metadata: {
      docId,
      collectionId,
      chunkIndex,
      titleChain,
      title,
      pointId,
    },
    type: 'chunkResult', // 默认类型
  } as unknown as SearchResult;
}

/**
 * 转换搜索API响应格式
 * 处理后端返回的 {results, total, query} 格式为前端期望的格式
 */
export function transformSearchResponse(
  backendResponse: Record<string, unknown> | unknown[],
): { results: SearchResult[]; total: number; query: string } {
  // 如果是对象，检查是否有results字段
  if (
    !Array.isArray(backendResponse) &&
    typeof backendResponse === 'object' &&
    backendResponse !== null
  ) {
    const response = backendResponse as Record<string, unknown>;

    // 如果已经是前端期望的格式，直接返回
    if (response.results && Array.isArray(response.results)) {
      return {
        results: transformSearchResults(response.results),
        total: (response.total as number) || 0,
        query: (response.query as string) || '',
      };
    }

    // 处理分页响应格式
    if (response.data && Array.isArray(response.data)) {
      const pagination = response.pagination as
        | Record<string, unknown>
        | undefined;
      return {
        results: transformSearchResults(response.data),
        total: (pagination?.total as number) || 0,
        query: '',
      };
    }
  }

  // 如果是直接返回的结果数组，包装成标准格式
  if (Array.isArray(backendResponse)) {
    return {
      results: transformSearchResults(backendResponse),
      total: backendResponse.length,
      query: '',
    };
  }

  // 默认返回空结果
  return {
    results: [],
    total: 0,
    query: '',
  };
}

/**
 * 转换后端错误响应为前端格式
 * 处理后端的 {error: {code, message, details}} 格式为前端期望的格式
 */
export function transformErrorResponse(backendError: Record<string, unknown>): {
  success: boolean;
  error: string;
  code?: string;
  details?: unknown;
} {
  if (
    backendError &&
    backendError.error &&
    typeof backendError.error === 'object' &&
    backendError.error !== null
  ) {
    const error = backendError.error as Record<string, unknown>;
    return {
      success: false,
      error: (error.message as string) || 'Unknown error',
      code: error.code as string,
      details: error.details,
    };
  }

  // 处理其他错误格式
  const errorMessage =
    typeof backendError?.message === 'string'
      ? backendError.message
      : typeof backendError?.error === 'string'
        ? backendError.error
        : 'Unknown error';
  const errorCode =
    typeof backendError?.code === 'string'
      ? backendError.code
      : typeof backendError?.status === 'number'
        ? backendError.status.toString()
        : undefined;

  return {
    success: false,
    error: errorMessage,
    code: errorCode,
    details: backendError?.details,
  };
}

/**
 * 批量转换集合数据
 */
export function transformCollections(
  backendCollections: unknown[],
): Collection[] {
  return backendCollections.map(item =>
    transformCollection(item as Record<string, unknown>),
  );
}

/**
 * 批量转换文档数据
 */
export function transformDocuments(backendDocuments: unknown[]): Document[] {
  return backendDocuments.map(item =>
    transformDocument(item as Record<string, unknown>),
  );
}

/**
 * 批量转换块数据
 */
export function transformChunks(backendChunks: unknown[]): Chunk[] {
  return backendChunks.map(item =>
    transformChunk(item as Record<string, unknown>),
  );
}

/**
 * 批量转换搜索结果
 */
export function transformSearchResults(
  backendResults: unknown[],
): SearchResult[] {
  return backendResults.map(item =>
    transformSearchResult(item as Record<string, unknown>),
  );
}

/**
 * 将前端数据转换为后端格式（用于创建/更新请求）
 */
export function toBackendCollection(
  frontendCollection: Partial<Collection>,
): Record<string, unknown> {
  return {
    ...frontendCollection,
    // 移除前端特有字段
    createdAt: undefined,
    updatedAt: undefined,
    // 确保使用后端字段名
    created_at: frontendCollection.createdAt,
    updated_at: frontendCollection.updatedAt,
  };
}

/**
 * 将前端数据转换为后端格式（用于创建/更新请求）
 */
export function toBackendDocument(
  frontendDocument: Partial<Document>,
): Record<string, unknown> {
  return {
    ...frontendDocument,
    // 移除前端特有字段
    sizeBytes: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    isDeleted: undefined,
    // 确保使用后端字段名
    size_bytes: frontendDocument.sizeBytes,
    created_at: frontendDocument.createdAt,
    updated_at: frontendDocument.updatedAt,
    is_deleted: frontendDocument.isDeleted,
  };
}

/**
 * 转换后端批量上传响应为前端格式
 */
export function transformBatchUploadResponse(
  backendResponse: Record<string, unknown>,
): BatchUploadResponse {
  const success = (backendResponse.success as boolean | undefined) || false;
  const total = (backendResponse.total as number | undefined) || 0;
  const successful = (backendResponse.successful as number | undefined) || 0;
  const failed = (backendResponse.failed as number | undefined) || 0;

  // 如果已经是前端期望的格式，直接返回
  if (backendResponse.results && Array.isArray(backendResponse.results)) {
    return {
      success,
      total,
      successful,
      failed,
      results: (backendResponse.results as unknown[]).map((result: unknown) => {
        const r = result as Record<string, unknown>;
        return {
          fileName: (r.fileName as string) || '',
          docId: (r.docId as string) || '',
          collectionId: (r.collectionId as string) || '',
          error: (r.error as string) || undefined,
          total: (r.total as number) || 0,
          successful: (r.successful as number) || 0,
          success:
            (r.success as boolean | undefined) !== undefined
              ? (r.success as boolean)
              : !!(r.docId as string),
        };
      }),
      operationId: backendResponse.operationId as string,
    };
  }

  // 默认返回空响应
  return {
    success: false,
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
  };
}

/**
 * 转换后端批量删除响应为前端格式
 */
export function transformBatchDeleteResponse(
  backendResponse: Record<string, unknown>,
): BatchDeleteResponse {
  const success = (backendResponse.success as boolean | undefined) || false;
  const total = (backendResponse.total as number | undefined) || 0;
  const successful = (backendResponse.successful as number | undefined) || 0;
  const failed = (backendResponse.failed as number | undefined) || 0;

  // 如果已经是前端期望的格式，直接返回
  if (backendResponse.results && Array.isArray(backendResponse.results)) {
    return {
      success,
      total,
      successful,
      failed,
      results: (backendResponse.results as unknown[]).map((result: unknown) => {
        const r = result as Record<string, unknown>;
        return {
          id:
            (r.id as string) ||
            (r.docId as string) ||
            (r.collectionId as string) ||
            '',
          success:
            (r.success as boolean | undefined) !== undefined
              ? (r.success as boolean)
              : !(r.error as string),
          error: r.error as string,
        };
      }),
    };
  }

  // 默认返回空响应
  return {
    success: false,
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
  };
}

/**
 * 转换后端批量操作进度为前端格式
 */
export function transformBatchOperationProgress(
  backendProgress: Record<string, unknown>,
): BatchOperationProgress {
  // 如果已经是前端期望的格式，直接返回
  if (
    backendProgress.operationId &&
    backendProgress.type &&
    backendProgress.status
  ) {
    const operationId = backendProgress.operationId as string;
    const type = backendProgress.type as 'upload' | 'delete';
    const status = backendProgress.status as BatchOperationProgress['status'];
    const total = (backendProgress.total as number | undefined) || 0;
    const processed = (backendProgress.processed as number | undefined) || 0;
    const successful = (backendProgress.successful as number | undefined) || 0;
    const failed = (backendProgress.failed as number | undefined) || 0;
    const startTime =
      (backendProgress.startTime as number | undefined) || Date.now();
    const endTime = backendProgress.endTime as number | undefined;
    const estimatedTimeRemaining = backendProgress.estimatedTimeRemaining as
      | number
      | undefined;
    const percentage =
      (backendProgress.percentage as number | undefined) ||
      (total > 0 ? Math.round((processed / total) * 100) : 0);
    const error = backendProgress.error as string | undefined;
    const details = backendProgress.details as unknown[] | undefined;

    return {
      operationId,
      type,
      status,
      total,
      processed,
      successful,
      failed,
      startTime,
      endTime,
      estimatedTimeRemaining,
      percentage,
      error,
      details,
    };
  }

  // 默认返回空进度
  return {
    operationId: '',
    type: 'upload',
    status: 'pending',
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    startTime: Date.now(),
  };
}
