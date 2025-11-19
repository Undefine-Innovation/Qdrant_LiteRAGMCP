import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchResult, Collection, PaginationParams } from '../types';
import { useApi } from '../hooks/useApi';
import { searchApi, collectionsApi } from '../services/api';
import { defaultSearchLimiter } from '../utils/searchLimiter';
import SearchBox from '../components/SearchBox';
import SearchResults from '../components/SearchResults';
import SearchStatusIndicator from '../components/SearchStatusIndicator';
import DocumentDetail from '../components/DocumentDetail';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';

/**
 * 搜索页面组件
 * 提供文档搜索功能
 */
const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [totalResults, setTotalResults] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [paginationParams, setPaginationParams] = useState<PaginationParams>({
    page: 1,
    limit: 20,
    sort: 'score',
    order: 'desc',
  });
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [isSearchStale, setIsSearchStale] = useState(false);

  // 用于跟踪当前搜索请求
  const currentSearchRef = useRef<{
    query: string;
    collectionId: string;
    page: number;
  } | null>(null);
  // 保持 executeSearch 的稳定引用，避免其 identity 变化导致 effect 不必要的重新执行
  const executeSearchRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    // 在这里不直接引用 executeSearch 的类型（避免在它声明前使用），
    // useEffect 会在 executeSearch 被声明后运行并同步引用
    // (依赖项会在 executeSearch 可用时触发)
  }, []);

  // 获取集合列表
  const { state: collectionsState, execute: loadCollections } = useApi(() =>
    collectionsApi.getCollections(),
  );

  // 获取搜索结果
  const {
    state: searchState,
    execute: executeSearch,
    reset: resetSearch,
  } = useApi(
    () =>
      searchApi.searchPaginated({
        q: query,
        collectionId: selectedCollection || undefined,
        ...paginationParams,
      }),
    {
      maxRetries: 1,
      retryDelay: 300,
      retryCondition: () => {
        // 搜索失败时不重试，避免重复请求
        return false;
      },
    },
  );

  // 同步 executeSearch 到 ref（用于稳定调用）
  useEffect(() => {
    executeSearchRef.current = executeSearch;
  }, [executeSearch]);

  // 执行搜索
  const handleSearch = useCallback(
    async (searchQuery: string, collectionId?: string): Promise<void> => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setTotalResults(0);
        setTotalPages(0);
        return;
      }

      // 更新搜索参数
      setQuery(searchQuery);
      setSelectedCollection(collectionId || '');
      setPaginationParams(prev => ({ ...prev, page: 1 }));
      // 通过 effect 触发实际搜索，请勿在此处更新 currentSearchRef
      setIsSearchStale(false);
    },
    [],
  );

  // 处理页码变化
  const handlePageChange = useCallback(
    (page: number) => {
      setPaginationParams(prev => ({ ...prev, page }));
      // 实际搜索将由 effect 触发
      setIsSearchStale(false);
    },
    [query, selectedCollection],
  );

  // 处理每页数量变化
  const handleLimitChange = useCallback(
    (limit: number) => {
      setPaginationParams(prev => ({ ...prev, limit, page: 1 }));
      // 实际搜索将由 effect 触发
      setIsSearchStale(false);
    },
    [query, selectedCollection],
  );

  // 处理集合变化
  const handleCollectionChange = useCallback(
    (collectionId: string) => {
      setSelectedCollection(collectionId);
      setPaginationParams(prev => ({ ...prev, page: 1 }));
      // 实际搜索将由 effect 触发
      setIsSearchStale(false);
    },
    [query],
  );

  // 处理结果选择
  const handleResultSelect = (result: SearchResult) => {
    setSelectedDocumentId(result.metadata.docId);
    setShowDetailModal(true);
  };

  // 当搜索参数变化时更新结果
  useEffect(() => {
    if (!query.trim()) return;

    const currentSearch = {
      query,
      collectionId: selectedCollection,
      page: paginationParams.page || 1,
    };

    const last = currentSearchRef.current;
    const changed =
      !last ||
      last.query !== currentSearch.query ||
      last.collectionId !== currentSearch.collectionId ||
      last.page !== currentSearch.page;

    if (!changed) return;

    defaultSearchLimiter
      .execute(
        `${query}_${selectedCollection}_${paginationParams.page}`,
        async () => {
          // 使用 ref 调用，避免依赖 executeSearch identity
          if (executeSearchRef.current) await executeSearchRef.current();
          return Promise.resolve();
        },
      )
      .then(() => {
        // 标记为已执行的最新搜索参数
        currentSearchRef.current = currentSearch;
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('搜索执行失败:', error);
        }
      });
    // 清理：组件卸载或依赖变化时取消限速器中的请求并中止进行中的 API 请求
    return () => {
      try {
        defaultSearchLimiter.cancelAll();
      } catch {
        // ignore
      }
      try {
        // resetSearch 会中止 useApi 内部的 AbortController
        resetSearch?.();
      } catch {
        // ignore
      }
    };
  }, [paginationParams.page, selectedCollection, query]);

  // 更新搜索结果
  useEffect(() => {
    if (searchState.data && !isSearchStale) {
      const data = searchState.data as {
        data: SearchResult[];
        pagination: { total: number; totalPages: number };
      };
      setSearchResults(data.data || []);
      setTotalResults(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    }
  }, [searchState.data, isSearchStale]);

  // 初始加载
  useEffect(() => {
    loadCollections();
  }, []);

  // 当集合列表加载完成且未选择集合时，设置一个默认集合（如果存在）
  useEffect(() => {
    const list =
      (collectionsState.data as { data: Collection[] })?.data ||
      (collectionsState.data as unknown as Collection[]) ||
      [];
    if (list.length > 0 && !selectedCollection) {
      setSelectedCollection(list[0].collectionId);
    }
  }, [collectionsState.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-800 mb-4">智能搜索</h1>
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1">
            <SearchBox
              onSearch={handleSearch}
              onResultSelect={handleResultSelect}
              collections={
                (collectionsState.data as { data: Collection[] })?.data ||
                (collectionsState.data as unknown as Collection[]) ||
                undefined
              }
              placeholder="输入搜索关键词..."
              onCollectionChange={handleCollectionChange}
              selectedCollection={selectedCollection}
            />
          </div>
          <SearchStatusIndicator />
        </div>
      </div>

      <div className="space-y-4">
        <SearchResults
          results={searchResults}
          loading={searchState.loading}
          query={query}
          total={totalResults}
          onResultSelect={handleResultSelect}
          onLoadMore={() => {}} // 不再使用加载更多，改用分页
          hasMore={false}
        />

        {/* 分页组件 - 仅在有结果时显示 */}
        {searchResults.length > 0 && totalPages > 1 && (
          <Pagination
            currentPage={paginationParams.page || 1}
            totalPages={totalPages}
            total={totalResults}
            limit={paginationParams.limit || 20}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={searchState.loading}
          />
        )}
      </div>

      {/* 详情模态框 */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="文档详情"
        size="xl"
      >
        <DocumentDetail
          documentId={selectedDocumentId}
          onClose={() => setShowDetailModal(false)}
        />
      </Modal>
    </div>
  );
};

export default SearchPage;
