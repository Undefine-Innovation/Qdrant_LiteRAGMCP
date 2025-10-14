import { z } from 'zod';

export const CreateCollectionRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const UpdateCollectionRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export const CollectionResponseSchema = z.object({
  collectionId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.number(),
});