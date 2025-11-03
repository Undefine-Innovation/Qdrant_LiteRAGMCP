import React, { useState, useEffect, useMemo } from 'react';
import { scrapeApiService } from '../services/scrape-api';
import { ScrapeForm } from '../components/ScrapeForm';
import { ScrapeTaskList } from '../components/ScrapeTaskList';
import { ScrapeStatsCard } from '../components/ScrapeStatsCard';
import type { ScrapeTask } from '../types/scrape';

export const ScrapePage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTask, setSelectedTask] = useState<ScrapeTask | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleTaskCreated = (taskId: string) => {
    setNotification({
      type: 'success',
      message: `爬虫任务已创建，任务ID: ${taskId}`,
    });
    setRefreshTrigger(prev => prev + 1);
    
    // 3秒后清除通知
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleError = (error: string) => {
    setNotification({
      type: 'error',
      message: error,
    });
    
    // 5秒后清除通知
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleTaskSelect = (task: ScrapeTask) => {
    setSelectedTask(task);
  };

  // 仅基于 taskId 进行轮询依赖，避免每次对象更新导致重复创建轮询器
  const selectedTaskId = useMemo(() => selectedTask?.id ?? null, [selectedTask?.id]);

  // 当打开任务详情时，开始可取消的轮询，关闭或切换任务时停止
  useEffect(() => {
    if (!selectedTaskId) return;
    // 结束状态不轮询
    if (selectedTask && (selectedTask.status === 'COMPLETED' || selectedTask.status === 'FAILED' || selectedTask.status === 'CANCELLED')) {
      return;
    }

    const stop = scrapeApiService.startPollingTask(
      selectedTaskId,
      (task) => {
        // 仅当返回的是同一个任务时更新，避免竞态
        if (task.id === selectedTaskId) {
          setSelectedTask(task);
        }
      },
      2000,
    );

    return () => {
      stop();
    };
  }, [selectedTaskId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">网页爬虫</h1>
            <p className="mt-2 text-gray-600">
              创建和管理网页爬虫任务，将网页内容导入到知识库中
            </p>
          </div>
          <a
            href="/scrape/review"
            className="inline-flex items-center px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            title="前往抓取结果审核页面"
          >
            抓取结果审核
          </a>
        </div>

        {/* 通知 */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg ${
            notification.type === 'success' 
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm">{notification.message}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setNotification(null)}
                  className="inline-flex text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：创建任务表单 */}
          <div className="lg:col-span-1">
            <ScrapeForm onSuccess={handleTaskCreated} onError={handleError} />
          </div>

          {/* 右侧：任务列表和统计 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 统计卡片 */}
            <ScrapeStatsCard refreshTrigger={refreshTrigger} />

            {/* 任务列表 */}
            <ScrapeTaskList
              refreshTrigger={refreshTrigger}
              onTaskSelect={handleTaskSelect}
            />
          </div>
        </div>

        {/* 任务详情模态框 */}
        {selectedTask && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">任务详情</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">任务ID:</span>
                    <p className="text-gray-900 font-mono">{selectedTask.id}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">状态:</span>
                    <p className="text-gray-900">{selectedTask.status}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">进度:</span>
                    <p className="text-gray-900">{selectedTask.progress}%</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">重试次数:</span>
                    <p className="text-gray-900">{selectedTask.retries}</p>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-gray-700">目标URL:</span>
                  <p className="text-gray-900 break-all">{selectedTask.context?.config?.url ?? 'N/A'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">最大深度:</span>
                    <p className="text-gray-900">{selectedTask.context?.config?.maxDepth ?? 0}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">跟随链接:</span>
                    <p className="text-gray-900">{selectedTask.context?.config?.followLinks ? '是' : '否'}</p>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-gray-700">创建时间:</span>
                  <p className="text-gray-900">{new Date(selectedTask.createdAt).toLocaleString('zh-CN')}</p>
                </div>

                {selectedTask.startedAt && (
                  <div>
                    <span className="font-medium text-gray-700">开始时间:</span>
                    <p className="text-gray-900">{new Date(selectedTask.startedAt).toLocaleString('zh-CN')}</p>
                  </div>
                )}

                {selectedTask.completedAt && (
                  <div>
                    <span className="font-medium text-gray-700">完成时间:</span>
                    <p className="text-gray-900">{new Date(selectedTask.completedAt).toLocaleString('zh-CN')}</p>
                  </div>
                )}

                {selectedTask.error && (
                  <div>
                    <span className="font-medium text-gray-700">错误信息:</span>
                    <p className="text-red-600 text-sm bg-red-50 p-2 rounded border">
                      {selectedTask.error}
                    </p>
                  </div>
                )}

                {selectedTask.context?.config?.selectors && (
                  <div>
                    <span className="font-medium text-gray-700">CSS选择器:</span>
                    <div className="text-sm bg-gray-50 p-2 rounded border space-y-1">
                      {selectedTask.context?.config?.selectors?.title && (
                        <div><span className="font-medium">标题:</span> {selectedTask.context.config.selectors.title}</div>
                      )}
                      {selectedTask.context?.config?.selectors?.content && (
                        <div><span className="font-medium">内容:</span> {selectedTask.context.config.selectors.content}</div>
                      )}
                      {selectedTask.context?.config?.selectors?.links && (
                        <div><span className="font-medium">链接:</span> {selectedTask.context.config.selectors.links}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="btn btn-secondary"
                >
                  关闭
                </button>
              </div>
              {/* 执行日志 */}
              {Array.isArray(selectedTask.context?.logs) && selectedTask.context?.logs?.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">执行日志</h4>
                  <div className="max-h-48 overflow-auto text-xs bg-gray-50 p-3 rounded border space-y-1">
                    {selectedTask.context.logs!.map((log, idx) => (
                      <div key={idx} className="flex items-start">
                        <span className={`inline-block px-1 mr-2 rounded text-white ${log.level === 'error' ? 'bg-red-500' : log.level === 'debug' ? 'bg-gray-500' : 'bg-blue-500'}`}>
                          {log.level}
                        </span>
                        <span className="text-gray-500 mr-2 whitespace-nowrap">
                          {new Date(log.ts).toLocaleTimeString('zh-CN')}
                        </span>
                        <span className="text-gray-900 break-words flex-1">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* 原始任务数据，便于调试（显示任何额外字段/控制台输出） */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">原始任务数据</h4>
                <pre className="max-h-48 overflow-auto text-xs bg-gray-50 p-3 rounded border">
                  {JSON.stringify(selectedTask, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScrapePage;