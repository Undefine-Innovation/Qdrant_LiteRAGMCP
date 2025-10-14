import { Collection, Version, Doc, SearchResult, CollectionId, VersionId, DocId } from '../../share/type.js';
import { DocumentChunk } from '../splitter.js';
import { ChunkWithVector } from '../qdrant.js';
import { AppConfig } from '../config.js';
import { DB } from '../db.js';

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
 * @interface IVersionService
 * @description 定义 Version 服务的接口，负责 Version 的 CRUD 操作和状态管理。
 */
export interface IVersionService {
  /**
   * 为指定 Collection 创建一个新的 Version。
   * @param collectionId 所属 Collection 的 ID。
   * @param name Version 的名称。
   * @param description Version 的描述（可选）。
   * @returns 包含新创建 Version 信息的 Promise。
   */
  createVersion(collectionId: CollectionId, name: string, description?: string): Promise<Version>;
  /**
   * 列出指定 Collection 下的所有 Version。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 包含所有 Version 数组的 Promise。
   */
  listVersions(collectionId: CollectionId): Promise<Version[]>;
  /**
   * 根据 ID 获取指定 Version。
   * @param versionId Version 的唯一标识符。
   * @returns 包含 Version 信息或 null 的 Promise。
   */
  getVersion(versionId: VersionId): Promise<Version | null>;
  /**
   * 更新指定 Version 的状态。
   * @param versionId Version 的唯一标识符。
   * @param status Version 的新状态。
   * @returns 无返回值的 Promise。
   */
  setVersionStatus(versionId: VersionId, status: Version['status']): Promise<void>;
  /**
   * 将指定 Version 设为当前版本。
   * @param versionId Version 的唯一标识符。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 无返回值的 Promise。
   */
  setCurrentVersion(versionId: VersionId, collectionId: CollectionId): Promise<void>;
  /**
   * 最终确定一个临时版本，并可能合并到现有版本。
   * @param temporaryVersionId 临时版本的 ID。
   * @returns 包含最终版本 ID 和是否为新版本信息的 Promise。
   */
  finalizeVersion(temporaryVersionId: VersionId): Promise<{ finalVersionId: VersionId; isNew: boolean }>;
  /**
   * 删除指定 Version。
   * @param versionId Version 的唯一标识符。
   * @returns 表示删除是否成功的 Promise。
   */
  deleteVersion(versionId: VersionId): Promise<boolean>;
}

/**
 * @interface IDocumentService
 * @description 定义 Document 服务的接口，负责 Document 的 CRUD 操作。
 */
export interface IDocumentService {
  /**
   * 创建一个新的 Document。
   * @param versionId 所属 Version 的 ID。
   * @param collectionId 所属 Collection 的 ID。
   * @param key 文档的唯一键。
   * @param content 文档的原始内容。
   * @param name 文档名称（可选）。
   * @param mime 文档的 MIME 类型（可选）。
   * @returns 包含新创建 Document 信息的 Promise。
   */
  createDoc(
    versionId: VersionId,
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
   * 列出指定 Version 下的所有 Document。
   * @param versionId 所属 Version 的 ID。
   * @returns 包含所有 Document 数组的 Promise。
   */
  listDocs(versionId: VersionId): Promise<Doc[]>;
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
   * @param versionId 所属 Version 的 ID。
   * @param key 文档的唯一键。
   * @param content 文档的原始内容。
   * @param name 文档名称（可选）。
   * @param mime 文档的 MIME 类型（可选）。
   * @param metadata 额外的元数据（可选）。
   * @returns 包含新创建 Document 信息的 Promise。
   */
  ingestDocument(
    collectionId: CollectionId,
    versionId: VersionId,
    key: string,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
    metadata?: any,
  ): Promise<Doc>;
}

/**
 * @interface Services
 * @description 定义服务层依赖注入的接口，聚合所有服务。
 */
export interface Services {
  collectionService: ICollectionService;
  versionService: IVersionService;
  documentService: IDocumentService;
  searchService: ISearchService;
  ingestionService: IIngestionService;
}

/**
 * @interface Infrastructure
 * @description 定义基础设施依赖注入的接口，聚合所有基础设施组件。
 */
export interface Infrastructure {
  db: DB;
  config: AppConfig;
  logger: ILogger;
}