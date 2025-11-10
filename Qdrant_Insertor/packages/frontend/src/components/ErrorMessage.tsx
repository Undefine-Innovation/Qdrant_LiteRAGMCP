import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

// 导入API错误类型
import type { ApiError } from '@/services/api-client';

interface ErrorMessageProps {
  message?: string;
  error?: ApiError | string;
  className?: string;
  showCloseButton?: boolean;
  autoHide?: boolean;
  onRetry?: () => void;
}

/**
 * 错误类型映射
 * 根据错误码返回用户友好的错误消息
 */
const getErrorMessage = (error: ApiError | string): string => {
  if (typeof error === 'string') {
    return error;
  }

  const { code, message } = error;

  // 根据错误码返回用户友好的消息
  switch (code) {
    case 'VALIDATION_ERROR':
      return '输入数据验证失败，请检查您的输入';
    case 'NOT_FOUND':
      return '请求的资源不存在';
    case 'UNAUTHORIZED':
      return '您没有权限执行此操作';
    case 'FORBIDDEN':
      return '访问被拒绝';
    case 'INTERNAL_SERVER_ERROR':
      return '服务器内部错误，请稍后重试';
    case 'SERVICE_UNAVAILABLE':
      return '服务暂时不可用，请稍后重试';
    case 'FILE_UPLOAD_FAILED':
      return '文件上传失败，请重试';
    case 'DOCUMENT_PROCESSING_FAILED':
      return '文档处理失败，请检查文件格式';
    case 'SYNC_FAILED':
      return '同步失败，请稍后重试';
    case 'INVALID_INPUT':
      return '输入数据无效';
    case 'FILE_TOO_LARGE':
      return '文件大小超出限制';
    case 'UNSUPPORTED_FILE_TYPE':
      return '不支持的文件类型';
    case 'NETWORK_ERROR':
      return '网络连接失败，请检查网络';
    default:
      return message || '发生未知错误';
  }
};

/**
 * 获取错误类型对应的样式类
 */
const getErrorClass = (code?: string): string => {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_INPUT':
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    case 'NOT_FOUND':
      return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return 'bg-orange-50 border-orange-200 text-orange-700';
    case 'FILE_TOO_LARGE':
    case 'UNSUPPORTED_FILE_TYPE':
    case 'FILE_UPLOAD_FAILED':
    case 'DOCUMENT_PROCESSING_FAILED':
      return 'bg-purple-50 border-purple-200 text-purple-700';
    case 'NETWORK_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 'bg-gray-50 border-gray-200 text-gray-700';
    default:
      return 'bg-red-50 border-red-200 text-red-700';
  }
};

/**
 * 获取错误类型对应的图标
 */
const getErrorIcon = (code?: string): JSX.Element => {
  const iconClass = 'h-5 w-5 mr-2 flex-shrink-0';

  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_INPUT':
      return (
        <svg
          className={iconClass}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'NOT_FOUND':
      return (
        <svg
          className={iconClass}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'NETWORK_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return (
        <svg
          className={iconClass}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={iconClass}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
};

/**
 * 错误提示组件
 * 用于显示错误信息，支持结构化错误对象和错误分类
 */
const ErrorMessage = ({
  message,
  error,
  className = '',
  showCloseButton = true,
  autoHide = true,
  onRetry,
}: ErrorMessageProps) => {
  const { error: storeError, clearError } = useAppStore();

  // 优先使用传入的error，然后是message，最后是store中的error
  const displayError = error || message || storeError;

  if (!displayError) return null;

  // 标准化错误对象
  const errorObj: ApiError =
    typeof displayError === 'string'
      ? { code: 'UNKNOWN_ERROR', message: displayError }
      : displayError;

  const errorMessage = getErrorMessage(errorObj);
  const errorClass = getErrorClass(errorObj.code);
  const errorIcon = getErrorIcon(errorObj.code);

  useEffect(() => {
    if (autoHide && displayError) {
      const timer = setTimeout(() => {
        if (!message && !error) {
          clearError();
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [displayError, message, error, autoHide, clearError]);

  const handleClose = () => {
    if (message || error) {
      // 如果是传入的错误，不处理关闭
      return;
    }
    clearError();
  };

  return (
    <div
      className={`${errorClass} px-4 py-3 rounded-md relative ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        {errorIcon}
        <div className="flex-1">
          <p className="text-sm font-medium">{errorMessage}</p>

          {/* 显示详细错误信息（仅在开发环境或有详细信息时） */}
          {errorObj.details &&
          (process.env.NODE_ENV === 'development' ||
            errorObj.code === 'VALIDATION_ERROR') ? (
            <details className="mt-1 text-xs opacity-75">
              <summary className="cursor-pointer">详细信息</summary>
              <pre className="mt-1 whitespace-pre-wrap">
                {typeof errorObj.details === 'string'
                  ? errorObj.details
                  : JSON.stringify(errorObj.details, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>

      <div className="absolute top-2 right-2 flex items-center space-x-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-current hover:opacity-75 focus:outline-none"
            aria-label="重试"
            title="重试"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {showCloseButton && (
          <button
            onClick={handleClose}
            className="text-current hover:opacity-75 focus:outline-none"
            aria-label="关闭"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// 导出错误处理工具函数供其他模块使用
export { getErrorMessage };

export default ErrorMessage;
