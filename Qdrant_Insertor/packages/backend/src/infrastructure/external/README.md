# 可扩展文件处理框架

本文档介绍了新实现的可扩展文件处理框架，该框架采用插件化架构，支持动态格式检测和多种文件格式的处理。

## 架构概述

### 核心组件

1. **IFileProcessor** - 文件处理器接口
   - 定义了文件处理器的标准接口
   - 支持格式检测、内容提取、分块处理、预览生成和缩略图生成

2. **FileProcessorRegistry** - 文件处理器注册表
   - 管理所有已注册的文件处理器
   - 提供处理器匹配和查询功能
   - 支持优先级排序

3. **FileFormatDetector** - 动态格式检测器
   - 支持MIME类型、文件扩展名和内容检测
   - 提供置信度评分
   - 自动选择最佳处理器

4. **BaseFileProcessor** - 抽象基类
   - 提供通用的文件处理功能
   - 实现默认的预览和缩略图生成
   - 简化新处理器的开发

### 已实现的处理器

1. **TextFileProcessor** - 文本文件处理器
   - 支持纯文本、代码文件和配置文件
   - 智能语言检测
   - 多种分块策略（按句子、按大小、按标题）

2. **MarkdownFileProcessor** - Markdown文件处理器
   - 专门处理Markdown格式
   - 标题层次结构提取
   - 链接、图片、代码块识别
   - 优化的HTML预览生成

## 使用方法

### 注册新处理器

```typescript
import { FileProcessorRegistry } from '@infrastructure/external/FileProcessorRegistry.js';
import { BaseFileProcessor } from '@infrastructure/external/BaseFileProcessor.js';

class CustomProcessor extends BaseFileProcessor {
  canHandle(file: LoadedFile): boolean {
    // 实现文件类型检测逻辑
    return file.fileName.endsWith('.custom');
  }

  getSupportedFormats() {
    return {
      mimeTypes: ['application/custom'],
      extensions: ['custom'],
    };
  }

  async extractText(file: LoadedFile): Promise<string> {
    // 实现文本提取逻辑
    return file.content;
  }
}

// 注册处理器
registry.register(new CustomProcessor(logger));
```

### 处理文件

```typescript
import { EnhancedFileProcessingService } from '@application/services/EnhancedFileProcessingService.js';

// 获取处理器
const processor = processorRegistry.getProcessor(file);

if (processor) {
  // 处理文件
  const result = await processor.process(file, {
    chunkingStrategy: 'by_headings',
    maxChunkSize: 1000,
    chunkOverlap: 100,
  });

  console.log(`生成了 ${result.chunks.length} 个块`);
}
```

### 生成预览和缩略图

```typescript
// 生成预览
const preview = await processor.generatePreview(file, 'html');

// 生成缩略图
const thumbnail = await processor.generateThumbnail(file, {
  width: 200,
  height: 200,
});
```

## 兼容性

### 与现有系统的集成

新框架通过适配器模式与现有系统保持兼容：

1. **MarkdownSplitterAdapter** - 将新处理器适配到ISplitter接口
2. **EnhancedFileProcessingService** - 实现IFileProcessingService接口
3. **依赖注入更新** - 在services.ts中集成新组件

### 向后兼容性

- 现有的ISplitter接口继续工作
- 现有的IFileProcessingService接口继续工作
- 现有的MarkdownSplitter类保持不变
- 现有的ImportService无需修改

## 扩展指南

### 添加新的文件格式支持

1. 创建新的处理器类，继承BaseFileProcessor
2. 实现必要的抽象方法
3. 在依赖注入配置中注册处理器
4. 添加相应的测试（可选）

### 自定义分块策略

处理器可以支持多种分块策略：

- `auto` - 自动选择最佳策略
- `by_headings` - 按标题分块（适用于Markdown）
- `by_size` - 按固定大小分块
- `by_sentences` - 按句子分块
- `by_sections` - 按章节分块

### 元数据提取

处理器可以提取丰富的元数据：

- 基本信息：标题、作者、创建时间
- 统计信息：字数、行数、段落数
- 格式特定信息：代码函数、Markdown标题等

## 性能优化

1. **处理器缓存** - 注册表维护索引以提高查找速度
2. **优先级排序** - 高优先级处理器优先匹配
3. **内容检测优化** - 只读取文件开头部分进行检测
4. **异步处理** - 支持大文件的异步处理

## 配置选项

### 处理器选项

```typescript
interface FileProcessorOptions {
  chunkingStrategy?: 'auto' | 'by_headings' | 'by_size' | 'by_sentences';
  maxChunkSize?: number;
  chunkOverlap?: number;
  preserveFormatting?: boolean;
  language?: string;
  customParams?: Record<string, unknown>;
}
```

### 注册表配置

```typescript
// 在 services.ts 中配置
const fileProcessorRegistry = new FileProcessorRegistry(logger);
fileProcessorRegistry.register(new TextFileProcessor(logger));
fileProcessorRegistry.register(new MarkdownFileProcessor(logger));
```

## 故障排除

### 常见问题

1. **处理器未找到**
   - 检查文件扩展名和MIME类型
   - 确认处理器已正确注册
   - 查看日志中的警告信息

2. **分块质量不佳**
   - 调整maxChunkSize和chunkOverlap参数
   - 尝试不同的chunkingStrategy
   - 检查文件内容格式

3. **性能问题**
   - 对于大文件，考虑流式处理
   - 优化内容检测逻辑
   - 使用处理器缓存

### 调试技巧

1. 启用详细日志记录
2. 使用处理器统计信息
3. 检查格式检测结果
4. 验证处理器优先级

## 未来扩展

### 计划中的功能

1. **更多文件格式支持**
   - PDF处理器
   - Word文档处理器
   - Excel处理器
   - 图片处理器

2. **高级分块策略**
   - 语义分块
   - 智能重叠
   - 自适应大小

3. **性能优化**
   - 并行处理
   - 流式处理
   - 缓存机制

4. **AI增强**
   - 智能格式检测
   - 内容摘要生成
   - 自动标签提取

## 贡献指南

欢迎贡献新的文件处理器：

1. Fork项目
2. 创建新的处理器类
3. 添加测试和文档
4. 提交Pull Request

### 代码规范

- 继承BaseFileProcessor
- 实现所有必需方法
- 添加适当的错误处理
- 编写清晰的文档
- 遵循TypeScript严格模式
