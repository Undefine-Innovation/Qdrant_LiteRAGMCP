import { UnifiedMarkdownSplitter } from '@infrastructure/external/UnifiedMarkdownSplitter.js';
import { Logger } from '@logging/logger.js';

describe('UnifiedMarkdownSplitter', () => {
  let splitter: UnifiedMarkdownSplitter;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    splitter = new UnifiedMarkdownSplitter(undefined, mockLogger);
  });

  describe('基本功能', () => {
    it('应该正确初始化所有策略', () => {
      const strategies = splitter.getAvailableStrategies();
      expect(strategies).toHaveLength(4);
      expect(strategies.map(s => s.name)).toEqual(
        expect.arrayContaining(['by_headings', 'by_size', 'hybrid', 'auto'])
      );
    });

    it('应该返回正确的默认选项', () => {
      const options = splitter.getDefaultOptions();
      expect(options).toEqual({
        strategy: 'auto',
        maxChunkSize: 1000,
        overlap: 100,
        maxHeadingDepth: 3,
        preferHeadings: true,
      });
    });
  });

  describe('标题分割策略', () => {
    it('应该按标题正确分割Markdown内容', async () => {
      const content = `# 主标题

这是第一段内容。

## 子标题1

这是子标题1的内容。

### 子子标题

这是更深层的内容。

## 子标题2

这是子标题2的内容。`;

      const chunks = await splitter.split(content, { strategy: 'by_headings' }) as any[];
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0].content).toContain('主标题');
      expect(chunks[0].content).toContain('这是第一段内容');
      expect(chunks[1].content).toContain('子标题1');
      expect(chunks[2].content).toContain('子子标题');
      expect(chunks[3].content).toContain('子标题2');
    });

    it('应该正确处理标题链', async () => {
      const content = `# 主标题

## 子标题

内容`;

      const chunks = await splitter.split(content, { 
        strategy: 'by_headings',
        docPath: 'test.md'
      }) as any[];
      
      expect(chunks[1].titleChain).toEqual(['test.md', '主标题']);
    });
  });

  describe('大小分割策略', () => {
    it('应该按大小正确分割长内容', async () => {
      const longContent = 'A'.repeat(2500);
      const chunks = await splitter.split(longContent, { 
        strategy: 'by_size',
        maxChunkSize: 1000,
        overlap: 100
      }) as any[];
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content.length).toBeLessThanOrEqual(1000);
    });

    it('应该对短内容返回单个块', async () => {
      const shortContent = '这是短内容';
      const chunks = await splitter.split(shortContent, { strategy: 'by_size' }) as any[];
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('这是短内容');
    });
  });

  describe('混合分割策略', () => {
    it('应该优先使用标题分割', async () => {
      const content = `# 标题1

${'A'.repeat(500)}

# 标题2

${'B'.repeat(500)}`;

      const chunks = await splitter.split(content, { 
        strategy: 'hybrid',
        maxChunkSize: 300 // 设置较小的大小以测试混合策略
      }) as any[];
      
      expect(chunks.length).toBeGreaterThan(2); // 应该被进一步分割
      expect(chunks.some(c => c.content.includes('标题1'))).toBe(true);
      expect(chunks.some(c => c.content.includes('标题2'))).toBe(true);
    });
  });

  describe('自动分割策略', () => {
    it('应该为有标题的Markdown选择混合策略', async () => {
      const markdownContent = `# 标题

内容`;

      const chunks = await splitter.split(markdownContent, { strategy: 'auto' }) as any[];
      
      expect(chunks).toHaveLength(1);
      // 验证debug被调用了两次（开始和完成）
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('应该为长内容选择大小分割', async () => {
      const longContent = 'A'.repeat(2500);
      const chunks = await splitter.split(longContent, { strategy: 'auto' }) as any[];
      
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('应该为短内容返回单个块', async () => {
      const shortContent = '短内容';
      const chunks = await splitter.split(shortContent, { strategy: 'auto' }) as any[];
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('短内容');
    });
  });

  describe('错误处理', () => {
    it('应该处理未知策略错误', async () => {
      const content = '测试内容';
      const chunks = await splitter.split(content, { strategy: 'unknown' }) as any[];
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('测试内容');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('应该提供降级分割', async () => {
      const content = '测试内容';
      const chunks = await splitter.split(content, { strategy: 'invalid' }) as any[];
      
      expect(chunks).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('使用降级分割策略');
    });
  });

  describe('splitText方法', () => {
    it('应该返回字符串数组', async () => {
      const content = `# 标题

内容1

## 子标题

内容2`;

      const textChunks = await splitter.splitText(content, { strategy: 'by_headings' });
      
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0]).toContain('标题');
      expect(textChunks[0]).toContain('内容1');
      expect(textChunks[1]).toContain('子标题');
      expect(textChunks[1]).toContain('内容2');
    });
  });

  describe('策略管理', () => {
    it('应该允许设置默认策略', () => {
      splitter.setDefaultStrategy('by_headings');
      const options = splitter.getDefaultOptions();
      expect(options.strategy).toBe('by_headings');
    });

    it('应该拒绝无效的策略名称', () => {
      expect(() => {
        splitter.setDefaultStrategy('invalid_strategy');
      }).toThrow('未知的分割策略: invalid_strategy');
    });
  });
});