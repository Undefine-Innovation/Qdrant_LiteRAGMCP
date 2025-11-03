import React from 'react';

interface SystemOverview {
  documentsCount: number;
  collectionsCount: number;
  chunksCount: number;
  vectorsCount: number;
}

interface SystemOverviewCardProps {
  overview: SystemOverview | null;
  loading?: boolean;
}

export const SystemOverviewCard: React.FC<SystemOverviewCardProps> = ({ overview, loading }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统概览</h3>
        <div className="animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="h-8 bg-gray-200 rounded w-12 mx-auto mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统概览</h3>
        <div className="text-center text-gray-500">
          无法获取系统概览数据
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: '文档数量',
      value: overview.documentsCount,
      color: 'text-blue-600 bg-blue-50',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label: '集合数量',
      value: overview.collectionsCount,
      color: 'text-green-600 bg-green-50',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      label: '文本块数量',
      value: overview.chunksCount,
      color: 'text-purple-600 bg-purple-50',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      label: '向量数量',
      value: overview.vectorsCount,
      color: 'text-orange-600 bg-orange-50',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">系统概览</h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className={`p-4 rounded-lg ${stat.color}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={stat.color.split(' ')[0]}>
                {stat.icon}
              </div>
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${stat.color.split(' ')[0]}`}>
                {formatNumber(stat.value)}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 数据比例显示 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600 space-y-2">
          {overview.documentsCount > 0 && overview.chunksCount > 0 && (
            <div className="flex justify-between">
              <span>平均每个文档的文本块数量:</span>
              <span className="font-medium">
                {(overview.chunksCount / overview.documentsCount).toFixed(1)}
              </span>
            </div>
          )}
          {overview.collectionsCount > 0 && overview.documentsCount > 0 && (
            <div className="flex justify-between">
              <span>平均每个集合的文档数量:</span>
              <span className="font-medium">
                {(overview.documentsCount / overview.collectionsCount).toFixed(1)}
              </span>
            </div>
          )}
          {overview.chunksCount > 0 && overview.vectorsCount > 0 && (
            <div className="flex justify-between">
              <span>向量化覆盖率:</span>
              <span className="font-medium">
                {((overview.vectorsCount / overview.chunksCount) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};