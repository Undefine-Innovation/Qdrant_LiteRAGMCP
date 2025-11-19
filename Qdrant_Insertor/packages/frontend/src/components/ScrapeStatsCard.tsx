import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { scrapeApiService } from '../services/scrape-api';
import type { ScrapeStats } from '../types/scrape';

interface ScrapeStatsProps {
  refreshTrigger?: number;
}

export const ScrapeStatsCard: React.FC<ScrapeStatsProps> = ({
  refreshTrigger,
}) => {
  const [stats, setStats] = useState<ScrapeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await scrapeApiService.getScrapeStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load statistics',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(loadStats, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadStats} className="btn btn-secondary text-sm">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-center text-gray-500">暂无统计数据</div>
      </div>
    );
  }

  const statItems = [
    { label: '总任务', value: stats.total, color: 'text-gray-600' },
    { label: '等待中', value: stats.pending, color: 'text-yellow-600' },
    { label: '处理中', value: stats.processing, color: 'text-blue-600' },
    { label: '已完成', value: stats.completed, color: 'text-green-600' },
    { label: '失败', value: stats.failed, color: 'text-red-600' },
    { label: '已取消', value: stats.cancelled, color: 'text-gray-600' },
    { label: '重试中', value: stats.retrying, color: 'text-orange-600' },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">爬虫统计</h3>
        <button
          onClick={loadStats}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          {loading ? <LoadingSpinner size="sm" /> : '刷新'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statItems.map(item => (
          <div key={item.label} className="text-center">
            <div className={`text-2xl font-bold ${item.color}`}>
              {item.value}
            </div>
            <div className="text-sm text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">成功率:</span>
            <span className="ml-2 font-medium text-green-600">
              {(stats.successRate * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">平均耗时:</span>
            <span className="ml-2 font-medium text-blue-600">
              {stats.avgDuration > 0
                ? `${(stats.avgDuration / 1000).toFixed(1)}s`
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
