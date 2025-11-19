import { useEffect, useState } from 'react';
import { defaultSearchLimiter } from '../utils/searchLimiter';

/**
 * 搜索状态指示器组件
 * 显示当前搜索请求的状态和统计信息
 */
interface SearchStatusIndicatorProps {
  className?: string;
}

const SearchStatusIndicator = ({
  className = '',
}: SearchStatusIndicatorProps) => {
  const [status, setStatus] = useState({
    pendingRequests: 0,
    queuedRequests: 0,
    activeRequests: 0,
  });

  useEffect(() => {
    const updateStatus = () => {
      setStatus(defaultSearchLimiter.getStatus());
    };

    // 初始更新
    updateStatus();

    // 定期更新状态
    const interval = setInterval(updateStatus, 200);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const hasActivity = status.pendingRequests > 0 || status.queuedRequests > 0;

  if (!hasActivity) {
    return null;
  }

  return (
    <div
      className={`flex items-center space-x-2 text-xs text-secondary-600 ${className}`}
    >
      {status.activeRequests > 0 && (
        <div className="flex items-center space-x-1">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-600"></div>
          <span>搜索中 ({status.activeRequests})</span>
        </div>
      )}

      {status.queuedRequests > 0 && (
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <span>排队中 ({status.queuedRequests})</span>
        </div>
      )}
    </div>
  );
};

export default SearchStatusIndicator;
