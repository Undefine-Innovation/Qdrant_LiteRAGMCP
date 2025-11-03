import React, { useEffect, useState } from 'react';
import { monitoringApi, DashboardDataResponse } from '../services/monitoring-api.js';
import { HealthStatusCard } from '../components/monitoring/HealthStatusCard.js';
import { SystemMetricsCard } from '../components/monitoring/SystemMetricsCard.js';
import { SyncStatsCard } from '../components/monitoring/SyncStatsCard.js';
import { RecentAlertsCard } from '../components/monitoring/RecentAlertsCard.js';
import { SystemOverviewCard } from '../components/monitoring/SystemOverviewCard.js';

export const MonitoringDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardDataResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const response = await monitoringApi.getDashboardData({
        timeRange: '1h',
        includeSyncStats: true,
        includeAlerts: true
      });
      
      if (response.success) {
        setDashboardData(response.data);
      } else {
        setError('获取仪表板数据失败');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('获取仪表板数据时发生错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // 设置自动刷新
    const interval = setInterval(fetchDashboardData, 30000); // 30秒刷新一次
    setRefreshInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  const handleToggleAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    } else {
      const interval = setInterval(fetchDashboardData, 30000);
      setRefreshInterval(interval);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和控制按钮 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">监控仪表板</h1>
              <p className="text-gray-600 mt-2">系统实时监控和性能指标</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleToggleAutoRefresh}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  refreshInterval 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {refreshInterval ? '自动刷新: 开' : '自动刷新: 关'}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg 
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>刷新</span>
              </button>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* 仪表板内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* 系统概览 - 占用两列 */}
          <div className="lg:col-span-2">
            <SystemOverviewCard 
              overview={dashboardData?.systemOverview || null} 
              loading={loading}
            />
          </div>

          {/* 健康状态 */}
          <div>
            <HealthStatusCard 
              health={dashboardData?.health || null} 
              loading={loading}
            />
          </div>

          {/* 系统指标 - 占用两列 */}
          <div className="lg:col-span-2">
            <SystemMetricsCard 
              metrics={dashboardData?.metrics || null} 
              loading={loading}
            />
          </div>

          {/* 同步统计 */}
          <div>
            <SyncStatsCard 
              stats={dashboardData?.syncStats || null} 
              loading={loading}
            />
          </div>

          {/* 最近告警 - 占用完整行 */}
          <div className="lg:col-span-2 xl:col-span-3">
            <RecentAlertsCard 
              alerts={dashboardData?.recentAlerts || []} 
              loading={loading}
            />
          </div>
        </div>

        {/* 页面底部信息 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            数据每 30 秒自动更新 • 
            最后更新: {dashboardData ? new Date().toLocaleTimeString('zh-CN') : '--'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;