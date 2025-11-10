import React from 'react';
import { Document } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DocumentThumbnail from '@/components/DocumentThumbnail';
import { DocumentListCore } from '@/components/DocumentListCore';
import Button from '@/components/Button';
import type { ApiError } from '@/services/api-client';

/**
 * 加载状态组件属性
 */
interface LoadingStateProps {
  message?: string;
}

/**
 * 加载状态组件
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = '加载文档列表...',
}) => {
  return (
    <div className="flex justify-center items-center py-12">
      <LoadingSpinner size="lg" />
      <span className="ml-3 text-secondary-600">{message}</span>
    </div>
  );
};

/**
 * 错误状态组件属性
 */
interface ErrorStateProps {
  error: string | ApiError;
  onRefresh: () => void;
}

/**
 * 错误状态组件
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRefresh }) => {
  return (
    <div className="space-y-4">
      <ErrorMessage
        error={error}
        onRetry={onRefresh}
        showCloseButton={false}
        autoHide={false}
      />
    </div>
  );
};

/**
 * 空状态组件
 */
export const EmptyState: React.FC = () => {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-secondary-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 6v6m-6 6h6m2 2h6m2 2h6m-6 6v6m-6 6h6"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-secondary-900">暂无文档</h3>
      <p className="mt-1 text-sm text-secondary-500">
        开始上传文档以使用此功能
      </p>
    </div>
  );
};

/**
 * 文档列表表格组件属性
 */
interface DocumentTableProps {
  documents: Document[];
  selectedDocuments: string[];
  onDocumentSelect: (documentId: string, checked: boolean) => void;
  onDocumentView: (documentId: string) => void;
  onDocumentDelete: (documentId: string) => void;
  onDocumentRetry: (documentId: string) => void;
  getStatusInfo: (status?: string) => {
    text: string;
    className: string;
  };
}

/**
 * 文档列表表格组件
 */
export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  selectedDocuments,
  onDocumentSelect,
  onDocumentView,
  onDocumentDelete,
  onDocumentRetry,
  getStatusInfo,
}) => {
  /**
   * 处理全选/取消全选
   */
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // 全选
      documents.forEach(doc => onDocumentSelect(doc.docId, true));
    } else {
      // 取消全选
      documents.forEach(doc => onDocumentSelect(doc.docId, false));
    }
  };

  return (
    <table className="min-w-full divide-y divide-secondary-200">
      <thead className="bg-secondary-50">
        <tr>
          <th key="checkbox" className="px-6 py-3 text-left">
            <input
              type="checkbox"
              checked={selectedDocuments.length === documents.length}
              onChange={e => handleSelectAll(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
          </th>
          <th
            key="thumbnail"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            缩略图
          </th>
          <th
            key="filename"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            文件名
          </th>
          <th
            key="collection"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            集合
          </th>
          <th
            key="status"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            状态
          </th>
          <th
            key="uploadTime"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            上传时间
          </th>
          <th
            key="actions"
            className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
          >
            操作
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-secondary-200">
        {documents.map(document => {
          const statusInfo = getStatusInfo(document.status);
          return (
            <tr key={document.docId} className="hover:bg-secondary-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedDocuments.includes(document.docId)}
                  onChange={e =>
                    onDocumentSelect(document.docId, e.target.checked)
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <DocumentThumbnail
                  documentId={document.docId}
                  onClick={() =>
                    onDocumentView && onDocumentView(document.docId)
                  }
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-secondary-900">
                  {document.name}
                </div>
                {document.errorMessage && (
                  <div className="text-sm text-red-600 mt-1">
                    {document.errorMessage}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                {document.collectionId}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.className}`}
                >
                  {statusInfo.text}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {DocumentListCore.formatDate(
                  Number(
                    (document as { created_at?: number; createdAt?: number })
                      .created_at ||
                      (document as { created_at?: number; createdAt?: number })
                        .createdAt ||
                      0,
                  ),
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  {onDocumentView && (
                    <button
                      onClick={() => onDocumentView(document.docId)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      查看
                    </button>
                  )}
                  {document.status === 'failed' && onDocumentRetry && (
                    <button
                      onClick={() => onDocumentRetry(document.docId)}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      重试
                    </button>
                  )}
                  {onDocumentDelete && (
                    <button
                      onClick={() => {
                        if (confirm(`确定要删除文档 "${document.name}" 吗？`)) {
                          onDocumentDelete(document.docId);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

/**
 * 批量操作工具栏组件属性
 */
interface BatchActionsProps {
  selectedDocuments: string[];
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

/**
 * 批量操作工具栏组件
 */
export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedDocuments,
  onBatchDelete,
  onClearSelection,
}) => {
  if (selectedDocuments.length === 0) return null;

  return (
    <div className="bg-secondary-50 px-6 py-3 border-b border-secondary-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary-700">
          已选择 {selectedDocuments.length} 个文档
        </span>
        <div className="space-x-2">
          {onBatchDelete && (
            <Button onClick={onBatchDelete} variant="secondary" size="sm">
              批量删除
            </Button>
          )}
          <Button onClick={onClearSelection} variant="secondary" size="sm">
            取消选择
          </Button>
        </div>
      </div>
    </div>
  );
};
