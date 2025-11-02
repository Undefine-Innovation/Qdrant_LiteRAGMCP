/**
 * @file Defines the interface for an embedding provider.
 */

/**
 * Represents a provider that can generate embeddings for a list of texts.
 */
export interface IEmbeddingProvider {
  /**
   * Generates embeddings for the given texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A promise that resolves to an array of number arrays, where each inner array is the embedding for the corresponding text.
   */
  generate(texts: string[]): Promise<number[][]>;
}
