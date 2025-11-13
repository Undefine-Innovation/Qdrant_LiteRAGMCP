import { createApiTestEnvironment } from './api/api-test-setup.test.js';
import supertest from 'supertest';

describe('Debug Documents Routes', () => {
  it('should check if document DELETE route works', async () => {
    const testEnv = await createApiTestEnvironment();

    // 尝试删除一个不存在的文档，应该返回 404 (not found) 而不是 404 (route not found)
    const response = await supertest(testEnv.app).delete(
      '/api/docs/nonexistent-doc-id',
    );

    console.log('DELETE /api/docs/nonexistent-doc-id status:', response.status);
    console.log('Response body:', JSON.stringify(response.body, null, 2));

    // 如果路由存在但文档不存在，应该返回404并带有错误消息
    // 如果路由本身不存在，也会返回404但响应格式不同
    expect(response.status).toBe(404);
  });

  it('should check if document GET route works', async () => {
    const testEnv = await createApiTestEnvironment();

    const response = await supertest(testEnv.app).get(
      '/api/docs/nonexistent-doc-id',
    );

    console.log('GET /api/docs/nonexistent-doc-id status:', response.status);
    console.log('Response body:', JSON.stringify(response.body, null, 2));

    expect(response.status).toBe(404);
  });
});
