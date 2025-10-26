import { CollectionId, Doc, DocId } from './types.js';

// Multer file interface
interface ExpressFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * 定义导入服务的接口。
 * 导入服务负责处理文档的导入、同步和删除。
 */
export interface IImportService {
  /**
   * 导入一个文档。
   *
   * @param filePath - 文档的本地文件路径。
   * @param collectionId - 文档所属的集合 ID。
   * @returns 导入的文档对象。
   */
  importDocument(filePath: string, collectionId: CollectionId): Promise<Doc>;

  /**
   * 导入上传的文件。
   *
   * @param file - 上传的文件对象。
   * @param collectionId - 文档所属的集合 ID。
   * @returns 导入的文档对象。
   */
  importUploadedFile(
    file: ExpressFile,
    collectionId: CollectionId,
  ): Promise<Doc>;

  /**
   * 重新同步（更新）一个文档。
   * 这将删除旧文档及其关联数据，然后从源文件重新导入。
   *
   * @param docId - 要重新同步的文档 ID。
   * @returns 更新后的文档对象。
   */
  resyncDocument(docId: DocId): Promise<Doc>;

  /**
   * 删除一个文档及其所有关联的块和向量点。
   *
   * @param docId - 要删除的文档 ID。
   */
  deleteDocument(docId: DocId): Promise<void>;

  /**
   * 删除一个集合及其所有关联的文档、块和向量点。
   *
   * @param collectionId - 要删除的集合 ID。
   */
  deleteCollection(collectionId: CollectionId): Promise<void>;
}
