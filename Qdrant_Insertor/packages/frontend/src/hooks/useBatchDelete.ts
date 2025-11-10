import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  BatchDeleteResponse,
  BatchDeleteDocumentsRequest,
  BatchDeleteCollectionsRequest,
  Document,
  Collection,
} from '../types';
import { batchApi } from '../services/api';

/**
 * 批量删除Hook
 * 提供批量删除文档和集合的功能
 */
export const useBatchDelete = () => {
  const {
    setBatchOperationProgress,
    addBatchOperationToHistory,
    documents,
    collections,
  } = useAppStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 轮询批量操作进度
  const startProgressPolling = useCallback(
    (operationId: string) => {
      progressIntervalRef.current = setInterval(async () => {
        try {
          const progress = await batchApi.getOperationProgress(operationId);
          setBatchOperationProgress(progress);

          // 如果操作完成，停止轮询
          if (progress.status === 'completed' || progress.status === 'failed') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }

            // 添加到历史记录
            addBatchOperationToHistory({
              id: operationId,
              type: 'delete',
              timestamp: Date.now(),
              status: progress.status,
              total: progress.total,
              successful: progress.successful,
              failed: progress.failed,
            });

            // 清除进度状态
            setTimeout(() => {
              setBatchOperationProgress(null);
            }, 3000);
          }
        } catch (err) {
          console.error('获取批量操作进度失败:', err);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }
      }, 1000); // 每秒轮询一次
    },
    [setBatchOperationProgress, addBatchOperationToHistory],
  );

  // 停止进度轮询
  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // 批量删除文档
  const batchDeleteDocuments = useCallback(
    async (docIds: string[]): Promise<BatchDeleteResponse> => {
      setIsDeleting(true);
      setError(null);

      try {
        // 创建批量删除请求
        const request: BatchDeleteDocumentsRequest = {
          docIds,
        };

        // 发送请求
        const response = await batchApi.deleteDocuments(request);

        // 开始进度轮询
        if ((response as unknown as { operationId?: string }).operationId) {
          startProgressPolling(
            (response as unknown as { operationId: string }).operationId,
          );
        }

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '批量删除文档失败';
        setError(errorMessage);
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [addBatchOperationToHistory],
  );

  // 批量删除集合
  const batchDeleteCollections = useCallback(
    async (collectionIds: string[]): Promise<BatchDeleteResponse> => {
      setIsDeleting(true);
      setError(null);

      try {
        // 创建批量删除请求
        const request: BatchDeleteCollectionsRequest = {
          collectionIds,
        };

        // 发送请求
        const response = await batchApi.deleteCollections(request);

        // 开始进度轮询
        if ((response as unknown as { operationId?: string }).operationId) {
          startProgressPolling(
            (response as unknown as { operationId: string }).operationId,
          );
        }

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '批量删除集合失败';
        setError(errorMessage);
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [addBatchOperationToHistory],
  );

  // 获取文档信息
  const getDocumentById = useCallback(
    (docId: string): Document | undefined => {
      return documents?.find(doc => doc.docId === docId);
    },
    [documents],
  );

  // 获取集合信息
  const getCollectionById = useCallback(
    (collectionId: string): Collection | undefined => {
      return collections?.find(coll => coll.collectionId === collectionId);
    },
    [collections],
  );

  // 获取文档名称
  const getDocumentName = useCallback(
    (docId: string): string => {
      const doc = getDocumentById(docId);
      return doc?.name || docId;
    },
    [getDocumentById],
  );

  // 获取集合名称
  const getCollectionName = useCallback(
    (collectionId: string): string => {
      const collection = getCollectionById(collectionId);
      return collection?.name || collectionId;
    },
    [getCollectionById],
  );

  // 验证是否可以删除集合
  const canDeleteCollection = useCallback(
    (collectionId: string): boolean => {
      const collection = getCollectionById(collectionId);
      // 如果集合中有文档，不允许删除
      return !collection || (collection.docCount || 0) === 0;
    },
    [getCollectionById],
  );

  // 获取不可删除的集合原因
  const getCollectionDeleteReason = useCallback(
    (collectionId: string): string => {
      const collection = getCollectionById(collectionId);
      if (!collection) {
        return '集合不存在';
      }
      if ((collection.docCount || 0) > 0) {
        return `集合中有 ${collection.docCount} 个文档，请先删除所有文档`;
      }
      return '';
    },
    [getCollectionById],
  );

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 清除操作进度
  const clearOperationProgress = useCallback(() => {
    setBatchOperationProgress(null);
    stopProgressPolling();
  }, [setBatchOperationProgress, stopProgressPolling]);

  return {
    // 状态
    isDeleting,
    error,
    operationProgress: useAppStore.getState().batchOperationProgress,
    documents: documents || [],
    collections: collections || [],

    // 方法
    batchDeleteDocuments,
    batchDeleteCollections,
    getDocumentById,
    getCollectionById,
    getDocumentName,
    getCollectionName,
    canDeleteCollection,
    getCollectionDeleteReason,
    clearError,
    clearOperationProgress,
    startProgressPolling,
    stopProgressPolling,
  };
};

export default useBatchDelete;
