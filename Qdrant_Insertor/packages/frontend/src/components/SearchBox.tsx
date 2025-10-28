import { useState, useEffect, useRef, useCallback, KeyboardEvent, FocusEvent } from 'react';
import { SearchResult } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { defaultSearchLimiter, SearchHistory } from '../utils/searchLimiter';
import LoadingSpinner from './LoadingSpinner';

interface SearchBoxProps {
  onSearch: (query: string, collectionId?: string) => Promise<void>;
  onResultSelect?: (result: SearchResult) => void;
  collections?: { collectionId: string; name: string }[];
  placeholder?: string;
  className?: string;
  showSuggestions?: boolean;
  maxSuggestions?: number;
}

/**
 * 搜索组件
 * 支持实时搜索建议和结果选择
 */
const SearchBox = ({
  onSearch,
  onResultSelect,
  collections = [],
  placeholder = '输入搜索关键词...',
  className = '',
  showSuggestions = true,
}: SearchBoxProps) => {
  const [query, setQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<
    Array<{
      query: string;
      collectionId?: string;
      timestamp: number;
    }>
  >([]);

  // 使用高级防抖Hook
  const { debouncedValue: debouncedQuery, cancel: cancelDebounce } =
    useDebounce(query, {
      delay: 300,
      leading: false,
      trailing: true,
      maxWait: 1000,
    });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSearchRef = useRef<string>('');

  // 执行搜索
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      // 防止重复搜索
      if (currentSearchRef.current === searchQuery && isSearching) {
        return;
      }

      currentSearchRef.current = searchQuery;
      setIsSearching(true);

      try {
        // 使用搜索限速器执行搜索
        await defaultSearchLimiter.execute(
          searchQuery,
          async () => {
            await onSearch(searchQuery, selectedCollection || undefined);
            return Promise.resolve();
          },
          selectedCollection || undefined,
        );

        // 添加到搜索历史
        SearchHistory.add(searchQuery, selectedCollection || undefined);

        // 注意：由于SearchPage中的onSearch现在返回void，这里不再设置建议
        setSuggestions([]);
        setShowDropdown(false);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('搜索失败:', error);
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
        currentSearchRef.current = '';
      }
    },
    [onSearch, selectedCollection, isSearching],
  );

  // 当防抖查询变化时执行搜索
  useEffect(() => {
    // 只有当查询真正变化时才执行搜索，避免重复触发
    if (
      showSuggestions &&
      debouncedQuery.trim() &&
      debouncedQuery !== currentSearchRef.current
    ) {
      performSearch(debouncedQuery);
    } else if (!debouncedQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [debouncedQuery, performSearch, showSuggestions]);

  // 加载搜索历史
  useEffect(() => {
    if (showHistory && !query.trim()) {
      setSearchHistory(SearchHistory.get());
    }
  }, [showHistory, query]);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (!newQuery.trim()) {
      setShowDropdown(false);
      setSuggestions([]);
      setShowHistory(true);
    } else {
      setShowHistory(false);
    }
  };

  // 处理键盘导航
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectResult(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // 处理搜索提交
  const handleSearch = async () => {
    if (query.trim()) {
      // 取消防抖，立即执行搜索
      cancelDebounce();
      setShowDropdown(false);
      setShowHistory(false);
      await performSearch(query);
    }
  };

  // 处理历史记录选择
  const handleHistorySelect = (historyItem: {
    query: string;
    collectionId?: string;
  }) => {
    setQuery(historyItem.query);
    if (historyItem.collectionId) {
      setSelectedCollection(historyItem.collectionId);
    }
    setShowHistory(false);
    performSearch(historyItem.query);
  };

  // 清空搜索历史
  const handleClearHistory = () => {
    SearchHistory.clear();
    setSearchHistory([]);
  };

  // 处理结果选择
  const handleSelectResult = (result: SearchResult) => {
    setQuery(result.content.substring(0, 50) + '...');
    setShowDropdown(false);
    setSelectedIndex(-1);
    onResultSelect?.(result);
  };

  // 处理焦点事件
  const handleFocus = () => {
    if (query.trim()) {
      if (suggestions.length > 0) {
        setShowDropdown(true);
      }
    } else {
      setShowHistory(true);
      setSearchHistory(SearchHistory.get());
    }
  };

  const handleBlur = (e: FocusEvent) => {
    // 延迟隐藏下拉框，以便处理点击事件
    setTimeout(() => {
      if (!searchRef.current?.contains(e.relatedTarget as Node)) {
        setShowDropdown(false);
      }
    }, 150);
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
          key={`highlight-${index}`}
          className="bg-yellow-200 text-yellow-900 px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        <span key={`text-${index}`}>{part}</span>
      ),
    );
  };

  return (
    <div ref={searchRef} className={`relative w-full ${className}`}>
      <div className="flex space-x-2">
        {/* 搜索输入框 */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="input pr-10"
          />

          {/* 搜索图标 */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isSearching ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg
                className="h-5 w-5 text-secondary-400"
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
            )}
          </div>
        </div>

        {/* 集合选择器 */}
        {collections.length > 0 && (
          <select
            value={selectedCollection}
            onChange={e => setSelectedCollection(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">全部集合</option>
            {collections.map(collection => (
              <option
                key={collection.collectionId}
                value={collection.collectionId}
              >
                {collection.name}
              </option>
            ))}
          </select>
        )}

        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className="btn btn-primary"
        >
          搜索
        </button>
      </div>

      {/* 搜索历史下拉框 */}
      {showHistory && !query.trim() && searchHistory.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-secondary-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
          <div className="px-4 py-2 border-b border-secondary-200 flex justify-between items-center">
            <span className="text-sm font-medium text-secondary-700">
              搜索历史
            </span>
            <button
              onClick={handleClearHistory}
              className="text-xs text-secondary-500 hover:text-secondary-700"
            >
              清空历史
            </button>
          </div>
          <ul className="py-1">
            {searchHistory.map((item, index) => (
              <li
                key={`${item.query}_${item.timestamp}`}
                className={`px-4 py-2 cursor-pointer hover:bg-secondary-50 ${
                  index === selectedIndex ? 'bg-secondary-100' : ''
                }`}
                onClick={() => handleHistorySelect(item)}
              >
                <div className="text-sm">
                  <div className="font-medium text-secondary-900">
                    {highlightText(item.query, query)}
                  </div>
                  {item.collectionId && (
                    <div className="text-xs text-secondary-500">
                      集合:{' '}
                      {collections.find(
                        c => c.collectionId === item.collectionId,
                      )?.name || '未知集合'}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 搜索建议下拉框 */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-secondary-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
          <ul className="py-1">
            {suggestions.map((result, index) => (
              <li
                key={`${result.metadata.docId}_${result.metadata.chunkIndex}`}
                className={`px-4 py-3 cursor-pointer hover:bg-secondary-50 ${
                  index === selectedIndex ? 'bg-secondary-100' : ''
                }`}
                onClick={() => handleSelectResult(result)}
              >
                <div className="text-sm">
                  <div className="font-medium text-secondary-900 mb-1">
                    {highlightText(
                      result.metadata.docName || '未知文档',
                      query,
                    )}
                  </div>
                  <div className="text-secondary-600 line-clamp-2">
                    {highlightText(result.content, query)}
                  </div>
                  <div className="flex items-center mt-1 text-xs text-secondary-500 space-x-2">
                    <span>
                      集合: {result.metadata.collectionName || '未知集合'}
                    </span>
                    <span>相关度: {(result.score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* 查看更多结果 */}
          <div className="border-t border-secondary-200 px-4 py-2">
            <button
              onClick={handleSearch}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              查看所有搜索结果
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBox;
