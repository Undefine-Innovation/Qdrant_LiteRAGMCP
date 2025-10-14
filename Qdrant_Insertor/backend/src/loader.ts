import fs from 'fs/promises';
import path from 'path';
import {glob} from 'glob';
import {error} from 'console';

/**
 * Finds all .md and .txt files in the specified directory.
 * 在指定目录中查找所有的 .md 和 .txt 文件。
 * @param {string} directoryPath - The path to the directory to search. / 要搜索的目录路径。
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths. / 一个解析为文件路径数组的 Promise。
 */
async function findDocuments(directoryPath:string):Promise<string[]> {
  const pattern = '**/*.{md,txt}';
  const options = {
    cwd: directoryPath,
    nodir: true,
    absolute: true
  };
  try {
    const files = await glob(pattern, options);
    console.log(`Found ${files.length} documents in ${directoryPath}`);
    return files;
  } catch (error) {
    console.error(`Error finding documents in ${directoryPath}:`, error);
    return [];
  }
};

/**
 * Reads the content of a single file.
 * 读取单个文件的内容。
 * @param {string} filePath - The path to the file. / 文件路径。
 * @returns {Promise<{path: string, content: string} | null>} A promise that resolves to an object with file path and content, or null if reading fails. / 一个解析为包含文件路径和内容对象的 Promise，如果读取失败则为 null。
 */
async function readFileContent(filePath:string):Promise<{path: string, content: string} | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {path: filePath, content};
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Loads all documents from a given directory.
 * 从给定目录加载所有文档。
 * @param {string} directoryPath - The path to the directory containing documents. / 包含文档的目录路径。
 * @returns {Promise<Array<{path: string, content: string}>>} A promise that resolves to an array of document objects. / 一个解析为文档对象数组的 Promise。
 */
export async function loadDocuments(directoryPath:string):Promise<Array<{path: string, content: string}>> {
  const filePaths = await findDocuments(directoryPath);
  const documents = await Promise.all(filePaths.map(readFileContent));
  // Filter out any files that failed to read
  return documents.filter(doc => doc !== null);
}