// jest.setup.ts
beforeEach(() => {
  process.env = {
    ...process.env, // 保持其他值
    OPENAI_API_KEY: 'test-key',
    DB_PATH: './test.sqlite',
    QDRANT_URL: 'http://localhost:6333',
    EMBEDDING_DIM: '3', // Some default dimension
    QDRANT_COLLECTION: 'test_collection', // Default collection name
    EMBEDDING_BATCH_SIZE: '100', // Default batch size
  };
});
