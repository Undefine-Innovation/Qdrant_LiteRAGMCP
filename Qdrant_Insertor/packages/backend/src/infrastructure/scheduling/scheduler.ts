import cron from 'node-cron';
import { Logger } from '@logging/logger.js';
import { MonitoringService } from '@application/services/MonitoringService.js';
import { AlertService } from '@application/services/AlertService.js';
import { AutoGCService } from '@application/services/AutoGCService.js';
import { AppConfig } from '@config/config.js';

/**
 * 设置定时任务
 *
 * @param monitoringService - 监控服务实例
 * @param alertService - 告警服务实例
 * @param autoGCService - 自动垃圾回收服务实例
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 */
export function setupScheduledTasks(
  monitoringService: MonitoringService,
  alertService: AlertService,
  autoGCService: AutoGCService,
  config: AppConfig,
  logger: Logger,
): void {
  logger.info('启动监控服务...');

  // 启动健康检查定时任务（每5分钟）
  cron.schedule('*/5 * * * *', () => {
    monitoringService.performHealthCheck().catch((err) => {
      logger.error(`健康检查失败: ${(err as Error).message}`, err);
    });
  });

  // 启动告警检查定时任务（每1分钟）
  cron.schedule('* * * * *', () => {
    alertService.checkAlerts().catch((err) => {
      logger.error(`告警检查失败: ${(err as Error).message}`, err);
    });
  });

  // 设置监控数据清理任务（每天凌晨2点）
  cron.schedule('0 2 * * *', () => {
    monitoringService.cleanup(30); // 清理30天前的数据
    logger.info('监控数据清理任务完成');
  });

  logger.info('监控服务已启动');

  // 设置自动垃圾回收（AutoGC）定时任务
  setupGCTasks(autoGCService, config, logger);
}

/**
 * 设置垃圾回收定时任务
 *
 * @param autoGCService - 自动垃圾回收服务实例
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 */
function setupGCTasks(
  autoGCService: AutoGCService,
  config: AppConfig,
  logger: Logger,
): void {
  const gcIntervalHours = config.gc.intervalHours; // 垃圾回收间隔小时数
  logger.info(`AutoGC 定时任务已设置，每${gcIntervalHours} 小时运行一次。`);

  // 立即运行一次垃圾回收（可选）
  setTimeout(() => {
    logger.info('执行初始垃圾回收...');
    autoGCService.runGC().catch((err) => {
      logger.error(`初始垃圾回收失败: ${(err as Error).message}`, err);
    });
  }, 5000); // 5秒后执行，确保应用完全启动

  // 设置定时任务
  // cron 表达式：'0 */${gcIntervalHours} * * *' 表示每${gcIntervalHours}小时执行一次，在小时的0分钟
  cron.schedule(`0 */${gcIntervalHours} * * *`, () => {
    logger.info('执行定时垃圾回收...');
    autoGCService.runGC().catch((err) => {
      logger.error(`定时垃圾回收失败: ${(err as Error).message}`, err);
    });
  });
}
