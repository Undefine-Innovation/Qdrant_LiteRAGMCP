import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import BatchOperationProgressComponent from './BatchOperationProgress';
import BatchOperationHistory from './BatchOperationHistory';
import Modal from './Modal';

/**
 * 批量操作状态管理组件
 * 全局显示批量操作进度和历史记录
 */
const BatchOperationStatus: React.FC = () => {
  const { batchUploadProgress, batchOperationProgress, batchOperationHistory } =
    useAppStore();

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // 判断是否有正在进行的批量操作
  const hasActiveOperation = batchUploadProgress || batchOperationProgress;

  // 获取当前操作的进度
  const currentProgress = batchOperationProgress || batchUploadProgress;

  return (
    <>
      {/* 浮动按钮 */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        {/* 历史记录按钮 */}
        {batchOperationHistory.length > 0 && (
          <button
            onClick={() => setShowHistoryModal(true)}
            className="bg-white rounded-full shadow-lg p-3 hover:shadow-xl transition-shadow"
            title="批量操作历史"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {batchOperationHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {batchOperationHistory.length}
              </span>
            )}
          </button>
        )}

        {/* 进度按钮 */}
        {hasActiveOperation && currentProgress && (
          <button
            onClick={() => setShowProgressModal(true)}
            className="bg-blue-500 text-white rounded-full shadow-lg p-3 hover:bg-blue-600 transition-colors"
            title="查看批量操作进度"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {(currentProgress.percentage || 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-blue-500 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {currentProgress.percentage || 0}%
              </span>
            )}
          </button>
        )}
      </div>

      {/* 进度模态框 */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="批量操作进度"
        size="lg"
      >
        <BatchOperationProgressComponent
          progress={batchOperationProgress}
          title="当前批量操作"
          showDetails={true}
          onCancel={() => {
            // 这里可以添加取消操作的逻辑
            setShowProgressModal(false);
          }}
        />
      </Modal>

      {/* 历史记录模态框 */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="批量操作历史"
        size="xl"
      >
        <BatchOperationHistory maxItems={20} showClearButton={true} />
      </Modal>

      {/* 简化的进度指示器（在页面底部） */}
      {hasActiveOperation && currentProgress && !showProgressModal && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">
                    批量操作进行中
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {currentProgress.successful}/{currentProgress.total} 已完成
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentProgress.percentage || 0}%` }}
                  />
                </div>
                <button
                  onClick={() => setShowProgressModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  查看详情
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BatchOperationStatus;
