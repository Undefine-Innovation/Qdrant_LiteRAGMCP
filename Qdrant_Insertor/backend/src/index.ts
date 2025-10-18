import { loadDocuments } from './loader.js';
import { MarkdownSplitter } from './infrastructure/MarkdownSplitter.js';
import { QdrantRepo } from './infrastructure/QdrantRepo.js';
import { info, error } from './logger.js';
import { createOpenAIEmbeddingProviderFromConfig } from './infrastructure/OpenAIEmbeddingProvider.js';
import { validateConfig, AppConfig } from './config.js';
import { createApp } from './api.js';
import { Chunk, ChunkWithVector, DocId, CollectionId, PointId } from '../../share/type.js'; // 导入更多类型
import { makeDocId, makeCollectionId, makePointId } from '../../share/utils/id.js'; // 导入 ID 生成函数
// DEPRECATED: Version concept has been removed from the architecture

async function main() {
  const config: AppConfig = validateConfig(); // 加载配置
  const qdrantRepo = new QdrantRepo(config);
  const embeddingProvider = createOpenAIEmbeddingProviderFromConfig();
  const splitter = new MarkdownSplitter();

  info('程序启动，开始处理文档...');

  // 启动 API 服务
  const app = createApp({ embeddingProvider });
  const apiPort = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3000;
  app.listen(apiPort, () => {
    info(`API 服务已在端口 ${apiPort} 上启动。`);
  });

  // 确保 Qdrant 集合存在
  await qdrantRepo.ensureCollection();
  info(`Qdrant 集合 '${config.qdrant.collection}' 已准备就绪。`);

  const pollingInterval = 5000; // 默认等待 5 秒
  const errorRetryInterval = 10000; // 错误后等待 10 秒

  while (true) {
    try {
      info('开始加载文档...');
      const documentSource = './docs'; // 硬编码文档源
      const documents = await loadDocuments(documentSource);

      if (documents.length === 0) {
        info('没有新文档可加载，等待下一轮...');
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        continue;
      }

      info(`加载了 ${documents.length} 份文档，开始分割...`);
      const collectionId = makeCollectionId() as CollectionId;

      const chunks: Chunk[] = [];
      for (const doc of documents) {
        const docId = makeDocId(doc.content) as DocId;
        const docChunks = splitter.split(doc.content, { docPath: doc.path });
        for (const [index, rawChunk] of docChunks.entries()) {
          chunks.push({
            pointId: makePointId(docId, index) as PointId,
            docId: docId,
            collectionId: collectionId,
            chunkIndex: index,
            content: rawChunk.content,
            titleChain: rawChunk.titleChain?.join(' > '),
            contentHash: makeDocId(rawChunk.content),
            created_at: Date.now(),
          });
        }
      }

      info(`文档分割成 ${chunks.length} 个块，开始创建嵌入...`);
      const vectors = await embeddingProvider.generate(chunks.map(c => c.content));
      const embeddedChunks: (ChunkWithVector & { content: string })[] = chunks.map((chunk, i) => ({
        ...chunk,
        vector: vectors[i],
        content: chunk.content,
      }));

      info(`嵌入创建完成，开始存储到 Qdrant...`);
      await qdrantRepo.upsertChunks(embeddedChunks);

      info('文档处理完成，等待下一轮...');
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    } catch (err) {
      error(`处理过程中发生错误: ${(err as Error).message}`, err);
      await new Promise(resolve => setTimeout(resolve, errorRetryInterval));
    }
  }
}

main().catch(err => {
  error(`主程序意外终止: ${(err as Error).message}`, err);
  process.exit(1);
});