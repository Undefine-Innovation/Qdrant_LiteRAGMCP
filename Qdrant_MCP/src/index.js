#!/usr/bin/env node

/**
 * @fileoverview This is the main entry point for the Qdrant MCP server, rebuilt using the FastMCP framework.
 * It initializes the server, defines and registers tools, and starts listening for requests.
 *
 * @fileoverview 这是 Qdrant MCP 服务器的主入口文件，使用 FastMCP 框架进行了重建。
 * 它负责初始化服务器、定义并注册工具，然后开始监听请求。
 */

import { FastMCP } from "fastmcp"; // Correct import for FastMCP server class
import { z } from "zod"; // Zod is re-exported by fastmcp, but it's safer to import directly if needed, or use fastmcp's re-export if available.
import { getQdrantClient } from "./qdrant-client.js";
import { getEmbeddingClient } from "./embedding-client.js";
import logger from './logger.js';

/**
 * @summary Defines the 'list_collections' tool as an object for FastMCP's addTool method.
 * This tool lists all collections in the Qdrant database.
 *
 * @summary 将 'list_collections' 工具定义为一个对象，用于 FastMCP 的 addTool 方法。
 * 此工具用于列出 Qdrant 数据库中的所有 collection。
 */
const listCollectionsToolDefinition = {
  name: 'list_collections',
  description: "Lists all collections in the Qdrant database.",
  parameters: z.object({}), // No input needed, using 'parameters' as per FastMCP example
  output: z.object({
    collections: z.array(z.object({
      name: z.string(),
    })),
  }),
  execute: async () => {
    logger.info("Executing list_collections tool");
    const client = getQdrantClient();
    const response = await client.getCollections();
    logger.info(`Found ${response.collections.length} collections.`);
    return {
      content: [
        {
          type: "text",
          text: `Found ${response.collections.length} collections: \n${response.collections
            .map((c) => `- ${c.name}`)
            .join("\n")}`,
        },
        {
          type: "text",
          text: JSON.stringify(response.collections, null, 2),
        }
      ],
    };
  }
};

/**
 * @summary Defines the 'search_collection' tool as an object for FastMCP's addTool method.
 * This tool searches a Qdrant collection using a text query.
 *
 * @summary 将 'search_collection' 工具定义为一个对象，用于 FastMCP 的 addTool 方法。
 * 此工具使用文本查询在 Qdrant collection 中进行搜索。
 */
const searchCollectionToolDefinition = {
  name: 'search_collection',
  description: `提示：为了获得更好的搜索结果，建议使用更口语化和具体的查询语句。例如，使用"React组件是什么？"或"如何创建React组件？"而不是简单的关键词。\n` +
                `此外，可以适当增加limit参数（建议设置为5-10之间）以获取更多相关结果，但不要设置得太高以免影响性能。`,
  parameters: z.object({ // Using 'parameters' as per FastMCP example
    collection_name: z.string().describe("The name of the collection to search in."),
    query_text: z.string().describe("The text to search for."),
    limit: z.number().describe("The maximum number of results to return.").default(3), // Added default for limit
  }),
  output: z.any(), // Define a more specific output schema if needed
  execute: async ({ collection_name, query_text, limit }) => {
    logger.info(`Executing search_collection for query "${query_text}" in collection "${collection_name}" with limit ${limit}`);
    
    // Step 1: Convert the text query to a vector.
    const { client: embeddingClient, model: modelName } = getEmbeddingClient();
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: modelName,
      input: query_text,
    });
    const vector = embeddingResponse.data[0].embedding;
    logger.info("Successfully converted query text to vector.");

    // Step 2: Search in the Qdrant collection.
    const qdrantClient = getQdrantClient();
    const searchResponse = await qdrantClient.search(collection_name, {
      vector: vector,
      limit: limit,
      with_payload: true,
    });
    logger.info(`Found ${searchResponse.length} results from Qdrant.`);

    // Step 3: Format and return the response.
    return {
      content: [
        {
          type: "text",
          text: `Found ${searchResponse.length} results in collection '${collection_name}' for query "${query_text}":\n\n` +
                `提示：为了获得更好的搜索结果，建议使用更口语化和具体的查询语句。例如，使用"React组件是什么？"或"如何创建React组件？"而不是简单的关键词。\n` +
                `此外，可以适当增加limit参数（建议设置为5-10之间）以获取更多相关结果，但不要设置得太高以免影响性能。`,
        },
        {
          type: "text",
          text: JSON.stringify(searchResponse, null, 2),
        },
      ],
    };
  }
};

/**
 * @summary Main function to create and start the FastMCP server.
 * @summary 创建并启动 FastMCP 服务器的主函数。
 */
async function main() {
  logger.info("Initializing FastMCP server...");
  
  // Create a new server instance, providing metadata.
  // 创建一个新的服务器实例，提供元数据。
  const server = new FastMCP({
    name: "qdrant-fastmcp-server",
    version: "1.0.0",
  });

  // Add tools to the server.
  // 将工具添加到服务器。
  server.addTool(listCollectionsToolDefinition);
  server.addTool(searchCollectionToolDefinition);

  // Start the server. It will automatically handle stdio transport.
  // 启动服务器。它将自动处理 stdio 传输。
  await server.start({ transportType: "stdio" }); // Explicitly specify stdio transport
  logger.info("FastMCP server started successfully.");
}

// Execute the main function and log any critical errors.
// 执行 main 函数并记录任何严重错误。
main().catch((error) => {
  logger.error("Server failed to start:", error);
  process.exit(1);
});