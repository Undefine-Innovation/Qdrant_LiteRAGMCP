/**
 * 用户工作流E2E测试
 * 测试完整的用户操作流程
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BrowserRouter } from 'react-router-dom';
import App from '../../src/App';
import {
  createMockDocumentsApi,
  createMockCollectionsApi,
  createMockSearchApi,
  createMockBatchApi,
} from './mocks/api-mocks';
import {
  TestDataFactory,
  ComponentTestHelpers,
  AssertionHelpers,
} from './utils/test-helpers';

// 模拟API
jest.mock('../../src/services/api', () => ({
  documentsApi: createMockDocumentsApi(),
  collectionsApi: createMockCollectionsApi(),
  searchApi: createMockSearchApi(),
  batchApi: createMockBatchApi(),
}));

// 模拟搜索限速器
jest.mock('../../src/utils/searchLimiter', () => ({
  defaultSearchLimiter: {
    execute: jest.fn().mockImplementation((key, fn) => fn()),
    cancelAll: jest.fn(),
  },
  SearchHistory: {
    get: jest.fn().mockReturnValue([]),
    add: jest.fn(),
    clear: jest.fn(),
  },
}));

// 模拟应用状态管理
jest.mock('../../src/stores/useAppStore', () => ({
  useAppStore: () => ({
    batchOperations: [],
    addBatchOperation: jest.fn(),
    updateBatchOperation: jest.fn(),
    removeBatchOperation: jest.fn(),
    setError: jest.fn(),
    addErrorToHistory: jest.fn(),
  }),
}));

// 测试包装器
const TestWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

describe('用户工作流测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('完整文档管理工作流', () => {
    it('应该能够完成创建集合、上传文档、搜索和删除的完整流程', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const newCollection = TestDataFactory.createCollection({
        name: '工作流测试集合',
        description: '用于测试完整工作流的集合',
      });
      const uploadedDocument = TestDataFactory.createDocument({
        name: '工作流测试文档.txt',
        content: '这是一个用于测试完整工作流的文档内容',
        collectionId: newCollection.collectionId,
      });
      const searchResults = TestDataFactory.createSearchResults(1);

      // 模拟API响应
      const {
        collectionsApi,
        documentsApi,
        searchApi,
        batchApi,
      } = require('../../src/services/api');

      // 初始集合列表
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: { page: 1, totalPages: 1, total: 2, limit: 20 },
      });

      // 创建集合
      collectionsApi.createCollection.mockResolvedValue(newCollection);

      // 上传文档
      documentsApi.uploadDocument.mockResolvedValue(uploadedDocument);
      documentsApi.uploadToCollection.mockResolvedValue(uploadedDocument);

      // 搜索文档
      searchApi.searchPaginated.mockResolvedValue({
        data: searchResults,
        pagination: { page: 1, totalPages: 1, total: 1, limit: 20 },
      });

      // 删除文档
      documentsApi.deleteDocument.mockResolvedValue({ success: true });

      // 删除集合
      collectionsApi.deleteCollection.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>,
      );

      // 1. 验证首页加载
      AssertionHelpers.assertElementExists('[data-testid="home-page"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="home-page"]',
        '欢迎使用 Qdrant Insertor',
      );

      // 2. 导航到集合管理页面
      const collectionsLink = screen.getByTestId('nav-collections');
      fireEvent.click(collectionsLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="collections-page"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="collections-page"]',
          '集合管理',
        );
      });

      // 3. 创建新集合
      const createCollectionButton = screen.getByTestId(
        'create-collection-button',
      );
      fireEvent.click(createCollectionButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
      });

      // 填写集合信息
      const nameInput = screen.getByTestId('collection-name-input');
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );

      ComponentTestHelpers.simulateUserInput(nameInput, '工作流测试集合');
      ComponentTestHelpers.simulateUserInput(
        descriptionInput,
        '用于测试完整工作流的集合',
      );

      // 提交表单
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(collectionsApi.createCollection).toHaveBeenCalledWith({
          name: '工作流测试集合',
          description: '用于测试完整工作流的集合',
        });
      });

      // 4. 导航到文档管理页面
      const documentsLink = screen.getByTestId('nav-documents');
      fireEvent.click(documentsLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="documents-page"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="documents-page"]',
          '文档管理',
        );
      });

      // 5. 上传文档
      const uploadButton = screen.getByTestId('upload-document-button');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="upload-modal"]');
      });

      // 模拟文件选择
      const testFile = TestDataFactory.createMockFile(
        '工作流测试文档.txt',
        'text/plain',
        '这是一个用于测试完整工作流的文档内容',
      );
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList([testFile]);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(documentsApi.uploadToCollection).toHaveBeenCalledWith(
          newCollection.collectionId,
          testFile,
        );
      });

      // 6. 导航到搜索页面
      const searchLink = screen.getByTestId('nav-search');
      fireEvent.click(searchLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-page"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-page"]',
          '智能搜索',
        );
      });

      // 7. 搜索文档
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '工作流测试');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(searchApi.searchPaginated).toHaveBeenCalledWith({
          q: '工作流测试',
          collectionId: newCollection.collectionId,
          page: 1,
          limit: 20,
          sort: 'score',
          order: 'desc',
        });
      });

      // 8. 验证搜索结果
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-results"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-results"]',
          searchResults[0].content,
        );
      });

      // 9. 查看文档详情
      const firstResult = screen.getByTestId('search-result-0');
      fireEvent.click(firstResult);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="document-detail-modal"]',
        );
      });

      // 10. 删除文档
      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="delete-confirmation-dialog"]',
        );
      });

      const confirmDeleteButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(documentsApi.deleteDocument).toHaveBeenCalledWith(
          uploadedDocument.docId,
        );
      });

      // 11. 返回集合页面并删除集合
      const collectionsLinkAgain = screen.getByTestId('nav-collections');
      fireEvent.click(collectionsLinkAgain);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="collections-page"]',
        );
      });

      const deleteCollectionButton = screen.getByTestId(
        `delete-collection-${mockCollections.length}`,
      );
      fireEvent.click(deleteCollectionButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="delete-confirmation-dialog"]',
        );
      });

      const confirmCollectionDeleteButton =
        screen.getByTestId('confirm-delete');
      fireEvent.click(confirmCollectionDeleteButton);

      await waitFor(() => {
        expect(collectionsApi.deleteCollection).toHaveBeenCalledWith(
          newCollection.collectionId,
        );
      });
    });
  });

  describe('批量操作工作流', () => {
    it('应该能够完成批量上传和批量删除的工作流', async () => {
      const mockCollections = TestDataFactory.createCollections(1);
      const uploadedDocuments = TestDataFactory.createDocuments(
        3,
        mockCollections[0].collectionId,
      );

      // 模拟API响应
      const {
        collectionsApi,
        documentsApi,
        batchApi,
      } = require('../../src/services/api');

      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: { page: 1, totalPages: 1, total: 1, limit: 20 },
      });

      documentsApi.getDocuments.mockResolvedValue({
        data: uploadedDocuments,
        pagination: { page: 1, totalPages: 1, total: 3, limit: 20 },
      });

      batchApi.batchUpload.mockResolvedValue({
        success: true,
        total: 3,
        successful: 3,
        failed: 0,
        results: uploadedDocuments,
      });

      batchApi.batchDelete.mockResolvedValue({
        success: true,
        total: 3,
        successful: 3,
        failed: 0,
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>,
      );

      // 1. 导航到文档管理页面
      const documentsLink = screen.getByTestId('nav-documents');
      fireEvent.click(documentsLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="documents-page"]');
      });

      // 2. 打开批量上传模态框
      const batchUploadButton = screen.getByTestId('batch-upload-button');
      fireEvent.click(batchUploadButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="batch-upload-modal"]',
        );
      });

      // 3. 模拟多文件选择
      const testFiles = [
        TestDataFactory.createMockFile(
          '批量文档1.txt',
          'text/plain',
          '批量文档1的内容',
        ),
        TestDataFactory.createMockFile(
          '批量文档2.txt',
          'text/plain',
          '批量文档2的内容',
        ),
        TestDataFactory.createMockFile(
          '批量文档3.txt',
          'text/plain',
          '批量文档3的内容',
        ),
      ];

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const files = ComponentTestHelpers.createMockFileList(testFiles);

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="selected-files-list"]',
        );
      });

      // 4. 开始批量上传
      const startUploadButton = screen.getByTestId('start-batch-upload');
      fireEvent.click(startUploadButton);

      await waitFor(() => {
        expect(batchApi.batchUpload).toHaveBeenCalled();
      });

      // 5. 等待上传完成并关闭模态框
      await waitFor(
        () => {
          AssertionHelpers.assertElementNotExists(
            '[data-testid="batch-upload-modal"]',
          );
        },
        { timeout: 5000 },
      );

      // 6. 打开批量删除模态框
      const batchDeleteButton = screen.getByTestId('batch-delete-button');
      fireEvent.click(batchDeleteButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="batch-delete-modal"]',
        );
      });

      // 7. 选择所有文档进行删除
      const selectAllCheckbox = screen.getByTestId('select-all-checkbox');
      fireEvent.click(selectAllCheckbox);

      // 8. 确认批量删除
      const confirmButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="delete-confirmation-dialog"]',
        );
      });

      const finalConfirmButton = screen.getByTestId('final-confirm-delete');
      fireEvent.click(finalConfirmButton);

      await waitFor(() => {
        expect(batchApi.batchDelete).toHaveBeenCalled();
      });
    });
  });

  describe('搜索和导航工作流', () => {
    it('应该能够完成搜索、结果查看和导航的工作流', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const searchResults = TestDataFactory.createSearchResults(5);
      const selectedDocument = TestDataFactory.createDocument({
        docId: searchResults[0].metadata.docId,
        name: searchResults[0].metadata.docName,
      });

      // 模拟API响应
      const {
        collectionsApi,
        searchApi,
        documentsApi,
      } = require('../../src/services/api');

      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: { page: 1, totalPages: 1, total: 2, limit: 20 },
      });

      searchApi.searchPaginated.mockResolvedValue({
        data: searchResults,
        pagination: { page: 1, totalPages: 1, total: 5, limit: 20 },
      });

      documentsApi.getDocument.mockResolvedValue(selectedDocument);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>,
      );

      // 1. 导航到搜索页面
      const searchLink = screen.getByTestId('nav-search');
      fireEvent.click(searchLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-page"]');
      });

      // 2. 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试搜索');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(searchApi.searchPaginated).toHaveBeenCalled();
      });

      // 3. 验证搜索结果
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-results"]');
        searchResults.forEach((result, index) => {
          AssertionHelpers.assertElementContainsText(
            `[data-testid="search-result-${index}"]`,
            result.content,
          );
        });
      });

      // 4. 选择特定集合进行搜索
      const collectionSelector = screen.getByTestId('collection-selector');
      fireEvent.change(collectionSelector, {
        target: { value: mockCollections[1].collectionId },
      });

      // 重新搜索
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(searchApi.searchPaginated).toHaveBeenCalledWith({
          q: '测试搜索',
          collectionId: mockCollections[1].collectionId,
          page: 1,
          limit: 20,
          sort: 'score',
          order: 'desc',
        });
      });

      // 5. 查看第一个搜索结果详情
      const firstResult = screen.getByTestId('search-result-0');
      fireEvent.click(firstResult);

      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="document-detail-modal"]',
        );
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          searchResults[0].metadata.docId,
        );
      });

      // 6. 从文档详情返回搜索结果
      const closeButton = screen.getByTestId('close-document-detail');
      fireEvent.click(closeButton);

      await waitFor(() => {
        AssertionHelpers.assertElementNotExists(
          '[data-testid="document-detail-modal"]',
        );
        AssertionHelpers.assertElementExists('[data-testid="search-results"]');
      });

      // 7. 导航回首页
      const homeLink = screen.getByTestId('nav-home');
      fireEvent.click(homeLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="home-page"]');
      });
    });
  });

  describe('错误处理工作流', () => {
    it('应该能够处理网络错误和用户反馈', async () => {
      // 模拟API错误
      const {
        collectionsApi,
        documentsApi,
      } = require('../../src/services/api');

      collectionsApi.getCollections.mockRejectedValue(
        new Error('网络连接失败'),
      );
      documentsApi.getDocuments.mockRejectedValue(new Error('服务器内部错误'));

      render(
        <TestWrapper>
          <App />
        </TestWrapper>,
      );

      // 1. 导航到集合页面（应该显示错误）
      const collectionsLink = screen.getByTestId('nav-collections');
      fireEvent.click(collectionsLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="error-message"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="error-message"]',
          '网络连接失败',
        );
      });

      // 2. 导航到文档页面（应该显示错误）
      const documentsLink = screen.getByTestId('nav-documents');
      fireEvent.click(documentsLink);

      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="error-message"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="error-message"]',
          '服务器内部错误',
        );
      });

      // 3. 验证错误处理机制
      const errorBoundary = screen.getByTestId('error-boundary');
      expect(errorBoundary).toBeInTheDocument();
    });
  });
});
