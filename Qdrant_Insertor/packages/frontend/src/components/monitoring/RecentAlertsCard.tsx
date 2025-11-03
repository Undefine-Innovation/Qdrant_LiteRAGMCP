import React from 'react';

interface RecentAlert {
  id: string;
  ruleId: string;
  severity: string;
  message: string;
  triggeredAt: number;
  status: string;
}

interface RecentAlertsCardProps {
  alerts: RecentAlert[];
  loading?: boolean;
}

export const RecentAlertsCard: React.FC<RecentAlertsCardProps> = ({ alerts, loading }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-red-600 bg-red-100';
      case 'resolved':
        return 'text-green-600 bg-green-100';
      case 'acknowledged':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">最近告警</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">最近告警</h3>
        {alerts.length > 0 && (
          <span className="text-sm text-gray-500">{alerts.length} 条告警</span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-gray-500 text-sm">暂无告警信息</div>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity).replace('border-', 'border ')}`}>
                    {alert.severity === 'critical' ? '严重' :
                     alert.severity === 'high' ? '高' :
                     alert.severity === 'medium' ? '中等' :
                     alert.severity === 'low' ? '低' :
                     alert.severity}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                    {alert.status === 'active' ? '活跃' :
                     alert.status === 'resolved' ? '已解决' :
                     alert.status === 'acknowledged' ? '已确认' :
                     alert.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTime(alert.triggeredAt)}
                </span>
              </div>
              
              <div className="text-sm text-gray-800 mb-1">
                {alert.message}
              </div>
              
              <div className="text-xs text-gray-500">
                规则ID: {alert.ruleId}
              </div>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            查看全部告警
          </button>
        </div>
      )}
    </div>
  );
};