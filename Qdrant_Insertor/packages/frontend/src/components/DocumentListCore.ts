import { Document } from '../types';

/**
 * 文档状态显示信息
 */
export interface DocumentStatusInfo {
  text: string;
  className: string;
}

/**
 * 文档列表核心逻辑
 * 负责处理文档状态、选择和分页逻辑
 */
export class DocumentListCore {
  /**
   * 获取状态显示信息
   */
  static getStatusInfo(status?: string): DocumentStatusInfo {
    switch (status) {
      case 'new':
        return { text: '新建', className: 'bg-gray-100 text-gray-800' };
      case 'processing':
        return { text: '处理中', className: 'bg-blue-100 text-blue-800' };
      case 'completed':
        return { text: '已完成', className: 'bg-green-100 text-green-800' };
      case 'failed':
        return { text: '失败', className: 'bg-red-100 text-red-800' };
      case 'dead':
        return { text: '已放弃', className: 'bg-gray-100 text-gray-800' };
      default:
        return { text: status || '未知', className: 'bg-gray-100 text-gray-800' };
    }
  }

  /**
   * 格式化日期
   */
  static formatDate(dateString: string): string {
    if (!dateString) return '未知时间';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '无效日期';
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('日期格式化错误:', error);
      return '无效日期';
    }
  }

  /**
   * 处理文档选择
   */
  static handleSelectDocument(
    documentId: string,
    selectedDocuments: string[],
  ): string[] {
    if (selectedDocuments.includes(documentId)) {
      // 取消选择
      return selectedDocuments.filter(id => id !== documentId);
    } else {
      // 添加选择
      return [...selectedDocuments, documentId];
    }
  }

  /**
   * 处理全选
   */
  static handleSelectAll(
    documents: Document[],
    selectedDocuments: string[],
  ): string[] {
    if (selectedDocuments.length === documents.length) {
      // 取消全选
      return [];
    } else {
      // 全选
      return documents.map(doc => (doc as any).id || doc.docId);
    }
  }

  /**
   * 生成分页数组
   */
  static generatePagination(currentPage: number, totalPages: number): number[] {
    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    // 显示页码范围
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      if (endPage < totalPages - 1) pages.push('...');
      if (endPage < totalPages - 2) pages.push(totalPages);
    }

    return pages as number[];
  }
}
