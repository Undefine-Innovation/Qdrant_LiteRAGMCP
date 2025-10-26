import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

interface ErrorMessageProps {
  message?: string;
  className?: string;
  showCloseButton?: boolean;
}

/**
 * 错误提示组件
 * 用于显示错误信息
 */
const ErrorMessage = ({
  message,
  className = '',
  showCloseButton = true,
}: ErrorMessageProps) => {
  const { error, clearError } = useAppStore();
  const displayMessage = message || error;

  useEffect(() => {
    if (displayMessage) {
      const timer = setTimeout(() => {
        if (!message) {
          clearError();
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [displayMessage, message, clearError]);

  if (!displayMessage) return null;

  return (
    <div
      className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md relative ${className}`}
      role="alert"
    >
      <div className="flex items-center">
        <svg
          className="h-5 w-5 mr-2 flex-shrink-0"
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
        <span className="text-sm">{displayMessage}</span>
      </div>

      {showCloseButton && (
        <button
          onClick={message ? undefined : clearError}
          className="absolute top-2 right-2 text-red-400 hover:text-red-600 focus:outline-none"
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
  );
};

export default ErrorMessage;
