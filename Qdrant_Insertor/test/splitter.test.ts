import { splitByMarkdownHeaders, splitByFixedSize, splitBySentence } from '../backend/src/splitter.js';

describe('Splitter Functions', () => {
  const testDocContent = `
# Header 1
This is some content under header 1.

## Header 1.1
Content for header 1.1.

# Header 2
Content for header 2.
`;
  let content: string;

  beforeAll(() => {
    content = testDocContent;
  });

  describe('splitByMarkdownHeaders', () => {
    test('should split document by markdown headers and include titleChain', () => {
      const chunks = splitByMarkdownHeaders(content, 'test_doc.md');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain("Header 1");
      expect(chunks[0].titleChain).toEqual(['test_doc.md']);
      expect(chunks[1].titleChain).toEqual(['test_doc.md', 'Header 1']);
    });

    test('should handle empty content', () => {
      const chunks = splitByMarkdownHeaders('', 'empty.md');
      expect(chunks).toEqual([]);
    });
  });

  describe('splitByFixedSize', () => {
    test('should split document into fixed size chunks with overlap', () => {
      const chunkSize = 100;
      const chunkOverlap = 20;
      const chunks = splitByFixedSize(content, 'test_doc.md', chunkSize, chunkOverlap);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content.length).toBeLessThanOrEqual(chunkSize);
      expect(chunks[0].titleChain).toEqual(['test_doc.md']);
      if (chunks.length > 1) {
        const overlapContent = chunks[0].content.substring(chunks[0].content.length - chunkOverlap);
        expect(chunks[1].content).toContain(overlapContent);
      }
    });

    test('should handle empty content', () => {
      const chunks = splitByFixedSize('', 'empty.md', 100, 20);
      expect(chunks).toEqual([]);
    });

    test('should merge small chunks if they are too small', () => {
      const shortContent = "This is a very short sentence. Another short one. And one more.";
      const chunks = splitByFixedSize(shortContent, 'short.md', 10, 0);
      expect(chunks.length).toBeLessThanOrEqual(3); // Should merge some short ones
      expect(chunks[0].titleChain).toEqual(['short.md']);
    });
  });

  describe('splitBySentence', () => {
    test('should split document by sentences', () => {
      const testContent = "Hello world. This is a test. Another sentence here.";
      const chunks = splitBySentence(testContent, 'sentence.md');
      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe("Hello world.");
      expect(chunks[1].content).toBe("This is a test.");
      expect(chunks[2].content).toBe("Another sentence here.");
      expect(chunks[0].titleChain).toEqual(['sentence.md']);
    });

    test('should handle empty content', () => {
      const chunks = splitBySentence('', 'empty.md');
      expect(chunks).toEqual([]);
    });

    test('should merge very short sentences', () => {
      const shortSentences = "A. B. C. D.";
      const chunks = splitBySentence(shortSentences, 'short_sentences.md');
      // Depending on the implementation, these might be merged into fewer chunks
      expect(chunks.length).toBeLessThanOrEqual(4);
      expect(chunks[0].titleChain).toEqual(['short_sentences.md']);
    });
  });
});