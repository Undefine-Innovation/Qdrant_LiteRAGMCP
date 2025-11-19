import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import BatchOperationStatus from '@/components/BatchOperationStatus';
import { ToastContainer } from '@/components/Toast';
import HomePage from '@/pages/HomePage';
import CollectionsPage from '@/pages/CollectionsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import SearchPage from '@/pages/SearchPage';
import ScrapePage from '@/pages/ScrapePage';
import ScrapeReviewPage from '@/pages/ScrapeReviewPage';
import MonitoringDashboard from '@/pages/MonitoringDashboard';
import { useAppStore } from '@/stores/useAppStore';
import globalErrorHandler from '@/utils/errorHandler';

function App() {
  const { setError, addErrorToHistory } = useAppStore();

  useEffect(() => {
    // 初始化全局错误处理器
    globalErrorHandler.init();

    // 添加全局错误监听器
    const removeListener = globalErrorHandler.addErrorListener(error => {
      // 将错误转换为ApiError格式（如果不是的话）
      const apiError =
        'code' in error
          ? error
          : {
              code: 'UNKNOWN_ERROR',
              message: error.message || String(error),
            };
      setError(apiError);
      addErrorToHistory(apiError);
    });

    // 清理函数
    return () => {
      removeListener();
      globalErrorHandler.destroy();
    };
  }, [setError, addErrorToHistory]);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // 将React错误转换为ApiError格式
        const apiError = {
          code: 'REACT_ERROR',
          message: error.message,
          details: {
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          },
        };

        setError(apiError);
        addErrorToHistory(apiError);
      }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/scrape" element={<ScrapePage />} />
          <Route path="/scrape/review" element={<ScrapeReviewPage />} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
        </Routes>
      </Layout>
      <BatchOperationStatus />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
