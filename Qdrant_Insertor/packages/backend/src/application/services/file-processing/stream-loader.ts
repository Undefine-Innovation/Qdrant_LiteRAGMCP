/**
 * 流式文件加载器接口
 * 用于从 Buffer、Stream 等内存源加载文件内容
 * 相比 IFileLoader（基于路径），此接口支持更灵活的输入源
 */

/**
 * 流式加载的文件对象
 */
export interface StreamLoadedFile {
  /** 文件内容 */
  content: string;
  /** 文件 MIME 类型 */
  mimeType: string;
  /** 文件名 */
  fileName: string;
}

/**
 * 流式文件加载器接口
 * 支持从 Buffer 和 Stream 加载文件
 */
export interface IStreamFileLoader {
  /**
   * 从 Buffer 加载文件
   * @param buffer 文件内容 Buffer
   * @param fileName 文件名
   * @param mimeType MIME 类型
   * @returns 加载后的文件对象
   */
  loadFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<StreamLoadedFile>;

  /**
   * 从可读流加载文件（可选）
   * @param stream Node.js 可读流
   * @param fileName 文件名
   * @param mimeType MIME 类型
   * @returns 加载后的文件对象
   */
  loadFromStream?(
    stream: NodeJS.ReadableStream,
    fileName: string,
    mimeType: string,
  ): Promise<StreamLoadedFile>;
}
