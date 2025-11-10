import FileUploadBase from '@/components/FileUploadBase';

interface FileUploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  isUploading?: boolean;
  className?: string;
}

/**
 * 文件上传区域组件
 * 支持拖拽上传和点击选择文件
 */
const FileUploadArea = ({
  onFilesSelected,
  accept = '.txt,.md,.pdf,.doc,.docx',
  maxFiles = 50,
  maxSize = 10 * 1024 * 1024, // 10MB
  isUploading = false,
  className = '',
}: FileUploadAreaProps) => {
  return (
    <FileUploadBase
      onFilesSelected={onFilesSelected}
      accept={accept}
      maxFiles={maxFiles}
      maxSize={maxSize}
      isUploading={isUploading}
      multiple={true}
      className={className}
    />
  );
};

export default FileUploadArea;
