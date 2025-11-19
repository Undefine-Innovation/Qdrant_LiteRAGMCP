import { useState, useCallback, useRef } from 'react';
import { BatchUploadProgress, BatchUploadResult } from '@/types';
import FileUploadArea from '@/components/FileUploadArea';
import FileList from '@/components/FileList';
import UploadProgress from '@/components/UploadProgress';
import UploadResults from '@/components/UploadResults';
import Button from '@/components/Button';

interface BatchDocumentUploadProps {
  onComplete?: () => void;
  collectionId?: string;
  onBatchUpload?: (
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
  onComplete,
  collectionId: propCollectionId,
  onBatchUpload,
  accept = '.txt,.md,.pdf,.doc,.docx',
  maxFiles = 50,
  maxSize = 10 * 1024 * 1024, // 10MB
  className = '',
}: BatchDocumentUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<BatchUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    propCollectionId || '',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setError(null);
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
      loaded: 0,
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

      if (!onBatchUpload) {
        throw new Error('onBatchUpload function is required');
      }

      const result = await onBatchUpload(
        fileList,
        selectedCollectionId || undefined,
      );

      setUploadProgress({
        loaded: result.total || 0,
        total: result.total || 0,
        processed: result.total || 0,
        successful: result.successful || 0,
        failed: result.failed || 0,
        percentage: 100,
        status: result.success ? 'completed' : 'completed_with_errors',
        results: result.results,
      });

      // 清空文件列表
      setTimeout(() => {
        clearFiles();
        setUploadProgress(null);
        onComplete?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量上传失败');
      setUploadProgress(prev => (prev ? { ...prev, status: 'failed' } : null));
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, selectedCollectionId, onBatchUpload, clearFiles]);

  return (
    <div className={`w-full ${className}`}>
      {/* 文件上传区域 */}
      <FileUploadArea
        onFilesSelected={handleFilesSelected}
        accept={accept}
        maxFiles={maxFiles}
        maxSize={maxSize}
        isUploading={isUploading}
      />

      {/* 上传进度 */}
      {isUploading && uploadProgress && (
        <div className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
            <p className="text-secondary-600">批量上传中...</p>
            <UploadProgress progress={uploadProgress} />
          </div>
        </div>
      )}

      {/* 选中的文件列表 */}
      {selectedFiles.length > 0 && !isUploading && (
        <div>
          <FileList
            files={selectedFiles}
            onRemoveFile={removeFile}
            onClearFiles={clearFiles}
          />

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
            <Button
              type="button"
              onClick={handleBatchUpload}
              variant="primary"
              size="lg"
              disabled={isUploading}
              loading={isUploading}
              className="w-full"
            >
              开始批量上传
            </Button>
          </div>
        </div>
      )}

      {/* 上传结果 */}
      {uploadProgress && uploadProgress.results && (
        <UploadResults results={uploadProgress.results} />
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
