/**
 * Pipeline Step Schemas - Zod契约即权威
 * 每个Step的输入/输出都通过Zod定义，生成TS类型
 * 这些Schema是所有Step必须遵守的内部契约
 *
 * 注意：Brand类型(DocId, CollectionId)运行时实际就是string，
 * Zod只需验证string，编译时通过类型标注升级为Brand
 */

import { z } from 'zod';
import type { DocId, CollectionId } from '@domain/entities/types.js';

// ============ ImportStep ============

/**
 * ImportStep 输入
 * 上游：REST API 上传的文件
 */
export const ImportStepInputSchema = z.object({
  fileBuffer: z.instanceof(Buffer),
  fileName: z.string().min(1),
  mimeType: z.string(),
  collectionId: z.string(),
  docKey: z.string().optional(),
  docName: z.string().optional(),
});

/** ImportStep 输入类型 */
export type ImportStepInput = z.infer<typeof ImportStepInputSchema> & {
  collectionId: CollectionId;
};

/**
 * ImportStep 输出
 */
export const ImportStepOutputSchema = z.object({
  docId: z.string(),
  content: z.string(),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
});

/** ImportStep 输出类型 */
export type ImportStepOutput = z.infer<typeof ImportStepOutputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof ImportStepOutputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

// ============ SplitStep ============

/**
 * SplitStep 输入
 * 上游：ImportStep 的输出
 */
export const SplitStepInputSchema = z.object({
  content: z.string(),
  docId: z.string(),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
  splitterKey: z.string().default('default'),
});

/** SplitStep 输入类型 */
export type SplitStepInput = z.infer<typeof SplitStepInputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof SplitStepInputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

/**
 * SplitStep 输出
 */
export const SplitStepOutputSchema = z.object({
  docId: z.string(),
  chunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      content: z.string(),
      title: z.string().optional(),
      titleChain: z.string().optional(),
    }),
  ),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
});

/** SplitStep 输出类型 */
export type SplitStepOutput = z.infer<typeof SplitStepOutputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof SplitStepOutputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

// ============ EmbedStep ============

/**
 * EmbedStep 输入
 * 上游：SplitStep 的输出
 */
export const EmbedStepInputSchema = z.object({
  docId: z.string(),
  chunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      content: z.string(),
      title: z.string().optional(),
      titleChain: z.string().optional(),
    }),
  ),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
  embeddingKey: z.string().default('default'),
});

/** EmbedStep 输入类型 */
export type EmbedStepInput = z.infer<typeof EmbedStepInputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof EmbedStepInputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

/**
 * EmbedStep 输出
 */
export const EmbedStepOutputSchema = z.object({
  docId: z.string(),
  embeddedChunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      content: z.string(),
      title: z.string().optional(),
      titleChain: z.string().optional(),
      vector: z.array(z.number()),
    }),
  ),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
});

/** EmbedStep 输出类型 */
export type EmbedStepOutput = z.infer<typeof EmbedStepOutputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof EmbedStepOutputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

// ============ IndexStep ============

/**
 * IndexStep 输入
 * 上游：EmbedStep 的输出
 */
export const IndexStepInputSchema = z.object({
  docId: z.string(),
  embeddedChunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      content: z.string(),
      title: z.string().optional(),
      titleChain: z.string().optional(),
      vector: z.array(z.number()),
    }),
  ),
  metadata: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    collectionId: z.string(),
    docKey: z.string(),
    docName: z.string().optional(),
  }),
});

/** IndexStep 输入类型 */
export type IndexStepInput = z.infer<typeof IndexStepInputSchema> & {
  docId: DocId;
  metadata: z.infer<typeof IndexStepInputSchema>['metadata'] & {
    collectionId: CollectionId;
  };
};

/**
 * IndexStep 输出
 */
export const IndexStepOutputSchema = z.object({
  docId: z.string(),
  collectionId: z.string(),
  indexedChunkCount: z.number().int().nonnegative(),
  status: z.enum(['success', 'partial', 'failed']),
  errorMessage: z.string().optional(),
});

