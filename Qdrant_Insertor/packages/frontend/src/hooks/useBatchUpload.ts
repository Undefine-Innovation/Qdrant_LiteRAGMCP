import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  BatchUploadResponse,
  Collection,
  BatchUploadRequest,
} from '../types';
import { batchApi } from '../services/api';

/**
 * 批量上传Hook
 * 提供批量文档上传功能
 */
export const useBatchUpload = () => {
  const {
    setBatchUploadProgress,
    setBatchOperationProgress,
    addBatchOperationToHistory,
    collections,
  } = useAppStore();

  const [isUploading, setIsUploading] = useState(false);
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
              type: 'upload',
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

  // 批量上传文档
  const batchUploadDocuments = useCallback(
    async (
      files: FileList,
      collectionId?: string,
    ): Promise<BatchUploadResponse> => {
      setIsUploading(true);
      setError(null);

      try {
        // 创建批量上传请求
        const request: BatchUploadRequest = {
          files: Array.from(files),
          collectionId: collectionId || '',
        };

        // 发送请求
        const response = await batchApi.uploadDocuments(request);

        // 开始进度轮询
        if (response.operationId) {
          startProgressPolling(response.operationId);
        }

        // 设置初始进度
        setBatchUploadProgress({
          loaded: 0,
          total: response.total,
          processed: 0,
          successful: 0,
          failed: 0,
          percentage: 0,
          status: 'processing',
        });

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '批量上传失败';
        setError(errorMessage);

        // 设置错误状态
        const currentProgress = useAppStore.getState().batchUploadProgress;
        setBatchUploadProgress(
          currentProgress
            ? {
                ...currentProgress,
                status: 'failed',
              }
            : null,
        );

        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [setBatchUploadProgress, addBatchOperationToHistory],
  );

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 清除上传进度
  const clearUploadProgress = useCallback(() => {
    setBatchUploadProgress(null);
    stopProgressPolling();
  }, [setBatchUploadProgress, stopProgressPolling]);

  // 获取集合列表
  const getCollections = useCallback((): Collection[] => {
    return collections || [];
  }, [collections]);

  return {
    // 状态
    isUploading,
    error,
    uploadProgress: useAppStore.getState().batchUploadProgress,
    operationProgress: useAppStore.getState().batchOperationProgress,
    collections: getCollections(),

    // 方法
    batchUploadDocuments,
    clearError,
    clearUploadProgress,
    startProgressPolling,
    stopProgressPolling,
  };
};

export default useBatchUpload;
