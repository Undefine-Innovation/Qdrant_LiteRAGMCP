import { useState, useRef, useCallback } from 'react';
import { UploadProgress } from '../types';

interface DocumentUploadProps {
  onUpload: (files: FileList) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  className?: string;
}

/**
 * 文档上传组件
 * 支持拖拽上传和点击选择文件
 */
const DocumentUpload = ({
  onUpload,
  accept = '.txt,.md,.pdf,.doc,.docx',
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  className = '',
}: DocumentUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件验证
  const validateFiles = (
    files: FileList,
  ): { valid: boolean; error?: string } => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 检查文件大小
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `文件 "${file.name}" 超过最大大小限制 (${Math.round(maxSize / 1024 / 1024)}MB)`,
        };
      }

      // 检查文件类型
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (accept && !accept.includes(fileExtension)) {
        return {
          valid: false,
          error: `文件 "${file.name}" 类型不支持，支持的类型: ${accept}`,
        };
      }
    }

    return { valid: true };
  };

  // 处理文件上传
  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);

      const validation = validateFiles(files);
      if (!validation.valid) {
        setError(validation.error || '验证失败');
        return;
      }

      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: files.length, percentage: 0 });

      try {
        await onUpload(files);
        setUploadProgress({
          loaded: files.length,
          total: files.length,
          percentage: 100,
        });

        // 重置文件输入
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败');
      } finally {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(null), 1000);
      }
    },
    [onUpload, maxSize, accept],
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

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
            <p className="text-secondary-600">上传中...</p>

            {uploadProgress && (
              <div className="w-full max-w-xs mx-auto">
                <div className="flex justify-between text-sm text-secondary-600 mb-1">
                  <span>
                    {uploadProgress.loaded} / {uploadProgress.total} 文件
                  </span>
                  <span>{uploadProgress.percentage}%</span>
                </div>
                <div className="w-full bg-secondary-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        ) : (
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
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={isUploading}
            >
              选择文件
            </button>
          </div>
        )}
      </div>

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

export default DocumentUpload;
