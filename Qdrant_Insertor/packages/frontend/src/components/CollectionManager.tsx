import { useState } from 'react';
import {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '../types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import CollectionForm from './CollectionForm';
import CollectionList from './CollectionList';

interface CollectionManagerProps {
  collections: Collection[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreate: (data: CreateCollectionRequest) => Promise<void>;
  onUpdate: (id: string, data: UpdateCollectionRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  className?: string;
}

/**
 * 集合管理组件
 * 支持集合的CRUD操作
 */
const CollectionManager = ({
  collections,
  loading,
  error,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  className = '',
}: CollectionManagerProps) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  );

  // 重置表单
  const resetForm = () => {
    setShowCreateForm(false);
    setEditingCollection(null);
  };

  // 处理编辑
  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setShowCreateForm(true);
  };

  // 处理删除
  const handleDelete = async (collection: Collection) => {
    if (confirm(`确定要删除集合 "${collection.name}" 吗？此操作不可撤销。`)) {
      try {
        await onDelete(collection.collectionId);
        onRefresh();
      } catch (err) {
        console.error('删除失败:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-secondary-600">加载集合列表...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error} />
        <button onClick={onRefresh} className="btn btn-secondary">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 操作工具栏 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-secondary-800">集合管理</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          创建新集合
        </button>
      </div>

      {/* 创建/编辑表单 */}
      {showCreateForm && (
        <CollectionForm
          collection={editingCollection}
          onSubmit={async (
            data: CreateCollectionRequest | UpdateCollectionRequest,
          ) => {
            if (editingCollection) {
              await onUpdate(
                editingCollection.collectionId,
                data as UpdateCollectionRequest,
              );
            } else {
              await onCreate(data as CreateCollectionRequest);
            }
          }}
          onCancel={resetForm}
        />
      )}

      {/* 集合列表 */}
      <CollectionList
        collections={collections || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default CollectionManager;
