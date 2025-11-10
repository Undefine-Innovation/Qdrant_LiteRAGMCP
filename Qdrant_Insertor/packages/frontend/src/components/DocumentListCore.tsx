import { DocumentStatusInfo } from '@/types';

/**
 * 文档列表核心逻辑
 * 提供文档状态处理等通用功能
 */
class DocumentListCore {
  /**
   * 获取文档状态信息
   * @param status - 文档状态
   * @returns 状态信息对象
   */
  static getStatusInfo(status?: string): DocumentStatusInfo {
    switch (status) {
      case 'new':
        return {
          text: '新建',
          className: 'bg-gray-100 text-gray-800',
        };
      case 'processing':
        return {
          text: '处理中',
          className: 'bg-blue-100 text-blue-800',
        };
      case 'completed':
        return {
          text: '已完成',
          className: 'bg-green-100 text-green-800',
        };
      case 'failed':
        return {
          text: '失败',
          className: 'bg-red-100 text-red-800',
        };
      case 'deleted':
        return {
          text: '已删除',
          className: 'bg-gray-100 text-gray-800',
        };
      case 'dead':
        return {
          text: '死信',
          className: 'bg-red-100 text-red-800',
        };
      default:
        return {
          text: '未知',
          className: 'bg-gray-100 text-gray-800',
        };
    }
  }

  /**
   * 格式化日期
   * @param timestamp - 时间戳或日期字符串
   * @returns 格式化后的日期字符串
   */
  static formatDate(timestamp?: number | string): string {
    if (!timestamp) return '-';
    // 如果是字符串，直接解析；如果是数字，作为时间戳处理
    const date =
      typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString('zh-CN');
  }

  /**
   * 格式化文件大小
   * @param bytes - 字节数
   * @returns 格式化后的文件大小字符串
   */
  static formatFileSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export { DocumentListCore };
export default DocumentListCore;
