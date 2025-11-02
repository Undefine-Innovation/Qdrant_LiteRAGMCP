import { createHash, randomUUID } from 'node:crypto';

/**
 * 计算内容的SHA-256 哈希值，用于去重和校验
 * @param content - 要哈希的内容，可以是字符串或 Uint8Array
 * @returns 返回内容的哈希值
 */
export function hashContent(content: string | Uint8Array): string {
  const buf =
    typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : Buffer.from(content);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * 生成一个唯一的集合ID
 * 要求 Node.js 版本 ≥14.17
 * @returns 返回生成的集合ID
 */
export function makeCollectionId(): string {
  return randomUUID();
}

/**
 * 生成一个唯一的版本ID，表示一批快照的批次
 * @returns 返回生成的版本ID
 */
export function makeVersionId(): string {
  return randomUUID();
}

/**
 * 生成一个文档ID，基于内容的哈希值
 * @param content - 文档内容，用于生成ID
 * @returns 返回生成的文档ID
 */
export function makeDocId(content: string | Uint8Array): string {
  return hashContent(content);
}

/**
 * 生成一个点 ID，格式为 `${docId}#${chunkIndex}`
 * @param docId - 文档 ID
 * @param chunkIndex - 文档的块索引
 * @returns 返回生成的点 ID
 * @throws 如果 docId 无效或chunkIndex 不是非负整数
 */
const SHA256_HEX_LEN = 64;
/**
 * SHA256十六进制正则表达式
 */
const HEX_RE = /^[0-9a-f]{64}$/;

/**
 * 生成点ID
 * 
 * @param docId - 文档ID
 * @param chunkIndex - 块索引
 * @returns 返回生成的点ID
 */
export function makePointId(docId: string, chunkIndex: number): string {
  if (!HEX_RE.test(docId)) throw new Error('makePointId: invalid docId');
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error('makePointId: invalid chunkIndex');
  }
  return `${docId}#${chunkIndex}`;
}

/**
 * 解析点ID，返回文档ID 和块索引
 * @param pointId - 要解析的点ID
 * @returns 返回包含文档 ID 和块索引的对象
 * @throws 如果 pointId 无效
 */
export function parsePointId(pointId: string): {
  docId: string;
  chunkIndex: number;
} {
  // 形如 <64位hex>#<非负整数>
  const [docId, idx] = (pointId ?? '').split('#');
  if (!HEX_RE.test(docId || ''))
    throw new Error('parsePointId: invalid pointId');
  const chunkIndex = Number(idx);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error('parsePointId: invalid pointId');
  }
  return { docId, chunkIndex };
}