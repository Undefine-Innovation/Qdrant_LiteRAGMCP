import { BatchUploadProgress } from '@/types';

interface UploadProgressProps {
  progress: BatchUploadProgress;
  className?: string;
}

/**
 * 上传进度组件
 * 显示批量上传的进度信息
 */
const UploadProgress = ({ progress, className = '' }: UploadProgressProps) => {
  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div className="flex justify-between text-sm text-secondary-600 mb-1">
        <span>
          {progress.processed} / {progress.total} 文件
        </span>
        <span>{progress.percentage}%</span>
      </div>
      <div className="w-full bg-secondary-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-sm text-secondary-600 mt-1">
        <span>成功: {progress.successful}</span>
        <span>失败: {progress.failed}</span>
      </div>
    </div>
  );
};

export default UploadProgress;
