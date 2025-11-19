/**
 * E2E测试辅助函数
 * 提供常用的测试工具和模拟数据
 */

import { TestUtils } from '../setup';
import type { Collection, Document, SearchResult } from '../../../src/types';

/**
 * 测试数据工厂
 */
export class TestDataFactory {
  /**
   * 创建测试集合
   */
  static createCollection(overrides: Partial<Collection> = {}): Collection {
    return {
      collectionId: `test-collection-${Date.now()}`,
      name: '测试集合',
      description: '这是一个测试集合',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentCount: 0,
      ...overrides,
    };
  }

  /**
   * 创建测试文档
   */
  static createDocument(overrides: Partial<Document> = {}): Document {
    return {
      docId: `test-doc-${Date.now()}`,
      collectionId: 'test-collection',
      name: '测试文档.txt',
      type: 'text/plain',
      size: 1024,
      status: 'synced',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: '这是一个测试文档的内容',
      ...overrides,
    };
  }

  /**
   * 创建测试搜索结果
   */
  static createSearchResult(
    overrides: Partial<SearchResult> = {},
  ): SearchResult {
    return {
      content: '这是搜索结果的内容片段',
      score: 0.95,
      metadata: {
        docId: `test-doc-${Date.now()}`,
        docName: '测试文档.txt',
        collectionId: 'test-collection',
        collectionName: '测试集合',
        chunkIndex: 0,
        totalChunks: 1,
      },
      ...overrides,
    };
  }

  /**
   * 创建多个测试集合
   */
  static createCollections(count: number): Collection[] {
    return Array.from({ length: count }, (_, index) =>
      this.createCollection({
        collectionId: `test-collection-${index}`,
        name: `测试集合 ${index + 1}`,
        description: `这是第 ${index + 1} 个测试集合`,
      }),
    );
  }

  /**
   * 创建多个测试文档
   */
  static createDocuments(
    count: number,
    collectionId: string = 'test-collection',
  ): Document[] {
    return Array.from({ length: count }, (_, index) =>
      this.createDocument({
        docId: `test-doc-${index}`,
        collectionId,
        name: `测试文档 ${index + 1}.txt`,
        content: `这是第 ${index + 1} 个测试文档的内容`,
      }),
    );
  }

  /**
   * 创建多个测试搜索结果
   */
  static createSearchResults(count: number): SearchResult[] {
    return Array.from({ length: count }, (_, index) =>
      this.createSearchResult({
        content: `搜索结果内容片段 ${index + 1}`,
        score: 0.9 - index * 0.1,
        metadata: {
          docId: `test-doc-${index}`,
          docName: `测试文档 ${index + 1}.txt`,
          collectionId: 'test-collection',
          collectionName: '测试集合',
          chunkIndex: index,
          totalChunks: count,
        },
      }),
    );
  }

  /**
   * 创建模拟文件
   */
  static createMockFile(
    name: string,
    type: string,
    content: string = '',
  ): File {
    const file = new File([content], name, { type });
    Object.defineProperty(file, 'size', { value: content.length });
    return file;
  }

  /**
   * 创建模拟文件列表
   */
  static createMockFileList(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  }
}

/**
 * API模拟工厂
 */
