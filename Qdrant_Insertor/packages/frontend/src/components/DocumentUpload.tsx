import { useState, useCallback } from 'react';
import { UploadProgress } from '@/types';
import FileUploadBase from '@/components/FileUploadBase';
import Button from '@/components/Button';

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  // 处理文件上传
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: files.length, percentage: 0 });

      try {
        // 创建FileList对象
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        const fileList = dataTransfer.files;

        await onUpload(fileList);
        setUploadProgress({
          loaded: files.length,
          total: files.length,
          percentage: 100,
        });
      } finally {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(null), 1000);
      }
    },
    [onUpload],
  );

  // 自定义渲染内容
  const renderUploadArea = ({
    isDragOver: _isDragOver,
    error: _error,
    triggerFileSelect: _triggerFileSelect,
  }: {
    isDragOver: boolean;
    error: string | null;
    triggerFileSelect: () => void;
  }) => {
    return (
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

        <Button type="button" disabled={isUploading}>
          选择文件
        </Button>

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
    );
  };

  return (
    <FileUploadBase
      onFilesSelected={handleFilesSelected}
      accept={accept}
      maxSize={maxSize}
      isUploading={isUploading}
      multiple={multiple}
      className={className}
    >
      {renderUploadArea}
    </FileUploadBase>
  );
};

export default DocumentUpload;
