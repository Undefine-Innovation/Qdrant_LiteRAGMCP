import { SearchResult } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface SearchResultsProps {
  results: SearchResult[] | null;
  loading: boolean;
  query: string;
  total?: number;
  onResultSelect?: (result: SearchResult) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

/**
 * 搜索结果组件
 * 显示搜索结果列表
 */
const SearchResults = ({
  results,
  loading,
  query,
  total,
  onResultSelect,
  onLoadMore,
  hasMore = false,
  className = '',
}: SearchResultsProps) => {
  // 高亮搜索关键词
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;

    const regex = new RegExp(
      `(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200 text-yellow-900 px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // 格式化相关度分数
  const formatScore = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  // 截取文本
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && !results) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-secondary-600">搜索中...</span>
      </div>
    );
  }

  if (!query) {
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-secondary-900">
          开始搜索
        </h3>
        <p className="mt-1 text-sm text-secondary-500">
          输入关键词搜索文档内容
        </p>
      </div>
    );
  }

  if (!results || results.length === 0) {
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
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-secondary-900">
          未找到结果
        </h3>
        <p className="mt-1 text-sm text-secondary-500">
          没有找到与 "{query}" 相关的内容
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜索结果统计 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-secondary-600">
          {total !== undefined ? (
            <span>
              找到 {total} 条结果，显示前 {results.length} 条
            </span>
          ) : (
            <span>找到 {results.length} 条结果</span>
          )}
        </div>
        {query && (
          <div className="text-sm text-secondary-500">
            搜索关键词: "{query}"
          </div>
        )}
      </div>

      {/* 搜索结果列表 */}
      <div className="space-y-4">
        {results.map(result => (
          <div
            key={`${result.metadata.docId}_${result.metadata.chunkIndex}`}
            className="bg-white border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onResultSelect?.(result)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-medium text-primary-600 hover:text-primary-800">
                {highlightText(result.metadata.docName || '未知文档', query)}
              </h3>
              <span className="text-sm text-secondary-500 bg-secondary-100 px-2 py-1 rounded">
                {formatScore(result.score)}
              </span>
            </div>

            <div className="text-secondary-700 mb-3 leading-relaxed">
              {highlightText(truncateText(result.content, 300), query)}
            </div>

            <div className="flex items-center text-xs text-secondary-500 space-x-4">
              <span className="flex items-center">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {result.metadata.docName || '未知文档'}
              </span>
              <span className="flex items-center">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                {result.metadata.collectionName || '未知集合'}
              </span>
              {result.metadata.titleChain && (
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  {result.metadata.titleChain}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                加载中...
              </>
            ) : (
              '加载更多'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
