import { QdrantClient } from "@qdrant/qdrant-js";

/**
 * @summary This module is responsible for initializing and exporting a singleton Qdrant client.
 * @summary 此模块负责初始化和导出一个 Qdrant 客户端的单例。
 */

// Store the client instance to ensure it's a singleton.
// 存储客户端实例以确保它是单例。
let qdrantClient;

/**
 * @summary Initializes and returns a singleton instance of the Qdrant client.
 * It retrieves the QDRANT_URL from environment variables.
 *
 * @summary 初始化并返回 Qdrant 客户端的单例实例。
 * 它会从环境变量中检索 QDRANT_URL。
 *
 * @returns {QdrantClient} The initialized Qdrant client.
 * @throws {Error} If the QDRANT_URL environment variable is not set.
 */
export function getQdrantClient() {
  // Step 1: Check if the client is already initialized.
  // 步骤 1: 检查客户端是否已初始化。
  if (!qdrantClient) {
    // Step 2: Get the Qdrant URL from environment variables.
    // 步骤 2: 从环境变量中获取 Qdrant URL。
    const qdrantUrl = process.env.QDRANT_URL;

    // Step 3: Validate that the URL is provided.
    // 步骤 3: 验证是否提供了 URL。
    if (!qdrantUrl) {
      // This error will be caught by the MCP server and reported to the user.
      // 这个错误将被 MCP 服务器捕获并报告给用户。
      throw new Error("QDRANT_URL environment variable is not set.");
    }

    // Step 4: Create and configure the new client instance.
    // 步骤 4: 创建并配置新的客户端实例。
    qdrantClient = new QdrantClient({
      url: qdrantUrl,
      // No API key is needed for local setup as per user's instruction.
      // 根据用户的指示，本地设置不需要 API 密钥。
    });
  }

  // Step 5: Return the singleton instance.
  // 步骤 5: 返回单例实例。
  return qdrantClient;
}