/**
 * Jest Mock 工厂
 * 避免循环依赖，提供 mock 对象创建
 */

/**
 * 创建集合API的mock对象
 */
export function createMockCollectionsApi() {
  return {
    getCollections: jest.fn(() =>
      Promise.resolve({
        data: [],
        pagination: {
          page: 1,
          totalPages: 1,
          total: 0,
          limit: 20,
        },
      }),
    ),
    createCollection: jest.fn(() =>
      Promise.resolve({
        collectionId: 'mock-collection',
        name: '测试集合',
        description: '这是一个测试集合',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: 0,
      }),
    ),
    updateCollection: jest.fn(() =>
      Promise.resolve({
        collectionId: 'mock-collection',
        name: '测试集合',
        description: '这是一个测试集合',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: 0,
      }),
    ),
    deleteCollection: jest.fn(() => Promise.resolve({ success: true })),
  };
}

/**
 * 创建文档API的mock对象
 */
export function createMockDocumentsApi() {
  return {
    getDocuments: jest.fn(() =>
      Promise.resolve({
        data: [],
        pagination: {
          page: 1,
          totalPages: 1,
          total: 0,
          limit: 20,
        },
      }),
    ),
    uploadDocument: jest.fn(() =>
      Promise.resolve({
        docId: 'mock-doc',
        collectionId: 'mock-collection',
        name: '测试文档.txt',
        size: 1024,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    getDocument: jest.fn(() =>
      Promise.resolve({
        docId: 'mock-doc',
        collectionId: 'mock-collection',
        name: '测试文档.txt',
        size: 1024,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    deleteDocument: jest.fn(() => Promise.resolve({ success: true })),
    deleteDocuments: jest.fn(() => Promise.resolve({ deleted: 0 })),
  };
}

/**
 * 创建搜索API的mock对象
 */
export function createMockSearchApi() {
  return {
    search: jest.fn(() => Promise.resolve({ results: [], total: 0 })),
    semanticSearch: jest.fn(() => Promise.resolve({ results: [], total: 0 })),
    keywordSearch: jest.fn(() => Promise.resolve({ results: [], total: 0 })),
  };
}

/**
 * 创建批量操作API的mock对象
 */
export function createMockBatchApi() {
  return {
    uploadBatch: jest.fn(() =>
      Promise.resolve({
        batchId: 'mock-batch',
        status: 'pending',
        totalFiles: 0,
        processedFiles: 0,
        createdAt: new Date().toISOString(),
      }),
    ),
    getBatchStatus: jest.fn(() =>
      Promise.resolve({
        batchId: 'mock-batch',
        status: 'completed',
        totalFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        createdAt: new Date().toISOString(),
      }),
    ),
    deleteBatch: jest.fn(() => Promise.resolve({ success: true })),
    cancelBatch: jest.fn(() => Promise.resolve({ success: true })),
  };
}
