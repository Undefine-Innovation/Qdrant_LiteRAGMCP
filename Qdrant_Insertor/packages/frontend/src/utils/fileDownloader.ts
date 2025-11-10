/**
 * 文件下载工具
 * 提供各种文件下载功能
 */

/**
 * 通用文件下载函数
 * @param blob - 文件二进制数据
 * @param filename - 文件名
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载文本文件
 * @param text - 文本内容
 * @param filename - 文件名
 */
export function downloadAsText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadFile(blob, filename);
}

/**
 * 下载Markdown文件
 * @param markdown - Markdown内容
 * @param filename - 文件名
 */
export function downloadAsMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadFile(blob, filename);
}

/**
 * 下载JSON文件
 * @param data - 数据对象
 * @param filename - 文件名
 */
export function downloadAsJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadFile(blob, filename);
}

/**
 * 下载CSV文件
 * @param csvContent - CSV内容字符串
 * @param filename - 文件名
 */
export function downloadAsCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  downloadFile(blob, filename);
}
