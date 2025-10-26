import React, { useState, useEffect } from 'react';

/**
 * 分页组件属性接口
 */
interface PaginationProps {
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 总记录数 */
  total: number;
  /** 每页显示数量 */
  limit: number;
  /** 页码变化回调函数 */
  onPageChange: (page: number) => void;
  /** 每页数量变化回调函数 */
  onLimitChange: (limit: number) => void;
  /** 是否处于加载状态 */
  loading?: boolean;
  /** 自定义CSS类名 */
  className?: string;
}

/**
 * 分页组件
 * 提供完整的分页导航功能，包括页码导航、每页数量设置、跳转等功能
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  loading = false,
  className = '',
}) => {
  const [inputPage, setInputPage] = useState(currentPage.toString());
  const [inputLimit, setInputLimit] = useState(limit.toString());

  // 当外部currentPage变化时，更新输入框
  useEffect(() => {
    setInputPage(currentPage.toString());
  }, [currentPage]);

  // 当外部limit变化时，更新输入框
  useEffect(() => {
    setInputLimit(limit.toString());
  }, [limit]);

  /**
   * 处理页码变化
   * @param page - 新页码
   */
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && !loading) {
      onPageChange(page);
    }
  };

  /**
   * 处理每页数量变化
   * @param newLimit - 新的每页数量
   */
  const handleLimitChange = (newLimit: number) => {
    if (newLimit >= 1 && newLimit <= 100 && !loading) {
      onLimitChange(newLimit);
    }
  };

  /**
   * 处理跳转到指定页
   */
  const handleJumpToPage = () => {
    const page = parseInt(inputPage, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
    } else {
      setInputPage(currentPage.toString());
    }
  };

  /**
   * 处理跳转页输入框按键事件
   * @param e - 键盘事件
   */
  const handleJumpToPageKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  /**
   * 处理每页数量设置提交
   */
  const handleLimitChangeSubmit = () => {
    const newLimit = parseInt(inputLimit, 10);
    if (!isNaN(newLimit) && newLimit >= 1 && newLimit <= 100) {
      handleLimitChange(newLimit);
    } else {
      setInputLimit(limit.toString());
    }
  };

  /**
   * 处理每页数量输入框按键事件
   * @param e - 键盘事件
   */
  const handleLimitKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLimitChangeSubmit();
    }
  };

  /**
   * 计算显示的页码范围
   * @returns 页码数组，包含数字和省略号
   */
  const getVisiblePages = () => {
    const delta = 2; // 当前页前后显示的页数
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      for (let i = 1; i < Math.min(2, currentPage); i++) {
        rangeWithDots.push(i);
      }
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      for (
        let i = Math.max(totalPages - 1, currentPage + 1);
        i <= totalPages;
        i++
      ) {
        rangeWithDots.push(i);
      }
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  return (
    <div className={`pagination ${className}`}>
      <div className="pagination-info">
        <span>
          显示第 {(currentPage - 1) * limit + 1} -{' '}
          {Math.min(currentPage * limit, total)} 条，共 {total} 条记录
        </span>
      </div>

      <div className="pagination-controls">
        <div className="pagination-nav">
          <button
            className="pagination-button"
            onClick={() => handlePageChange(1)}
            disabled={!hasPrev || loading}
            title="第一页"
          >
            &laquo;
          </button>

          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrev || loading}
            title="上一页"
          >
            &lsaquo;
          </button>

          <div className="pagination-pages">
            {visiblePages.map((page, index) => (
              <span key={index}>
                {page === '...' ? (
                  <span className="pagination-ellipsis">...</span>
                ) : (
                  <button
                    className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(page as number)}
                    disabled={loading}
                  >
                    {page}
                  </button>
                )}
              </span>
            ))}
          </div>

          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNext || loading}
            title="下一页"
          >
            &rsaquo;
          </button>

          <button
            className="pagination-button"
            onClick={() => handlePageChange(totalPages)}
            disabled={!hasNext || loading}
            title="最后一页"
          >
            &raquo;
          </button>
        </div>

        <div className="pagination-options">
          <div className="pagination-jump">
            <label>跳转到第</label>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={inputPage}
              onChange={e => setInputPage(e.target.value)}
              onKeyPress={handleJumpToPageKeyPress}
              disabled={loading}
              className="pagination-input"
            />
            <label>页</label>
            <button
              onClick={handleJumpToPage}
              disabled={loading}
              className="pagination-button"
            >
              跳转
            </button>
          </div>

          <div className="pagination-limit">
            <label>每页显示</label>
            <input
              type="number"
              min="1"
              max="100"
              value={inputLimit}
              onChange={e => setInputLimit(e.target.value)}
              onKeyPress={handleLimitKeyPress}
              disabled={loading}
              className="pagination-input"
            />
            <label>条</label>
            <button
              onClick={handleLimitChangeSubmit}
              disabled={loading}
              className="pagination-button"
            >
              设置
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="pagination-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default Pagination;
