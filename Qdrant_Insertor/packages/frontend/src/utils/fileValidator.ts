/**
 * 文件验证结果接口
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  validFiles?: File[];
}

/**
 * 文件验证器
 * 负责验证文件大小、类型和数量
 */
export class FileValidator {
  /**
   * 验证文件列表
   * @param files - 文件列表
   * @param options - 验证选项
   * @returns 验证结果
   */
  public static validateFiles(
    files: FileList,
    options: {
      maxFiles?: number;
      maxSize?: number;
      accept?: string;
    } = {},
  ): FileValidationResult {
    const { maxFiles = 50, maxSize = 10 * 1024 * 1024, accept } = options;

    if (files.length > maxFiles) {
      return {
        valid: false,
        error: `文件数量超过限制，最多只能上传 ${maxFiles} 个文件`,
      };
    }

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 检查文件大小
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `文件 "${file.name}" 超过最大大小限制 (${Math.round(maxSize / 1024 / 1024)}MB)`,
        };
      }

      // 检查文件类型
      if (accept) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!accept.includes(fileExtension)) {
          return {
            valid: false,
            error: `文件 "${file.name}" 类型不支持，支持的类型: ${accept}`,
          };
        }
      }

      validFiles.push(file);
    }

    return { valid: true, validFiles };
  }
}

/**
 * 文件大小格式化工具
 * @param bytes - 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};