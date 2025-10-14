/**
 * Represents a chunk of a document.
 * 文档块的表示。
 */
export interface DocumentChunk {
  content: string; // The text content of the chunk. / 文本块的内容。
  titleChain?: string[]; // 始终是 string[]
}

type HeadingEvt = { index: number; level: number; text: string };

function normalizeEol(s: string) {
  return s.replace(/\r\n?/g, '\n');
}

// 3) 新增：取 basename 作为文档名
function baseName(p?: string): string | null {
  if (!p) return null;
  const parts = p.split(/[/\\]/);
  const last = parts[parts.length - 1] || '';
  return last || null;
}

function collectHeadings(md: string): HeadingEvt[] {
  const text = normalizeEol(md);
  const lines = text.split('\n');
  const events: HeadingEvt[] = [];

  // 扫描 ATX
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      events.push({ index: offset, level, text });
    }
    offset += line.length + 1; // + '\n'
  }

  // 扫描 Setext（需再次遍历）
  offset = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i],
      nxt = lines[i + 1];
    const u = /^(=){3,}\s*$/.test(nxt);
    const l = /^(-){3,}\s*$/.test(nxt);
    if ((u || l) && cur.trim() && !/^\s*#/.test(cur)) {
      const level = u ? 1 : 2;
      const text = cur.trim();
      // index = 当前行起始 offset
      events.push({ index: offset, level, text });
    }
    offset += lines[i].length + 1;
  }

  // 位置稳定：按 index 升序
  events.sort((a, b) => a.index - b.index);
  return events;
}

function buildTitleTracker(md: string) {
  const events = collectHeadings(md);
  // 滚动维护标题栈
  let stack: string[] = [];
  let ptr = 0;

  // 返回给定字符位置的标题链
  return function at(pos: number): string[] {
    while (ptr < events.length && events[ptr].index < pos) {
      const { level, text } = events[ptr];
      // 收缩到当前层级-1
      if (stack.length >= level) stack = stack.slice(0, level - 1);
      stack.push(text);
      ptr++;
    }
    return stack.slice(); // 拷贝
  };
}

/**
 * Options for splitting documents.
 * 文档分割的选项。
 */
export interface SplitOptions {
  chunkSize?: number; // The desired size of each chunk. / 每个块的期望大小。
  chunkOverlap?: number; // The number of characters to overlap between chunks. / 块之间重叠的字符数。
  strategy?: 'markdown' | 'fixed-size' | 'sentence'; // The splitting strategy to use. / 使用的分割策略。
}

/**
 * Splits a Markdown document by its headers. Each header and the content
 * following it (until the next header of the same or higher level) becomes a chunk.
 * This is a more semantically meaningful way to split technical documentation.
 *
 * 根据 Markdown 文档的标题进行分割。每个标题及其后面的内容
 * （直到下一个相同或更高级别的标题）成为一个块。
 * 这是一种在语义上更有意义的技术文档分割方式。
 *
 * @param {string} text - The Markdown text to split. / 要分割的 Markdown 文本。
 * @returns {DocumentChunk[]} An array of document chunks. / 文档块数组。
 */
export function splitByMarkdownHeaders(
  text: string,
  docPath?: string,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const at = buildTitleTracker(text);
  const lines = text.split('\n');
  let currentChunkContent = '';
  let currentChunkStartIndex = 0;

  const addChunk = (content: string, startIndex: number) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const base = baseName(docPath);
    const chain = at(startIndex);
    const titleChain = base ? [base, ...chain] : chain;
    chunks.push({ content: trimmed, titleChain });
  };

  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/); // Corrected regex
    if (headerMatch) {
      // Add the previous content as a chunk before processing the new header
      addChunk(currentChunkContent, currentChunkStartIndex);
      currentChunkContent = ''; // Reset content for the new chunk
      currentChunkStartIndex = offset; // New chunk starts at this header's offset
    }
    currentChunkContent += line + '\n';
    offset += line.length + 1; // + '\n'
  }

  // 收尾
  addChunk(currentChunkContent, currentChunkStartIndex);

  if (chunks.length === 0 && text.trim()) {
    const base = baseName(docPath);
    const chain: string[] = [];
    const titleChain = base ? [base, ...chain] : chain;
    chunks.push({ content: text.trim(), titleChain });
  }
  return chunks;
}

/**
 * Splits text into chunks of a fixed size with a specified overlap.
 * This function also attempts to merge small chunks (< 200 characters) with the previous one.
 *
 * 将文本分割成固定大小的块，并带有指定的重叠。
 * 此函数还会尝试将小块（< 200 个字符）与前一个块合并。
 *
 * @param {string} text - The text to split. / 要分割的文本。
 * @param {number} [chunkSize=500] - The desired size of each chunk. / 每个块的期望大小。
 * @param {number} [chunkOverlap=50] - The number of characters要重叠的字符数。
 * @returns {DocumentChunk[]} An array of document chunks. / 文档块数组。
 */
