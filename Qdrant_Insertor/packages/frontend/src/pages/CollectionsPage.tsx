import { useState, useEffect } from 'react';
import {
  CreateCollectionRequest,
  UpdateCollectionRequest,
  PaginationParams,
} from '../types';
import { useApi } from '../hooks/useApi';
import { collectionsApi } from '../services/api';
import CollectionManager from '../components/CollectionManager';
import BatchDelete from '../components/BatchDelete';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';

/**
 * 集合管理页面组件
 * 用于创建、查看和管理文档集合
 */
const CollectionsPage = () => {
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [paginationParams, setPaginationParams] = useState<PaginationParams>({
    page: 1,
    limit: 20,
    sort: 'created_at',
    order: 'desc',
  });

  // 获取集合列表
  const { state: collectionsState, execute: loadCollections } = useApi(
    () => collectionsApi.getCollections(paginationParams as any),
    {
      maxRetries: 3,
      retryDelay: 1000,
      onSuccess: data => {
        console.log('Collections loaded successfully:', data);
      },
      onError: error => {
        console.error('Failed to load collections:', error);
      },
    },
  );

  // 创建集合
  const handleCreateCollection = async (data: CreateCollectionRequest) => {
    try {
      await collectionsApi.createCollection(data);
      await loadCollections();
    } catch (error) {
      console.error('Failed to create collection:', error);
      throw error;
    }
  };

  // 更新集合
  const handleUpdateCollection = async (
    id: string,
    data: UpdateCollectionRequest,
  ) => {
    try {
      await collectionsApi.updateCollection(id, data);
      await loadCollections();
    } catch (error) {
      console.error('Failed to update collection:', error);
      throw error;
    }
  };

  // 删除集合
  const handleDeleteCollection = async (id: string) => {
    try {
      await collectionsApi.deleteCollection(id);
      await loadCollections();
    } catch (error) {
      console.error('Failed to delete collection:', error);
      throw error;
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    loadCollections();
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setPaginationParams(prev => ({ ...prev, page }));
  };

  // 处理每页数量变化
  const handleLimitChange = (limit: number) => {
    setPaginationParams(prev => ({ ...prev, limit, page: 1 }));
  };

  // 当分页参数变化时重新加载数据
  useEffect(() => {
    loadCollections();
  }, [paginationParams]);

  // 初始加载
  useEffect(() => {
    loadCollections();
  }, []);

  const collections = Array.isArray(collectionsState.data)
    ? (collectionsState.data as unknown[])
    : (collectionsState.data as { data?: unknown[] })?.data || [];
  const pagination = (
    collectionsState.data as {
      pagination?: {
        page: number;
        totalPages: number;
        total: number;
        limit: number;
      };
    }
  )?.pagination;

  // 调试日志
  console.log('CollectionsPage - collectionsState:', collectionsState);
  console.log('CollectionsPage - collections:', collections);
  console.log('CollectionsPage - pagination:', pagination);
  console.log('CollectionsPage - collections.length:', collections.length);
  console.log(
    'CollectionsPage - collectionsState.loading:',
    collectionsState.loading,
  );
  console.log(
    'CollectionsPage - collectionsState.error:',
    collectionsState.error,
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-secondary-800">集合管理</h1>
        <button
          onClick={() => setShowBatchDeleteModal(true)}
          className="btn btn-danger"
          data-testid="batch-delete-collections-button"
        >
          批量删除集合
        </button>
      </div>

      <CollectionManager
        collections={collections as any}
        loading={collectionsState.loading}
        error={collectionsState.error}
        onRefresh={handleRefresh}
        onCreate={handleCreateCollection}
        onUpdate={handleUpdateCollection}
        onDelete={handleDeleteCollection}
      />

      {/* 分页组件 - 仅在有分页数据时显示 */}
      {pagination && collections.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          loading={collectionsState.loading}
        />
      )}

      {/* 批量删除模态框 */}
      <Modal
        isOpen={showBatchDeleteModal}
        onClose={() => setShowBatchDeleteModal(false)}
        title="批量删除集合"
        size="xl"
      >
        <div data-testid="batch-delete-modal">
          <BatchDelete
            mode="collections"
            onComplete={() => {
              setShowBatchDeleteModal(false);
              loadCollections();
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CollectionsPage;
