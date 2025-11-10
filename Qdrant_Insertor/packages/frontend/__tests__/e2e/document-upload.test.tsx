/**
 * 文档上传流程E2E测试
 * 测试单个文档和批量文档上传功能
 */

// jest.mock MUST come before imports
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  documentsApi: {
    getDocuments: jest.fn(() =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, totalPages: 1, total: 0, limit: 20 },
      }),
    ),
    uploadDocument: jest.fn(() =>
      Promise.resolve({
        docId: 'mock-doc',
        collectionId: 'mock-collection',
        name: '测试文档.txt',
        size: 1024,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    getDocument: jest.fn(() =>
      Promise.resolve({
        docId: 'mock-doc',
        collectionId: 'mock-collection',
        name: '测试文档.txt',
        size: 1024,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    deleteDocument: jest.fn(() => Promise.resolve({ success: true })),
    deleteDocuments: jest.fn(() => Promise.resolve({ deleted: 0 })),
  },
  collectionsApi: {
    getCollections: jest.fn(() =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, totalPages: 1, total: 0, limit: 20 },
      }),
    ),
    createCollection: jest.fn(() =>
      Promise.resolve({
        collectionId: 'mock-collection',
        name: '测试集合',
        description: '这是一个测试集合',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: 0,
      }),
    ),
    updateCollection: jest.fn(() =>
      Promise.resolve({
        collectionId: 'mock-collection',
        name: '测试集合',
        description: '这是一个测试集合',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: 0,
      }),
    ),
    deleteCollection: jest.fn(() => Promise.resolve({ success: true })),
  },
  default: {},
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import DocumentUpload from '../../src/components/DocumentUpload';
import BatchDocumentUpload from '../../src/components/BatchDocumentUpload';
import DocumentsPage from '../../src/pages/DocumentsPage';

// Test Helpers (after jest.mock to avoid circular dependencies)
const TestDataFactory = {
  createMockFile: (name: string, type: string, content = '') =>
    new File([content], name, { type }),
  createDocument: () => ({
    docId: `test-doc-${Date.now()}`,
    collectionId: 'test-collection',
    name: '测试文档.txt',
    size: 1024,
    status: 'processing' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  createDocuments: (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      docId: `test-doc-${i}`,
      collectionId: 'test-collection',
      name: `测试文档 ${i + 1}.txt`,
      size: 1024,
      status: 'processing' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
};

const ComponentTestHelpers = {
  createMockFileList: (files: File[]) => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    return dt.files;
  },
  simulateFileDrop: (element: HTMLElement, files: File[]) => {
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: ComponentTestHelpers.createMockFileList(files) },
    });
    element.dispatchEvent(dropEvent);
  },
};

const AssertionHelpers = {
  assertElementExists: (sel: string) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element ${sel} not found`);
  },
  assertElementContainsText: (sel: string, text: string) => {
    const el = document.querySelector(sel);
    if (!el?.textContent?.includes(text))
      throw new Error(
        `${sel} does not contain "${text}", has: "${el?.textContent}"`,
      );
  },
  assertElementNotExists: (sel: string) => {
    const el = document.querySelector(sel);
    if (el) throw new Error(`Element ${sel} should not exist`);
  },
};

describe('文档上传流程测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('单个文档上传', () => {
    it('应该显示文档上传组件', () => {
      const mockOnUpload = jest.fn();

      render(<DocumentUpload onUpload={mockOnUpload} />);

      // 验证上传区域存在
      AssertionHelpers.assertElementExists('[data-testid="document-upload"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-upload"]',
        '拖拽文件到此处或点击选择',
      );

      // 验证支持的文件类型显示
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-upload"]',
        '.txt,.md,.pdf,.doc,.docx',
      );

      // 验证选择文件按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="select-files-button"]',
      );
    });

    it('应该处理文件选择事件', async () => {
      const mockOnUpload = jest.fn().mockResolvedValue(undefined);
      const testFile = TestDataFactory.createMockFile(
        'test.txt',
        'text/plain',
        '测试内容',
      );

      render(<DocumentUpload onUpload={mockOnUpload} />);

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList([testFile]);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证上传函数被调用
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(files);
      });
    });

    it('应该处理文件拖拽事件', async () => {
      const mockOnUpload = jest.fn().mockResolvedValue(undefined);
      const testFile = TestDataFactory.createMockFile(
        'test.txt',
        'text/plain',
        '测试内容',
      );

      render(<DocumentUpload onUpload={mockOnUpload} />);

      // 模拟文件拖拽
      const uploadArea = screen.getByTestId('document-upload');
      ComponentTestHelpers.simulateFileDrop(uploadArea, [testFile]);

      // 验证上传函数被调用
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });
    });

    it('应该显示上传进度', async () => {
      const mockOnUpload = jest.fn().mockImplementation(async () => {
        // 模拟上传延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      const testFile = TestDataFactory.createMockFile(
        'test.txt',
        'text/plain',
        '测试内容',
      );

      render(<DocumentUpload onUpload={mockOnUpload} />);

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList([testFile]);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证上传进度显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="upload-progress"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="upload-progress"]',
          '1 / 1 文件',
        );
      });
    });

    it('应该处理上传错误', async () => {
      const mockOnUpload = jest.fn().mockRejectedValue(new Error('上传失败'));
      const testFile = TestDataFactory.createMockFile(
        'test.txt',
        'text/plain',
        '测试内容',
      );

      render(<DocumentUpload onUpload={mockOnUpload} />);

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList([testFile]);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证错误处理
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });
    });
  });

  describe('批量文档上传', () => {
    it('应该显示批量上传组件', () => {
      const mockOnComplete = jest.fn();

      render(<BatchDocumentUpload onComplete={mockOnComplete} />);

      // 验证批量上传区域存在
      AssertionHelpers.assertElementExists(
        '[data-testid="batch-document-upload"]',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="batch-document-upload"]',
        '拖拽文件到此处或点击选择',
      );
    });

    it('应该处理多个文件选择', async () => {
      const mockOnBatchUpload = jest.fn().mockResolvedValue({
        success: true,
        total: 2,
        successful: 2,
        failed: 0,
        results: TestDataFactory.createDocuments(2),
      });

      const testFiles = [
        TestDataFactory.createMockFile('test1.txt', 'text/plain', '测试内容1'),
        TestDataFactory.createMockFile('test2.txt', 'text/plain', '测试内容2'),
      ];

      render(
        <BatchDocumentUpload
          onBatchUpload={mockOnBatchUpload}
          onComplete={jest.fn()}
        />,
      );

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证文件列表显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="selected-files-list"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="selected-files-list"]',
          'test1.txt',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="selected-files-list"]',
          'test2.txt',
        );
      });

      // 点击开始上传按钮
      const uploadButton = screen.getByTestId('start-batch-upload');
      fireEvent.click(uploadButton);

      // 验证批量上传函数被调用
      await waitFor(() => {
        expect(mockOnBatchUpload).toHaveBeenCalledWith(files, undefined);
      });
    });

    it('应该显示批量上传进度', async () => {
      const mockOnBatchUpload = jest.fn().mockImplementation(async () => {
        // 模拟上传延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          success: true,
          total: 2,
          successful: 2,
          failed: 0,
          results: TestDataFactory.createDocuments(2),
        };
      });

      const testFiles = [
        TestDataFactory.createMockFile('test1.txt', 'text/plain', '测试内容1'),
        TestDataFactory.createMockFile('test2.txt', 'text/plain', '测试内容2'),
      ];

      render(
        <BatchDocumentUpload
          onBatchUpload={mockOnBatchUpload}
          onComplete={jest.fn()}
        />,
      );

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 点击开始上传按钮
      const uploadButton = screen.getByTestId('start-batch-upload');
      fireEvent.click(uploadButton);

      // 验证上传进度显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="batch-upload-progress"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="batch-upload-progress"]',
          '批量上传中...',
        );
      });
    });

    it('应该处理部分上传失败', async () => {
      const mockOnBatchUpload = jest.fn().mockResolvedValue({
        success: true,
        total: 3,
        successful: 2,
        failed: 1,
        results: [
          ...TestDataFactory.createDocuments(2),
          {
            ...TestDataFactory.createDocument(),
            docId: 'failed-doc',
            error: '文件格式不支持',
          },
        ],
      });

      const testFiles = [
        TestDataFactory.createMockFile('test1.txt', 'text/plain', '测试内容1'),
        TestDataFactory.createMockFile('test2.txt', 'text/plain', '测试内容2'),
        TestDataFactory.createMockFile(
          'test3.exe',
          'application/x-executable',
          '可执行文件',
        ),
      ];

      render(
        <BatchDocumentUpload
          onBatchUpload={mockOnBatchUpload}
          onComplete={jest.fn()}
        />,
      );

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 点击开始上传按钮
      const uploadButton = screen.getByTestId('start-batch-upload');
      fireEvent.click(uploadButton);

      // 验证部分失败结果
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="upload-results"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="upload-results"]',
          '成功: 2',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="upload-results"]',
          '失败: 1',
        );
      });
    });

    it('应该允许移除选中的文件', async () => {
      const testFiles = [
        TestDataFactory.createMockFile('test1.txt', 'text/plain', '测试内容1'),
        TestDataFactory.createMockFile('test2.txt', 'text/plain', '测试内容2'),
      ];

      render(<BatchDocumentUpload onComplete={jest.fn()} />);

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证文件列表显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="selected-files-list"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="selected-files-list"]',
          'test1.txt',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="selected-files-list"]',
          'test2.txt',
        );
      });

      // 点击移除第一个文件
      const removeButton = screen.getByTestId('remove-file-0');
      fireEvent.click(removeButton);

      // 验证文件被移除
      await waitFor(() => {
        AssertionHelpers.assertElementNotExists(
          '[data-testid="remove-file-0"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="selected-files-list"]',
          'test2.txt',
        );
      });
    });

    it('应该允许清空所有选中的文件', async () => {
      const testFiles = [
        TestDataFactory.createMockFile('test1.txt', 'text/plain', '测试内容1'),
        TestDataFactory.createMockFile('test2.txt', 'text/plain', '测试内容2'),
      ];

      render(<BatchDocumentUpload onComplete={jest.fn()} />);

      // 模拟文件选择
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 验证文件列表显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="selected-files-list"]',
        );
      });

      // 点击清空文件按钮
      const clearButton = screen.getByTestId('clear-files');
      fireEvent.click(clearButton);

      // 验证文件列表被清空
      await waitFor(() => {
        AssertionHelpers.assertElementNotExists(
          '[data-testid="selected-files-list"]',
        );
      });
    });
  });

  describe('文档管理页面集成测试', () => {
    it('应该能够从文档管理页面打开上传模态框', async () => {
      render(<DocumentsPage />);

      // 验证上传文档按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="upload-document-button"]',
      );

      // 点击上传文档按钮
      const uploadButton = screen.getByTestId('upload-document-button');
      fireEvent.click(uploadButton);

      // 验证上传模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="upload-modal"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="upload-modal"]',
          '上传文档',
        );
      });
    });

    it('应该能够从文档管理页面打开批量上传模态框', async () => {
      render(<DocumentsPage />);

      // 验证批量上传按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="batch-upload-button"]',
      );

      // 点击批量上传按钮
      const batchUploadButton = screen.getByTestId('batch-upload-button');
      fireEvent.click(batchUploadButton);

      // 验证批量上传模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="batch-upload-modal"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="batch-upload-modal"]',
          '批量上传文档',
        );
      });
    });

    it('应该在上传完成后刷新文档列表', async () => {
      const mockDocumentsApi = ApiMockFactory.mockDocumentsApi();
      jest.doMock('../../src/services/api', () => ({
        documentsApi: mockDocumentsApi,
        collectionsApi: ApiMockFactory.mockCollectionsApi(),
      }));

      render(<DocumentsPage />);

      // 打开上传模态框
      const uploadButton = screen.getByTestId('upload-document-button');
      fireEvent.click(uploadButton);

      // 等待模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="upload-modal"]');
      });

      // 模拟文件上传
      const testFile = TestDataFactory.createMockFile(
        'test.txt',
        'text/plain',
        '测试内容',
      );
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList([testFile]);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 等待上传完成
      await waitFor(() => {
        expect(mockDocumentsApi.uploadDocument).toHaveBeenCalled();
      });

      // 验证文档列表被刷新
      await waitFor(() => {
        expect(mockDocumentsApi.getDocuments).toHaveBeenCalled();
      });
    });
  });
});
