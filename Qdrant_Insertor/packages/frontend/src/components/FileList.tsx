import { formatFileSize } from '@/utils/fileValidator';

interface FileListProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  className?: string;
}

/**
 * 文件列表组件
 * 显示已选择的文件列表，支持移除单个文件或清空所有文件
 */
const FileList = ({
  files,
  onRemoveFile,
  onClearFiles,
  className = '',
}: FileListProps) => {
  return (
    <div className={`mt-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-secondary-900">
          已选择 {files.length} 个文件
        </h3>
        <button
          type="button"
          onClick={onClearFiles}
          className="text-sm text-secondary-500 hover:text-secondary-700"
        >
          清空
        </button>
      </div>

      <div className="border border-secondary-200 rounded-md divide-y divide-secondary-200">
        {files.map((file, index) => (
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
              onClick={() => onRemoveFile(index)}
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
    </div>
  );
};

export default FileList;
