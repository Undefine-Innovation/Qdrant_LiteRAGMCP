import { useState } from 'react';
import { Document } from '../types';
import { DocumentListCore } from './DocumentListCore';
import {
  DocumentTable,
  Pagination,
  LoadingState,
  ErrorState,
  EmptyState,
  BatchActions
} from './DocumentListUI';

/**
 * 文档列表组件属性
 */
interface DocumentListProps {
  documents: Document[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDelete?: (documentId: string) => Promise<void>;
  onView?: (documentId: string) => void;
  onRetry?: (documentId: string) => Promise<void>;
  pagination?: {
    currentPage: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}

/**
 * 文档列表组件
 * 显示文档基本信息，支持分页、删除、查看详情等操作
 */
const DocumentList = ({
  documents,
  loading,
  error,
  onRefresh,
  onDelete,
  onView,
  onRetry,
  pagination,
  className = '',
}: DocumentListProps) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // 处理文档选择
  const handleSelectDocument = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, documentId]);
    } else {
      setSelectedDocuments((prev) => prev.filter((id) => id !== documentId));
    }
  };


  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedDocuments.length === 0 || !onDelete) return;

    if (confirm(`确定要删除选中的 ${selectedDocuments.length} 个文档吗？`)) {
      try {
        await Promise.all(selectedDocuments.map((id) => onDelete(id)));
        setSelectedDocuments([]);
        onRefresh();
      } catch (error) {
        console.error('批量删除失败:', error);
      }
    }
  };

  // 渲染组件
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRefresh={onRefresh} />;
  }

  if (!documents || documents.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* 批量操作工具栏 */}
      <BatchActions
        selectedDocuments={selectedDocuments}
        onBatchDelete={handleBatchDelete}
        onClearSelection={() => setSelectedDocuments([])}
      />

      {/* 文档列表 */}
      <DocumentTable
        documents={documents}
        selectedDocuments={selectedDocuments}
        onDocumentSelect={handleSelectDocument}
        onDocumentView={onView || (() => {})}
        onDocumentRetry={onRetry || (() => {})}
        onDocumentDelete={onDelete || (() => {})}
        getStatusInfo={DocumentListCore.getStatusInfo}
      />

      {/* 分页控件 */}
      {pagination && <Pagination {...pagination} />}
    </div>
  );
};

export default DocumentList;