import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../test-data-factory.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { sanitizeInput, validateCollectionRequest } from './request-utils.js';

describe('Validation & API Safety', () => {
  let dataSource: DataSource;
  let testCollection: Collection;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    testCollection = await dataSource.getRepository(Collection).save(
      TestDataFactory.createCollection({
        name: `Validation Test Collection ${Date.now()}`,
      }),
    );
  });

  describe('Entity validation rules', () => {
    it('rejects blank or oversized collection names', async () => {
      const collectionRepository = dataSource.getRepository(Collection);
      const invalidCollections = [
        TestDataFactory.createCollection({ name: '' }),
        TestDataFactory.createCollection({ name: 'a'.repeat(300) }),
      ];

      for (const collection of invalidCollections) {
        await expect(collectionRepository.save(collection)).rejects.toThrow();
      }
    });

    it('trims collection names before persisting', async () => {
      const collectionRepository = dataSource.getRepository(Collection);
      const saved = await collectionRepository.save(
        TestDataFactory.createCollection({
          name: '  spaced name  ',
        }),
      );

      expect(saved.name).toBe('spaced name');
    });

    it('calculates chunk content length on save', async () => {
      const chunkRepository = dataSource.getRepository(Chunk);
      const chunk = TestDataFactory.createChunk({
        docId: 'doc-validation' as DocId,
        collectionId: testCollection.collectionId as CollectionId,
        content: 'chunk payload',
      });

      const saved = await chunkRepository.save(chunk);
      expect(saved.contentLength).toBe('chunk payload'.length);
    });
  });

  describe('Request validation helpers', () => {
    it('flags malformed requests', () => {
      const invalidRequests = [
        { name: null },
        { name: undefined },
        { name: 123 },
        {},
      ];

      for (const request of invalidRequests) {
        const result = validateCollectionRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.errors).toBeDefined();
      }
    });

    it('rejects oversized descriptions', () => {
      const result = validateCollectionRequest({
        name: 'Test Collection',
        description: 'x'.repeat(1_000_001),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request body too large');
    });
  });

  describe('Input sanitization', () => {
    it('removes malicious payloads', () => {
      const sanitized = sanitizeInput({
        name: '<script>alert("xss")</script>',
        description: '"; DROP TABLE collections; --',
      });

      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.description).not.toContain('"');
      expect(sanitized.description).not.toContain(';');
      expect(sanitized.description).not.toContain('--');
    });

    it('preserves valid payloads', () => {
      const payload = {
        name: 'Safe Collection',
        description: 'Plain text description',
      };

      const sanitized = sanitizeInput(payload);
      expect(sanitized).toEqual(payload);
    });
  });
});