/** IndexStep 输出类型 */
export type IndexStepOutput = z.infer<typeof IndexStepOutputSchema> & {
  docId: DocId;
  collectionId: CollectionId;
};

// ============ RetrievalStep ============

/**
 * RetrievalStep 输入
 * 上游：用户查询请求
 */
export const RetrievalStepInputSchema = z.object({
  query: z.string().min(1),
  collectionId: z.string(),
  vectorLimit: z.number().int().positive().default(10),
  keywordLimit: z.number().int().positive().default(10),
  retrieverKey: z.string().default('default'),
  fusionKey: z.string().optional(),
});

/** RetrievalStep 输入类型 */
export type RetrievalStepInput = z.infer<typeof RetrievalStepInputSchema> & {
  collectionId: CollectionId;
};

/**
 * RetrievalStep 输出
 */
export const RetrievalStepOutputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      pointId: z.string(),
      content: z.string(),
      title: z.string().optional(),
      docId: z.string(),
      chunkIndex: z.number().int().nonnegative(),
      collectionId: z.string(),
      titleChain: z.string().optional(),
      score: z.number(),
    }),
  ),
});

/** RetrievalStep 输出类型 */
export type RetrievalStepOutput = z.infer<typeof RetrievalStepOutputSchema> & {
  results: Array<
    z.infer<
      typeof RetrievalStepOutputSchema
    >['results'][number] & {
      docId: DocId;
      collectionId: CollectionId;
    }
  >;
};

// ============ RerankStep ============

/**
 * RerankStep 输入
 * 上游：RetrievalStep 的输出
 */
export const RerankStepInputSchema = z.object({
  query: z.string().min(1),
  results: z.array(
    z.object({
      pointId: z.string(),
      content: z.string(),
      title: z.string().optional(),
      docId: z.string(),
      chunkIndex: z.number().int().nonnegative(),
      collectionId: z.string(),
      titleChain: z.string().optional(),
      score: z.number(),
    }),
  ),
  rerankKey: z.string().default('default'),
  limit: z.number().int().positive().default(10),
});

/** RerankStep 输入类型 */
export type RerankStepInput = z.infer<typeof RerankStepInputSchema> & {
  results: Array<
    z.infer<
      typeof RerankStepInputSchema
    >['results'][number] & {
      docId: DocId;
      collectionId: CollectionId;
    }
  >;
};

/**
 * RerankStep 输出
 */
export const RerankStepOutputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      pointId: z.string(),
      content: z.string(),
      title: z.string().optional(),
      docId: z.string(),
      chunkIndex: z.number().int().nonnegative(),
      collectionId: z.string(),
      titleChain: z.string().optional(),
      score: z.number(),
    }),
  ),
  rerankerDuration: z.number().int().nonnegative(),
});

/** RerankStep 输出类型 */
export type RerankStepOutput = z.infer<typeof RerankStepOutputSchema> & {
  results: Array<
    z.infer<
      typeof RerankStepOutputSchema
    >['results'][number] & {
      docId: DocId;
      collectionId: CollectionId;
    }
  >;
};

// ============ 导出 ============

/**
 * 所有步骤的Schema和类型汇总
 */
export const PipelineSchemas = {
  import: {
    input: ImportStepInputSchema,
    output: ImportStepOutputSchema,
  },
  split: {
    input: SplitStepInputSchema,
    output: SplitStepOutputSchema,
  },
  embed: {
    input: EmbedStepInputSchema,
    output: EmbedStepOutputSchema,
  },
  index: {
    input: IndexStepInputSchema,
    output: IndexStepOutputSchema,
  },
  retrieval: {
    input: RetrievalStepInputSchema,
    output: RetrievalStepOutputSchema,
  },
  rerank: {
    input: RerankStepInputSchema,
    output: RerankStepOutputSchema,
  },
} as const;
