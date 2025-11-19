import { Logger, EnhancedLogger } from '@logging/logger.js';
import { MonitoringService } from '@application/services/monitoring/index.js';
import { AlertService } from '@application/services/alerting/index.js';
import { LogTag } from '@infrastructure/logging/EnhancedLogger.js';

/**
 * 设置优雅关闭处理
 *
 * @param monitoringService - 监控服务实例
 * @param alertService - 告警服务实例
 * @param logger - 日志器实例
 * @returns 优雅关闭函数
 */
export function setupGracefulShutdown(
  monitoringService: MonitoringService,
  alertService: AlertService,
  logger: Logger,
): () => void {
  const gracefulShutdown = () => {
    logger.info('正在优雅关闭应用...');

    // 停止监控服务
    monitoringService.stop();
    alertService.stop();

    logger.info('应用已优雅关闭');
    process.exit(0);
  };

  // 监听关闭信号
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return gracefulShutdown;
}
