import { jest } from '@jest/globals';
import { validateConfig, AppConfig } from '../backend/src/config.js'; // Import validateConfig and AppConfig

describe('Config Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original process.env
    originalEnv = process.env;
    // Clear relevant environment variables for a clean test state
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.QDRANT_URL; // Use QDRANT_URL
    delete process.env.OPENAI_MODEL;
    delete process.env.EMBEDDING_DIM;
    delete process.env.EMBEDDING_BATCH_SIZE;
    delete process.env.DB_PATH;
    jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => { throw new Error(`Process exited with code ${code || 0}`); }); // Mock process.exit with correct type
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
    jest.restoreAllMocks(); // Restore process.exit mock
  });

  test('should validate a complete and valid configuration', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_DIM = '128';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    process.env.DB_PATH = './test-db.sqlite';

    expect(() => validateConfig()).not.toThrow();
  });

  test('should throw error if OPENAI_API_KEY is missing', () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_HOST = 'http://localhost:6333';
    process.env.QDRANT_API_KEY = 'test-qdrant-key';
    process.env.QDRANT_GRPC_PORT = '6334';
    process.env.DB_PATH = './test-db.sqlite';

    expect(() => validateConfig()).toThrow('validateConfig: Missing OPENAI_API_KEY');
  });

  test('should throw error if QDRANT_URL is missing', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.DB_PATH = './test-db.sqlite';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_DIM = '128';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    delete process.env.QDRANT_URL; // Ensure it's missing

    expect(() => validateConfig()).toThrow('validateConfig: Missing QDRANT_URL');
  });

  test('should throw error if DB_PATH is missing', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_DIM = '128';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    delete process.env.DB_PATH; // Ensure it's missing

    expect(() => validateConfig()).toThrow('validateConfig: Missing DB_PATH');
  });

  test('should not throw error if OPENAI_BASE_URL is missing but API_KEY is present', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DB_PATH = './test-db.sqlite';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_DIM = '128';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    delete process.env.OPENAI_BASE_URL; // Ensure it's missing

    expect(() => validateConfig()).not.toThrow();
  });

  test('should not throw error if OPENAI_MODEL is missing but API_KEY is present', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DB_PATH = './test-db.sqlite';
    process.env.EMBEDDING_DIM = '128';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    delete process.env.OPENAI_MODEL; // Ensure it's missing

    expect(() => validateConfig()).not.toThrow();
  });

  test('should not throw error if EMBEDDING_DIM is missing but API_KEY is present', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DB_PATH = './test-db.sqlite';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_BATCH_SIZE = '50';
    delete process.env.EMBEDDING_DIM; // Ensure it's missing

    expect(() => validateConfig()).not.toThrow();
  });

  test('should not throw error if EMBEDDING_BATCH_SIZE is missing but API_KEY is present', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DB_PATH = './test-db.sqlite';
    process.env.OPENAI_MODEL = 'test-model';
    process.env.EMBEDDING_DIM = '128';
    delete process.env.EMBEDDING_BATCH_SIZE; // Ensure it's missing

    expect(() => validateConfig()).not.toThrow();
  });

  test('should correctly load config values from environment variables', async () => {
    process.env.OPENAI_API_KEY = 'env-openai-key';
    process.env.OPENAI_BASE_URL = 'http://env-openai:1234/v1';
    process.env.OPENAI_MODEL = 'env-model';
    process.env.QDRANT_URL = 'http://env-qdrant:6333';
    process.env.EMBEDDING_DIM = '256';
    process.env.EMBEDDING_BATCH_SIZE = '200';
    process.env.DB_PATH = './env-test-db.sqlite';

    // Reload config after setting env vars
    jest.resetModules(); // Clear module cache
    const reloadedConfig = validateConfig(); // Call validateConfig directly

    expect(reloadedConfig.openai.apiKey).toBe('env-openai-key');
    expect(reloadedConfig.openai.baseUrl).toBe('http://env-openai:1234/v1');
    expect(reloadedConfig.openai.model).toBe('env-model');
    expect(reloadedConfig.qdrant.url).toBe('http://env-qdrant:6333');
    expect(reloadedConfig.qdrant.vectorSize).toBe(256);
    expect(reloadedConfig.embedding.batchSize).toBe(200);
    expect(reloadedConfig.db.path).toBe('./env-test-db.sqlite');
  });
});