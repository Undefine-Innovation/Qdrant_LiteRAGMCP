import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { scrapeApiService } from '../services/scrape-api';
import type { ScrapeTask, ScrapeTaskStatus } from '../types/scrape';

interface ScrapeTaskListProps {
  refreshTrigger?: number;
  onTaskSelect?: (task: ScrapeTask) => void;
}

export const ScrapeTaskList: React.FC<ScrapeTaskListProps> = ({
  refreshTrigger,
  onTaskSelect,
}) => {
  const [tasks, setTasks] = useState<ScrapeTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 状态颜色映射
  const getStatusColor = (status: ScrapeTaskStatus): string => {
    switch (status) {
      case 'NEW':
        return 'bg-gray-100 text-gray-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-yellow-100 text-yellow-800';
      case 'RETRYING':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 状态中文标签
  const getStatusLabel = (status: ScrapeTaskStatus): string => {
    switch (status) {
      case 'NEW':
        return '新建';
      case 'PROCESSING':
        return '处理中';
      case 'COMPLETED':
        return '已完成';
      case 'FAILED':
        return '失败';
      case 'CANCELLED':
        return '已取消';
      case 'RETRYING':
        return '重试中';
      default:
        return status;
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 格式化URL显示
  const formatUrl = (url: string | undefined, maxLength: number = 50): string => {
    if (!url) return 'N/A';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  // 计算任务持续时间
  const calculateDuration = (task: ScrapeTask): string => {
    if (!task.startedAt) return '-';
    
    const endTime = task.completedAt || Date.now();
    const duration = endTime - task.startedAt;
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await scrapeApiService.getAllScrapeTasks();
      if (response.success) {
        setTasks(response.tasks);
      } else {
        setError('Failed to load tasks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    try {
      await scrapeApiService.cancelScrapeTask(taskId, { reason: '用户取消' });
      await loadTasks(); // 重新加载任务列表
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };

  // 重试任务
  const handleRetryTask = async (taskId: string) => {
    try {
      await scrapeApiService.retryScrapeTask(taskId, { reason: '用户重试' });
      await loadTasks(); // 重新加载任务列表
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task');
    }
  };

  // 选择任务
  const handleTaskSelect = (task: ScrapeTask) => {
    setSelectedTaskId(task.id);
    onTaskSelect?.(task);
  };

  // 初始加载和刷新触发器效果
  useEffect(() => {
    loadTasks();
  }, [refreshTrigger]);

  // 自动刷新正在进行的任务
  useEffect(() => {
    const hasActiveTasks = tasks.some(
      task => task.status === 'PROCESSING' || task.status === 'RETRYING'
    );

    if (hasActiveTasks) {
      const interval = setInterval(loadTasks, 3000); // 每3秒刷新一次
      return () => clearInterval(interval);
    }
  }, [tasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">爬虫任务列表</h3>
          <button
            onClick={loadTasks}
            disabled={loading}
            className="btn btn-secondary text-sm"
          >
            {loading ? <LoadingSpinner size="sm" /> : '刷新'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            暂无爬虫任务
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedTaskId === task.id ? 'bg-blue-50 border-l-4 border-blue-400' : ''
              }`}
              onClick={() => handleTaskSelect(task)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {getStatusLabel(task.status)}
                    </span>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {formatUrl(task.context?.config?.url)}
                    </p>
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                    <span>深度: {task.context?.config?.maxDepth || 0}</span>
                    <span>重试: {task.retries}</span>
                    <span>进度: {task.progress}%</span>
                    <span>耗时: {calculateDuration(task)}</span>
                    <span>创建: {formatTime(task.createdAt)}</span>
                  </div>

                  {task.error && (
                    <div className="mt-2">
                      <p className="text-sm text-red-600 truncate">{task.error}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {task.status === 'PROCESSING' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelTask(task.id);
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      取消
                    </button>
                  )}
                  
                  {(task.status === 'FAILED' || task.status === 'CANCELLED') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryTask(task.id);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      重试
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};