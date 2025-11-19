import { BatchUploadProgress } from '@/types';

interface UploadResultsProps {
  results: BatchUploadProgress['results'];
  className?: string;
}

/**
 * 上传结果组件
 * 显示批量上传的详细结果
 */
const UploadResults = ({ results, className = '' }: UploadResultsProps) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 ${className}`}>
      <h3 className="text-sm font-medium text-secondary-900 mb-2">上传结果</h3>
      <div className="border border-secondary-200 rounded-md divide-y divide-secondary-200 max-h-60 overflow-y-auto">
        {results.map((result, index) => (
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
  );
};

export default UploadResults;
