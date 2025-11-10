import { Logger } from '@logging/logger.js';
import {
  IFileProcessor,
  IFileProcessorRegistry,
} from '@domain/services/fileProcessor.js';
import { LoadedFile } from '@domain/services/loader.js';

/**
 * 文件处理器注册表实现
 * 负责管理和协调所有文件处理器
 */
export class FileProcessorRegistry implements IFileProcessorRegistry {
  private readonly processors: Map<string, IFileProcessor> = new Map();
  private readonly mimeTypeIndex: Map<string, IFileProcessor[]> = new Map();
  private readonly extensionIndex: Map<string, IFileProcessor[]> = new Map();

  /**
   * 构造函数
   * @param logger - 日志记录器
   */
  constructor(private readonly logger: Logger) {
    this.logger.info('文件处理器注册表已初始化');
  }

  /**
   * 注册文件处理器
   * @param processor - 文件处理器实例
   */
  public register(processor: IFileProcessor): void {
    const processorName = processor.constructor.name;

    if (this.processors.has(processorName)) {
      this.logger.warn(`文件处理器 ${processorName} 已存在，将被覆盖`);
    }

    this.processors.set(processorName, processor);

    // 更新MIME类型索引
    const formats = processor.getSupportedFormats();
    formats.mimeTypes.forEach((mimeType) => {
      if (!this.mimeTypeIndex.has(mimeType)) {
        this.mimeTypeIndex.set(mimeType, []);
      }
      this.mimeTypeIndex.get(mimeType)!.push(processor);
    });

    // 更新文件扩展名索引
    formats.extensions.forEach((extension) => {
      const normalizedExt = extension.toLowerCase().startsWith('.')
        ? extension.toLowerCase()
        : `.${extension.toLowerCase()}`;

      if (!this.extensionIndex.has(normalizedExt)) {
        this.extensionIndex.set(normalizedExt, []);
      }
      this.extensionIndex.get(normalizedExt)!.push(processor);
    });

    this.logger.info(
      `文件处理器 ${processorName} 已注册，支持格式: MIME[${formats.mimeTypes.join(', ')}] 扩展名[${formats.extensions.join(', ')}]`,
    );
  }

  /**
   * 注销文件处理器
   * @param processorName - 处理器名称
   */
  public unregister(processorName: string): void {
    const processor = this.processors.get(processorName);
    if (!processor) {
      this.logger.warn(`文件处理器 ${processorName} 不存在`);
      return;
    }

    // 从主注册表中移除
    this.processors.delete(processorName);

    // 从MIME类型索引中移除
    const formats = processor.getSupportedFormats();
    formats.mimeTypes.forEach((mimeType) => {
      const processors = this.mimeTypeIndex.get(mimeType);
      if (processors) {
        const index = processors.indexOf(processor);
        if (index > -1) {
          processors.splice(index, 1);
        }
        if (processors.length === 0) {
          this.mimeTypeIndex.delete(mimeType);
        }
      }
    });

    // 从文件扩展名索引中移除
    formats.extensions.forEach((extension) => {
      const normalizedExt = extension.toLowerCase().startsWith('.')
        ? extension.toLowerCase()
        : `.${extension.toLowerCase()}`;

      const processors = this.extensionIndex.get(normalizedExt);
      if (processors) {
        const index = processors.indexOf(processor);
        if (index > -1) {
          processors.splice(index, 1);
        }
        if (processors.length === 0) {
          this.extensionIndex.delete(normalizedExt);
        }
      }
    });

    this.logger.info(`文件处理器 ${processorName} 已注销`);
  }

  /**
   * 获取能够处理指定文件的处理器
   * @param file - 文件对象
   * @returns 匹配的处理器，如果没有则返回null
   */
  public getProcessor(file: LoadedFile): IFileProcessor | null {
    // 首先尝试通过MIME类型匹配
    const mimeTypeProcessors = this.mimeTypeIndex.get(file.mimeType);
    if (mimeTypeProcessors && mimeTypeProcessors.length > 0) {
      // 按优先级排序，返回最高优先级的处理器
      const sortedProcessors = mimeTypeProcessors.sort(
        (a, b) => b.getPriority() - a.getPriority(),
      );
      for (const processor of sortedProcessors) {
        if (processor.canHandle(file)) {
          this.logger.debug(
            `通过MIME类型 ${file.mimeType} 匹配到处理器: ${processor.constructor.name}`,
          );
          return processor;
        }
      }
    }

    // 如果MIME类型匹配失败，尝试通过文件扩展名匹配
    const extension = this.extractExtension(file.fileName);
    if (extension) {
      const extensionProcessors = this.extensionIndex.get(extension);
      if (extensionProcessors && extensionProcessors.length > 0) {
        const sortedProcessors = extensionProcessors.sort(
          (a, b) => b.getPriority() - a.getPriority(),
        );
        for (const processor of sortedProcessors) {
          if (processor.canHandle(file)) {
            this.logger.debug(
              `通过扩展名 ${extension} 匹配到处理器: ${processor.constructor.name}`,
            );
            return processor;
          }
        }
      }
    }

    // 最后尝试所有处理器
    for (const processor of this.processors.values()) {
      if (processor.canHandle(file)) {
        this.logger.debug(
          `通过通用匹配找到处理器: ${processor.constructor.name}`,
        );
        return processor;
      }
    }

    this.logger.warn(
      `无法找到适合处理文件 ${file.fileName} (${file.mimeType}) 的处理器`,
    );
    return null;
  }

  /**
   * 获取所有已注册的处理器
   * @returns 处理器数组
   */
  public getAllProcessors(): IFileProcessor[] {
    return Array.from(this.processors.values());
  }

  /**
   * 根据MIME类型获取处理器
   * @param mimeType - MIME类型
   * @returns 处理器数组
   */
  public getProcessorsByMimeType(mimeType: string): IFileProcessor[] {
    return this.mimeTypeIndex.get(mimeType) || [];
  }

  /**
   * 根据文件扩展名获取处理器
   * @param extension - 文件扩展名
   * @returns 处理器数组
   */
  public getProcessorsByExtension(extension: string): IFileProcessor[] {
    const normalizedExt = extension.toLowerCase().startsWith('.')
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;

    return this.extensionIndex.get(normalizedExt) || [];
  }

  /**
   * 获取注册表统计信息
   * @returns 统计信息
   */
  public getStats(): {
    totalProcessors: number;
    supportedMimeTypes: string[];
    supportedExtensions: string[];
  } {
    return {
      totalProcessors: this.processors.size,
      supportedMimeTypes: Array.from(this.mimeTypeIndex.keys()),
      supportedExtensions: Array.from(this.extensionIndex.keys()),
    };
  }

  /**
   * 从文件名中提取扩展名
   * @param fileName - 文件名
   * @returns 扩展名（包含点号），如果没有则返回null
   */
  private extractExtension(fileName: string): string | null {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return null;
    }
    return fileName.substring(lastDotIndex).toLowerCase();
  }
}
