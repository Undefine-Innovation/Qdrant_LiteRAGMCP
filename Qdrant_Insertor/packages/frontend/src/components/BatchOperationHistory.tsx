import React, { useState } from 'react';
import { BatchOperationHistory as BatchOperationHistoryType } from '../types';
import { useAppStore } from '../stores/useAppStore';

/**
 * 批量操作历史记录组件属性
 */
interface BatchOperationHistoryProps {
  maxItems?: number;
  showClearButton?: boolean;
}

/**
 * 批量操作历史记录组件
 * 显示批量操作的历史记录和统计信息
 */
const BatchOperationHistory: React.FC<BatchOperationHistoryProps> = ({
  maxItems = 10,
  showClearButton = true,
}) => {
  const { batchOperationHistory, clearBatchOperationHistory } = useAppStore();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /**
   * 获取操作类型文本
   */
  const getOperationTypeText = (type: string): string => {
    switch (type) {
      case 'upload':
        return '批量上传';
      case 'delete':
        return '批量删除';
      default:
        return type;
    }
  };

  /**
   * 获取状态文本
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'completed_with_errors':
        return '已完成（有错误）';
      case 'failed':
        return '失败';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'completed_with_errors':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  /**
   * 格式化时间戳
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  /**
   * 切换展开状态
   */
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  /**
   * 获取成功率
   */
  const getSuccessRate = (operation: BatchOperationHistoryType): number => {
    if (operation.total === 0) return 0;
    return Math.round((operation.successful / operation.total) * 100);
  };

  // 限制显示数量
  const displayHistory = batchOperationHistory.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      {/* 标题和操作 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">批量操作历史</h3>
        {showClearButton && batchOperationHistory.length > 0 && (
          <button
            onClick={clearBatchOperationHistory}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            清除历史
          </button>
        )}
      </div>

      {/* 历史记录列表 */}
      {displayHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无批量操作历史</div>
      ) : (
        <div className="space-y-3">
          {displayHistory.map(operation => (
            <div
              key={operation.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              {/* 基本信息 */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">
                      {getOperationTypeText(operation.type)}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}
                    >
                      {getStatusText(operation.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatTimestamp(operation.timestamp)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-800">
                    {operation.successful}/{operation.total}
                  </div>
                  <div className="text-xs text-gray-600">
                    成功率: {getSuccessRate(operation)}%
                  </div>
                </div>
              </div>

              {/* 详细信息 */}
              <div className="mt-3 space-y-2">
                {/* 进度条 */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      operation.status === 'completed'
                        ? 'bg-green-500'
                        : operation.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-gray-500'
                    }`}
                    style={{ width: `${getSuccessRate(operation)}%` }}
                  />
                </div>

                {/* 统计信息 */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-green-600">
                      {operation.successful}
                    </div>
                    <div className="text-gray-600">成功</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">
                      {operation.failed}
                    </div>
                    <div className="text-gray-600">失败</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-blue-600">
                      {operation.total -
                        operation.successful -
                        operation.failed}
                    </div>
                    <div className="text-gray-600">待处理</div>
                  </div>
                </div>

                {/* 展开/收起按钮 */}
                {(operation as unknown as { details?: unknown[] }).details &&
                  (operation as unknown as { details: unknown[] }).details
                    .length > 0 && (
                    <button
                      onClick={() => toggleExpanded(operation.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {expandedItems.has(operation.id)
                        ? '收起详情'
                        : '查看详情'}
                    </button>
                  )}

                {/* 详细信息 */}
                {expandedItems.has(operation.id) &&
                  (operation as unknown as { details: unknown[] }).details && (
                    <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1 max-h-32 overflow-y-auto">
                      {(
                        operation as unknown as { details: unknown[] }
                      ).details.map((detail: unknown, index: number) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              (detail as { success?: boolean }).success
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span
                            className={
                              (detail as { success?: boolean }).success
                                ? 'text-green-700'
                                : 'text-red-700'
                            }
                          >
                            {(detail as { message?: string }).message ||
                              '未知错误'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 统计信息 */}
      {batchOperationHistory.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            总计 {batchOperationHistory.length} 次批量操作
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchOperationHistory;
