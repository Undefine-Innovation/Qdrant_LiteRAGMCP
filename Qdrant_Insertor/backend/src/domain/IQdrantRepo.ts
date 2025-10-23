import { Schemas } from '@qdrant/js-client-rest';
import { SearchResult, CollectionId, PointId, DocId } from '@domain/types.js';

export interface Point {
  id: PointId;
  vector: number[];
  payload: {
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    content: string;
    contentHash?: string;
    titleChain?: string;
  };
}

export interface IQdrantRepo {
  ensureCollection(collectionId: CollectionId): Promise<void>;
  upsertCollection(collectionId: CollectionId, points: Point[]): Promise<void>;
  search(
    collectionId: CollectionId,
    opts: {
      vector: number[];
      limit?: number;
      filter?: Schemas['Filter'];
    },
  ): Promise<SearchResult[]>;
  deletePointsByDoc(docId: DocId): Promise<void>;
  deletePointsByCollection(collectionId: CollectionId): Promise<void>;
  getAllPointIdsInCollection(collectionId: CollectionId): Promise<PointId[]>;
  deletePoints(collectionId: CollectionId, pointIds: PointId[]): Promise<void>;
}
