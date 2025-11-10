/**
 * 流式文件加载器实现
 * 从 Buffer 或 Stream 加载文件内容
 */

import { IStreamFileLoader, StreamLoadedFile } from '@domain/services/stream-loader.js';
import { Logger } from '@logging/logger.js';

/**
 * 默认流式文件加载器实现
 */
export class DefaultStreamFileLoader implements IStreamFileLoader {
  /**
   * 创建实例
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 从 Buffer 加载文件
   * @param buffer 文件 Buffer
   * @param fileName 文件名
   * @param mimeType MIME 类型
   * @returns 加载结果
   */
  async loadFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<StreamLoadedFile> {
    try {
      const content = buffer.toString('utf-8');
      this.logger.debug(
        `从Buffer加载文件成功: ${fileName}, 大小: ${buffer.length} bytes`,
      );
      return {
        content,
        fileName,
        mimeType,
      };
    } catch (error) {
      this.logger.error(`从Buffer加载文件失败: ${fileName}`, { error });
      throw error;
    }
  }

  /**
   * 从 Stream 加载文件
   * @param stream 可读流
   * @param fileName 文件名
   * @param mimeType MIME 类型
   * @returns 加载结果
   */
  async loadFromStream(
    stream: NodeJS.ReadableStream,
    fileName: string,
    mimeType: string,
  ): Promise<StreamLoadedFile> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const content = buffer.toString('utf-8');
          this.logger.debug(
            `从Stream加载文件成功: ${fileName}, 大小: ${buffer.length} bytes`,
          );
          resolve({
            content,
            fileName,
            mimeType,
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', (error: Error) => {
        this.logger.error(`Stream加载失败: ${fileName}`, { error });
        reject(error);
      });
    });
  }
}
