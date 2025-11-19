import { DocId } from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';
import { ErrorFactory } from '@domain/errors/ErrorFactory.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

/**
 * 文档删除处理器
 * 负责处理文档的删除操作
 */
export class DocumentDeletionProcessor {
  constructor(
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
    private readonly docRepository: DocRepository,
  ) {}

  /**
   * 删除文档
   * @param docId 文档ID
   * @returns {Promise<void>}
   */
  public async deleteDocument(docId: DocId): Promise<void> {
    console.log(
      'DEBUG: DocumentDeletionProcessor.deleteDocument called with docId:',
      docId,
    );
    this.logger.info(`Deleting document: ${docId}`);

    if (!this.docRepository) {
      console.log('DEBUG: DocRepository not initialized in deleteDocument');
      throw ErrorFactory.createInternalServerError(
        'DocRepository not initialized',
      );
    }

    console.log('DEBUG: About to find document for deletion');
    const doc = await this.docRepository.findById(docId);
    console.log('DEBUG: Found document for deletion:', doc);

    if (!doc) {
      console.log('DEBUG: Document not found for deletion');
      this.logger.warn(
        `Document with id ${docId} not found. Nothing to delete.`,
      );
      return; // Idempotent deletion
    }

    console.log('DEBUG: About to delete points from Qdrant');
    await this.qdrantRepo.deletePointsByDoc(docId);
    console.log('DEBUG: About to delete doc from TypeORM repository');

    // 使用TypeORM repository直接删除（硬删除）
    // 注意：Doc实体使用docId字段作为业务标识符
    await this.docRepository.delete(docId as string);

    console.log('DEBUG: Document deletion completed');
    this.logger.info(`成功删除文档 ${docId} 及其关联的向量点。`);
  }
}
