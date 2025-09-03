import OpenAI from "openai";

let embeddingClient;
let modelName;

/**
 * @summary Initializes and returns a singleton instance of the OpenAI client for embeddings.
 * It reads configuration from environment variables.
 *
 * @summary 初始化并返回一个用于嵌入的 OpenAI 客户端单例实例。
 * 它会从环境变量中读取配置。
 *
 * @returns {{client: OpenAI, model: string}} An object containing the client instance and the model name.
 */
export function getEmbeddingClient() {
  if (!embeddingClient) {
    const apiKey = process.env.EMBEDDING_API_KEY;
    const apiUrl = process.env.EMBEDDING_API_URL;
    modelName = process.env.EMBEDDING_MODEL_NAME;

    if (!apiKey || !apiUrl || !modelName) {
      throw new Error(
        "Missing required environment variables for embedding client: EMBEDDING_API_KEY, EMBEDDING_API_URL, EMBEDDING_MODEL_NAME"
      );
    }

    embeddingClient = new OpenAI({
      apiKey: apiKey,
      baseURL: apiUrl,
    });
  }

  return { client: embeddingClient, model: modelName };
}