import { Collection, Doc, SearchResult, CollectionId, DocId } from '../../../share/type.js';
import { DocumentChunk } from '../../../share/type.js';
import { ChunkWithVector } from '../infrastructure/QdrantRepo.js';
import { AppConfig } from '../config.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';

// DEPRECATED: Version concept has been removed from the architecture

/**
 * @interface ServiceError
 * @description 定义统一的服务层错误接口。
 */
export interface ServiceError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误详情（可选） */
  details?: any;
}

/**
 * @interface ILogger
 * @description 定义统一的日志接口，用于服务层进行日志记录。
 */
export interface ILogger {
  /** 记录一般信息 */
  info(message: string, ...args: any[]): void;
  /** 记录警告信息 */
  warn(message: string, ...args: any[]): void;
  /** 记录错误信息 */
  error(message: string, ...args: any[]): void;
  /** 记录调试信息 */
  debug(message: string, ...args: any[]): void;
}

/**
 * @interface ICollectionService
 * @description 定义 Collection 服务的接口，负责 Collection 的 CRUD 操作。
 */
export interface ICollectionService {
  /**
   * 创建一个新的 Collection。
   * @param name Collection 的名称。
   * @param description Collection 的描述（可选）。
   * @returns 包含新创建 Collection 信息的 Promise。
   */
  createCollection(name: string, description?: string): Promise<Collection>;
  /**
   * 列出所有 Collection。
   * @returns 包含所有 Collection 数组的 Promise。
   */
  listCollections(): Promise<Collection[]>;
  /**
   * 根据 ID 获取指定 Collection。
   * @param collectionId Collection 的唯一标识符。
   * @returns 包含 Collection 信息或 null 的 Promise。
   */
  getCollectionById(collectionId: CollectionId): Promise<Collection | null>;
  /**
   * 更新指定 Collection 的信息。
   * @param collectionId Collection 的唯一标识符。
   * @param name Collection 的新名称（可选）。
   * @param description Collection 的新描述（可选）。
   * @returns 包含更新后 Collection 信息或 null 的 Promise。
   */
  updateCollection(collectionId: CollectionId, name?: string, description?: string): Promise<Collection | null>;
  /**
   * 删除指定 Collection。
   * @param collectionId Collection 的唯一标识符。
   * @returns 无返回值的 Promise。
   */
  deleteCollection(collectionId: CollectionId): Promise<void>;
}


/**
 * @interface IDocumentService
 * @description 定义 Document 服务的接口，负责 Document 的 CRUD 操作。
 */
export interface IDocumentService {
  /**
   * 创建一个新的 Document。
   * @param collectionId 所属 Collection 的 ID。
   * @param key 文档的唯一键。
   * @param content 文档的原始内容。
   * @param name 文档名称（可选）。
   * @param mime 文档的 MIME 类型（可选）。
   * @returns 包含新创建 Document 信息的 Promise。
   */
  createDoc(
    collectionId: CollectionId,
    key: string,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Promise<Doc>;
  /**
   * 根据 ID 获取指定 Document。
   * @param docId Document 的唯一标识符。
   * @returns 包含 Document 信息或 null 的 Promise。
   */
  getDocById(docId: DocId): Promise<Doc | null>;
  /**
   * 更新指定 Document 的内容和元数据。
   * @param docId Document 的唯一标识符。
   * @param content 文档的新内容。
   * @param name 文档的新名称（可选）。
   * @param mime 文档的新 MIME 类型（可选）。
   * @returns 包含更新后 Document 信息或 null 的 Promise。
   */
  updateDoc(
    docId: DocId,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Promise<Doc | null>;
  /**
   * 删除指定 Document。
   * @param docId Document 的唯一标识符。
   * @returns 表示删除是否成功的 Promise。
   */
  deleteDoc(docId: DocId): Promise<boolean>;
  /**
   * 获取所有 Document。
   * @returns 包含所有 Document 数组的 Promise。
   */
  getAllDocs(): Promise<Doc[]>;
  /**
   * 列出指定 Collection 下的所有 Document。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 包含所有 Document 数组的 Promise。
   */
  listDocs(collectionId: CollectionId): Promise<Doc[]>;
}

/**
 * @interface ISearchService
 * @description 定义 Search 服务的接口，负责文档的搜索功能。
 */
export interface ISearchService {
  /**
   * 执行文档搜索。
   * @param query 搜索查询字符串。
   * @param collectionId 要搜索的 Collection ID。
   * @param limit 返回结果的最大数量（可选）。
   * @param latestOnly 是否只搜索最新版本（可选）。
   * @param filters 额外的过滤条件（可选）。
   * @returns 包含搜索结果数组的 Promise。
   */
  runSearch(
    query: string,
    collectionId: CollectionId,
    limit?: number,
    latestOnly?: boolean,
    filters?: { [key: string]: any },
  ): Promise<SearchResult[]>;
}

/**
 * @interface IIngestionService
 * @description 定义 Ingestion 服务的接口，负责文档的摄取和处理流程。
 */
export interface IIngestionService {
  /**
   * 处理指定路径下的新文档，包括加载、分割、嵌入和存储。
   * @param documentSourcePath 文档源目录路径。
   * @returns 无返回值的 Promise。
   */
  processNewDocuments(documentSourcePath: string): Promise<void>;
  /**
   * 摄取单个文档到系统中。
   * @param collectionId 所属 Collection 的 ID。
   * @param key 文档的唯一键。
   * @param content 文档的原始内容。
   * @param name 文档名称（可选）。
   * @param mime 文档的 MIME 类型（可选）。
   * @param metadata 额外的元数据（可选）。
   * @returns 包含新创建 Document 信息的 Promise。
   */
  ingestDocument(
    collectionId: CollectionId,
    key: string,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
    metadata?: unknown,
  ): Promise<Doc>;
}

/**
 * @interface Services
 * @description 定义服务层依赖注入的接口，聚合所有服务。
 */
export interface Services {
  collectionService: ICollectionService;
  documentService: IDocumentService;
  searchService: ISearchService;
  ingestionService: IIngestionService;
}

/**
 * @interface Infrastructure
 * @description 定义基础设施依赖注入的接口，聚合所有基础设施组件。
 */
export interface Infrastructure {
  db: SQLiteRepo;
  config: AppConfig;
  logger: ILogger;
}