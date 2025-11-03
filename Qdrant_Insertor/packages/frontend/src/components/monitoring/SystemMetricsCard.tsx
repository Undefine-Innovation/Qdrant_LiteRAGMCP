import React from 'react';
import { SystemMetricsResponse } from '../../services/monitoring-api.js';

interface SystemMetricsCardProps {
  metrics: SystemMetricsResponse['metrics'] | null;
  loading?: boolean;
}

export const SystemMetricsCard: React.FC<SystemMetricsCardProps> = ({ metrics, loading }) => {
  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 75) return 'bg-yellow-500';
    if (percentage > 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const ProgressBar: React.FC<{ percentage: number; label: string; value: string }> = ({ 
    percentage, 
    label, 
    value 
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="text-gray-600">{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统指标</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统指标</h3>
        <div className="text-center text-gray-500">
          无法获取系统指标数据
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">系统指标</h3>
      
      <div className="space-y-6">
        {/* CPU 使用率 */}
        <ProgressBar
          percentage={metrics.cpu.usage}
          label="CPU 使用率"
          value={`${metrics.cpu.usage.toFixed(1)}%`}
        />

        {/* 内存使用率 */}
        <ProgressBar
          percentage={metrics.memory.percentage}
          label="内存使用率"
          value={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
        />

        {/* 磁盘使用率 */}
        <ProgressBar
          percentage={metrics.disk.percentage}
          label="磁盘使用率"
          value={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
        />

        {/* 数据库信息 */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">数据库</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.database.connections}</div>
              <div className="text-xs text-gray-500">活跃连接</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatBytes(metrics.database.size)}</div>
              <div className="text-xs text-gray-500">数据库大小</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{metrics.database.queryTime}ms</div>
              <div className="text-xs text-gray-500">平均查询时间</div>
            </div>
          </div>
        </div>

        {/* 负载平均值 */}
        {metrics.cpu.loadAverage && metrics.cpu.loadAverage.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">系统负载</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {metrics.cpu.loadAverage[0]?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-gray-500">1分钟</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {metrics.cpu.loadAverage[1]?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-gray-500">5分钟</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {metrics.cpu.loadAverage[2]?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-gray-500">15分钟</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};