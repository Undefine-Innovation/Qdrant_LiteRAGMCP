/**
 * E2E测试环境设置
 * 提供测试前的初始化和清理功能
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// 模拟浏览器环境
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 模拟IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 模拟FileReader
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  readAsText: jest.fn(),
  addEventListener: jest.fn(),
  result: '',
  readyState: 2, // DONE
}));

// 模拟fetch
global.fetch = jest.fn();

// 模拟localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// 模拟sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// 模拟URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// 更可靠的 AbortController mock：返回一个可调用的 controller.abort()，并且 signal 能响应该事件
class MockAbortController {
  signal: any;
  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      // 有些代码错误地调用 signal.abort()，提供一个安全的 noop
      abort: jest.fn(),
    };
  }

  abort(reason?: any) {
    try {
      this.signal.aborted = true;
      // dispatch an abort event if possible
      if (typeof this.signal.dispatchEvent === 'function') {
        const ev = { type: 'abort', reason } as any;
        this.signal.dispatchEvent(ev);
      }
    } catch (e) {
      // swallow in tests
    }
  }
}

global.AbortController = MockAbortController as any;

// 模拟DataTransfer
global.DataTransfer = jest.fn().mockImplementation(() => ({
  items: {
    add: jest.fn(),
  },
  files: [],
}));

// 模拟Clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  },
});

/**
 * 测试工具函数
 */
export const TestUtils = {
  /**
   * 等待指定时间
   */
  wait: (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 创建模拟文件
   */
  createMockFile: (name: string, type: string, content: string = ''): File => {
    const file = new File([content], name, { type });
    Object.defineProperty(file, 'size', { value: content.length });
    return file;
  },

  /**
   * 创建模拟文件列表
   */
  createMockFileList: (files: File[]): FileList => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  },

  /**
   * 模拟API响应
   */
  mockApiResponse: (data: any, status: number = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers(),
    });
  },

  /**
   * 模拟API错误
   */
  mockApiError: (message: string, status: number = 400) => {
    return Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error: message }),
      text: () => Promise.resolve(JSON.stringify({ error: message })),
      headers: new Headers(),
    });
  },
};

/**
 * 全局测试设置
 */
beforeAll(() => {
  // 设置测试环境
  console.log('🧪 E2E测试环境初始化');
});

afterAll(() => {
  // 清理测试环境
  console.log('🧪 E2E测试环境清理');
});

beforeEach(() => {
  // 每个测试前的清理
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

afterEach(() => {
  // 每个测试后的清理
  jest.restoreAllMocks();
});

// 全局 mock: 为了避免每个测试单独 mock store，我们在 setup 中提供一个安全的默认实现
// 这确保 useAppStore 在组件挂载期不会因为缺少方法而抛错
const defaultStore = {
  isLoading: false,
  sidebarOpen: true,
  collections: [],
  documents: [],
  systemStatus: null,
  searchResults: [],
  searchQuery: '',
  selectedCollection: '',
  collectionsPagination: null,
  documentsPagination: null,
  searchPagination: null,
  batchUploadProgress: null,
  batchOperationProgress: null,
  selectedDocuments: [],
  selectedCollections: [],
  batchOperationHistory: [],
  error: null,
  lastError: null,
  errorHistory: [],
  setLoading: jest.fn(),
  setSidebarOpen: jest.fn(),
  setCollections: jest.fn(),
  setDocuments: jest.fn(),
  setSystemStatus: jest.fn(),
  setSearchResults: jest.fn(),
  setSearchQuery: jest.fn(),
  setSelectedCollection: jest.fn(),
  setCollectionsPagination: jest.fn(),
  setDocumentsPagination: jest.fn(),
  setSearchPagination: jest.fn(),
  setError: jest.fn(),
  clearError: jest.fn(),
  addErrorToHistory: jest.fn(),
  clearErrorHistory: jest.fn(),
  resetSearch: jest.fn(),
  refreshData: jest.fn(),
  setBatchUploadProgress: jest.fn(),
  setBatchOperationProgress: jest.fn(),
  setSelectedDocuments: jest.fn(),
  setSelectedCollections: jest.fn(),
  addBatchOperationToHistory: jest.fn(),
  clearBatchOperationHistory: jest.fn(),
};

// 使用 jest.mock 在所有测试中替换真实 store 模块
try {
  // jest.mock 只能在 Jest 环境中使用 - 包装在 try/catch 以防在非测试加载时抛出
  jest.mock('@/stores/useAppStore', () => ({
    useAppStore: () => defaultStore,
  }));
} catch (e) {
  // ignore when not running under jest
}

// 兼容旧测试中使用的全局 mock 变量 (如 mockDocumentsApi, mockCollectionsApi, mockBatchApi)
// 使用惰性 getter，这样当测试文件使用 jest.mock(...) 时，require 返回的是被 mock 的模块
try {
  Object.defineProperty(global, 'mockDocumentsApi', {
    configurable: true,
    get() {
      // require 相对于当前文件路径
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/services/api');
      return mod && mod.documentsApi ? mod.documentsApi : {};
    },
  });

  Object.defineProperty(global, 'mockCollectionsApi', {
    configurable: true,
    get() {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/services/api');
      return mod && mod.collectionsApi ? mod.collectionsApi : {};
    },
  });

  Object.defineProperty(global, 'mockBatchApi', {
    configurable: true,
    get() {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/services/api');
      return mod && mod.batchApi ? mod.batchApi : {};
    },
  });
} catch (e) {
  // ignore in non-jest environments
}
