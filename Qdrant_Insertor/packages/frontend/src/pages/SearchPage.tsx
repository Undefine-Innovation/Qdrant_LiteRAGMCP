import { useState, useEffect } from 'react';
import { SearchResult, Collection, PaginationParams } from '../types';
import { useApi } from '../hooks/useApi';
import { searchApi, collectionsApi } from '../services/api';
import SearchBox from '../components/SearchBox';
import SearchResults from '../components/SearchResults';
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

  // 获取集合列表
  const { state: collectionsState, execute: loadCollections } = useApi(() =>
    collectionsApi.getCollections(),
  );

  // 获取搜索结果
  const { state: searchState, execute: executeSearch } = useApi(() =>
    searchApi.searchPaginated({
      q: query,
      collectionId: selectedCollection || undefined,
      ...paginationParams,
    }),
  );

  // 执行搜索
  const handleSearch = async (
    searchQuery: string,
    collectionId?: string,
  ): Promise<SearchResult[]> => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setTotalResults(0);
      setTotalPages(0);
      return [];
    }

    setQuery(searchQuery);
    setSelectedCollection(collectionId || '');
    setPaginationParams(prev => ({ ...prev, page: 1 }));
    return [];
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setPaginationParams(prev => ({ ...prev, page }));
  };

  // 处理每页数量变化
  const handleLimitChange = (limit: number) => {
    setPaginationParams(prev => ({ ...prev, limit, page: 1 }));
  };

  // 处理集合变化
  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setPaginationParams(prev => ({ ...prev, page: 1 }));
  };

  // 处理结果选择
  const handleResultSelect = (result: SearchResult) => {
    setSelectedDocumentId(result.documentId);
    setShowDetailModal(true);
  };

  // 当搜索参数变化时更新结果
  useEffect(() => {
    if (query.trim()) {
      executeSearch();
    }
  }, [paginationParams, selectedCollection, query]);

  // 更新搜索结果
  useEffect(() => {
    if (searchState.data) {
      const data = searchState.data as any;
      setSearchResults(data.data || []);
      setTotalResults(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    }
  }, [searchState.data]);

  // 初始加载
  useEffect(() => {
    loadCollections();
  }, []);

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
                (collectionsState.data as any)?.data ||
                (collectionsState.data as unknown as Collection[]) ||
                undefined
              }
              placeholder="输入搜索关键词..."
            />
          </div>
          <select
            value={selectedCollection}
            onChange={e => handleCollectionChange(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">所有集合</option>
            {(collectionsState.data as any)?.data?.map(
              (collection: Collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ),
            )}
          </select>
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
