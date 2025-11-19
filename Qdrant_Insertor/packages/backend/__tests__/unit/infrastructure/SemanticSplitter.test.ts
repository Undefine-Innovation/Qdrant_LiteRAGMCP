/**
 * SemanticSplitter 单元测试
 */

import { ILLMService, SemanticSplitResult } from '@domain/interfaces/llm.js';
import { SemanticSplitter } from '@infrastructure/external/SemanticSplitter.js';
import { MockFactory, LLMServiceMockFactory } from '../../utils/test-mocks.js';
import { Logger } from '@logging/logger.js';
import { DocumentChunk } from '@infrastructure/external/index.js';

describe('SemanticSplitter', () => {
  /**
   * 模拟的日志记录器，用于验证日志调用
   */
  let logger: jest.Mocked<Logger>;
  /**
   * 模拟的 LLM 服务，用于预设语义拆分行为
   */
  let mockLLMService: jest.Mocked<ILLMService>;
  /**
   * 待测的 SemanticSplitter 实例
   */
  let semanticSplitter: SemanticSplitter;

  beforeEach(() => {
    logger = MockFactory.createLoggerMock();
    mockLLMService = LLMServiceMockFactory.createLLMServiceMock();
    semanticSplitter = new SemanticSplitter(mockLLMService, logger);
  });

  describe('构造函数', () => {
    it('应该正确初始化SemanticSplitter', () => {
      expect(semanticSplitter).toBeInstanceOf(SemanticSplitter);
      expect(logger.info).toHaveBeenCalledWith('SemanticSplitter已初始化', {
        provider: mockLLMService.getProvider(),
        enableFallback: true,
        fallbackStrategy: 'by_size',
        enableCache: true,
      });
    });

    it('应该接受自定义选项', () => {
      const customOptions = {
        enableFallback: false,
        fallbackStrategy: 'by_headings' as const,
        maxRetries: 5,
        retryDelay: 2000,
        enableCache: false,
        cacheTTL: 600000,
      };
      
      const customSplitter = new SemanticSplitter(mockLLMService, logger, customOptions);
      
      expect(customSplitter).toBeInstanceOf(SemanticSplitter);
    });
  });

  describe('getDefaultOptions', () => {
    it('应该返回默认选项', () => {
      const options = semanticSplitter.getDefaultOptions();
      
      expect(options).toEqual({
        maxChunkSize: 1000,
        chunkOverlap: 100,
        strategy: 'semantic',
        enableFallback: true,
        fallbackStrategy: 'by_size',
        maxRetries: 3,
        retryDelay: 1000,
        enableCache: true,
        cacheTTL: 300000,
      });
    });
  });

  describe('split', () => {
    const testText = '这是一段测试文本，用于测试语义分块功能。';

    it('应该成功执行语义分块', async () => {
      const mockResult: SemanticSplitResult = {
        chunks: ['分块1', '分块2'],
        chunkTitles: ['标题1', '标题2'],
        tokensUsed: 100,
      };
      
      mockLLMService.semanticSplit.mockResolvedValue(mockResult);
      mockLLMService.isAvailable.mockResolvedValue(true);
      
      const result = await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        chunkOverlap: 10,
      });
      
      expect(result).toEqual([
        {
          content: '分块1',
          index: 0,
          title: '标题1',
          titleChain: ['标题1'],
        },
        {
          content: '分块2',
          index: 1,
          title: '标题2',
          titleChain: ['标题2'],
        },
      ]);
      
      expect(mockLLMService.semanticSplit).toHaveBeenCalledWith({
        text: testText,
        targetChunkSize: 100,
        chunkOverlap: 10,
        strategy: 'semantic',
        maxChunks: undefined,
      });
    });

    it('应该使用缓存', async () => {
      const mockResult: SemanticSplitResult = {
        chunks: ['缓存分块'],
        tokensUsed: 50,
      };
      
      mockLLMService.semanticSplit.mockResolvedValue(mockResult);
      mockLLMService.isAvailable.mockResolvedValue(true);
      
      // 第一次调用
      await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        enableCache: true,
      });
      
      // 第二次调用应该使用缓存
      const result = await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        enableCache: true,
      });
      
      expect(result).toEqual([{
        content: '缓存分块',
        index: 0,
      }]);
      
      // LLM服务应该只被调用一次
      expect(mockLLMService.semanticSplit).toHaveBeenCalledTimes(1);
    });

    it('应该在LLM服务不可用时使用降级策略', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const result = await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        enableFallback: true,
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('使用降级分块策略', {
        fallbackStrategy: 'by_size',
      });
    });

    it('应该在LLM服务失败时使用降级策略', async () => {
      mockLLMService.isAvailable.mockResolvedValue(true);
      mockLLMService.semanticSplit.mockRejectedValue(new Error('LLM错误'));
      
      const result = await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        enableFallback: true,
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(logger.error).toHaveBeenCalledWith('语义分块失败', {
        error: expect.any(Error),
        options: expect.any(Object),
      });
    });

    it('应该在禁用降级时抛出错误', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      await expect(
        semanticSplitter.split(testText, {
          maxChunkSize: 100,
          enableFallback: false,
        })
      ).rejects.toThrow('LLM服务不可用');
    });

    it('应该支持重试机制', async () => {
      mockLLMService.isAvailable.mockResolvedValue(true);
      
      // 前两次调用失败，第三次成功
      mockLLMService.semanticSplit
        .mockRejectedValueOnce(new Error('第一次失败'))
        .mockRejectedValueOnce(new Error('第二次失败'))
        .mockResolvedValueOnce({
          chunks: ['成功分块'],
          tokensUsed: 50,
        });
      
      const result = await semanticSplitter.split(testText, {
        maxChunkSize: 100,
        maxRetries: 3,
        retryDelay: 10, // 使用较短的延迟以加快测试
      });
      
      expect(result).toEqual([{
        content: '成功分块',
        index: 0,
      }]);
      
      expect(mockLLMService.semanticSplit).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2); // 两次失败警告
    });
  });

  describe('splitText', () => {
    it('应该返回字符串数组', async () => {
      const mockResult: SemanticSplitResult = {
        chunks: ['分块1', '分块2'],
        tokensUsed: 100,
      };
      
      mockLLMService.semanticSplit.mockResolvedValue(mockResult);
      mockLLMService.isAvailable.mockResolvedValue(true);
      
      const result = await semanticSplitter.splitText('测试文本', {
        maxChunkSize: 100,
      });
      
      expect(result).toEqual(['分块1', '分块2']);
    });
  });

  describe('降级策略', () => {
    it('应该支持按大小分块', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const longText = '这是一段很长的文本，用于测试按大小分块功能。'.repeat(10);
      const result = await semanticSplitter.split(longText, {
        maxChunkSize: 50,
        chunkOverlap: 10,
        fallbackStrategy: 'by_size',
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // 验证每个块的大小
      const chunks = result as DocumentChunk[];
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(50);
      });
    });

    it('应该支持按标题分块', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const markdownText = `# 标题1
内容1

## 标题2
内容2

### 标题3
内容3`;
      
      const result = await semanticSplitter.split(markdownText, {
        maxChunkSize: 1000,
        fallbackStrategy: 'by_headings',
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      const chunks = result as DocumentChunk[];
      expect(chunks.length).toBeGreaterThan(0);
      
      // 验证标题信息
      chunks.forEach(chunk => {
        if (chunk.title) {
          expect(chunk.titleChain).toContain(chunk.title);
        }
      });
    });

    it('应该支持自动分块', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const markdownText = `# 标题1
内容1

## 标题2
内容2`;
      
      const result = await semanticSplitter.split(markdownText, {
        maxChunkSize: 1000,
        fallbackStrategy: 'auto',
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // 对于Markdown内容，应该使用按标题分块
      const chunks = result as DocumentChunk[];
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('缓存管理', () => {
    it('应该支持清空缓存', () => {
      semanticSplitter.clearCache();
      
      expect(logger.debug).toHaveBeenCalledWith('语义分块缓存已清空');
    });

    it('应该支持获取缓存统计', () => {
      const stats = semanticSplitter.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Markdown检测', () => {
    it('应该正确检测Markdown内容', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const markdownText = `# 标题
这是**粗体**文本和*斜体*文本。

[链接](http://example.com)

\`\`\`javascript
console.log('代码块');
\`\`\`

- 列表项1
- 列表项2`;
      
      const result = await semanticSplitter.split(markdownText, {
        maxChunkSize: 1000,
        fallbackStrategy: 'auto',
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该正确检测非Markdown内容', async () => {
      mockLLMService.isAvailable.mockResolvedValue(false);
      
      const plainText = '这是普通文本，没有Markdown格式。';
      
      const result = await semanticSplitter.split(plainText, {
        maxChunkSize: 1000,
        fallbackStrategy: 'auto',
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
