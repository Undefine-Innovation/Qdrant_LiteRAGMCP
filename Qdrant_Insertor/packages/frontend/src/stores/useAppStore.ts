import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Collection,
  Document,
  SystemStatus,
  SearchResult,
  BatchUploadProgress,
  BatchOperationProgress,
} from '../types';

/**
 * 应用状态接口
 */
interface AppState {
  // 用户界面状态
  isLoading: boolean;
  sidebarOpen: boolean;

  // 数据状态
  collections: Collection[];
  documents: Document[];
  systemStatus: SystemStatus | null;
  searchResults: SearchResult[];
  searchQuery: string;
  selectedCollection: string;

  // 分页状态
  collectionsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  documentsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  searchPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;

  // 批量操作状态
  batchUploadProgress: BatchUploadProgress | null;
  batchOperationProgress: BatchOperationProgress | null;
  selectedDocuments: string[];
  selectedCollections: string[];
  batchOperationHistory: Array<{
    id: string;
    type: 'upload' | 'delete';
    timestamp: number;
    status: 'completed' | 'failed';
    total: number;
    successful: number;
    failed: number;
  }>;

  // 错误状态
  error: string | null;
  lastError: {
    message: string;
    timestamp: number;
  } | null;

  // 操作方法
  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setCollections: (collections: Collection[]) => void;
  setDocuments: (documents: Document[]) => void;
  setSystemStatus: (status: SystemStatus) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCollection: (collectionId: string) => void;
  setCollectionsPagination: (
    pagination: AppState['collectionsPagination'],
  ) => void;
  setDocumentsPagination: (pagination: AppState['documentsPagination']) => void;
  setSearchPagination: (pagination: AppState['searchPagination']) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  resetSearch: () => void;
  refreshData: () => Promise<void>;

  // 批量操作方法
  setBatchUploadProgress: (progress: BatchUploadProgress | null) => void;
  setBatchOperationProgress: (progress: BatchOperationProgress | null) => void;
  setSelectedDocuments: (documentIds: string[]) => void;
  setSelectedCollections: (collectionIds: string[]) => void;
  addBatchOperationToHistory: (
    operation: AppState['batchOperationHistory'][0],
  ) => void;
  clearBatchOperationHistory: () => void;
}

/**
 * 应用状态管理
 * 使用 Zustand 管理全局状态
 */
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      set => ({
        // 初始状态
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

        // 设置加载状态
        setLoading: (loading: boolean) => {
          set({ isLoading: loading }, false, 'setLoading');
        },

        // 设置侧边栏状态
        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open }, false, 'setSidebarOpen');
        },

        // 设置集合列表
        setCollections: (collections: Collection[]) => {
          set({ collections }, false, 'setCollections');
        },

        // 设置文档列表
        setDocuments: (documents: Document[]) => {
          set({ documents }, false, 'setDocuments');
        },

        // 设置系统状态
        setSystemStatus: (status: SystemStatus) => {
          set({ systemStatus: status }, false, 'setSystemStatus');
        },

        // 设置搜索结果
        setSearchResults: (results: SearchResult[]) => {
          set({ searchResults: results }, false, 'setSearchResults');
        },

        // 设置搜索查询
        setSearchQuery: (query: string) => {
          set({ searchQuery: query }, false, 'setSearchQuery');
        },

        // 设置选中的集合
        setSelectedCollection: (collectionId: string) => {
          set(
            { selectedCollection: collectionId },
            false,
            'setSelectedCollection',
          );
        },

        // 设置集合分页
        setCollectionsPagination: pagination => {
          set(
            { collectionsPagination: pagination },
            false,
            'setCollectionsPagination',
          );
        },

        // 设置文档分页
        setDocumentsPagination: pagination => {
          set(
            { documentsPagination: pagination },
            false,
            'setDocumentsPagination',
          );
        },

        // 设置搜索分页
        setSearchPagination: pagination => {
          set({ searchPagination: pagination }, false, 'setSearchPagination');
        },

        // 设置错误信息
        setError: (error: string | null) => {
          set(
            state => ({
              error,
              lastError: error
                ? {
                    message: error,
                    timestamp: Date.now(),
                  }
                : state.lastError,
            }),
            false,
            'setError',
          );
        },

        // 清除错误信息
        clearError: () => {
          set({ error: null }, false, 'clearError');
        },

        // 重置搜索状态
        resetSearch: () => {
          set(
            {
              searchResults: [],
              searchQuery: '',
              searchPagination: null,
            },
            false,
            'resetSearch',
          );
        },

        // 刷新数据
        refreshData: async () => {
          set({ isLoading: true }, false, 'refreshData:start');
          try {
            // 这里可以添加刷新数据的逻辑
            // 例如重新获取集合和文档列表
            set({ isLoading: false }, false, 'refreshData:success');
          } catch (error) {
            set(
              {
                isLoading: false,
                error: error instanceof Error ? error.message : '刷新数据失败',
              },
              false,
              'refreshData:error',
            );
          }
        },
      }),
      {
        name: 'app-store',
        partialize: state => ({
          sidebarOpen: state.sidebarOpen,
          selectedCollection: state.selectedCollection,
          searchQuery: state.searchQuery,
          selectedDocuments: state.selectedDocuments,
          selectedCollections: state.selectedCollections,
        }),
      },
    ),
    {
      name: 'app-store',
    },
  ),
);

export default useAppStore;
