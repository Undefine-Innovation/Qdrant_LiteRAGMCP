/**
 * 监控API端到端测试
 * 测试监控相关的所有API端点
 */

import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { DataSource } from 'typeorm';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('Monitoring API E2E Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };

  beforeAll(async () => {
    // 创建测试环境
    testEnv = await createApiTestEnvironment();
  });

  afterAll(async () => {
    // 清理测试环境
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      await testEnv.dataSource.destroy();
      // 清理全局测试数据源引用
      (globalThis as any).__TEST_DATASOURCE = null;
    }
  });

  beforeEach(async () => {
    // 重置测试数据库
    await resetTestDatabase();
    jest.clearAllMocks();

    // 创建测试数据
    await createTestData();
  });

  afterEach(async () => {
    // 清理测试数据 - 使用DELETE而不是clear()以避免连接问题
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      try {
        const tableNames = ['alert_history', 'alert_rules', 'system_metrics', 'system_health'];
        for (const tableName of tableNames) {
          try {
            await testEnv.dataSource.query(`DELETE FROM ${tableName}`);
          } catch (error) {
            // 表可能不存在，忽略错误
          }
        }
      } catch (error) {
        console.error('Error cleaning up test data:', error);
        // 继续运行测试，即使清理失败
      }
    }
  });

  async function createTestData() {
    const healthRepository = testEnv.dataSource.getRepository(SystemHealth);
    const metricsRepository = testEnv.dataSource.getRepository(SystemMetrics);
    const alertRulesRepository = testEnv.dataSource.getRepository(AlertRules);
    const alertHistoryRepository = testEnv.dataSource.getRepository(AlertHistory);

    // 创建健康数据
    await healthRepository.save([
      {
        id: 'health-1',
        component: 'database',
        status: 'healthy',
        message: 'Database connection is stable',
        details: { responseTime: 15 },
        lastCheck: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'health-2',
        component: 'qdrant',
        status: 'healthy',
        message: 'Qdrant service is responding',
        details: { responseTime: 25 },
        lastCheck: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'health-3',
        component: 'embedding-service',
        status: 'degraded',
        message: 'Embedding service is slow',
        details: { responseTime: 5000 },
        lastCheck: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    // 创建指标数据
    await metricsRepository.save([
      {
        id: 'metric-1',
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        tags: { host: 'server-1' },
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'metric-2',
        name: 'memory_usage',
        value: 1024,
        unit: 'megabytes',
        tags: { host: 'server-1' },
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'metric-3',
        name: 'request_count',
        value: 1500,
        unit: 'count',
        tags: { endpoint: '/api/search' },
        timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    // 创建告警规则
    const alertRule = await alertRulesRepository.save({
      id: 'alert-rule-1',
      name: 'High CPU Usage',
      condition: 'cpu_usage > threshold',
      threshold: 80,
      enabled: true,
      metricName: 'cpu_usage',
      conditionOperator: '>',
      thresholdValue: 80,
      severity: 'high',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // 创建告警历史
    await alertHistoryRepository.save({
      id: 'alert-history-1',
      ruleId: alertRule.id,
      status: 'triggered',
      severity: 'high',
      message: 'CPU usage is high',
      value: 85,
      triggeredAt: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }

  describe('GET /api/monitoring/health', () => {
    it('应该返回系统健康状态', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/health');

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['success', 'status', 'timestamp', 'services', 'metrics']);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('degraded'); // 有一个组件降级
      expect(response.body.services).toBeDefined();
      expect(response.body.metrics).toBeDefined();
    });

    it('应该包含所有组件状态', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/health');

      // Assert
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('qdrant');
      expect(response.body.services).toHaveProperty('filesystem');
      expect(response.body.services.database).toBe('healthy');
      expect(response.body.services.qdrant).toBe('healthy');
      expect(response.body.services.filesystem).toBe('healthy');
    });

    it('应该包含系统指标', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/health');

      // Assert
      expect(response.body.metrics).toHaveProperty('uptime');
      expect(response.body.metrics).toHaveProperty('memoryUsage');
      expect(response.body.metrics).toHaveProperty('diskUsage');
      expect(typeof response.body.metrics.uptime).toBe('number');
      expect(typeof response.body.metrics.memoryUsage).toBe('string');
      expect(typeof response.body.metrics.diskUsage).toBe('string');
    });
  });

  describe('GET /api/monitoring/metrics', () => {
    it('应该返回系统指标', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/metrics');

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('应该支持按指标名称过滤', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/metrics')
        .query({ metricName: 'cpu_usage' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        response.body.forEach((metric: any) => {
          expect(metric.name).toBe('cpu_usage');
        });
      }
    });

    it('应该支持时间范围过滤', async () => {
      // Arrange
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/metrics')
        .query({
          startTime: oneHourAgo,
          endTime: now,
        });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('应该验证时间范围参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/metrics')
        .query({
          startTime: 'invalid-time',
          endTime: Date.now(),
        });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/monitoring/alert-rules', () => {
    it('应该成功创建告警规则', async () => {
      // Arrange
      const alertRuleData = {
        name: 'Test Alert Rule',
        metricName: 'memory_usage',
        conditionOperator: '>',
        thresholdValue: 90,
        severity: 'critical',
        enabled: true,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/monitoring/alert-rules')
        .send(alertRuleData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 201, ['id', 'name', 'metricName', 'thresholdValue']);
      expect(response.body.name).toBe(alertRuleData.name);
      expect(response.body.metricName).toBe(alertRuleData.metricName);
      expect(response.body.thresholdValue).toBe(alertRuleData.thresholdValue);
      expect(response.body.enabled).toBe(alertRuleData.enabled);
    });

    it('应该验证必填字段', async () => {
      // Arrange
      const invalidAlertRuleData = {
        name: 'Test Alert Rule',
        // 缺少必填字段
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/monitoring/alert-rules')
        .send(invalidAlertRuleData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该验证阈值类型', async () => {
      // Arrange
      const invalidAlertRuleData = {
        name: 'Test Alert Rule',
        metricName: 'memory_usage',
        conditionOperator: '>',
        thresholdValue: 'invalid-threshold', // 应该是数字
        severity: 'critical',
        enabled: true,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/monitoring/alert-rules')
        .send(invalidAlertRuleData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/monitoring/alert-rules', () => {
    it('应该返回所有告警规则', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alert-rules');

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('应该支持分页', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alert-rules')
        .query({ page: 1, limit: 10 });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, undefined, {
        page: 1,
        limit: 10,
      });
    });

    it('应该支持按活跃状态过滤', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alert-rules')
        .query({ activeOnly: true });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (Array.isArray(response.body)) {
        response.body.forEach((rule: any) => {
          expect(rule.enabled).toBe(true);
        });
      }
    });
  });

  describe('PUT /api/monitoring/alert-rules/:ruleId', () => {
    it('应该成功更新告警规则', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Alert Rule',
        thresholdValue: 85,
        enabled: false,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .put('/api/monitoring/alert-rules/alert-rule-1')
        .send(updateData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['id', 'name', 'thresholdValue', 'enabled']);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.thresholdValue).toBe(updateData.thresholdValue);
      expect(response.body.enabled).toBe(updateData.enabled);
    });

    it('应该返回404当规则不存在', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Alert Rule',
        thresholdValue: 85,
        enabled: false,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .put('/api/monitoring/alert-rules/non-existent-rule')
        .send(updateData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('DELETE /api/monitoring/alert-rules/:ruleId', () => {
    it('应该成功删除告警规则', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .delete('/api/monitoring/alert-rules/alert-rule-1');

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('应该返回404当规则不存在', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .delete('/api/monitoring/alert-rules/non-existent-rule');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('GET /api/monitoring/alerts/history', () => {
    it('应该返回告警历史', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alerts/history');

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('应该支持按规则ID过滤', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alerts/history')
        .query({ ruleId: 'alert-rule-1' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (Array.isArray(response.body)) {
        response.body.forEach((alert: any) => {
          expect(alert.ruleId).toBe('alert-rule-1');
        });
      }
    });

    it('应该支持按严重性过滤', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alerts/history')
        .query({ severity: 'high' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (Array.isArray(response.body)) {
        response.body.forEach((alert: any) => {
          expect(alert.severity).toBe('high');
        });
      }
    });

    it('应该支持时间范围过滤', async () => {
      // Arrange
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alerts/history')
        .query({
          startTime: oneDayAgo,
          endTime: now,
        });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/monitoring/dashboard', () => {
    it('应该返回仪表板数据', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/dashboard');

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['overallHealth', 'components', 'metrics', 'activeAlerts']);
      expect(response.body.overallHealth).toBeDefined();
      expect(Array.isArray(response.body.components)).toBe(true);
      expect(response.body.metrics).toBeDefined();
      expect(Array.isArray(response.body.activeAlerts)).toBe(true);
    });

    it('应该包含组件健康状态', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/dashboard');

      // Assert
      expect(Array.isArray(response.body.components)).toBe(true);
      expect(response.body.components.length).toBeGreaterThan(0);
      
      response.body.components.forEach((component: any) => {
        expect(component).toHaveProperty('component');
        expect(component).toHaveProperty('status');
        expect(component).toHaveProperty('message');
        expect(component).toHaveProperty('lastCheck');
      });
    });

    it('应该包含系统指标', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/dashboard');

      // Assert
      expect(response.body.metrics).toBeDefined();
      expect(typeof response.body.metrics).toBe('object');
    });

    it('应该包含活跃告警', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/dashboard');

      // Assert
      expect(Array.isArray(response.body.activeAlerts)).toBe(true);
      
      response.body.activeAlerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('ruleId');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('triggeredAt');
      });
    });
  });

  describe('Error Handling', () => {
    it('应该处理无效的JSON', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/monitoring/alert-rules')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理数据库连接错误', async () => {
      // Arrange
      await testEnv.dataSource.destroy();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/health');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 500, 'INTERNAL_ERROR');
    });
  });

  describe('Response Format', () => {
    it('应该返回正确的Content-Type', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/health');

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('应该包含必要的响应字段', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/alert-rules');

      // Assert
      if (Array.isArray(response.body) && response.body.length > 0) {
        response.body.forEach((rule: any) => {
          expect(rule).toHaveProperty('id');
          expect(rule).toHaveProperty('name');
          expect(rule).toHaveProperty('metricName');
          expect(rule).toHaveProperty('conditionOperator');
          expect(rule).toHaveProperty('thresholdValue');
          expect(rule).toHaveProperty('severity');
          expect(rule).toHaveProperty('enabled');
          expect(rule).toHaveProperty('created_at');
          expect(rule).toHaveProperty('updated_at');
        });
      }
    });

    it('应该正确处理时间戳字段', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/monitoring/metrics');

      // Assert
      if (Array.isArray(response.body) && response.body.length > 0) {
        response.body.forEach((metric: any) => {
          expect(typeof metric.timestamp).toBe('number');
          expect(typeof metric.created_at).toBe('number');
          expect(typeof metric.updated_at).toBe('number');
        });
      }
    });
  });
});