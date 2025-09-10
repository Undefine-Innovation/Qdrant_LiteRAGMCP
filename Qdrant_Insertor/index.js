import config from './config.ts';
import { loadDocuments } from './src/loader.ts';
import { splitDocuments } from './src/splitter.ts';
import { embedChunks } from './src/embedding.ts';
import { ensureCollection, upsertChunks } from './src/qdrant.ts';

/**
 * The main function to run the entire document processing pipeline.
 * 运行整个文档处理流程的主函数。
 * @param {string} docsPath - The path to the documents directory. / 文档目录的路径。
 */
async function main(docsPath) {
  console.log(`Starting document processing pipeline for: ${docsPath}`);

  // 1. Ensure Qdrant collection exists
  // 1. 确保 Qdrant 集合存在
  try {
    await ensureCollection();
  } catch (error) {
    console.error('Failed to ensure Qdrant collection. Aborting.', error);
    return; // Exit if we can't connect to Qdrant or create a collection
  }

  // 2. Load documents from the specified path
  // 2. 从指定路径加载文档
  const documents = await loadDocuments(docsPath);
  if (documents.length === 0) {
    console.log(`No documents found in ${docsPath}. Exiting.`);
    return;
  }

  // 3. Split documents into chunks
  // 3. 将文档分割成块
  const chunks = splitDocuments(documents);
  console.log(`Split ${documents.length} documents into ${chunks.length} chunks.`);

  // 4. Create embeddings for the chunks
  // 4. 为文本块创建向量
  const chunksWithVectors = await embedChunks(chunks);
  console.log(`Successfully created embeddings for ${chunksWithVectors.length} chunks.`);

  // 5. Upsert the vectorized chunks into Qdrant
  // 5. 将向量化的块上传到 Qdrant
  await upsertChunks(chunksWithVectors);

  console.log('----------------------------------------');
  console.log('Document processing pipeline finished!');
  console.log('----------------------------------------');
}

// --- Application Entry Point ---
// --- 应用程序入口点 ---
// The first command-line argument after the script name is our path
// 脚本名称后的第一个命令行参数是我们的路径
const customPath = process.argv[2];
const docsPath = customPath || config.docs.path;

main(docsPath).catch(error => {
  console.error('An unexpected error occurred in the main process:', error);
});