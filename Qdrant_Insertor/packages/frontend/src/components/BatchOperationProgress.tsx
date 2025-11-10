import React from 'react';
import { BatchOperationProgress } from '../types';

/**
 * 批量操作进度指示器组件属性
 */
interface BatchOperationProgressProps {
  progress: BatchOperationProgress | null;
  title?: string;
  showDetails?: boolean;
  onCancel?: () => void;
}

/**
 * 批量操作进度指示器组件
 * 显示批量操作的进度、状态和详细信息
 */
const BatchOperationProgressComponent: React.FC<
  BatchOperationProgressProps
> = ({ progress, title = '批量操作', showDetails = true, onCancel }) => {
  if (!progress) {
    return null;
  }

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'completed_with_errors':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  /**
   * 获取状态文本
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'processing':
        return '处理中...';
      case 'completed':
        return '已完成';
      case 'completed_with_errors':
        return '已完成（有错误）';
      case 'failed':
        return '失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知状态';
    }
  };

  /**
   * 获取进度条颜色
   */
  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'processing':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'completed_with_errors':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const isCompleted =
    progress.status === 'completed' ||
    progress.status === 'failed' ||
    progress.status === 'cancelled';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      {/* 标题和状态 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center space-x-2">
          <span
            className={`text-sm font-medium ${getStatusColor(progress.status)}`}
          >
            {getStatusText(progress.status)}
          </span>
          {progress.status === 'processing' && onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>进度</span>
          <span>{progress.percentage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${getProgressColor(progress.status)} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">
            {progress.total}
          </div>
          <div className="text-gray-600">总计</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {progress.successful}
          </div>
          <div className="text-gray-600">成功</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {progress.failed}
          </div>
          <div className="text-gray-600">失败</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {progress.total - progress.successful - progress.failed}
          </div>
          <div className="text-gray-600">待处理</div>
        </div>
      </div>

      {/* 详细信息 */}
      {showDetails && progress.details && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">详细信息</h4>
          <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-600 max-h-32 overflow-y-auto">
            {progress.details.map((detail: unknown, index: number) => {
              const detailObj = detail as {
                success?: boolean;
                message?: string;
              };
              return (
                <div key={index} className="flex items-center space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      detailObj.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={
                      detailObj.success ? 'text-green-700' : 'text-red-700'
                    }
                  >
                    {detailObj.message || '未知错误'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {progress.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-red-800 mb-1">错误信息</h4>
          <p className="text-sm text-red-700">{progress.error}</p>
        </div>
      )}

      {/* 操作完成提示 */}
      {isCompleted && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            刷新页面
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchOperationProgressComponent;
