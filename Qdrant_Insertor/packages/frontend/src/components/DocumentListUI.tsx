import React from 'react';
import { Document } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

/**
 * 分页控件组件属性
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 分页控件组件
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  // 显示页码范围
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('...');
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < totalPages - 1) {
    if (endPage < totalPages - 2) pages.push('...');
    if (endPage < totalPages - 1) pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-secondary-50 border-t border-secondary-200">
      <div className="text-sm text-secondary-700">
        显示第 {(currentPage - 1) * 10 + 1} 到{' '}
        {Math.min(currentPage * 10, totalPages)} 条，共 {totalPages} 条记录
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-secondary-300 rounded-md hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        {pages.map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-secondary-500">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 text-sm border rounded-md ${
                page === currentPage
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-secondary-300 hover:bg-secondary-100'
              }`}
            >
              {page}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-secondary-300 rounded-md hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </div>
  );
};

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
  error: string;
  onRefresh: () => void;
}

/**
 * 错误状态组件
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRefresh }) => {
  return (
    <div className="space-y-4">
      <ErrorMessage message={error} />
      <button onClick={onRefresh} className="btn btn-secondary">
        重试
      </button>
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
  getStatusInfo: (status: Document['status']) => {
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
   * 格式化日期
   */
  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return '-';
    // 如果是字符串，直接解析；如果是数字，作为时间戳处理
    const date =
      typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

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
                {formatDate(document.created_at || document.createdAt)}
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
                  {(document.status === 'failed' ||
                    document.status === 'dead') &&
                    onDocumentRetry && (
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
            <button
              onClick={onBatchDelete}
              className="btn btn-secondary text-sm"
            >
              批量删除
            </button>
          )}
          <button
            onClick={onClearSelection}
            className="btn btn-secondary text-sm"
          >
            取消选择
          </button>
        </div>
      </div>
    </div>
  );
};
