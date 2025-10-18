import { ISplitter } from '../domain/splitter.js';
import { DocumentChunk, SplitOptions } from '../../../share/type.js';

type HeadingEvt = { index: number; level: number; text: string };

function normalizeEol(s: string) {
  return s.replace(/\r\n?/g, '\n');
}

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

  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      events.push({ index: offset, level, text });
    }
    offset += line.length + 1;
  }

  offset = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i],
      nxt = lines[i + 1];
    const u = /^(=){3,}\s*$/.test(nxt);
    const l = /^(-){3,}\s*$/.test(nxt);
    if ((u || l) && cur.trim() && !/^\s*#/.test(cur)) {
      const level = u ? 1 : 2;
      const text = cur.trim();
      events.push({ index: offset, level, text });
    }
    offset += lines[i].length + 1;
  }

  events.sort((a, b) => a.index - b.index);
  return events;
}

function buildTitleTracker(md: string) {
  const events = collectHeadings(md);
  let stack: string[] = [];
  let ptr = 0;

  return function at(pos: number): string[] {
    while (ptr < events.length && events[ptr].index < pos) {
      const { level, text } = events[ptr];
      if (stack.length >= level) stack = stack.slice(0, level - 1);
      stack.push(text);
      ptr++;
    }
    return stack.slice();
  };
}

/**
 * 一个根据 Markdown 标题分割文档的分割器。
 * 每个标题及其后面的内容都会成为一个块。
 * A splitter that divides a Markdown document based on its headings.
 * Each heading and the content following it becomes a chunk.
 */
export class MarkdownSplitter implements ISplitter {
  /**
   * @param options 默认的分割选项。/ Default splitting options.
   */
  constructor(private readonly options: SplitOptions = { strategy: 'markdown_headings' }) {}

  /**
   * 将给定的 Markdown 内容分割成文档块数组。
   * Splits the given Markdown content into an array of document chunks.
   * @param content 要分割的 Markdown 字符串内容。/ The Markdown string content to split.
   * @param options 本次分割操作的选项，例如 `{ docPath: 'path/to/doc.md' }`。/ Options for this specific split operation, e.g., `{ docPath: 'path/to/doc.md' }`.
   * @returns 文档块数组。/ An array of document chunks.
   */
  split(
    content: string,
    options?: {
      docPath?: string;
    },
  ): DocumentChunk[] {
    const docPath = options?.docPath;
    const chunks: DocumentChunk[] = [];
    const at = buildTitleTracker(content);
    const lines = content.split('\n');
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
      const headerMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (headerMatch) {
        addChunk(currentChunkContent, currentChunkStartIndex);
        currentChunkContent = '';
        currentChunkStartIndex = offset;
      }
      currentChunkContent += line + '\n';
      offset += line.length + 1;
    }

    addChunk(currentChunkContent, currentChunkStartIndex);

    if (chunks.length === 0 && content.trim()) {
      const base = baseName(docPath);
      const chain: string[] = [];
      const titleChain = base ? [base, ...chain] : chain;
      chunks.push({ content: content.trim(), titleChain });
    }
    return chunks;
  }
}