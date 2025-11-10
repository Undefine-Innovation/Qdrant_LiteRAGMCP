import { useState, useCallback, useRef } from 'react';
import { FileValidator } from '@/utils/fileValidator';
import Button from '@/components/Button';

interface FileUploadBaseProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  isUploading?: boolean;
  multiple?: boolean;
  className?: string;
  children?: (props: {
    isDragOver: boolean;
    error: string | null;
    triggerFileSelect: () => void;
  }) => React.ReactNode;
}

/**
 * 文件上传基础组件
 * 提供通用的文件上传逻辑，包括拖拽、点击选择、验证等功能
 */
const FileUploadBase = ({
  onFilesSelected,
  accept = '.txt,.md,.pdf,.doc,.docx',
  maxFiles = 50,
  maxSize = 10 * 1024 * 1024, // 10MB
  isUploading = false,
  multiple = true,
  className = '',
  children,
}: FileUploadBaseProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件验证和选择
  const handleFiles = useCallback(
    (files: FileList) => {
      setError(null);

      const validation = FileValidator.validateFiles(files, {
        maxFiles,
        maxSize,
        accept,
      });

      if (validation.valid && validation.validFiles) {
        onFilesSelected(validation.validFiles);
        setError(null);
      } else {
        setError(validation.error || '验证失败');
      }
    },
    [maxFiles, maxSize, accept, onFilesSelected],
  );

  // 处理文件选择
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles],
  );

  // 处理拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles],
  );

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 默认渲染内容
  const defaultChildren = () => (
    <div className="space-y-4">
      <div className="flex justify-center">
        <svg
          className="h-12 w-12 text-secondary-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      <div>
        <p className="text-lg font-medium text-secondary-900">
          拖拽文件到此处或点击选择
        </p>
        <p className="text-sm text-secondary-500 mt-1">
          支持的文件类型: {accept}
        </p>
        <p className="text-sm text-secondary-500">
          最大文件大小: {Math.round(maxSize / 1024 / 1024)}MB
          {maxFiles > 1 && `，最多 ${maxFiles} 个文件`}
        </p>
      </div>

      <Button type="button" disabled={isUploading}>
        选择文件
      </Button>
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary-400 bg-primary-50'
            : 'border-secondary-300 hover:border-secondary-400 bg-white'
        } ${isUploading ? 'cursor-not-allowed opacity-60' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isUploading ? triggerFileSelect : undefined}
      >
        {isUploading ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
            <p className="text-secondary-600">
              {multiple ? '批量上传中...' : '上传中...'}
            </p>
          </div>
        ) : children ? (
          children({ isDragOver, error, triggerFileSelect })
        ) : (
          defaultChildren()
        )}
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
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
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadBase;
