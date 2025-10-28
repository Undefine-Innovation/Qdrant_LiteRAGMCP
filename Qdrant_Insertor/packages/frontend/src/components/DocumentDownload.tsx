import { useState } from 'react';
import { documentsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface DocumentDownloadProps {
  documentId: string;
  documentName?: string;
  className?: string;
}

/**
 * 文档下载组件
 * 提供下载按钮和下载选项
 */
const DocumentDownload = ({
  documentId,
  documentName,
  className = '',
}: DocumentDownloadProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // 处理文档下载
  const handleDownload = async (
    format: 'original' | 'html' | 'txt' = 'original',
  ) => {
    try {
      setLoading(true);
      setError(null);
      setDownloadProgress(0);

      // 创建下载进度模拟
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // 获取文档内容
      const response = await documentsApi.getDocumentDownload(documentId, {
        format,
      });

      // 创建下载链接
      const blob = new Blob([response.content], { type: response.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 完成下载进度
      clearInterval(progressInterval);
      setDownloadProgress(100);

      // 短暂延迟后重置状态
      setTimeout(() => {
        setLoading(false);
        setDownloadProgress(0);
      }, 500);
    } catch (err) {
      setLoading(false);
      setDownloadProgress(0);
      setError(err instanceof Error ? err.message : '文档下载失败');
    }
  };

  // 获取文件扩展名
  const getFileExtension = (format: 'original' | 'html' | 'txt'): string => {
    switch (format) {
      case 'html':
        return '.html';
      case 'txt':
        return '.txt';
      case 'original':
      default:
        // 尝试从原始文件名获取扩展名
        if (documentName) {
          const lastDotIndex = documentName.lastIndexOf('.');
          if (lastDotIndex > 0) {
            return documentName.substring(lastDotIndex);
          }
        }
        return '';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        下载文档
      </h3>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      {loading && (
        <div className="mb-4">
          <div className="flex items-center space-x-3">
            <LoadingSpinner size="sm" />
            <span className="text-secondary-600">准备下载...</span>
          </div>

          {downloadProgress > 0 && (
            <div className="mt-2">
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-sm text-secondary-600 mt-1">
                {downloadProgress}% 完成
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* 原始格式下载 */}
        <div className="flex items-center justify-between p-3 border border-secondary-200 rounded-md">
          <div>
            <h4 className="font-medium text-secondary-900">原始格式</h4>
            <p className="text-sm text-secondary-500">
              下载文档的原始格式
              {getFileExtension('original') &&
                ` (${getFileExtension('original')})`}
            </p>
          </div>
          <button
            onClick={() => handleDownload('original')}
            disabled={loading}
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下载
          </button>
        </div>

        {/* HTML格式下载 */}
        <div className="flex items-center justify-between p-3 border border-secondary-200 rounded-md">
          <div>
            <h4 className="font-medium text-secondary-900">HTML格式</h4>
            <p className="text-sm text-secondary-500">
              转换为HTML格式下载 (.html)
            </p>
          </div>
          <button
            onClick={() => handleDownload('html')}
            disabled={loading}
            className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下载
          </button>
        </div>

        {/* 纯文本格式下载 */}
        <div className="flex items-center justify-between p-3 border border-secondary-200 rounded-md">
          <div>
            <h4 className="font-medium text-secondary-900">纯文本格式</h4>
            <p className="text-sm text-secondary-500">
              转换为纯文本格式下载 (.txt)
            </p>
          </div>
          <button
            onClick={() => handleDownload('txt')}
            disabled={loading}
            className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下载
          </button>
        </div>
      </div>

      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>提示：</strong>
          HTML格式适用于Markdown文档，纯文本格式适用于所有文档类型。
        </p>
      </div>
    </div>
  );
};

export default DocumentDownload;
