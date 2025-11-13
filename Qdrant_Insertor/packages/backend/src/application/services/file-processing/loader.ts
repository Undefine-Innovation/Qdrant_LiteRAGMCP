/**
 * @file 定义文件加载器的接口�?
 */

// Import and re-export LoadedFile from infrastructure layer to ensure consistency
import type { LoadedFile } from '../../../infrastructure/external/index.js';
export type { LoadedFile };

/**
 * 一个用于从给定路径读取文件的加载器接口�?
 * 这种抽象允许不同的加载策略，例如
 * 从本地文件系统、远�?URL 或数据库�?
 */
export interface IFileLoader {
  /**
   * 从指定路径加载文件�?
   * @param filePath 要加载的文件的路径�?
   * @returns 一个解析为 LoadedFile 对象�?Promise�?
   */
  load(filePath: string): Promise<LoadedFile>;
}
