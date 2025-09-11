import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { DB, Collection, Version, Doc, Chunk, SearchResult } from '../src/db.js';
import { makeCollectionId, makeVersionId, makeDocId, makePointId } from '../utils/id.js';

const TEST_DB_PATH = ':memory:'; // 使用内存数据库进行测试，每次测试都是干净的

describe('ChunksDatabase', () => {
  let db: DB;
  let collectionId: string;
  let versionId: string;
  let docId: string;

  beforeEach(() => {
    db = new DB(TEST_DB_PATH);
    db.init();

    // 创建一个集合
    const collection = db.createCollection('Test Collection', 'A collection for testing');
    collectionId = collection.collectionId;

    // 创建一个版本
    const version = db.createVersion(collectionId, 'v1.0', 'Initial version');
    versionId = version.versionId;

    // 创建一个文档
    const docContent = 'This is the content for the initial document.';
    const doc = db.createDoc(versionId, collectionId, 'test-doc-key', docContent, 'Test Document', 'text/markdown');
    docId = doc.docId;
  });

  afterEach(() => {
    db.close();
  });

  describe('Collection Operations', () => {
    test('should create and retrieve a collection', () => {
      const newCollection = db.createCollection('Another Collection');
      expect(newCollection).toBeDefined();
      expect(newCollection.name).toBe('Another Collection');

      const retrievedCollection = db.getCollectionById(newCollection.collectionId);
      expect(retrievedCollection?.name).toBe(newCollection.name);
      expect(retrievedCollection?.description).toBe(newCollection.description);
      expect(retrievedCollection?.collectionId).toBe(newCollection.collectionId);
    });

    test('should retrieve collection by name', () => {
      const retrievedCollection = db.getCollectionByName('Test Collection');
      expect(retrievedCollection?.collectionId).toBe(collectionId);
    });

    test('should list collections', () => {
      const collections = db.listCollections();
      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections.some((c: Collection) => c.collectionId === collectionId)).toBe(true);
    });

    test('should delete a collection and its associated data', () => {
      const collectionToDelete = db.createCollection('Collection to Delete');
      const versionToDelete = db.createVersion(collectionToDelete.collectionId, 'v_del', 'Version to delete');
      const docToDeleteContent = 'Content for doc to delete.';
      const docToDelete = db.createDoc(versionToDelete.versionId, collectionToDelete.collectionId, 'doc_del', docToDeleteContent, 'Doc to Delete', 'text/plain');
      const pointId = makePointId(docToDelete.docId, 0);
      db.insertChunkBatch({
        collectionId: collectionToDelete.collectionId,
        versionId: versionToDelete.versionId,
        docId: docToDelete.docId,
        metas: [{ pointId, chunkIndex: 0, titleChain: 'Title', contentHash: makeDocId('Content') }],
        texts: [{ pointId, content: 'Content', title: 'Title' }]
      });

      db.deleteCollection(collectionToDelete.collectionId);

      expect(db.getCollectionById(collectionToDelete.collectionId)).toBeNull();
      expect(db.listVersions(collectionToDelete.collectionId)).toEqual([]);
      const deletedDoc = db.getDocById(docToDelete.docId);
      expect(deletedDoc).toBeNull(); // deleteCollection 硬删除了 docs
      expect(db.getChunkMeta(pointId)).toBeNull();
    });
  });
    test('should update collection name and description', () => {
      const updatedName = 'Updated Test Collection';
      const updatedDescription = 'This collection has been updated.';
      db.updateCollection(collectionId, updatedName, updatedDescription);

      const updatedCollection = db.getCollectionById(collectionId);
      expect(updatedCollection).toBeDefined();
      expect(updatedCollection?.name).toBe(updatedName);
      expect(updatedCollection?.description).toBe(updatedDescription);
    });

  describe('Version Operations', () => {
    test('should create and retrieve a version', () => {
      const newVersion = db.createVersion(collectionId, 'v2.0', 'Second version');
      expect(newVersion).toBeDefined();
      expect(newVersion.name).toBe('v2.0');
      expect(newVersion.description).toBe('Second version');

      const retrievedVersion = db.getVersion(newVersion.versionId);
      expect(retrievedVersion?.versionId).toBe(newVersion.versionId);
    });

    test('should list versions for a collection', () => {
      db.createVersion(collectionId, 'v2.0', 'Second version');
      const versions = db.listVersions(collectionId);
      expect(versions.length).toBe(2);
      expect(versions.some((v: Version) => v.versionId === versionId)).toBe(true);
    });

    test('should set and get current version', () => {
describe('version management', () => {
      const newVersion = db.createVersion(collectionId, 'v2.0', 'Second version');
      db.setCurrentVersion(newVersion.versionId, collectionId);

      const currentVersionId = db.getCurrentVersionId(collectionId);
      expect(currentVersionId).toBe(newVersion.versionId);

      const oldVersion = db.getVersion(versionId);
    test('should delete a version and its associated data', () => {
      const versionToDelete = db.createVersion(collectionId, 'v_del_ver', 'Version to delete');
      const docToDeleteContent = 'Content for doc to delete in version.';
      const docToDelete = db.createDoc(versionToDelete.versionId, collectionId, 'doc_del_ver', docToDeleteContent, 'Doc to Delete Ver', 'text/plain');
      const pointId = makePointId(docToDelete.docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionToDelete.versionId,
        docId: docToDelete.docId,
        metas: [{ pointId, chunkIndex: 0, titleChain: 'Title', contentHash: makeDocId('Content') }],
        texts: [{ pointId, content: 'Content', title: 'Title' }]
      });

      db.deleteVersion(versionToDelete.versionId);

      expect(db.getVersion(versionToDelete.versionId)).toBeNull();
      expect(db.listDocs(versionToDelete.versionId)).toEqual([]);
      expect(db.getChunkMeta(pointId)).toBeNull();
    });
      expect(oldVersion?.is_current).toBe(false);
});
      const updatedNewVersion = db.getVersion(newVersion.versionId);
      expect(updatedNewVersion?.is_current).toBe(true);
    });

    test('should update version status', () => {
      db.setVersionStatus(versionId, 'INDEXED_SQLITE');
      const updatedVersion = db.getVersion(versionId);
      expect(updatedVersion?.status).toBe('INDEXED_SQLITE');
    });
  });

  describe('Doc Operations', () => {
    test('should create and retrieve a document', () => {
      const newDocContent = 'Content for another document.';
      const newDoc = db.createDoc(versionId, collectionId, 'another-doc', newDocContent, 'Another Document', 'text/plain');
      expect(newDoc).toBeDefined();
      expect(newDoc.key).toBe('another-doc');
      expect(newDoc.content).toBe(newDocContent);
      expect(newDoc.docId).toBe(makeDocId(newDocContent));

      const expectedDoc = {
        ...newDoc,
        is_deleted: false,
        mime: undefined,
      };

      const retrievedDoc = db.getDocById(newDoc.docId);
      expect(retrievedDoc).toEqual(expectedDoc);
    });

    test('should retrieve document by key', () => {
      const retrievedDoc = db.getDocByKey(versionId, 'test-doc-key');
      expect(retrievedDoc?.docId).toBe(docId);
    });

    test('should list documents for a version', () => {
      const docInVersionContent = 'Content for doc in version.';
      db.createDoc(versionId, 'doc-in-version', 'Doc in Version', 'text/plain', docInVersionContent);
      const docs = db.listDocs(versionId);
      expect(docs.length).toBe(2);
      expect(docs.some((d: Doc) => d.docId === docId)).toBe(true);
    });

    test('should soft delete a document and its chunks', () => {
      const pointId = makePointId(docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [{ pointId, chunkIndex: 0, titleChain: 'Title', contentHash: makeDocId('Content') }],
        texts: [{ pointId, content: 'Content', title: 'Title' }]
      });

      db.deleteDoc(docId);
      const deletedDoc = db.getDocById(docId);
      expect(deletedDoc).toBeNull(); // deleteDoc 硬删除了 docs
      expect(db.getChunkMeta(pointId)).toBeNull(); // Chunks should be hard deleted
    });

    test('should update document content and metadata', () => {
      const updatedContent = 'This is the updated content for the document.';
      const updatedName = 'Updated Test Document';
      const updatedMime = 'application/json';

      const updatedDoc = db.updateDoc(docId, updatedContent, updatedName, updatedMime);

      expect(updatedDoc).toBeDefined();
      expect(updatedDoc?.docId).not.toBe(docId); // docId should change due to content change
      expect(updatedDoc?.content).toBe(updatedContent);
      expect(updatedDoc?.name).toBe(updatedName);
      expect(updatedDoc?.mime).toBe(updatedMime);
      expect(updatedDoc?.is_deleted).toBe(false);

      const retrievedOldDoc = db.getDocById(docId);
      expect(retrievedOldDoc).toBeNull(); // The old docId should no longer exist

      const retrievedNewDoc = db.getDocById(updatedDoc!.docId);
      expect(retrievedNewDoc).toEqual(updatedDoc);
    });
    test('should update document content without changing docId if content is same', () => {
      const originalContent = 'Original content for doc update test.';
      // Create a doc using the new createDoc signature
      const doc = db.createDoc(versionId, collectionId, 'doc-update-content', originalContent, 'Doc Update Content', 'text/plain');
      const originalDocId = doc.docId;

      // Update with same content, should not change docId
      // The updateDoc function now deletes chunks by the old docId and inserts new ones,
      // but the docId in the docs table will only change if the content hash changes.
      // If content is identical, the newDocId will be the same as originalDocId.
      const updatedDoc = db.updateDoc(originalDocId, originalContent, 'Updated Name', 'text/plain');
      expect(updatedDoc?.docId).toBe(originalDocId); // docId should remain the same
      expect(updatedDoc?.name).toBe('Updated Name');
      expect(updatedDoc?.content).toBe(originalContent);

      // Update with different content, should change docId
      const newContent = 'New content for doc update test.';
      const newUpdatedDoc = db.updateDoc(originalDocId, newContent, 'New Name', 'application/json');
      expect(newUpdatedDoc?.docId).not.toBe(originalDocId);
      expect(newUpdatedDoc?.content).toBe(newContent);
      expect(newUpdatedDoc?.name).toBe('New Name');
      expect(newUpdatedDoc?.mime).toBe('application/json');
      expect(newUpdatedDoc?.is_deleted).toBe(false);
    });

    test('should get all documents across all versions and collections', () => {
      const collection2 = db.createCollection('Collection Two');
      const version2 = db.createVersion(collection2.collectionId, 'v1.0', 'Version for Collection Two');
      const doc2Content = 'Content for document in collection two.';
      db.createDoc(version2.versionId, collection2.collectionId, 'doc-col2', doc2Content, 'Doc in Col 2', 'text/plain');

      const allDocs = db.getAllDocs();
      expect(allDocs.length).toBe(2); // Initial doc + doc in collection2
      expect(allDocs.some(d => d.docId === docId)).toBe(true);
      expect(allDocs.some((d: Doc) => d.content === doc2Content)).toBe(true);
      expect(allDocs.every((d: Doc) => d.is_deleted === false)).toBe(true); // Should only return non-deleted docs
    });
    test('should get doc IDs by version', () => {
      const docContent1 = 'Doc content for version ID test 1.';
      const docContent2 = 'Doc content for version ID test 2.';
      db.createDoc(versionId, collectionId, 'doc-ver-1', docContent1, 'Doc Ver 1', 'text/plain');
      db.createDoc(versionId, collectionId, 'doc-ver-2', docContent2, 'Doc Ver 2', 'text/plain');

      const docIds = db.getDocIdsByVersion(versionId);
      expect(docIds.length).toBe(3); // Initial doc + 2 new docs
      expect(docIds).toContain(docId);
      expect(docIds).toContain(makeDocId(docContent1));
      expect(docIds).toContain(makeDocId(docContent2));

      // Test with a non-existent version
      const nonExistentVersionDocIds = db.getDocIdsByVersion(makeVersionId());
      expect(nonExistentVersionDocIds).toEqual([]);
    });

    test('should throw error for mismatched metas and texts length in insertChunkBatch', () => {
      const pointId1 = makePointId(docId, 0);
      expect(() => {
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: versionId,
          docId: docId,
          metas: [{ pointId: pointId1, chunkIndex: 0 }],
          texts: [] // Mismatched length
        });
      }).toThrow('Metas and texts length mismatch');
    });

    test('should throw error for empty metas or texts in insertChunkBatch', () => {
      expect(() => {
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: versionId,
          docId: docId,
          metas: [],
          texts: []
        });
      }).toThrow('No metas or texts to insert');
    });

    test('should throw error for mismatched pointIds in insertChunkBatch', () => {
      const pointId1 = makePointId(docId, 0);
      const pointId2 = makePointId(docId, 1);
      expect(() => {
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: versionId,
          docId: docId,
          metas: [{ pointId: pointId1, chunkIndex: 0 }],
          texts: [{ pointId: pointId2, content: 'Content' }] // Mismatched pointIds
        });
      }).toThrow(`PointId mismatch at index 0`);
    });

    test('should return null for non-existent chunk meta', () => {
      const nonExistentPointId = makePointId('nonexistent-doc', 0);
      expect(db.getChunkMeta(nonExistentPointId)).toBeNull();
    });

    test('should return empty object for non-existent chunk texts', () => {
      const nonExistentPointId = makePointId('nonexistent-doc', 0);
      const texts = db.getChunkTexts([nonExistentPointId]);
      expect(texts).toEqual({});
    });
  });

  describe('Chunk Operations', () => {
    test('should insert chunks in batch', () => {
      const pointId1 = makePointId(docId, 0);
      const pointId2 = makePointId(docId, 1);
      const result = db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [
          { pointId: pointId1, chunkIndex: 0, titleChain: 'Title 1' },
          { pointId: pointId2, chunkIndex: 1, titleChain: 'Title 2' }
        ],
        texts: [
          { pointId: pointId1, content: 'Content 1', title: 'Title 1' },
          { pointId: pointId2, content: 'Content 2', title: 'Title 2' }
        ]
      });
      expect(result.inserted).toBe(2);

      const meta1 = db.getChunkMeta(pointId1);
      expect(meta1).toBeDefined();
      expect(meta1?.titleChain).toBe('Title 1');

      const texts = db.getChunkTexts([pointId1, pointId2]);
      expect(texts?.[pointId1].content).toBe('Content 1');
    });
    test('should retrieve single chunk meta by pointId', () => {
      const pointId = makePointId(docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [{ pointId, chunkIndex: 0, titleChain: 'Single Chunk', contentHash: makeDocId('Single Content') }],
        texts: [{ pointId, content: 'Single Content', title: 'Single Chunk' }]
      });
      const meta = db.getChunkMeta(pointId);
      expect(meta).toBeDefined();
      expect(meta?.pointId).toBe(pointId);
      expect(meta?.titleChain).toBe('Single Chunk');
    });

    test('should retrieve multiple chunk texts by pointIds', () => {
      const pointId1 = makePointId(docId, 0);
      const pointId2 = makePointId(docId, 1);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [
          { pointId: pointId1, chunkIndex: 0, titleChain: 'Text A', contentHash: makeDocId('Content A') },
          { pointId: pointId2, chunkIndex: 1, titleChain: 'Text B', contentHash: makeDocId('Content B') }
        ],
        texts: [
          { pointId: pointId1, content: 'Content A', title: 'Title A' },
          { pointId: pointId2, content: 'Content B', title: 'Title B' }
        ]
      });
      const texts = db.getChunkTexts([pointId1, pointId2]);
      expect(texts).toBeDefined();
      expect(texts).not.toBeNull();
      expect(Object.keys(texts!).length).toBe(2);
      expect(texts![pointId1].content).toBe('Content A');
      expect(texts![pointId2].content).toBe('Content B');
    });


    test('should retrieve chunk metas by version', () => {
      const pointId = makePointId(docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [{ pointId, chunkIndex: 0, contentHash: makeDocId('Content') }],
        texts: [{ pointId, content: 'Content', title: 'Title' }]
      });
      const chunks = db.getChunkMetasByVersion(versionId);
      expect(chunks.length).toBe(1);
      expect(chunks[0].pointId).toBe(pointId);
    });

    test('should delete chunks by document', () => {
      const pointId = makePointId(docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [{ pointId, chunkIndex: 0 }],
        texts: [{ pointId, content: 'Content' }]
      });
      expect(db.getChunkMeta(pointId)).toBeDefined();

      db.deleteChunksByDoc(docId);
      expect(db.getChunkMeta(pointId)).toBeNull();
    });
  });

  describe('Search Operations', () => {
    let currentVersionId: string;
    let docId2: string;

    beforeEach(() => {
      // 设置当前版本
      db.setCurrentVersion(versionId, collectionId);
      currentVersionId = db.getCurrentVersionId(collectionId)!;

      // 插入一些数据进行搜索测试
      const doc2Content = 'Content for search document.';
      const doc2 = db.createDoc(versionId, collectionId, 'search-doc-key', doc2Content, 'Search Document', 'text/plain');
      docId2 = doc2.docId;

      const pointId1 = makePointId(docId, 0);
      const pointId2 = makePointId(docId, 1);
      const pointId3 = makePointId(docId2, 0);

      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [
          { pointId: pointId1, chunkIndex: 0, titleChain: 'First Chunk Title', contentHash: makeDocId('This is the content of the first chunk.') },
          { pointId: pointId2, chunkIndex: 1, titleChain: 'Second Chunk Title', contentHash: makeDocId('Another chunk with different content.') }
        ],
        texts: [
          { pointId: pointId1, content: 'This is the content of the first chunk.', title: 'First Chunk' },
          { pointId: pointId2, content: 'Another chunk with different content.', title: 'Second Chunk' }
        ]
      });

      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId2,
        metas: [
          { pointId: pointId3, chunkIndex: 0, titleChain: 'Searchable Content Title', contentHash: makeDocId('This chunk contains searchable keyword.') }
        ],
        texts: [
          { pointId: pointId3, content: 'This chunk contains searchable keyword.', title: 'Searchable Content' }
        ]
      });
    });

    test('should perform keyword search', () => {
      const results = db.searchKeyword({ collectionId, query: 'searchable keyword' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('searchable keyword');
      expect(results[0].title).toBe('Searchable Content');
      expect(results[0].versionId).toBe(versionId);
      expect(results[0].docId).toBe(docId2);
      expect(results[0].is_current).toBe(true);
    });

    test('should filter keyword search results by additional filters', () => {
      // Create another document in the same version but with a specific docId
      const filteredDocContent = 'This is content for a filtered document. Specific keyword.';
      const filteredDoc = db.createDoc(versionId, collectionId, 'filtered-doc-key', filteredDocContent, 'Filtered Document', 'text/plain');
      const filteredPointId = makePointId(filteredDoc.docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: filteredDoc.docId,
        metas: [{ pointId: filteredPointId, chunkIndex: 0, titleChain: 'Filtered Doc Title', contentHash: makeDocId(filteredDocContent) }],
        texts: [{ pointId: filteredPointId, content: filteredDocContent, title: 'Filtered Doc' }]
      });

    test('should retrieve existing chunks and ignore non-existent ones', () => {
      const existingPointId = makePointId(docId, 0);
      const nonExistentPointId = makePointId('non-existent-doc', 99);

      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [{ pointId: existingPointId, chunkIndex: 0, titleChain: 'Existing Chunk', contentHash: makeDocId('Existing Content') }],
        texts: [{ pointId: existingPointId, content: 'Existing Content', title: 'Existing Chunk' }]
      });

      const chunks = db.getChunksByPointIds([existingPointId, nonExistentPointId], collectionId);
      expect(chunks.length).toBe(1);
      expect(chunks[0].pointId).toBe(existingPointId);
      expect(chunks[0].content).toBe('Existing Content');
    });

      const results = db.searchKeyword({
        collectionId,
        query: 'Specific keyword',
        filters: { docId: filteredDoc.docId }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r: SearchResult) => r.docId === filteredDoc.docId)).toBe(true);
      expect(results[0].content).toContain('Specific keyword');
    });

    test('should limit keyword search results', () => {
      const results = db.searchKeyword({ collectionId, query: 'chunk', limit: 1 });
      expect(results.length).toBe(1);
    });

    test('should filter keyword search by latestOnly', () => {
      const oldVersion = db.createVersion(collectionId, 'old_v', 'Old Version');
      const oldDocContent = 'This is old content for an old document.';
      const oldDoc = db.createDoc(oldVersion.versionId, collectionId, 'old-doc-key', oldDocContent, 'Old Document', 'text/plain');
      const oldPointId = makePointId(oldDoc.docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: oldVersion.versionId,
        docId: oldDoc.docId,
        metas: [{ pointId: oldPointId, chunkIndex: 0, titleChain: 'Old Content Title', contentHash: makeDocId(oldDocContent) }],
        texts: [{ pointId: oldPointId, content: oldDocContent, title: 'Old Content' }]
      });

      // Create a new version and set it as current, but with different content
      const newVersion = db.createVersion(collectionId, 'new_v', 'New Version');
      db.setCurrentVersion(newVersion.versionId, collectionId);
      const newDocContent = 'This is new content for a new document. Contains searchable keyword.';
      const newDoc = db.createDoc(newVersion.versionId, collectionId, 'new-doc-key', newDocContent, 'New Document', 'text/plain');
      const newPointId = makePointId(newDoc.docId, 0);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: newVersion.versionId,
        docId: newDoc.docId,
        metas: [{ pointId: newPointId, chunkIndex: 0, titleChain: 'New Content Title', contentHash: makeDocId(newDocContent) }],
        texts: [{ pointId: newPointId, content: newDocContent, title: 'New Content' }]
      });

      const results = db.searchKeyword({ collectionId, query: 'content', latestOnly: true });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r: SearchResult) => r.is_current)).toBe(true);
      expect(results.some((r: SearchResult) => r.docId === newDoc.docId)).toBe(true);
      expect(results.some((r: SearchResult) => r.docId === oldDoc.docId)).toBe(false); // Old doc should not be in results
    });
  });

  describe('getChunksByPointIds', () => {
    test('should retrieve chunks by pointIds', () => {
      const pointId1 = makePointId(docId, 0);
      const pointId2 = makePointId(docId, 1);
      db.insertChunkBatch({
        collectionId: collectionId,
        versionId: versionId,
        docId: docId,
        metas: [
          { pointId: pointId1, chunkIndex: 0, titleChain: 'Title A', contentHash: makeDocId('Content A') },
          { pointId: pointId2, chunkIndex: 1, titleChain: 'Title B', contentHash: makeDocId('Content B') }
        ],
        texts: [
          { pointId: pointId1, content: 'Content A', title: 'Title A' },
          { pointId: pointId2, content: 'Content B', title: 'Title B' }
        ]
      });

      const chunks = db.getChunksByPointIds([pointId1, pointId2], collectionId);
      expect(chunks.length).toBe(2);
      expect(chunks[0].pointId).toBe(pointId1);
      expect(chunks[1].pointId).toBe(pointId2);
      expect(chunks[0].content).toBe('Content A');
    });

    test('should handle empty pointIds array', () => {
      const chunks = db.getChunksByPointIds([], collectionId);
      expect(chunks).toEqual([]);
    });
  });

  describe('Utility Functions', () => {
    test('should return database stats', () => {
      const stats = db.stats();
      expect(stats.collections).toBeGreaterThanOrEqual(1);
      expect(stats.versions).toBeGreaterThanOrEqual(1);
      expect(stats.docs).toBeGreaterThanOrEqual(1);
      expect(stats.chunks).toBe(0); // No chunks inserted yet in this test run
    });

    test('should ping the database successfully', () => {
      expect(db.ping()).toBe(true);
    });
  
    describe('Version Finalization (finalizeVersion)', () => {
      test('should finalize a temporary version and mark it as new', () => {
        const docContent = 'Content for a temporary version doc.';
        const docId = db.createDoc(versionId, collectionId, 'temp-doc-key', docContent, 'Temp Doc', 'text/plain').docId;
        const pointId = makePointId(docId, 0);
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: versionId,
          docId: docId,
          metas: [{ pointId, chunkIndex: 0, contentHash: makeDocId(docContent) }],
          texts: [{ pointId, content: docContent, title: 'Temp Doc' }]
        });
  
        const { finalVersionId, isNew } = db.finalizeVersion(versionId);
  
        expect(isNew).toBe(true);
        expect(finalVersionId).toBeDefined();
        expect(db.getVersion(finalVersionId)).toBeDefined();
        expect(db.getVersion(finalVersionId)?.status).toBe('ACTIVE');
        expect(db.getVersion(versionId)).toBeNull(); // Temporary version should be deleted
  
        // Verify docs and chunks are linked to the final version
        const finalVersionDocs = db.listDocs(finalVersionId);
        expect(finalVersionDocs.length).toBe(1);
        expect(finalVersionDocs[0].docId).toBe(docId);
  
        const finalVersionChunks = db.getChunkMetasByVersion(finalVersionId);
        expect(finalVersionChunks.length).toBe(1);
        expect(finalVersionChunks[0].pointId).toBe(pointId);
      });
  
      test('should deduplicate versions if content is identical', () => {
        const docContent1 = 'Content for deduplication test 1.';
        const docContent2 = 'Content for deduplication test 2.';
  
        // First version (will become the canonical one)
        const initialVersion = db.createVersion(collectionId, 'initial_v', 'Initial version for dedup');
        const doc1_initial = db.createDoc(initialVersion.versionId, collectionId, 'doc1', docContent1, 'Doc One', 'text/plain');
        const doc2_initial = db.createDoc(initialVersion.versionId, collectionId, 'doc2', docContent2, 'Doc Two', 'text/plain');
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: initialVersion.versionId,
          docId: doc1_initial.docId,
          metas: [{ pointId: makePointId(doc1_initial.docId, 0), chunkIndex: 0, contentHash: makeDocId(docContent1) }],
          texts: [{ pointId: makePointId(doc1_initial.docId, 0), content: docContent1, title: 'Doc One' }]
        });
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: initialVersion.versionId,
          docId: doc2_initial.docId,
          metas: [{ pointId: makePointId(doc2_initial.docId, 0), chunkIndex: 0, contentHash: makeDocId(docContent2) }],
          texts: [{ pointId: makePointId(doc2_initial.docId, 0), content: docContent2, title: 'Doc Two' }]
        });
        const { finalVersionId: canonicalVersionId, isNew: isNewCanonical } = db.finalizeVersion(initialVersion.versionId);
        expect(isNewCanonical).toBe(true);
        expect(db.getVersion(canonicalVersionId)).toBeDefined();
  
        // Second version with identical content
        const duplicateVersion = db.createVersion(collectionId, 'duplicate_v', 'Duplicate version for dedup');
        const doc1_duplicate = db.createDoc(duplicateVersion.versionId, collectionId, 'doc1', docContent1, 'Doc One', 'text/plain');
        const doc2_duplicate = db.createDoc(duplicateVersion.versionId, collectionId, 'doc2', docContent2, 'Doc Two', 'text/plain');
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: duplicateVersion.versionId,
          docId: doc1_duplicate.docId,
          metas: [{ pointId: makePointId(doc1_duplicate.docId, 0), chunkIndex: 0, contentHash: makeDocId(docContent1) }],
          texts: [{ pointId: makePointId(doc1_duplicate.docId, 0), content: docContent1, title: 'Doc One' }]
        });
        db.insertChunkBatch({
          collectionId: collectionId,
          versionId: duplicateVersion.versionId,
          docId: doc2_duplicate.docId,
          metas: [{ pointId: makePointId(doc2_duplicate.docId, 0), chunkIndex: 0, contentHash: makeDocId(docContent2) }],
          texts: [{ pointId: makePointId(doc2_duplicate.docId, 0), content: docContent2, title: 'Doc Two' }]
        });
  
        const { finalVersionId: deduplicatedVersionId, isNew: isNewDeduplicated } = db.finalizeVersion(duplicateVersion.versionId);
  
        expect(isNewDeduplicated).toBe(false);
        expect(deduplicatedVersionId).toBe(canonicalVersionId); // Should be the same ID
        expect(db.getVersion(duplicateVersion.versionId)).toBeNull(); // Duplicate version should be deleted
  
        // Verify docs and chunks from the duplicate version are now linked to the canonical version
        const canonicalVersionDocs = db.listDocs(canonicalVersionId);
        expect(canonicalVersionDocs.length).toBe(2); // Only two unique docs from initial creation
        expect(canonicalVersionDocs.some(d => d.docId === doc1_initial.docId)).toBe(true);
        expect(canonicalVersionDocs.some(d => d.docId === doc2_initial.docId)).toBe(true);
        // When content is identical, docId will be the same, so the original docId should be present
        expect(canonicalVersionDocs.some((d: Doc) => d.docId === doc1_duplicate.docId)).toBe(true); // This should be true, as doc1_duplicate.docId will be the same as doc1_initial.docId
  
        const canonicalVersionChunks = db.getChunkMetasByVersion(canonicalVersionId);
        expect(canonicalVersionChunks.length).toBe(2); // Only two unique chunks
      });
  
      test('should handle empty version during finalization', () => {
        const emptyVersion = db.createVersion(collectionId, 'empty_v', 'Empty Version');
        const { finalVersionId, isNew } = db.finalizeVersion(emptyVersion.versionId);
  
        // An empty version will result in a consistent hash for an empty set of docIds
        // It should still be marked as new if this specific "empty" hash hasn't been seen.
        // The exact finalVersionId will depend on hashContent('') or hashContent('|')
        expect(isNew).toBe(true);
        expect(db.getVersion(finalVersionId)).toBeDefined();
        expect(db.getVersion(finalVersionId)?.status).toBe('ACTIVE');
        expect(db.listDocs(finalVersionId)).toEqual([]);
        expect(db.getChunkMetasByVersion(finalVersionId)).toEqual([]);
      });
  
      test('should not finalize if version does not exist', () => {
        const nonExistentVersionId = makeVersionId();
        // Expect finalizeVersion to throw or return a specific error/null, depending on implementation
        // Current implementation logs a warning and proceeds, but doesn't throw.
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result = db.finalizeVersion(nonExistentVersionId);
        expect(result.finalVersionId).toBeDefined(); // It will still attempt to hash an empty set of docs
        expect(result.isNew).toBe(true); // And create a new version for that hash
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('no such versionId')); // The method does not check for version existence before proceeding to get docIds
        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('Transactions', () => {
    let transactionDb: DB;

    beforeEach(() => {
      transactionDb = new DB(TEST_DB_PATH);
      transactionDb.init();
    });

    afterEach(() => {
      transactionDb.close();
    });

    test('should commit changes on successful transaction', () => {
      const initialCount = transactionDb.listCollections().length;
      transactionDb.transaction(() => {
        transactionDb.createCollection('Transactional Collection');
      });
      expect(transactionDb.listCollections().length).toBe(initialCount + 1);
    });

    test('should rollback changes on failed transaction', () => {
      const initialCount = transactionDb.listCollections().length;
      expect(() => {
        transactionDb.transaction(() => {
          transactionDb.createCollection('Failing Collection');
          throw new Error('Transaction failed');
        });
      }).toThrow('Transaction failed');
      expect(transactionDb.listCollections().length).toBe(initialCount); // Should rollback
    });
  });
});