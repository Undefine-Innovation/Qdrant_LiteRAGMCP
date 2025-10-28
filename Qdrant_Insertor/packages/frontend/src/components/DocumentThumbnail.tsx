import { useState, useEffect } from 'react';
import { documentsApi } from '../services/api';

interface DocumentThumbnailProps {
  documentId: string;
  documentName?: string;
  size?: { width: number; height: number };
  className?: string;
  onClick?: () => void;
}

/**
 * 文档缩略图组件
 * 在文档列表中显示缩略图
 */
const DocumentThumbnail = ({
  documentId,
  documentName,
  size = { width: 100, height: 100 },
  className = '',
  onClick,
}: DocumentThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  // 加载文档缩略图
  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await documentsApi.getDocumentThumbnail(documentId, {
          width: size.width,
          height: size.height,
        });

        // 创建缩略图URL
        const blob = new Blob([response], { type: 'image/png' });
        const url = window.URL.createObjectURL(blob);
        setThumbnailUrl(url);
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      loadThumbnail();
    }

    // 清理函数
    return () => {
      if (thumbnailUrl) {
        window.URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [documentId, size.width, size.height]);

  // 获取文件扩展名
  const getFileExtension = (): string => {
    if (!documentName) return '';
    const lastDotIndex = documentName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return documentName.substring(lastDotIndex + 1).toLowerCase();
    }
    return '';
  };

  // 获取文件类型图标
  const getFileIcon = () => {
    const extension = getFileExtension();

    switch (extension) {
      case 'pdf':
        return (
          <svg
            className="w-8 h-8 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2a2 2 0 00-2-2H4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg
            className="w-8 h-8 text-blue-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2a2 2 0 00-2-2H4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'md':
      case 'markdown':
        return (
          <svg
            className="w-8 h-8 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2a2 2 0 00-2-2H4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'txt':
        return (
          <svg
            className="w-8 h-8 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2a2 2 0 00-2-2H4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-8 h-8 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2a2 2 0 00-2-2H4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  // 渲染缩略图内容
  const renderThumbnailContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-secondary-100 rounded">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
        </div>
      );
    }

    if (error || !thumbnailUrl) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-secondary-100 rounded">
          {getFileIcon()}
        </div>
      );
    }

    return (
      <img
        src={thumbnailUrl}
        alt={`${documentName || '文档'} 缩略图`}
        className="w-full h-full object-cover rounded"
        onError={() => setError(true)}
      />
    );
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-secondary-200 cursor-pointer transition-transform hover:scale-105 ${className}`}
      style={{ width: size.width, height: size.height }}
      onClick={onClick}
      title={documentName || '文档'}
    >
      {renderThumbnailContent()}

      {/* 文件类型标签 */}
      {!loading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
          {getFileExtension().toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default DocumentThumbnail;
