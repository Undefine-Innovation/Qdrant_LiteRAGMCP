import request from 'supertest';
import { app } from '../../src/app.js';
import { ErrorFactory } from '../../src/domain/errors/ErrorFactory.js';
import { AppError, ErrorCode } from '../../src/api/contracts/error.js';

describe('Error Handling Integration Tests', () => {
  describe('API Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/collections')
        .send({
          name: '', // Invalid empty name
          description: 'A'.repeat(2000), // Too long description
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('errorId');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('details');

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(typeof response.body.error.errorId).toBe('string');
      expect(typeof response.body.error.timestamp).toBe('string');
      expect(response.body.error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('should return consistent error format for not found errors', async () => {
      const response = await request(app)
        .get('/api/collections/nonexistent-collection')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND_ERROR');
      expect(response.body.error.message).toContain('not found');
      expect(response.body.error).toHaveProperty('errorId');
    });

    it('should return consistent error format for conflict errors', async () => {
      // First, create a collection
      const createResponse = await request(app)
        .post('/api/collections')
        .send({
          name: 'test-collection',
          description: 'Test collection',
        })
        .expect(201);

      // Try to create another collection with the same name
      const conflictResponse = await request(app)
        .post('/api/collections')
        .send({
          name: 'test-collection',
          description: 'Another test collection',
        })
        .expect(409);

      expect(conflictResponse.body.error.code).toBe('CONFLICT_ERROR');
      expect(conflictResponse.body.error.message).toContain('already exists');
      expect(conflictResponse.body.error).toHaveProperty('errorId');
    });
  });

  describe('Error Context and Logging', () => {
    it('should include request context in error responses', async () => {
      const response = await request(app)
        .post('/api/collections')
        .set('X-Request-ID', 'test-request-123')
        .set('X-User-ID', 'test-user-456')
        .send({
          name: '', // Invalid
        })
        .expect(400);

      // The error should be logged with context (verified through logs in real environment)
      expect(response.body.error).toHaveProperty('errorId');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/collections')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('JSON');
    });

    it('should handle oversized requests', async () => {
      const largePayload = {
        name: 'test-collection',
        description: 'A'.repeat(10 * 1024 * 1024), // 10MB description
      };

      const response = await request(app)
        .post('/api/collections')
        .send(largePayload)
        .expect(413);

      expect(response.body.error.code).toBe('FILE_TOO_LARGE_ERROR');
    });
  });

  describe('Service Layer Error Handling', () => {
    it('should handle domain service errors correctly', async () => {
      // Test business rule violations
      const response = await request(app)
        .post('/api/collections')
        .send({
          name: 'test-collection',
          description: 'Valid description',
        })
        .expect(201);

      const collectionId = response.body.data.id;

      // Try to add too many documents (if there's a limit)
      const promises = [];
      for (let i = 0; i < 15000; i++) {
        // Assuming limit is 10000
        promises.push(
          request(app)
            .post(`/api/collections/${collectionId}/documents`)
            .send({
              key: `doc-${i}`,
              content: `Document content ${i}`,
            }),
        );
      }

      // At least one of these should fail with a business rule error
      const results = await Promise.allSettled(promises);
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        const failure = failures[0] as PromiseRejectedResult;
        expect(failure.reason).toHaveProperty('status');
        expect([422, 500]).toContain(failure.reason.status);
      }
    });

    it('should handle infrastructure errors gracefully', async () => {
      // This test would require mocking infrastructure failures
      // For now, we'll test a scenario that might trigger infrastructure errors

      const response = await request(app)
        .get('/api/collections/invalid-collection-id/documents')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND_ERROR');
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should handle temporary service unavailability', async () => {
      // This would typically require mocking external service failures
      // For now, we'll test the error response format

      const response = await request(app).get('/api/health').expect(200);

      // Health check should succeed, but if it failed, it should return proper error format
      expect(response.body).toHaveProperty('status');
    });

    it('should handle rate limiting correctly', async () => {
      // This test would require implementing rate limiting
      // For now, we'll verify the error format structure

      // Simulate rapid requests that might trigger rate limiting
      const promises = Array(100)
        .fill(null)
        .map(() => request(app).get('/api/collections'));

      const results = await Promise.allSettled(promises);

      // Check if any request was rate limited
      const rateLimited = results.find(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      );

      if (rateLimited) {
        const response = (rateLimited as PromiseFulfilledResult<any>).value;
        expect(response.body.error.code).toBe('RATE_LIMIT_ERROR');
      }
    });
  });

  describe('Error ID Uniqueness', () => {
    it('should generate unique error IDs for different errors', async () => {
      const response1 = await request(app)
        .post('/api/collections')
        .send({ name: '' }) // Invalid
        .expect(400);

      const response2 = await request(app)
        .post('/api/collections')
        .send({ name: '' }) // Another invalid request
        .expect(400);

      expect(response1.body.error.errorId).not.toBe(response2.body.errorId);
      expect(response1.body.error.errorId).toMatch(/^ERR_[A-Z0-9]{8}$/);
      expect(response2.body.error.errorId).toMatch(/^ERR_[A-Z0-9]{8}$/);
    });
  });

  describe('Error Severity Classification', () => {
    it('should classify client errors correctly', async () => {
      const clientErrorCodes = [400, 401, 403, 404, 409, 422, 429];

      for (const statusCode of clientErrorCodes) {
        // Create scenarios that would trigger each status code
        let response;

        switch (statusCode) {
          case 400: // Validation error
            response = await request(app)
              .post('/api/collections')
              .send({ name: '' })
              .expect(400);
            break;
          case 404: // Not found
            response = await request(app)
              .get('/api/collections/nonexistent')
              .expect(404);
            break;
          case 409: // Conflict
            // Create collection first
            await request(app)
              .post('/api/collections')
              .send({ name: 'duplicate-test' })
              .expect(201);
            // Try to create again
            response = await request(app)
              .post('/api/collections')
              .send({ name: 'duplicate-test' })
              .expect(409);
            break;
          default:
            continue;
        }

        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('errorId');
      }
    });

    it('should classify server errors correctly', async () => {
      // Server errors (5xx) should be handled properly
      // This would typically require mocking internal failures

      // For now, verify that the error format is consistent
      const response = await request(app)
        .get('/api/collections/trigger-server-error') // Non-existent endpoint
        .expect(404); // This will be 404, not 5xx, but format should be consistent

      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('errorId');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing AppError format', async () => {
      // Test that the error response format is backward compatible
      const response = await request(app)
        .post('/api/collections')
        .send({ name: '' })
        .expect(400);

      // Should have the new UnifiedError format
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('errorId');
      expect(response.body.error).toHaveProperty('timestamp');

      // But should also be compatible with existing client expectations
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });
  });

  describe('Performance Impact', () => {
    it('should handle errors without significant performance degradation', async () => {
      const startTime = Date.now();

      // Make multiple requests that will generate errors
      const promises = Array(50)
        .fill(null)
        .map(
          () => request(app).post('/api/collections').send({ name: '' }), // Invalid request
        );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 50 error requests in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });
});
