import { getQdrantClient } from "./qdrant-client.js";
import { getEmbeddingClient } from "./embedding-client.js";
import { z } from "zod";

/**
 * @summary This module defines all the MCP tools for interacting with Qdrant.
 * @summary 此模块定义了所有用于与 Qdrant 交互的 MCP 工具。
 */

/**
 * @summary Tool to list all collections in the Qdrant database.
 * It takes no input and returns a list of collection names.
 *
 * @summary 用于列出 Qdrant 数据库中所有 collection 的工具。
 * 它没有输入，并返回一个 collection 名称的列表。
 */
export const listCollectionsTool = {
  // The name of the tool.
  // 工具的名称。
  name: "list_collections",

  // A description of what the tool does.
  // 工具功能的描述。
  description: "Lists all collections in the Qdrant database.",

  // The input schema, defined using Zod. This tool has no inputs.
  // 使用 Zod 定义的输入 schema。此工具没有输入。
  inputSchema: {},

  // The function that executes the tool's logic.
  // 执行工具逻辑的函数。
  async execute() {
    // Step 1: Get the Qdrant client instance.
    // 步骤 1: 获取 Qdrant 客户端实例。
    const client = getQdrantClient();

    // Step 2: Call the Qdrant API to get the list of collections.
    // 步骤 2: 调用 Qdrant API 获取 collection 列表。
    const response = await client.getCollections();

    // Step 3: Format the response into the MCP content structure.
    // 步骤 3: 将响应格式化为 MCP content 结构。
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
  },
};

/**
 * @summary Tool to search for vectors in a specific Qdrant collection using a text query.
 * It converts the text query to a vector using an embedding model and then performs the search.
 *
 * @summary 使用文本查询在指定的 Qdrant collection 中搜索向量的工具。
 * 它会使用嵌入模型将文本查询转换为向量，然后执行搜索。
 */
export const searchCollectionTool = {
  name: "search_collection",
  description: `提示：为了获得更好的搜索结果，建议使用更口语化和具体的查询语句。例如，使用"React组件是什么？"或"如何创建React组件？"而不是简单的关键词。\n` +
                `此外，可以适当增加limit参数（建议设置为5-10之间）以获取更多相关结果，但不要设置得太高以免影响性能。`,
  inputSchema: z.object({
    collection_name: z.string(),
    query_text: z.string(),
    limit: z.number(),
  }),
  async execute({ collection_name, query_text, limit }) {
    // Step 1: Convert the text query to a vector.
    // 步骤 1: 将文本查询转换为向量。
    const { client: embeddingClient, model: modelName } = getEmbeddingClient();
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: modelName,
      input: query_text,
    });
    const vector = embeddingResponse.data[0].embedding;

    // Step 2: Use the vector to search in the Qdrant collection.
    // 步骤 2: 使用向量在 Qdrant collection 中进行搜索。
    const qdrantClient = getQdrantClient();
    const searchResponse = await qdrantClient.search(collection_name, {
      vector: vector,
      limit: limit,
      with_payload: true,
    });

    // Step 3: Format the response.
    // 步骤 3: 格式化响应。
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
  },
};