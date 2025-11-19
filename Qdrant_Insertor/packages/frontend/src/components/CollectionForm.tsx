import { useState } from 'react';
import {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '../types';

interface CollectionFormProps {
  collection?: Collection | null;
  onSubmit: (
    data: CreateCollectionRequest | UpdateCollectionRequest,
  ) => Promise<void>;
  onCancel: () => void;
}

/**
 * 集合表单组件
 * 支持创建和编辑集合
 */
const CollectionForm = ({
  collection,
  onSubmit,
  onCancel,
}: CollectionFormProps) => {
  const [formData, setFormData] = useState({
    name: collection?.name || '',
    description: collection?.description || '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = '集合名称不能为空';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.name)) {
      errors.name = '集合名称只能包含字母、数字、下划线、连字符和点';
    } else if (
      [
        'system',
        'admin',
        'root',
        'default',
        'public',
        'private',
        'api',
        'config',
        'settings',
        'temp',
        'tmp',
        'test',
        'dev',
        'prod',
        'staging',
      ].includes(formData.name.toLowerCase())
    ) {
      errors.name = '这是一个保留的集合名称，不能使用';
    } else if (formData.name.startsWith('.') || formData.name.endsWith('.')) {
      errors.name = '集合名称不能以点开头或结尾';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await onSubmit(formData);
      onCancel();
    } catch (err) {
      console.error('操作失败:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-secondary-900">
          {collection ? '编辑集合' : '创建新集合'}
        </h2>
        <button
          onClick={onCancel}
          className="text-secondary-400 hover:text-secondary-600"
          aria-label="关闭"
        >
          <svg
            className="h-6 w-6"
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-secondary-700 mb-1"
          >
            集合名称 *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className={`input ${formErrors.name ? 'border-red-500' : ''}`}
            placeholder="输入集合名称"
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-secondary-700 mb-1"
          >
            描述
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={e =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            className="input"
            placeholder="输入集合描述（可选）"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            {collection ? '更新' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CollectionForm;
