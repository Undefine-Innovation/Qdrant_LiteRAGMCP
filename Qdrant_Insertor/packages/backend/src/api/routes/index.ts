import express from 'express';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { MonitoringApiService } from '@application/services/api/index.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { createCollectionRoutes } from './collections.js';
import { createDocumentRoutes } from './documents.js';
import { createSearchRoutes } from './search.js';
import { createGraphRoutes } from './graph.js';
import { createPreviewRoutes } from './preview.js';
import { createCommonRoutes } from './common.js';
import { createBatchRoutes } from './batch.js';
import { createMonitoringRoutes } from '@api/monitoring.js';
import { IScrapeService } from '@domain/entities/scrape.js';
import { Logger } from '@logging/logger.js';
import { createScrapeRoutes } from './scrape.js';
import type { IImportAndIndexUseCase } from '@domain/use-cases/index.js';

/**
 * Interface defining all API services required for routing
 */
interface ApiServices {
  importService: IImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
  fileProcessingService: IFileProcessingService;
  batchService: IBatchService;
  scrapeService: IScrapeService;
  logger: Logger;
  monitoringApiService?: IMonitoringApiService | MonitoringApiService;
  importAndIndexUseCase: IImportAndIndexUseCase;
}

/**
 * Creates and configures the main API router with all route handlers
 *
 * @param services - Object containing all required API services
 * @returns Configured Express router instance
 */
export function createApiRouter(services: ApiServices): express.Router {
  const router = express.Router();

  router.use('/', createCommonRoutes());
  router.use('/', createBatchRoutes(services.batchService));
  router.use('/', createCollectionRoutes(services.collectionService));
  router.use(
    '/',
    createDocumentRoutes(
      services.importService,
      services.collectionService,
      services.documentService,
      services.importAndIndexUseCase,
    ),
  );
  router.use('/', createSearchRoutes(services.searchService, services.logger));
  router.use('/', createGraphRoutes(services.graphService));
  router.use('/', createPreviewRoutes(services.fileProcessingService));
  router.use(
    '/scrape',
    createScrapeRoutes(services.scrapeService, services.logger),
  );

  if (services.monitoringApiService) {
    router.use(
      '/monitoring',
      createMonitoringRoutes(services.monitoringApiService),
    );
  }

  return router;
}