export class ApiMockFactory {
  /**
   * 模拟集合API响应
   */
  static mockCollectionsApi() {
    return {
      getCollections: jest.fn().mockResolvedValue({
        data: TestDataFactory.createCollections(3),
        pagination: {
          page: 1,
          totalPages: 1,
          total: 3,
          limit: 20,
        },
      }),
      createCollection: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createCollection()),
      updateCollection: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createCollection()),
      deleteCollection: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  /**
   * 模拟文档API响应
   */
  static mockDocumentsApi() {
    return {
      getDocuments: jest.fn().mockResolvedValue({
        data: TestDataFactory.createDocuments(5),
        pagination: {
          page: 1,
          totalPages: 1,
          total: 5,
          limit: 20,
        },
      }),
      uploadDocument: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createDocument()),
      uploadToCollection: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createDocument()),
      deleteDocument: jest.fn().mockResolvedValue({ success: true }),
      resyncDocument: jest.fn().mockResolvedValue({ success: true }),
      getDocument: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createDocument()),
    };
  }

  /**
   * 模拟搜索API响应
   */
  static mockSearchApi() {
    return {
      search: jest
        .fn()
        .mockResolvedValue(TestDataFactory.createSearchResults(3)),
      searchPaginated: jest.fn().mockResolvedValue({
        data: TestDataFactory.createSearchResults(3),
        pagination: {
          page: 1,
          totalPages: 1,
          total: 3,
          limit: 20,
        },
      }),
    };
  }

  /**
   * 模拟批量操作API响应
   */
  static mockBatchApi() {
    return {
      batchUpload: jest.fn().mockResolvedValue({
        success: true,
        total: 5,
        successful: 5,
        failed: 0,
        results: TestDataFactory.createDocuments(5),
      }),
      batchDelete: jest.fn().mockResolvedValue({
        success: true,
        total: 3,
        successful: 3,
        failed: 0,
      }),
    };
  }

  /**
   * 模拟通用API响应
   */
  static mockCommonApi() {
    return {
      healthCheck: jest.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

/**
 * 组件测试辅助函数
 */
export class ComponentTestHelpers {
  /**
   * 模拟用户输入
   */
  static simulateUserInput(element: HTMLElement, value: string) {
    element.focus();
    element.dispatchEvent(new Event('focus', { bubbles: true }));

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * 创建模拟文件列表
   */
  static createMockFileList(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  }

  /**
   * 模拟文件拖拽
   */
  static simulateFileDrop(element: HTMLElement, files: File[]) {
    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
    });
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
    });
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    });

    // 添加文件到dataTransfer
    files.forEach(file => {
      (dropEvent.dataTransfer as DataTransfer).items.add(file);
    });

    element.dispatchEvent(dragEnterEvent);
    element.dispatchEvent(dragOverEvent);
    element.dispatchEvent(dropEvent);
  }

  /**
   * 模拟点击事件
   */
  static simulateClick(element: HTMLElement) {
    element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  /**
   * 模拟键盘事件
   */
  static simulateKeyboard(
    element: HTMLElement,
    key: string,
    options: KeyboardEventInit = {},
  ) {
    const keydownEvent = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    const keyupEvent = new KeyboardEvent('keyup', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keyupEvent);
  }

  /**
   * 等待元素出现
   */
  static async waitForElement(
    selector: string,
    timeout: number = 5000,
  ): Promise<Element | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
      await TestUtils.wait(100);
    }

    return null;
  }

  /**
   * 等待元素消失
   */
  static async waitForElementToDisappear(
    selector: string,
    timeout: number = 5000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (!element) {
        return true;
      }
      await TestUtils.wait(100);
    }

    return false;
  }
}

/**
 * 断言辅助函数
 */
export class AssertionHelpers {
  /**
   * 断言元素存在
   */
  static assertElementExists(selector: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element with selector "${selector}" should exist`);
    }
  }

  /**
   * 断言元素不存在
   */
  static assertElementNotExists(selector: string) {
    const element = document.querySelector(selector);
    if (element) {
      throw new Error(`Element with selector "${selector}" should not exist`);
    }
  }

  /**
   * 断言元素可见
   */
  static assertElementVisible(selector: string) {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      throw new Error(`Element with selector "${selector}" should exist`);
    }
    if (element.offsetParent === null) {
      throw new Error(`Element with selector "${selector}" should be visible`);
    }
  }

  /**
   * 断言元素隐藏
   */
  static assertElementHidden(selector: string) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.offsetParent !== null) {
      throw new Error(`Element with selector "${selector}" should be hidden`);
    }
  }

  /**
   * 断言元素文本内容
   */
  static assertElementText(selector: string, expectedText: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element with selector "${selector}" should exist`);
    }
    if (element.textContent !== expectedText) {
      throw new Error(
        `Element with selector "${selector}" should have text "${expectedText}", but has "${element.textContent}"`,
      );
    }
  }

  /**
   * 断言元素包含文本
   */
  static assertElementContainsText(selector: string, expectedText: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element with selector "${selector}" should exist`);
    }
    if (!element.textContent?.includes(expectedText)) {
      throw new Error(
        `Element with selector "${selector}" should contain text "${expectedText}", but has "${element.textContent}"`,
      );
    }
  }

  /**
   * 断言元素属性值
   */
  static assertElementAttribute(
    selector: string,
    attribute: string,
    expectedValue: string,
  ) {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      throw new Error(`Element with selector "${selector}" should exist`);
    }
    const actualValue = element.getAttribute(attribute);
    if (actualValue !== expectedValue) {
      throw new Error(
        `Element with selector "${selector}" should have attribute "${attribute}" with value "${expectedValue}", but has "${actualValue}"`,
      );
    }
  }
}
