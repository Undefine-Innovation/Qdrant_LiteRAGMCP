import { CollectionId, Doc } from '../entities/types.js';

/**
 * 导入文件并执行完整索引流程的用例输入
 */
export interface ImportAndIndexInput {
  /**
   * 上传的文件对象
   */
  file: Express.Multer.File;

  /**
   * 目标集合 ID
   */
  collectionId: CollectionId;
}

/**
 * 导入并索引用例接口
 *
 * 封装完整的文档导入和索引流程：
 * 1. 导入文件到数据库
 * 2. 触发状态机执行拆分
 * 3. 生成嵌入向量
 * 4. 上传到 Qdrant 索引
 *
 * 提供统一的、声明式的导入-索引操作，隐藏复杂的内部实现细节。
 */
export interface IImportAndIndexUseCase {
  /**
   * 执行导入和索引用例
   *
   * 流程：
   * - 导入文件到本地数据库（SQLite）
   * - 触发状态机开始处理
   * - 状态机自动执行：拆分 → 嵌入 → Qdrant 索引
   *
   * @param input 包含文件和集合信息的输入参数
   * @returns 返回导入后的文档对象
   * @throws {AppError} 如果导入或索引过程失败
   *
   * @example
   * ```typescript
   * const doc = await useCase.execute({
   *   file: req.file,
   *   collectionId: collectionId as CollectionId,
   * });
   * console.log(`导入成功，文档 ID: ${doc.id}`);
   * ```
   */
  execute(input: ImportAndIndexInput): Promise<Doc>;
}
