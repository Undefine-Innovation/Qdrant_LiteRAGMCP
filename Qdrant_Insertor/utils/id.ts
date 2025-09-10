import { createHash, randomUUID } from 'node:crypto';

/** 内容哈希：仍可用于去重/校验，但不再作为 versionId */
export function hashContent(content: string | Uint8Array): string {
  const buf =
    typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : Buffer.from(content);
  return createHash('sha256').update(buf).digest('hex');
}

/** 生成集合ID（要求 Node.js ≥ 14.17 支持 crypto.randomUUID） */
export function makeCollectionId(): string {
  return randomUUID();
}

/** 生成版本ID（整批快照的批次ID） */
export function makeVersionId(): string {
  return randomUUID();
}

/** 生成文档ID（隶属于某个版本） */
export function makeDocId(content: string | Uint8Array): string {
  return hashContent(content);
}

/** 生成 pointId = `${docId}#${chunkIndex}` */
const SHA256_HEX_LEN = 64;
const HEX_RE = /^[0-9a-f]{64}$/;

export function makePointId(docId: string, chunkIndex: number): string {
  if (!HEX_RE.test(docId)) throw new Error("makePointId: invalid docId");
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("makePointId: invalid chunkIndex");
  }
  return `${docId}#${chunkIndex}`;
}

export function parsePointId(pointId: string): { docId: string; chunkIndex: number } {
  // 形如 <64位hex>#<非负整数>
  const [docId, idx] = (pointId ?? "").split("#");
  if (!HEX_RE.test(docId || "")) throw new Error("parsePointId: invalid pointId");
  const chunkIndex = Number(idx);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("parsePointId: invalid pointId");
  }
  return { docId, chunkIndex };
}
