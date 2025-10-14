import { loadDocuments } from './loader.js';
import { splitDocuments } from './splitter.js';
import { embedChunks } from './embedding.js';
import { ensureCollection, upsertChunks } from './qdrant.js';
import { info, error } from './logger.js';
import { validateConfig, AppConfig } from './config.js';
import { createApp } from './api.js';
import { Chunk, ChunkWithVector, DocId, VersionId, CollectionId, PointId } from '../../share/type.js'; // 导入更多类型
import { makeDocId, makeVersionId, makeCollectionId, makePointId } from '../../share/utils/id.js'; // 导入 ID 生成函数

async function main() {
  const config: AppConfig = validateConfig(); // 加载配置

  info('程序启动，开始处理文档...');

  // 启动 API 服务
  const app = createApp();
  const apiPort = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3000;
  app.listen(apiPort, () => {
    info(`API 服务已在端口 ${apiPort} 上启动。`);
  });

  // 确保 Qdrant 集合存在
  await ensureCollection();
  info(`Qdrant 集合 '${config.qdrant.collection}' 已准备就绪。`);

  const pollingInterval = 5000; // 默认等待 5 秒
  const errorRetryInterval = 10000; // 错误后等待 10 秒

  while (true) {
    try {
      info('开始加载文档...');
      // 假设 loadDocuments 接受一个路径作为参数，这里硬编码一个示例路径
      const documents = await loadDocuments('./docs'); // 假设文档源为 ./docs

      if (documents.length === 0) {
        info('没有新文档可加载，等待下一轮...');
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        continue;
      }

      info(`加载了 ${documents.length} 份文档，开始分割...`);
      const documentSource = './docs'; // 硬编码文档源
      const documents = await loadDocuments(documentSource);

      if (documents.length === 0) {
        info('没有新文档可加载，等待下一轮...');
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        continue;
      }

      info(`加载了 ${documents.length} 份文档，开始分割...`);
      const rawChunks = await splitDocuments(documents); // splitDocuments 返回 DocumentChunk[]

      // 模拟生成 Chunk 所需的元数据
      const collectionId: CollectionId = makeCollectionId('default-collection');
      const versionId: VersionId = makeVersionId('default-version');
      const docId: DocId = makeDocId('default-doc'); // 假设所有文档来自同一个逻辑文档

      const chunks: Chunk[] = rawChunks.map((rawChunk, index) => ({
        ...rawChunk,
        pointId: makePointId(`${docId}#${index}`),
        docId: docId,
        versionId: versionId,
        collectionId: collectionId,
        chunkIndex: index,
        contentHash: makeDocId(rawChunk.content), // 简单哈希内容
        created_at: Date.now(),
      }));

      info(`文档分割成 ${chunks.length} 个块，开始创建嵌入...`);
      const embeddedChunks: ChunkWithVector[] = await embedChunks(chunks);

      info(`嵌入创建完成，开始存储到 Qdrant...`);
      await upsertChunks(embeddedChunks);

      info('文档处理完成，等待下一轮...');
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    } catch (err) {
      error(`处理过程中发生错误: ${(err as Error).message}`, err);
      await new Promise(resolve => setTimeout(resolve, config.errorRetryInterval));
    }
  }
}

main().catch(err => {
  error(`主程序意外终止: ${(err as Error).message}`, err);
  process.exit(1);
});