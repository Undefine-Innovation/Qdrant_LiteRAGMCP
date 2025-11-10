/**
 * 监控和健康检查集成测试
 * 测试系统健康检查、指标收集和告警功能
 */

import { DataSource } from 'typeorm';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { HealthCheckService } from '@application/services/monitoring/HealthCheckService.js';
import { MetricsService } from '@application/services/monitoring/MetricsService.js';
import { MonitoringService } from '@application/services/monitoring/MonitoringService.js';
import { IHealthCheckService } from '@domain/repositories/IHealthCheckService.js';
import { IMetricsService } from '@domain/repositories/IMetricsService.js';
import { IMonitoringService } from '@domain/repositories/IMonitoringService.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';

describe('Monitoring and Health Check Integration Tests', () => {
  let dataSource: DataSource;
  let healthCheckService: IHealthCheckService;
  let metricsService: IMetricsService;
  let monitoringService: IMonitoringService;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 创建监控服务实例
    healthCheckService = new HealthCheckService(dataSource, getTestLogger());
    metricsService = new MetricsService(dataSource, getTestLogger());
    monitoringService = new MonitoringService(
      dataSource,
      healthCheckService,
      metricsService,
      getTestLogger(),
    );
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Health Check Service', () => {
    it('应该能够检查系统组件健康状态', async () => {
      // Arrange
      const healthRepository = dataSource.getRepository(SystemHealth);

      // 创建测试健康数据
      await healthRepository.save([
        TestDataFactory.createSystemHealth({
          component: 'database',
          status: 'healthy',
          message: 'Database connection is stable',
          details: { responseTime: 15 },
        }),
        TestDataFactory.createSystemHealth({
          component: 'qdrant',
          status: 'healthy',
          message: 'Qdrant service is responding',
          details: { responseTime: 25 },
        }),
        TestDataFactory.createSystemHealth({
          component: 'embedding-service',
          status: 'degraded',
          message: 'Embedding service is slow',
          details: { responseTime: 5000 },
        }),
      ]);

      // Act
      const healthStatus = await healthCheckService.getSystemHealth();

      // Assert
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBe('degraded'); // 有一个组件降级，整体状态为降级
      expect(healthStatus.components).toHaveLength(3);
      expect(healthStatus.components[0].component).toBe('database');
      expect(healthStatus.components[0].status).toBe('healthy');
      expect(healthStatus.components[2].component).toBe('embedding-service');
      expect(healthStatus.components[2].status).toBe('degraded');
    });

    it('应该能够更新组件健康状态', async () => {
      // Arrange
      const healthRepository = dataSource.getRepository(SystemHealth);

      const initialHealth = TestDataFactory.createSystemHealth({
        component: 'database',
        status: 'healthy',
        message: 'Database is healthy',
      });
      await healthRepository.save(initialHealth);

      // Act
      await healthCheckService.updateComponentHealth('database', {
        status: 'unhealthy',
        message: 'Database connection lost',
        details: { error: 'Connection timeout' },
      });

      // Assert
      const updatedHealth = await healthRepository.findOne({
        where: { component: 'database' },
      });

      expect(updatedHealth.status).toBe('unhealthy');
      expect(updatedHealth.message).toBe('Database connection lost');
      expect(updatedHealth.details.error).toBe('Connection timeout');
      expect(updatedHealth.lastCheck.getTime()).toBeGreaterThan(
        initialHealth.lastCheck.getTime(),
      );
    });

    it('应该能够检查特定组件健康状态', async () => {
      // Arrange
      const healthRepository = dataSource.getRepository(SystemHealth);

      await healthRepository.save(
        TestDataFactory.createSystemHealth({
          component: 'database',
          status: 'healthy',
          message: 'Database is healthy',
        }),
      );

      // Act
      const componentHealth =
        await healthCheckService.checkComponent('database');

      // Assert
      expect(componentHealth).toBeDefined();
      expect(componentHealth.component).toBe('database');
      expect(componentHealth.status).toBe('healthy');
      expect(componentHealth.message).toBe('Database is healthy');
    });

    it('应该处理不存在的组件检查', async () => {
      // Act
      const componentHealth = await healthCheckService.checkComponent(
        'nonexistent-component',
      );

      // Assert
      expect(componentHealth).toBeDefined();
      expect(componentHealth.component).toBe('nonexistent-component');
      expect(componentHealth.status).toBe('unknown');
      expect(componentHealth.message).toBe('Component not found');
    });
  });

  describe('Metrics Service', () => {
    it('应该能够记录系统指标', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);

      const metrics = [
        {
          name: 'cpu_usage',
          value: 75.5,
          unit: 'percent',
          tags: { host: 'server-1' },
        },
        {
          name: 'memory_usage',
          value: 1024,
          unit: 'megabytes',
          tags: { host: 'server-1' },
        },
        {
          name: 'request_count',
          value: 1500,
          unit: 'count',
          tags: { endpoint: '/api/search' },
        },
      ];

      // Act
      for (const metric of metrics) {
        await metricsService.recordMetric(metric);
      }

      // Assert
      const savedMetrics = await metricsRepository.find();
      expect(savedMetrics).toHaveLength(3);

      const cpuMetric = savedMetrics.find((m) => m.name === 'cpu_usage');
      expect(cpuMetric.value).toBe(75.5);
      expect(cpuMetric.unit).toBe('percent');
      expect(cpuMetric.tags.host).toBe('server-1');
    });

    it('应该能够查询指标历史', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 创建不同时间的指标
      await metricsRepository.save([
        TestDataFactory.createSystemMetrics({
          name: 'cpu_usage',
          value: 50,
          timestamp: oneHourAgo,
        }),
        TestDataFactory.createSystemMetrics({
          name: 'cpu_usage',
          value: 75,
          timestamp: new Date(oneHourAgo.getTime() + 30 * 60 * 1000),
        }),
        TestDataFactory.createSystemMetrics({
          name: 'cpu_usage',
          value: 80,
          timestamp: now,
        }),
      ]);

      // Act
      const metricsHistory = await metricsService.getMetricsHistory(
        'cpu_usage',
        {
          startTime: oneHourAgo,
          endTime: now,
        },
      );

      // Assert
      expect(metricsHistory).toHaveLength(3);
      expect(metricsHistory[0].value).toBe(50);
      expect(metricsHistory[1].value).toBe(75);
      expect(metricsHistory[2].value).toBe(80);
    });

    it('应该能够计算指标聚合', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 创建多个指标值
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const value of values) {
        await metricsRepository.save(
          TestDataFactory.createSystemMetrics({
            name: 'response_time',
            value,
            timestamp: new Date(
              oneHourAgo.getTime() + Math.random() * 60 * 60 * 1000,
            ),
          }),
        );
      }

      // Act
      const aggregations = await metricsService.getMetricsAggregations(
        'response_time',
        {
          startTime: oneHourAgo,
          endTime: now,
          aggregations: ['avg', 'min', 'max', 'sum', 'count'],
        },
      );

      // Assert
      expect(aggregations.avg).toBe(55); // (10+20+...+100)/10
      expect(aggregations.min).toBe(10);
      expect(aggregations.max).toBe(100);
      expect(aggregations.sum).toBe(550); // 10+20+...+100
      expect(aggregations.count).toBe(10);
    });

    it('应该能够按标签过滤指标', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);

      await metricsRepository.save([
        TestDataFactory.createSystemMetrics({
          name: 'response_time',
          value: 100,
          tags: { endpoint: '/api/search', host: 'server-1' },
        }),
        TestDataFactory.createSystemMetrics({
          name: 'response_time',
          value: 200,
          tags: { endpoint: '/api/upload', host: 'server-1' },
        }),
        TestDataFactory.createSystemMetrics({
          name: 'response_time',
          value: 150,
          tags: { endpoint: '/api/search', host: 'server-2' },
        }),
      ]);

      // Act
      const filteredMetrics = await metricsService.getMetricsByTags({
        endpoint: '/api/search',
      });

      // Assert
      expect(filteredMetrics).toHaveLength(2);
      expect(
        filteredMetrics.every((m) => m.tags.endpoint === '/api/search'),
      ).toBe(true);
    });
  });

  describe('Alert Rules', () => {
    it('应该能够创建告警规则', async () => {
      // Arrange
      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const alertRule = {
        name: 'High CPU Usage',
        condition: 'cpu_usage > threshold',
        threshold: 80,
        enabled: true,
        metricName: 'cpu_usage',
        conditionOperator: '>',
        thresholdValue: 80,
        severity: 'high',
      };

      // Act
      const createdRule = await monitoringService.createAlertRule(alertRule);

      // Assert
      expect(createdRule).toBeDefined();
      expect(createdRule.name).toBe('High CPU Usage');
      expect(createdRule.threshold).toBe(80);
      expect(createdRule.enabled).toBe(true);
      expect(createdRule.severity).toBe('high');

      // 验证数据库中的记录
      const savedRule = await alertRulesRepository.findOne({
        where: { name: 'High CPU Usage' },
      });
      expect(savedRule).toBeDefined();
      expect(savedRule.metricName).toBe('cpu_usage');
    });

    it('应该能够更新告警规则', async () => {
      // Arrange
      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const rule = await alertRulesRepository.save(
        TestDataFactory.createAlertRule({
          name: 'Original Rule',
          threshold: 70,
          enabled: true,
        }),
      );

      // Act
      const updatedRule = await monitoringService.updateAlertRule(
        rule.id as string,
        {
          threshold: 85,
          enabled: false,
          severity: 'critical',
        },
      );

      // Assert
      expect(updatedRule.threshold).toBe(85);
      expect(updatedRule.enabled).toBe(false);
      expect(updatedRule.severity).toBe('critical');

      // 验证数据库中的更新
      const savedRule = await alertRulesRepository.findOne({
        where: { id: rule.id },
      });
      expect(savedRule.threshold).toBe(85);
      expect(savedRule.enabled).toBe(false);
      expect(savedRule.severity).toBe('critical');
    });

    it('应该能够删除告警规则', async () => {
      // Arrange
      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const rule = await alertRulesRepository.save(
        TestDataFactory.createAlertRule({
          name: 'Rule to Delete',
        }),
      );

      // Act
      await monitoringService.deleteAlertRule(rule.id as string);

      // Assert
      const deletedRule = await alertRulesRepository.findOne({
        where: { id: rule.id },
      });
      expect(deletedRule).toBeNull();
    });

    it('应该能够获取所有告警规则', async () => {
      // Arrange
      const alertRulesRepository = dataSource.getRepository(AlertRules);

      await alertRulesRepository.save([
        TestDataFactory.createAlertRule({
          name: 'CPU Alert',
          enabled: true,
        }),
        TestDataFactory.createAlertRule({
          name: 'Memory Alert',
          enabled: false,
        }),
        TestDataFactory.createAlertRule({
          name: 'Disk Alert',
          enabled: true,
        }),
      ]);

      // Act
      const allRules = await monitoringService.getAllAlertRules();

      // Assert
      expect(allRules).toHaveLength(3);
      expect(allRules.filter((r) => r.enabled)).toHaveLength(2);
      expect(allRules.filter((r) => !r.enabled)).toHaveLength(1);
    });
  });

  describe('Alert Processing', () => {
    beforeEach(async () => {
      // 创建告警规则
      const alertRulesRepository = dataSource.getRepository(AlertRules);

      await alertRulesRepository.save([
        TestDataFactory.createAlertRule({
          name: 'High CPU Usage',
          metricName: 'cpu_usage',
          conditionOperator: '>',
          thresholdValue: 80,
          enabled: true,
          severity: 'high',
        }),
        TestDataFactory.createAlertRule({
          name: 'Low Memory',
          metricName: 'memory_usage',
          conditionOperator: '<',
          thresholdValue: 200,
          enabled: true,
          severity: 'medium',
        }),
      ]);
    });

    it('应该能够触发告警', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      // 记录触发告警的指标
      await metricsRepository.save(
        TestDataFactory.createSystemMetrics({
          name: 'cpu_usage',
          value: 85, // 超过80的阈值
          tags: { host: 'server-1' },
        }),
      );

      // Act
      const triggeredAlerts = await monitoringService.processAlerts();

      // Assert
      expect(triggeredAlerts).toHaveLength(1);
      expect(triggeredAlerts[0].ruleName).toBe('High CPU Usage');
      expect(triggeredAlerts[0].severity).toBe('high');
      expect(triggeredAlerts[0].metricValue).toBe(85);

      // 验证告警历史记录
      const alertHistory = await alertHistoryRepository.find();
      expect(alertHistory).toHaveLength(1);
      expect(alertHistory[0].ruleId).toBeDefined();
      expect(alertHistory[0].status).toBe('triggered');
      expect(alertHistory[0].severity).toBe('high');
    });

    it('应该能够解决告警', async () => {
      // Arrange
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      // 创建已触发的告警
      const triggeredAlert = await alertHistoryRepository.save(
        TestDataFactory.createAlertHistory({
          ruleId: 'rule-123',
          status: 'triggered',
          severity: 'high',
          message: 'CPU usage is high',
        }),
      );

      // Act
      const resolvedAlert = await monitoringService.resolveAlert(
        triggeredAlert.id as string,
        {
          message: 'CPU usage has returned to normal',
        },
      );

      // Assert
      expect(resolvedAlert.status).toBe('resolved');
      expect(resolvedAlert.message).toBe('CPU usage has returned to normal');
      expect(resolvedAlert.resolvedAt).toBeInstanceOf(Date);

      // 验证数据库中的更新
      const updatedAlert = await alertHistoryRepository.findOne({
        where: { id: triggeredAlert.id },
      });
      expect(updatedAlert.status).toBe('resolved');
      expect(updatedAlert.resolvedAt).toBeInstanceOf(Date);
    });

    it('应该能够获取告警历史', async () => {
      // Arrange
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await alertHistoryRepository.save([
        TestDataFactory.createAlertHistory({
          ruleId: 'rule-1',
          status: 'triggered',
          severity: 'high',
          triggeredAt: oneDayAgo,
        }),
        TestDataFactory.createAlertHistory({
          ruleId: 'rule-2',
          status: 'resolved',
          severity: 'medium',
          triggeredAt: new Date(oneDayAgo.getTime() + 12 * 60 * 60 * 1000),
          resolvedAt: now,
        }),
      ]);

      // Act
      const alertHistory = await monitoringService.getAlertHistory({
        startTime: oneDayAgo,
        endTime: now,
      });

      // Assert
      expect(alertHistory).toHaveLength(2);
      expect(alertHistory[0].status).toBe('triggered');
      expect(alertHistory[1].status).toBe('resolved');
    });
  });

  describe('Monitoring Dashboard', () => {
    it('应该能够获取监控仪表板数据', async () => {
      // Arrange
      const healthRepository = dataSource.getRepository(SystemHealth);
      const metricsRepository = dataSource.getRepository(SystemMetrics);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      // 创建健康数据
      await healthRepository.save([
        TestDataFactory.createSystemHealth({
          component: 'database',
          status: 'healthy',
        }),
        TestDataFactory.createSystemHealth({
          component: 'qdrant',
          status: 'healthy',
        }),
        TestDataFactory.createSystemHealth({
          component: 'embedding-service',
          status: 'degraded',
        }),
      ]);

      // 创建指标数据
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await metricsRepository.save([
        TestDataFactory.createSystemMetrics({
          name: 'cpu_usage',
          value: 75,
          timestamp: now,
        }),
        TestDataFactory.createSystemMetrics({
          name: 'memory_usage',
          value: 1024,
          timestamp: now,
        }),
        TestDataFactory.createSystemMetrics({
          name: 'request_count',
          value: 500,
          timestamp: oneHourAgo,
        }),
      ]);

      // 创建告警数据
      await alertHistoryRepository.save([
        TestDataFactory.createAlertHistory({
          status: 'triggered',
          severity: 'high',
          triggeredAt: oneHourAgo,
        }),
        TestDataFactory.createAlertHistory({
          status: 'triggered',
          severity: 'medium',
          triggeredAt: new Date(oneHourAgo.getTime() + 30 * 60 * 1000),
        }),
      ]);

      // Act
      const dashboardData = await monitoringService.getDashboardData();

      // Assert
      expect(dashboardData).toBeDefined();
      expect(dashboardData.overallHealth).toBe('degraded');
      expect(dashboardData.components).toHaveLength(3);
      expect(dashboardData.metrics).toBeDefined();
      expect(dashboardData.metrics.cpu_usage).toBe(75);
      expect(dashboardData.metrics.memory_usage).toBe(1024);
      expect(dashboardData.activeAlerts).toHaveLength(2);
      expect(dashboardData.activeAlerts[0].severity).toBe('high');
    });

    it('应该能够获取系统概览', async () => {
      // Arrange
      const healthRepository = dataSource.getRepository(SystemHealth);
      const metricsRepository = dataSource.getRepository(SystemMetrics);

      // 创建健康数据
      await healthRepository.save([
        TestDataFactory.createSystemHealth({
          component: 'database',
          status: 'healthy',
        }),
        TestDataFactory.createSystemHealth({
          component: 'qdrant',
          status: 'healthy',
        }),
        TestDataFactory.createSystemHealth({
          component: 'embedding-service',
          status: 'healthy',
        }),
        TestDataFactory.createSystemHealth({
          component: 'cache',
          status: 'unhealthy',
        }),
      ]);

      // 创建指标数据
      await metricsRepository.save([
        TestDataFactory.createSystemMetrics({ name: 'uptime', value: 99.9 }),
        TestDataFactory.createSystemMetrics({
          name: 'request_rate',
          value: 150,
        }),
        TestDataFactory.createSystemMetrics({ name: 'error_rate', value: 0.5 }),
      ]);

      // Act
      const systemOverview = await monitoringService.getSystemOverview();

      // Assert
      expect(systemOverview).toBeDefined();
      expect(systemOverview.healthStatus).toBe('unhealthy'); // 有一个组件不健康
      expect(systemOverview.uptime).toBe(99.9);
      expect(systemOverview.requestRate).toBe(150);
      expect(systemOverview.errorRate).toBe(0.5);
      expect(systemOverview.componentCount).toBe(4);
      expect(systemOverview.healthyComponents).toBe(3);
      expect(systemOverview.unhealthyComponents).toBe(1);
    });
  });

  describe('Performance Monitoring', () => {
    it('应该能够监控系统响应时间', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);

      // 模拟API响应时间记录
      const responseTimes = [100, 150, 200, 120, 180, 250, 90, 110];

      for (const responseTime of responseTimes) {
        await metricsRepository.save(
          TestDataFactory.createSystemMetrics({
            name: 'api_response_time',
            value: responseTime,
            tags: { endpoint: '/api/search' },
          }),
        );
      }

      // Act
      const performanceStats = await monitoringService.getPerformanceStats(
        'api_response_time',
        {
          endpoint: '/api/search',
        },
      );

      // Assert
      expect(performanceStats).toBeDefined();
      expect(performanceStats.average).toBeCloseTo(150, 1); // 平均值
      expect(performanceStats.min).toBe(90);
      expect(performanceStats.max).toBe(250);
      expect(performanceStats.p95).toBeCloseTo(200, 1); // 95百分位
      expect(performanceStats.p99).toBeCloseTo(250, 1); // 99百分位
    });

    it('应该能够检测性能异常', async () => {
      // Arrange
      const metricsRepository = dataSource.getRepository(SystemMetrics);

      // 创建正常响应时间
      const normalResponseTimes = [100, 120, 110, 130, 115];
      for (const responseTime of normalResponseTimes) {
        await metricsRepository.save(
          TestDataFactory.createSystemMetrics({
            name: 'api_response_time',
            value: responseTime,
            timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1小时前
          }),
        );
      }

      // 创建异常响应时间
      const abnormalResponseTimes = [500, 600, 550, 700, 650];
      for (const responseTime of abnormalResponseTimes) {
        await metricsRepository.save(
          TestDataFactory.createSystemMetrics({
            name: 'api_response_time',
            value: responseTime,
            timestamp: new Date(), // 现在
          }),
        );
      }

      // Act
      const anomalies = await monitoringService.detectPerformanceAnomalies(
        'api_response_time',
        {
          threshold: 2.0, // 2倍标准差
          timeWindow: 60 * 60 * 1000, // 1小时窗口
        },
      );

      // Assert
      expect(anomalies).toHaveLength(5); // 异常响应时间数量
      expect(anomalies.every((a) => a.value > 300)).toBe(true);
      expect(anomalies[0].severity).toBe('high');
    });
  });
});
