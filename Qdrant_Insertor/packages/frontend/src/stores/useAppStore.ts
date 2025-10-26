import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Collection, Document, SystemStatus } from '../types';

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

  // 错误状态
  error: string | null;

  // 操作方法
  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setCollections: (collections: Collection[]) => void;
  setDocuments: (documents: Document[]) => void;
  setSystemStatus: (status: SystemStatus) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * 应用状态管理
 * 使用 Zustand 管理全局状态
 */
export const useAppStore = create<AppState>()(
  devtools(
    set => ({
      // 初始状态
      isLoading: false,
      sidebarOpen: true,
      collections: [],
      documents: [],
      systemStatus: null,
      error: null,

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

      // 设置错误信息
      setError: (error: string | null) => {
        set({ error }, false, 'setError');
      },

      // 清除错误信息
      clearError: () => {
        set({ error: null }, false, 'clearError');
      },
    }),
    {
      name: 'app-store',
    },
  ),
);

export default useAppStore;
