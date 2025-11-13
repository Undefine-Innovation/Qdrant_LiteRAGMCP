import { z } from 'zod';

/**
 * ID format validation message
 */
const idFormatMessage =
  'Only alphanumeric characters, ".", "_", ":", and "-" are allowed';

/**
 * ID validation regex pattern
 */
const idRegex = /^[A-Za-z0-9._:-]+$/;

/**
 * Batch document upload request schema
 * Validates `POST /upload/batch` request body
 */
export const BatchUploadRequestSchema = z.object({
  collectionId: z
    .string()
    .optional()
    .describe(
      'Target collection ID (optional, uses default collection if not provided)',
    ),
});

/**
 * Batch document upload response schema
 */
export const BatchUploadResponseSchema = z.object({
  success: z.boolean().describe('Whether batch upload was successful'),
  total: z.number().describe('Total number of files'),
  successful: z.number().describe('Number of successfully uploaded files'),
  failed: z.number().describe('Number of failed uploads'),
  results: z
    .array(
      z.object({
        fileName: z.string().describe('File name'),
        docId: z
          .string()
          .optional()
          .describe('Document ID returned on successful upload'),
        collectionId: z
          .string()
          .optional()
          .describe('Collection ID of the collection'),
        error: z.string().optional().describe('Error message if upload failed'),
      }),
    )
    .describe('Upload result for each file'),
});

/**
 * Batch delete documents request schema
 * Validates `DELETE /docs/batch` request body
 */
/**
 * Document ID validation schema
 * Accepts any string matching the ID format (alphanumeric, dots, underscores, colons, hyphens)
 */
const DocIdSchema = z
  .string()
  .regex(idRegex, idFormatMessage)
  .min(1, 'Document ID cannot be empty');

/**
 * Batch delete documents request schema
 * Validates `DELETE /docs/batch` request body
 */
export const BatchDeleteDocsRequestSchema = z.object({
  docIds: z
    .array(DocIdSchema)
    .min(1)
    .describe('List of document IDs to delete'),
});

/**
 * Batch delete documents response schema
 */
export const BatchDeleteDocsResponseSchema = z.object({
  success: z.boolean().describe('Whether batch delete was successful'),
  total: z.number().describe('Total number of documents'),
  successful: z.number().describe('Number of successfully deleted documents'),
  failed: z.number().describe('Number of failed deletions'),
  results: z
    .array(
      z.object({
        docId: z.string().describe('Document ID'),
        success: z.boolean().describe('Whether deletion was successful'),
        error: z
          .string()
          .optional()
          .describe('Error message if deletion failed'),
      }),
    )
    .describe('Deletion result for each document'),
});

/**
 * Batch delete collections request schema
 * Validates `DELETE /collections/batch` request body
 */
export const BatchDeleteCollectionsRequestSchema = z.object({
  collectionIds: z
    .array(z.string().regex(idRegex, idFormatMessage))
    .min(1)
    .describe('List of collection IDs to delete'),
});

/**
 * Batch delete collections response schema
 */
export const BatchDeleteCollectionsResponseSchema = z.object({
  success: z.boolean().describe('Whether batch delete was successful'),
  total: z.number().describe('Total number of collections'),
  successful: z.number().describe('Number of successfully deleted collections'),
  failed: z.number().describe('Number of failed deletions'),
  results: z
    .array(
      z.object({
        collectionId: z.string().describe('Collection ID'),
        success: z.boolean().describe('Whether deletion was successful'),
        error: z
          .string()
          .optional()
          .describe('Error message if deletion failed'),
      }),
    )
    .describe('Deletion result for each collection'),
});

/**
 * Batch operation progress response schema
 */
export const BatchOperationProgressSchema = z.object({
  operationId: z.string().describe('Operation ID'),
  type: z.enum(['upload', 'delete']).describe('Operation type'),
  status: z
    .enum(['pending', 'processing', 'completed', 'failed'])
    .describe('Operation status'),
  total: z.number().describe('Total number of items'),
  processed: z.number().describe('Number of processed items'),
  successful: z.number().describe('Number of successful items'),
  failed: z.number().describe('Number of failed items'),
  startTime: z.number().describe('Start timestamp'),
  endTime: z.number().optional().describe('End timestamp'),
  estimatedTimeRemaining: z
    .number()
    .optional()
    .describe('Estimated remaining time (seconds)'),
});

/**
 * Batch operation status query schema
 */
export const BatchOperationQuerySchema = z.object({
  operationId: z.string().describe('Operation ID'),
});

/**
 * Batch operation list query schema
 */
export const BatchOperationListQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});
