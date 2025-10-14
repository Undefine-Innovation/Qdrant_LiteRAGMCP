export type EmbeddingMock = (
  input: string | string[],
  options?: { forceLive?: boolean },
) => Promise<number[] | number[][] | null> | number[] | number[][] | null;

let embeddingMock: EmbeddingMock | undefined;

export function setEmbeddingMock(fn?: EmbeddingMock) {
  embeddingMock = fn;
}

export function getEmbeddingMock(): EmbeddingMock | undefined {
  return embeddingMock;
}
