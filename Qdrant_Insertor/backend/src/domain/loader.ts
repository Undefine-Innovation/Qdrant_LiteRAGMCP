/**
 * @file 定义文件加载器的接口。
 */

/**
 * 表示从源加载的文件。
 */
export interface LoadedFile {
  /**
   * 文件的原始内容。
   */
  content: string;
  /**
   * 文件的 MIME 类型，用于确定如何处理它。
   */
  mimeType: string;
  /**
   * 文件名。
   */
  fileName: string;
}

/**
 * 一个用于从给定路径读取文件的加载器接口。
 * 这种抽象允许不同的加载策略，例如
 * 从本地文件系统、远程 URL 或数据库。
 */
export interface IFileLoader {
  /**
   * 从指定路径加载文件。
   * @param filePath 要加载的文件的路径。
   * @returns 一个解析为 LoadedFile 对象的 Promise。
   */
  load(filePath: string): Promise<LoadedFile>;
}
