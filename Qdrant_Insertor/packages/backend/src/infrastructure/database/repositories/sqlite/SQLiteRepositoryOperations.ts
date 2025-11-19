import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  CollectionRepository,
  DocRepository,
  ChunkRepository,
  ChunkMetaRepository,
} from '../index.js';
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
  DocumentChunk,
  ChunkMeta as ChunkMetaType,
  PaginationQuery,
  PaginatedResponse,
  Doc as DomainDoc,
} from '@domain/entities/types.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

export class SQLiteRepositoryOperations {
  constructor(
    private readonly dataSource: DataSource,
    private readonly collectionRepository: CollectionRepository,
    private readonly docRepository: DocRepository,
    private readonly chunkRepository: ChunkRepository,
    private readonly chunkMetaRepository: ChunkMetaRepository,
    private readonly logger: Logger,
    private readonly qdrantRepo?: IQdrantRepo,
  ) {}

  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.dataSource.transaction(async () => {
      await this.chunkRepository.deleteByCollectionId(collectionId);

      const docs = await this.docRepository.findByCollectionId(collectionId);
      for (const doc of docs) {
        await this.docRepository.delete({ id: doc.id as string });
      }

      await this.collectionRepository.delete({ id: collectionId as string });

      this.logger.info(`删除集合成功`, { collectionId });
    });
  }

  async deleteDoc(docId: DocId): Promise<boolean> {
    return await this.dataSource.transaction(async () => {
      await this.chunkRepository.deleteByDocId(docId);

      const success = await this.docRepository.delete({ id: docId as string });

      if (success !== undefined) {
        this.logger.info(`删除文档成功`, { docId });
      }

      return success !== undefined;
    });
  }

  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    const chunks = await this.chunkRepository.findByPointIds(pointIds);

    return chunks.map((chunk) => ({
      pointId: chunk.pointId as PointId,
      docId: chunk.docId as DocId,
      collectionId: chunk.collectionId as CollectionId,
      chunkIndex: chunk.chunkIndex,
      title: chunk.title,
      content: chunk.content,
      score: 0,
    }));
  }

  async getDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    const chunks = await this.chunkRepository.findByDocId(docId);

    return chunks.map((chunk) => ({
      pointId: chunk.pointId as PointId,
      docId: chunk.docId as DocId,
      collectionId: chunk.collectionId as CollectionId,
      chunkIndex: chunk.chunkIndex,
      title: chunk.title,
      content: chunk.content,
    }));
  }

  async getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<
    PaginatedResponse<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    const chunks = await this.chunkRepository.findByDocId(docId);

    const { page = 1, limit = 10 } = query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedChunks = chunks.slice(startIndex, endIndex);

    const totalPages = Math.ceil(chunks.length / limit);

    return {
      data: paginatedChunks.map((chunk) => ({
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
      })),
      pagination: {
        page,
        limit,
        total: chunks.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    const doc = await this.docRepository.findById(docId as unknown as string);
    if (doc) {
      return {
        id: doc.key as DocId,
        docId: doc.key as DocId,
        collectionId: doc.collectionId as CollectionId,
        key: doc.key,
        name: doc.name,
        size_bytes: doc.size_bytes,
        mime: doc.mime,
        created_at:
          typeof doc.created_at === 'number'
            ? doc.created_at
            : (doc.created_at as Date)?.getTime?.() || Date.now(),
        updated_at:
          typeof doc.updated_at === 'number'
            ? doc.updated_at
            : (doc.updated_at as Date)?.getTime?.() || Date.now(),
        deleted: doc.deleted,
        content: doc.content,
      } as DomainDoc;
    }
    return undefined;
  }

  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMetaType[]> {
    const chunkMetas = await this.chunkMetaRepository.findByDocId(docId);
    return chunkMetas.map(
      (meta) =>
        ({
          id: meta.id as DocId,
          docId: meta.docId as DocId,
          chunkIndex: meta.chunkIndex,
          tokenCount: meta.tokenCount,
          embeddingStatus: meta.embeddingStatus as
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed',
          syncedAt: meta.syncedAt,
          error: meta.error,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          pointId: meta.pointId as PointId,
          collectionId: meta.collectionId as CollectionId,
        }) as ChunkMetaType,
    );
  }

  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMetaType[]> {
    const chunkMetas =
      await this.chunkMetaRepository.findByCollectionId(collectionId);

    return chunkMetas.map(
      (meta) =>
        ({
          id: meta.id as DocId,
          docId: meta.docId as DocId,
          chunkIndex: meta.chunkIndex,
          tokenCount: meta.tokenCount,
          embeddingStatus: meta.embeddingStatus as
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed',
          syncedAt: meta.syncedAt,
          error: meta.error,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          pointId: meta.pointId as PointId,
          collectionId: meta.collectionId as CollectionId,
        }) as ChunkMetaType,
    );
  }

  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    const chunks = await this.chunkRepository.findByPointIds(pointIds);

    const result: Record<string, { content: string }> = {};
    for (const chunk of chunks) {
      result[chunk.pointId] = {
        content: chunk.content,
      };
    }

    return result;
  }

  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    await this.dataSource.transaction(async () => {
      const chunks = documentChunks.map((chunk, index) => ({
        pointId: `${docId}_${index}` as PointId,
        docId,
        collectionId: '' as CollectionId,
        chunkIndex: index,
        title: chunk.titleChain?.join(' > ') || '',
        content: chunk.content,
      }));

      await this.chunkRepository.createBatch(chunks);

      this.logger.debug(`添加文档块成功`, {
        docId,
        count: chunks.length,
      });
    });
  }

  async markDocAsSynced(docId: DocId): Promise<void> {
    this.logger.debug(`标记文档为已同步`, { docId });
  }

  async getAllCollectionIds(): Promise<CollectionId[]> {
    const collections = await this.collectionRepository.findAll();
    return collections.map(
      (collection: unknown) =>
        (collection as { id: string }).id as CollectionId,
    );
  }

  async listDeletedDocs(): Promise<DomainDoc[]> {
    const docs = await this.docRepository.findDeleted();

    return docs.map(
      (doc) =>
        ({
          id: doc.key as DocId,
          docId: doc.key as DocId,
          collectionId: doc.collectionId as CollectionId,
          key: doc.key,
          name: doc.name,
          size_bytes: doc.size_bytes,
          mime: doc.mime,
          created_at:
            typeof doc.created_at === 'number'
              ? doc.created_at
              : (doc.created_at as Date)?.getTime?.() || Date.now(),
          updated_at:
            typeof doc.updated_at === 'number'
              ? doc.updated_at
              : (doc.updated_at as Date)?.getTime?.() || Date.now(),
          deleted: doc.deleted,
          content: doc.content,
        }) as DomainDoc,
    );
  }

  async hardDelete(docId: DocId): Promise<void> {
    await this.docRepository.delete({ id: docId as string });
    this.logger.debug(`硬删除文档成功`, { docId });
  }

  async deleteBatch(pointIds: PointId[]): Promise<void> {
    await this.chunkRepository.deleteByPointIds(pointIds);
    this.logger.debug(`批量删除块成功`, { count: pointIds.length });
  }
}
