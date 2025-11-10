import React from 'react';
import { HealthCheckResponse } from '../../services/monitoring-api.js';

interface HealthStatusCardProps {
  health: HealthCheckResponse | null;
  loading?: boolean;
}

export const HealthStatusCard: React.FC<HealthStatusCardProps> = ({
  health,
  loading,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (uptime: number) => {
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days}天 ${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统健康状态</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统健康状态</h3>
        <div className="text-center text-gray-500">无法获取健康状态数据</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">系统健康状态</h3>

      {/* 总体状态 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">总体状态</span>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(health.status)}`}
          >
            {health.status === 'healthy'
              ? '健康'
              : health.status === 'degraded'
                ? '降级'
                : '不健康'}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          运行时间: {formatUptime(health.uptime)}
        </div>
      </div>

      {/* 组件状态 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">组件状态</h4>
        <div className="space-y-2">
          {Object.entries(health.components).map(([name, component]) => (
            <div
              key={name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {name === 'database'
                      ? '数据库'
                      : name === 'qdrant'
                        ? 'Qdrant'
                        : name === 'embedding'
                          ? '嵌入服务'
                          : name}
                  </span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(component.status)}`}
                  >
                    {component.status === 'healthy'
                      ? '健康'
                      : component.status === 'degraded'
                        ? '降级'
                        : '不健康'}
                  </span>
                </div>
                {component.message && (
                  <div className="text-xs text-gray-500 mt-1">
                    {component.message}
                  </div>
                )}
              </div>
              {component.responseTime !== undefined && (
                <div className="text-xs text-gray-500">
                  {component.responseTime}ms
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
