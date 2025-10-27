import { useState, useEffect } from 'react';
import { Document, Chunk } from '../types';
import { documentsApi } from '../services/api';
import { usePaginatedApi } from '../hooks/useApi';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import Pagination from './Pagination';

// 文档块接口（扩展后端Chunk类型）
interface DocumentChunk extends Chunk {
  tokenCount: number;
}

interface DocumentDetailProps {
  documentId: string;
  onClose?: () => void;
  className?: string;
}

/**
 * 文档详情组件
 * 显示文档内容和块列表
 */
const DocumentDetail = ({
  documentId,
  onClose,
  className = '',
}: DocumentDetailProps) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'chunks'>('content');
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(
    null,
  );

  // 使用分页Hook加载文档块
  const {
    state: chunksState,
    loadPage: loadChunksPage,
    nextPage,
    prevPage,
  } = usePaginatedApi(async (page: number, limit: number) => {
    const response = await documentsApi.getDocumentChunksPaginated(documentId, {
      page,
      limit,
      sort: 'chunkIndex',
      order: 'asc',
    });

    // 处理块数据，将后端格式转换为前端格式
    const chunksData = response.data.map((chunk: any) => ({
      id: chunk.pointId,
      documentId: chunk.docId,
      content: chunk.content,
      index: chunk.chunkIndex,
      tokenCount: Math.floor(chunk.content.length / 4), // 估算token数量
    }));

    return {
      data: chunksData,
      total: response.pagination.total,
      page: response.pagination.page,
      limit: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
  });

  // 加载文档详情
  useEffect(() => {
    const loadDocumentDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        // 调用实际的API
        const documentResponse = await documentsApi.getDocument(documentId);

        // 处理文档数据
        const docData = documentResponse as Document;
        setDocument(docData);

        // 加载第一页的文档块
        await loadChunksPage(1, 20);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文档详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      loadDocumentDetail();
    }
  }, [documentId, loadChunksPage]);

  // 获取状态显示文本和样式
  const getStatusInfo = (isDeleted?: boolean) => {
    if (isDeleted) {
      return { text: '已删除', className: 'bg-red-100 text-red-800' };
    }
    return { text: '正常', className: 'bg-green-100 text-green-800' };
  };

  // 格式化日期
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '未知';
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-secondary-600">加载文档详情...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error} />
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary">
            返回
          </button>
        )}
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary-500">文档不存在</p>
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary mt-4">
            返回
          </button>
        )}
      </div>
    );
  }

  const statusInfo = getStatusInfo(document.isDeleted);

  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}
    >
      {/* 文档头部 */}
      <div className="bg-secondary-50 px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-secondary-900">
              {document.name}
            </h2>
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.className}`}
            >
              {statusInfo.text}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-secondary-600 focus:outline-none"
              aria-label="关闭"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center space-x-6 text-sm text-secondary-500">
          <span>文档ID: {document.docId}</span>
          <span>集合ID: {document.collectionId}</span>
          <span>
            文件大小:{' '}
            {document.sizeBytes
              ? `${(document.sizeBytes / 1024).toFixed(1)} KB`
              : '未知'}
          </span>
          <span>创建时间: {formatDate(document.createdAt)}</span>
          <span>更新时间: {formatDate(document.updatedAt)}</span>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-secondary-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'content'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
            }`}
          >
            文档内容
          </button>
          <button
            onClick={() => setActiveTab('chunks')}
            className={`py-2 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'chunks'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
            }`}
          >
            文档块 ({chunksState.data?.total || chunksState.data?.length || 0})
          </button>
        </nav>
      </div>

      {/* 标签页内容 */}
      <div className="p-6">
        {activeTab === 'content' ? (
          <div className="space-y-4">
            <div className="prose max-w-none">
              <p className="text-secondary-700 leading-relaxed">
                这里应该显示文档的完整内容。在实际应用中，您需要从后端API获取文档的原始内容。
              </p>
              <p className="text-secondary-700 leading-relaxed">
                文档内容可能包含各种格式，如Markdown、HTML或纯文本。您可以使用相应的渲染库来正确显示这些内容。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!chunksState.data?.data || chunksState.data?.data?.length === 0 ? (
              <div className="text-center py-8 text-secondary-500">
                该文档尚未被分割成块
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 块列表 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-secondary-900 mb-3">
                    文档块列表
                  </h3>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {chunksState.data?.data?.map(chunk => (
                      <div
                        key={chunk.id}
                        onClick={() => setSelectedChunk(chunk)}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          selectedChunk?.id === chunk.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-secondary-200 hover:bg-secondary-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-secondary-900">
                            块 #{chunk.index + 1}
                          </span>
                          <span className="text-xs text-secondary-500">
                            {chunk.tokenCount} tokens
                          </span>
                        </div>
                        <p className="text-sm text-secondary-600 line-clamp-3">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* 分页组件 */}
                  {chunksState.data && chunksState.data.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={chunksState.data.page}
                        totalPages={chunksState.data.totalPages}
                        total={chunksState.data.total}
                        limit={chunksState.data.limit}
                        onPageChange={page =>
                          loadChunksPage(page, chunksState.data?.limit || 20)
                        }
                        onLimitChange={limit => loadChunksPage(1, limit)}
                        loading={chunksState.loading}
                      />
                    </div>
                  )}
                </div>

                {/* 块详情 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-secondary-900 mb-3">
                    块详情
                  </h3>
                  {selectedChunk ? (
                    <div className="border border-secondary-200 rounded-md p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-secondary-900">
                          块 #{selectedChunk.index + 1}
                        </span>
                        <span className="text-xs text-secondary-500">
                          {selectedChunk.tokenCount} tokens
                        </span>
                      </div>
                      <div className="bg-secondary-50 p-3 rounded-md">
                        <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                          {selectedChunk.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-secondary-200 rounded-md p-8 text-center text-secondary-500">
                      选择一个文档块查看详情
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentDetail;
