import React, { useState } from 'react';
import { TableColumn, TableAction, SelectionState } from '@/types/common';

interface TableProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  selection?: SelectionState<T>;
  actions?: TableAction<T>[];
  rowKey?: keyof T | ((record: T) => string);
  className?: string;
  emptyText?: string;
  onRowClick?: (record: T) => void;
}

/**
 * 通用表格组件
 * 提供排序、选择、操作等功能
 */
const Table = <T = unknown,>({
  data,
  columns,
  loading = false,
  selection,
  actions,
  rowKey = 'id' as keyof T,
  className = '',
  emptyText = '暂无数据',
  onRowClick,
}: TableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: 'asc' | 'desc';
  } | null>(null);

  // 获取行键值
  const getRowKey = (record: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return String(record[rowKey]);
  };

  // 处理排序
  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable) return;

    const key = column.dataIndex as keyof T;
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }

    setSortConfig({ key, direction });
  };

  // 排序数据
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // 确保值是可比较的
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (selection) {
      if (checked) {
        selection.selectAll();
      } else {
        selection.clearSelection();
      }
    }
  };

  // 处理行选择
  const handleRowSelect = (record: T, _checked: boolean) => {
    if (selection) {
      selection.toggleSelection(record);
    }
  };

  // 渲染表头
  const renderHeader = () => (
    <thead className="bg-secondary-50">
      <tr>
        {selection && (
          <th className="px-6 py-3 text-left">
            <input
              type="checkbox"
              checked={
                data.length > 0 &&
                data.every(item => selection.isSelected(item))
              }
              onChange={e => handleSelectAll(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
          </th>
        )}
        {columns.map(column => (
          <th
            key={column.key}
            className={`px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider ${
              column.align === 'center'
                ? 'text-center'
                : column.align === 'right'
                  ? 'text-right'
                  : ''
            }`}
            style={{ width: column.width }}
          >
            {column.sortable ? (
              <button
                onClick={() => handleSort(column)}
                className="flex items-center space-x-1 hover:text-secondary-700"
              >
                <span>{column.title}</span>
                {sortConfig && sortConfig.key === column.dataIndex && (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    {sortConfig.direction === 'asc' ? (
                      <path
                        fillRule="evenodd"
                        d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                        clipRule="evenodd"
                      />
                    ) : (
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    )}
                  </svg>
                )}
              </button>
            ) : (
              <span>{column.title}</span>
            )}
          </th>
        ))}
        {actions && actions.length > 0 && (
          <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
            操作
          </th>
        )}
      </tr>
    </thead>
  );

  // 渲染表格行
  const renderRow = (record: T, index: number) => {
    const isSelected = selection?.isSelected(record) || false;
    const rowKey = getRowKey(record);

    return (
      <tr
        key={rowKey}
        className={`hover:bg-secondary-50 ${onRowClick ? 'cursor-pointer' : ''}`}
        onClick={() => onRowClick?.(record)}
      >
        {selection && (
          <td className="px-6 py-4 whitespace-nowrap">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={e => handleRowSelect(record, e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
          </td>
        )}
        {columns.map(column => (
          <td
            key={column.key}
            className={`px-6 py-4 whitespace-nowrap text-sm ${
              column.align === 'center'
                ? 'text-center'
                : column.align === 'right'
                  ? 'text-right'
                  : ''
            }`}
          >
            {column.render
              ? column.render(
                  record[column.dataIndex as keyof T],
                  record,
                  index,
                )
              : String(record[column.dataIndex as keyof T] || '')}
          </td>
        ))}
        {actions && actions.length > 0 && (
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center space-x-2">
              {actions.map(action => {
                const disabled = action.disabled?.(record) || false;
                return (
                  <button
                    key={action.key}
                    onClick={() => !disabled && action.action(record)}
                    disabled={disabled}
                    className={`text-sm ${
                      action.danger
                        ? 'text-red-600 hover:text-red-900'
                        : 'text-primary-600 hover:text-primary-900'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                );
              })}
            </div>
          </td>
        )}
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-secondary-600">加载中...</span>
      </div>
    );
  }

  if (data.length === 0) {
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
            d="M9 12h6m-6 6v6m-6 6h6m2 2h6m2 2h6m-6 6v6m-6 6h6"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-secondary-900">
          {emptyText}
        </h3>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-secondary-200">
        {renderHeader()}
        <tbody className="bg-white divide-y divide-secondary-200">
          {sortedData.map((record, index) => renderRow(record, index))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
