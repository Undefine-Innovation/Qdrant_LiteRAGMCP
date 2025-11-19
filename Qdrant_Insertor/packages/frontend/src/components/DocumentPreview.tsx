import { useState, useEffect } from 'react';
import { documentsApi } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import type { ApiError } from '../services/api-client';

interface DocumentPreviewProps {
  documentId: string;
  format?: 'html' | 'text' | 'json';
  className?: string;
}

/**
 * 文档预览组件
 * 支持多种格式的文档预览
 */
const DocumentPreview = ({
  documentId,
  format = 'text',
  className = '',
}: DocumentPreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | ApiError | null>(null);
  const [activeFormat, setActiveFormat] = useState<'html' | 'text' | 'json'>(
    format,
  );

  // 加载文档预览内容
  useEffect(() => {
    const loadPreviewContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await documentsApi.getDocumentPreview(documentId, {
          format: activeFormat,
        });

        setContent(response.content);
        setMimeType(response.mimeType);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文档预览失败');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      loadPreviewContent();
    }
  }, [documentId, activeFormat]);

  // 格式切换处理
  const handleFormatChange = (newFormat: 'html' | 'text' | 'json') => {
    setActiveFormat(newFormat);
  };

  // 渲染预览内容
  const renderPreviewContent = () => {
    if (!content) return null;

    switch (activeFormat) {
      case 'html':
        return (
          <div
            className="preview-html"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      case 'json':
        try {
          const jsonData = JSON.parse(content);
          return (
            <pre className="preview-json">
              <code>{JSON.stringify(jsonData, null, 2)}</code>
            </pre>
          );
        } catch {
          return (
            <div className="preview-error">
              <p>无效的JSON格式</p>
              <pre>{content}</pre>
            </div>
          );
        }
      case 'text':
      default:
        return (
          <pre className="preview-text">
            <code>{content}</code>
          </pre>
        );
    }
  };

  if (loading) {
    return (
      <div className={`flex justify-center items-center py-12 ${className}`}>
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-secondary-600">加载文档预览...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <ErrorMessage error={error} showCloseButton={false} autoHide={false} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}
    >
      {/* 预览头部 */}
      <div className="bg-secondary-50 px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-secondary-900">文档预览</h2>

          {/* 格式切换按钮 */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleFormatChange('text')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeFormat === 'text'
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              文本
            </button>
            <button
              onClick={() => handleFormatChange('html')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeFormat === 'html'
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              HTML
            </button>
            <button
              onClick={() => handleFormatChange('json')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeFormat === 'json'
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        <div className="mt-2 text-sm text-secondary-500">
          格式: {activeFormat} | MIME类型: {mimeType}
        </div>
      </div>

      {/* 预览内容 */}
      <div className="p-6 overflow-auto" style={{ maxHeight: '600px' }}>
        {renderPreviewContent()}
      </div>
    </div>
  );
};

export default DocumentPreview;
