import { IFileLoader, LoadedFile } from '../domain/loader.js';
import fs from 'fs/promises';
import path from 'path';
import { lookup } from 'mime-types';

/**
 * @class LocalFileLoader
 * @implements {IFileLoader}
 * @description 从本地文件系统加载文件的加载器。
 */
export class LocalFileLoader implements IFileLoader {
  /**
   * 从本地文件系统异步加载文件。
   *
   * @param filePath 要加载的文件的路径。
   * @returns 一个解析为 LoadedFile 对象的 Promise，包含文件内容、MIME 类型和文件名。
   * @throws 如果文件读取失败，则会抛出异常。
   */
  public async load(filePath: string): Promise<LoadedFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const mimeType = lookup(filePath) || 'application/octet-stream';

    return {
      content,
      fileName,
      mimeType,
    };
  }
}
