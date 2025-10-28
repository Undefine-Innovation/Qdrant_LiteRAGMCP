import { useState, useCallback } from 'react';
import {
  BatchDeleteResult,
  BatchDeleteDocsResponse,
  BatchDeleteCollectionsResponse,
} from '../types';

interface BatchDeleteProps {
  onComplete?: () => void;
  mode?: 'documents' | 'collections';
  collectionId?: string;
  type?: 'documents' | 'collections';
  items?: Array<{ id: string; name: string; title?: string }>;
  selectedItems?: string[];
  onSelectionChange?: (selectedItems: string[]) => void;
  onBatchDelete?: (
    itemIds: string[],
  ) => Promise<BatchDeleteDocsResponse | BatchDeleteCollectionsResponse>;
  onRefresh?: () => void;
  className?: string;
}

/**
 * 批量删除组件
 * 支持批量选择和删除文档或集合
 */
const BatchDelete = ({
  type = 'documents',
  items = [],
  selectedItems = [],
  onSelectionChange = () => {},
  onBatchDelete,
  onRefresh,
  onComplete,
  className = '',
}: BatchDeleteProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{
    total: number;
    processed: number;
    successful: number;
    failed: number;
    percentage: number;
    status: 'processing' | 'completed' | 'completed_with_errors' | 'failed';
    results?: BatchDeleteResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 处理全选/取消全选
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        onSelectionChange(items.map(item => item.id));
      } else {
        onSelectionChange([]);
      }
    },
    [items, onSelectionChange],
  );

  // 处理批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedItems.length === 0) {
      setError('请先选择要删除的项目');
      return;
    }

    setShowConfirmDialog(false);
    setError(null);
    setIsDeleting(true);

    setDeleteProgress({
      total: selectedItems.length,
      processed: 0,
      successful: 0,
      failed: 0,
      percentage: 0,
      status: 'processing',
    });

    try {
      if (!onBatchDelete) {
        throw new Error('批量删除函数未定义');
      }
      const result = await onBatchDelete(selectedItems);

      setDeleteProgress({
        total: result.total,
        processed: result.total,
        successful: result.successful,
        failed: result.failed,
        percentage: 100,
        status: result.success ? 'completed' : 'completed_with_errors',
        results: result.results,
      });

      // 删除完成后刷新数据
      setTimeout(() => {
        onSelectionChange([]);
        setDeleteProgress(null);
        onRefresh?.();
        onComplete?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量删除失败');
      setDeleteProgress(prev => (prev ? { ...prev, status: 'failed' } : null));
    } finally {
      setIsDeleting(false);
    }
  }, [selectedItems, onBatchDelete, onSelectionChange, onRefresh]);

  // 获取项目名称
  const getItemName = (item: { id: string; name: string; title?: string }): string => {
    return item.name || item.title || item.id;
  };

  // 获取类型特定的文本
  const getTypeText = (): { singular: string; plural: string } => {
    return type === 'documents'
      ? { singular: '文档', plural: '文档' }
      : { singular: '集合', plural: '集合' };
  };

  const typeText = getTypeText();

  return (
    <div className={`w-full ${className}`}>
      {/* 批量操作工具栏 */}
      <div className="bg-white border border-secondary-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 全选复选框 */}
            <label className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                checked={
                  items.length > 0 && selectedItems.length === items.length
                }
                ref={(input) => {
                  if (input) {
                    input.indeterminate =
                      selectedItems.length > 0 &&
                      selectedItems.length < items.length;
                  }
                }}
                onChange={e => handleSelectAll(e.target.checked)}
              />
              <span className="ml-2 text-sm text-secondary-700">
                全选 ({selectedItems.length}/{items.length})
              </span>
            </label>

            {/* 选中数量显示 */}
            {selectedItems.length > 0 && (
              <span className="text-sm text-secondary-500">
                已选择 {selectedItems.length} 个{typeText.plural}
              </span>
            )}
          </div>

          {/* 批量删除按钮 */}
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={selectedItems.length === 0 || isDeleting}
            className="btn btn-danger"
          >
            {isDeleting ? '删除中...' : `批量删除${typeText.plural}`}
          </button>
        </div>
      </div>

      {/* 删除进度 */}
      {deleteProgress && (
        <div className="bg-white border border-secondary-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-secondary-900">
              批量删除进度
            </h3>
            <span className="text-sm text-secondary-500">
              {deleteProgress.percentage}%
            </span>
          </div>

          <div className="w-full bg-secondary-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                deleteProgress.status === 'failed'
                  ? 'bg-red-600'
                  : deleteProgress.status === 'completed_with_errors'
                    ? 'bg-yellow-600'
                    : 'bg-green-600'
              }`}
              style={{ width: `${deleteProgress.percentage}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-sm text-secondary-600">
            <span>
              进度: {deleteProgress.processed} / {deleteProgress.total}
            </span>
            <div>
              <span className="text-green-600">
                成功: {deleteProgress.successful}
              </span>
              <span className="mx-2">|</span>
              <span className="text-red-600">
                失败: {deleteProgress.failed}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 删除结果 */}
      {deleteProgress && deleteProgress.results && (
        <div className="bg-white border border-secondary-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-secondary-900 mb-2">
            删除结果
          </h3>
          <div className="border border-secondary-200 rounded-md divide-y divide-secondary-200 max-h-60 overflow-y-auto">
            {deleteProgress.results.map((result, index) => {
              const item = items.find(i => i.id === result.id);
              return (
                <div
                  key={index}
                  className={`p-3 ${
                    result.error ? 'bg-red-50' : 'bg-green-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary-900 truncate">
                      {item ? getItemName(item) : result.id}
                    </p>
                    {result.error ? (
                      <span className="text-xs text-red-600">失败</span>
                    ) : (
                      <span className="text-xs text-green-600">成功</span>
                    )}
                  </div>
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* 确认删除对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                确认批量删除
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  您确定要删除选中的 {selectedItems.length} 个{typeText.plural}
                  吗？
                  {type === 'collections' && (
                    <span className="block mt-2 text-red-600 font-medium">
                      注意：删除集合将同时删除其中的所有文档和块，此操作不可撤销！
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="items-center px-4 py-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md mr-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDelete;
