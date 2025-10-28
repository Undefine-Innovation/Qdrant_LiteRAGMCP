import { useState, useRef, useCallback } from 'react';
import { BatchUploadProgress, BatchUploadResult } from '../types';

interface BatchDocumentUploadProps {
  onBatchUpload: (
    files: FileList,
    collectionId?: string,
  ) => Promise<BatchUploadResult>;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
  className?: string;
}

/**
 * 批量文档上传组件
 * 支持拖拽上传和点击选择多个文件
 */
const BatchDocumentUpload = ({
  onBatchUpload,
  accept = '.txt,.md,.pdf,.doc,.docx',
  maxFiles = 50,
  maxSize = 10 * 1024 * 1024, // 10MB
  className = '',
}: BatchDocumentUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<BatchUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件验证
  const validateFiles = (
    files: FileList,
  ): { valid: boolean; error?: string; validFiles?: File[] } => {
    if (files.length > maxFiles) {
      return {
        valid: false,
        error: `文件数量超过限制，最多只能上传 ${maxFiles} 个文件`,
      };
    }

    const validFiles: File[] = [];
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

      validFiles.push(file);
    }

    return { valid: true, validFiles };
  };

  // 处理文件选择
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const validation = validateFiles(files);
        if (validation.valid && validation.validFiles) {
          setSelectedFiles(validation.validFiles);
          setError(null);
        } else {
          setError(validation.error || '验证失败');
          setSelectedFiles([]);
        }
      }
    },
    [maxFiles, maxSize, accept],
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
        const validation = validateFiles(files);
        if (validation.valid && validation.validFiles) {
          setSelectedFiles(validation.validFiles);
          setError(null);
        } else {
          setError(validation.error || '验证失败');
          setSelectedFiles([]);
        }
      }
    },
    [maxFiles, maxSize, accept],
  );

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 移除选中的文件
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 清空选中的文件
  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 处理批量上传
  const handleBatchUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setError('请先选择要上传的文件');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress({
      total: selectedFiles.length,
      processed: 0,
      successful: 0,
      failed: 0,
      percentage: 0,
      status: 'processing',
    });

    try {
      // 创建FileList对象
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach(file => dataTransfer.items.add(file));
      const fileList = dataTransfer.files;

      const result = await onBatchUpload(
        fileList,
        selectedCollectionId || undefined,
      );

      setUploadProgress({
        total: result.total,
        processed: result.total,
        successful: result.successful,
        failed: result.failed,
        percentage: 100,
        status: result.success ? 'completed' : 'completed_with_errors',
        results: result.results,
      });

      // 清空文件列表
      setTimeout(() => {
        clearFiles();
        setUploadProgress(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量上传失败');
      setUploadProgress(prev => (prev ? { ...prev, status: 'failed' } : null));
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, selectedCollectionId, onBatchUpload, clearFiles]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={true}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* 文件选择区域 */}
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
            <p className="text-secondary-600">批量上传中...</p>

            {uploadProgress && (
              <div className="w-full max-w-md mx-auto">
                <div className="flex justify-between text-sm text-secondary-600 mb-1">
                  <span>
                    {uploadProgress.processed} / {uploadProgress.total} 文件
                  </span>
                  <span>{uploadProgress.percentage}%</span>
                </div>
                <div className="w-full bg-secondary-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-secondary-600 mt-1">
                  <span>成功: {uploadProgress.successful}</span>
                  <span>失败: {uploadProgress.failed}</span>
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
                最大文件大小: {Math.round(maxSize / 1024 / 1024)}MB，最多{' '}
                {maxFiles} 个文件
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

      {/* 选中的文件列表 */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-secondary-900">
              已选择 {selectedFiles.length} 个文件
            </h3>
            <button
              type="button"
              onClick={clearFiles}
              className="text-sm text-secondary-500 hover:text-secondary-700"
            >
              清空
            </button>
          </div>

          <div className="border border-secondary-200 rounded-md divide-y divide-secondary-200">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 hover:bg-secondary-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-sm text-secondary-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-2 text-red-600 hover:text-red-900"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* 集合选择 */}
          <div className="mt-4">
            <label
              htmlFor="collection-select"
              className="block text-sm font-medium text-secondary-700 mb-1"
            >
              目标集合（可选）
            </label>
            <select
              id="collection-select"
              value={selectedCollectionId}
              onChange={e => setSelectedCollectionId(e.target.value)}
              className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">默认集合</option>
              {/* 这里可以动态加载集合列表 */}
            </select>
          </div>

          {/* 上传按钮 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleBatchUpload}
              className="btn btn-primary w-full"
              disabled={isUploading}
            >
              开始批量上传
            </button>
          </div>
        </div>
      )}

      {/* 上传结果 */}
      {uploadProgress && uploadProgress.results && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-secondary-900 mb-2">
            上传结果
          </h3>
          <div className="border border-secondary-200 rounded-md divide-y divide-secondary-200 max-h-60 overflow-y-auto">
            {uploadProgress.results.map((result, index) => (
              <div
                key={index}
                className={`p-3 ${result.error ? 'bg-red-50' : 'bg-green-50'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-secondary-900 truncate">
                    {result.fileName}
                  </p>
                  {result.error ? (
                    <span className="text-xs text-red-600">失败</span>
                  ) : (
                    <span className="text-xs text-green-600">成功</span>
                  )}
                </div>
                {result.error && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

export default BatchDocumentUpload;
