import { Collection } from '../types';

interface CollectionListProps {
  collections: Collection[];
  onEdit: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}

/**
 * 集合列表组件
 * 显示集合列表和操作按钮
 */
const CollectionList = ({
  collections,
  onEdit,
  onDelete,
}: CollectionListProps) => {
  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!collections || collections.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-secondary-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 012-2m0 0V9a2 2 0 01-2-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-secondary-900">
          暂无集合
        </h3>
        <p className="mt-1 text-sm text-secondary-500">
          创建您的第一个集合来开始管理文档
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-secondary-200">
          <thead className="bg-secondary-50">
            <tr>
              <th
                key="name"
                className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
              >
                名称
              </th>
              <th
                key="description"
                className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
              >
                描述
              </th>
              <th
                key="documentCount"
                className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
              >
                文档数量
              </th>
              <th
                key="createdAt"
                className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
              >
                创建时间
              </th>
              <th
                key="actions"
                className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {collections.map(collection => (
              <tr
                key={collection.collectionId}
                className="hover:bg-secondary-50"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-secondary-900">
                    {collection.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-secondary-500 max-w-xs truncate">
                    {collection.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-secondary-900">
                    {collection.docCount || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                  {formatDate(collection.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onEdit(collection)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onDelete(collection)}
                      className="text-red-600 hover:text-red-900"
                      disabled={(collection.docCount || 0) > 0}
                      title={
                        (collection.docCount || 0) > 0
                          ? '集合中还有文档，无法删除'
                          : '删除集合'
                      }
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectionList;