// 7) 固定大小分割：签名加入 docPath，并在 push 时叠加文档名
export function splitByFixedSize(
  raw: string,
  docPath?: string,
  chunkSize = 500,
  overlap = 50
): DocumentChunk[] {
  if (chunkSize <= 0) throw new Error('chunkSize must be > 0');
  if (overlap < 0 || overlap >= chunkSize) throw new Error('0 <= overlap < chunkSize');

  const text = normalizeEol(raw);
  const at = buildTitleTracker(text);
  const chunks: DocumentChunk[] = [];

  let start = 0;
  const n = text.length;

  while (start < n) {
    const hardEnd = Math.min(start + chunkSize, n);
    let end = hardEnd;

    // 可选：在±30窗口内找更自然的断点
    if (hardEnd < n) {
      const window = text.slice(Math.max(start, hardEnd - 30), Math.min(n, hardEnd + 30));
      const rel = /(?<=\S)[\.!\?。！？…」』】）\s](?!\S)/.exec(window);
      if (rel) {
        const relIdx = rel.index + rel[0].length;
        end = Math.max(start + 1, Math.max(hardEnd - 30, start) + relIdx);
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      const base = baseName(docPath);
      const chain = at(start);
      const titleChain = base ? [base, ...chain] : chain;
      chunks.push({ content, titleChain });
    }

    if (end >= n) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

/**
 * Splits text into chunks based on sentence boundaries.
 * This function also attempts to merge small chunks (< 200 characters) with the previous one.
 *
 * 将文本根据句子边界分割成块。
 * 此函数还会尝试将小块（< 200 个字符）与前一个块合并。
 *
 * @param {string} text - The text to split. / 要分割的文本。
 * @returns {DocumentChunk[]} An array of document chunks。 / 文档块数组。
 */
export function splitBySentence(
  raw: string,
  docPath?: string,
  minLen = 10,
  maxLen = 500
): DocumentChunk[] {
  const text = normalizeEol(raw);
  const at = buildTitleTracker(text);

  // 中英通用：句末标点 + 末尾残段
  const re = /[^.!?。！？…]+[.!?。！？…]+|[^.!?。！？…]+$/g;
  const sentences: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(text)) !== null) {
    const seg = match[0];
    const start = idx;
    const end = idx + seg.length;
    sentences.push({ start, end });
    idx = end;
  }

  const chunks: DocumentChunk[] = [];
  let bufStart = 0, bufEnd = 0;

  const flush = () => {
    const content = text.slice(bufStart, bufEnd).trim();
    if (content) {
      const base = baseName(docPath);
      const chain = at(bufStart);
      const titleChain = base ? [base, ...chain] : chain;
      chunks.push({ content, titleChain });
    }
  };

  for (const s of sentences) {
    if (bufEnd === 0) { bufStart = s.start; bufEnd = s.end; }
    else {
      if (s.end - bufStart <= maxLen) bufEnd = s.end;
      else { flush(); bufStart = s.start; bufEnd = s.end; }
    }
    if ((bufEnd - bufStart) >= minLen) { flush(); bufStart = 0; bufEnd = 0; }
  }
  if (bufEnd > bufStart) flush();
  return chunks;
}

/**
 * Splits a single document into chunks based on the provided strategy.
 * 将单个文档根据提供的策略分割成块。
 * @param {{path: string, content: string}} document - The document to split. / 要分割的文档。
 * @param {SplitOptions} [options] - Options for splitting. / 分割选项。
 * @returns {DocumentChunk[]} An array of document chunks. / 文档块数组。
 */
export function splitDocument(
  document: { path: string; content: string },
  options: SplitOptions = {},
): DocumentChunk[] {
  if (!document || !document.content) {
    return [];
  }

  const { strategy = 'markdown', chunkSize = 500, chunkOverlap = 50 } = options;

  switch (strategy) {
    case 'markdown':
      return splitByMarkdownHeaders(document.content);
    case 'fixed-size':
      return splitByFixedSize(document.content, document.path, chunkSize, chunkOverlap);
    case 'sentence':
      return splitBySentence(document.content, document.path); // pass document.path and use defaults for min/max
    default:
      console.warn(
        `Unknown splitting strategy: ${strategy}. Falling back to markdown.`,
      );
      return splitByMarkdownHeaders(document.content);
  }
}

/**
 * Splits multiple documents into chunks.
 * 将多个文档分割成块。
 * @param {Array<{path: string, content: string}>} documents - The documents to split. / 要分割的文档数组。
 * @returns {DocumentChunk[]} A flattened array of all document chunks. / 所有文档块的扁平化数组。
 */
export function splitDocuments(
  documents: { path: string; content: string }[],
  options: SplitOptions = {},
): DocumentChunk[] {
  return documents.flatMap((doc) => splitDocument(doc, options));
}
