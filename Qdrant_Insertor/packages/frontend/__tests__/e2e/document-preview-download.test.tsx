/**
 * 文档预览和下载功能E2E测试
 * 测试文档预览、下载和相关功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import DocumentDetail from '../../src/components/DocumentDetail';
import DocumentPreview from '../../src/components/DocumentPreview';
import DocumentDownload from '../../src/components/DocumentDownload';
import DocumentsPage from '../../src/pages/DocumentsPage';
import { createMockDocumentsApi } from './mocks/api-mocks';
import { TestDataFactory, AssertionHelpers } from './utils/test-helpers';

// 模拟API
jest.mock('../../src/services/api', () => ({
  documentsApi: createMockDocumentsApi(),
}));

// 模拟文件下载
jest.mock('../../src/utils/fileDownloader', () => ({
  downloadFile: jest.fn(),
  downloadAsText: jest.fn(),
  downloadAsMarkdown: jest.fn(),
}));

describe('文档预览和下载功能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('文档详情测试', () => {
    it('应该显示文档详情组件', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容',
        type: 'text/plain',
      });
      const mockOnClose = jest.fn();

      render(
        <DocumentDetail
          documentId={mockDocument.docId}
          onClose={mockOnClose}
        />,
      );

      // 验证文档详情组件存在
      AssertionHelpers.assertElementExists('[data-testid="document-detail"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-detail"]',
        '文档详情',
      );
    });

    it('应该加载并显示文档信息', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容',
        type: 'text/plain',
        size: 1024,
        status: 'synced',
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail documentId={mockDocument.docId} onClose={jest.fn()} />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 验证文档信息显示
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-name"]',
        mockDocument.name,
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-type"]',
        mockDocument.type,
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-size"]',
        '1 KB',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-status"]',
        '已同步',
      );
    });

    it('应该显示文档内容', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容\n包含多行文本\n用于测试预览功能',
        type: 'text/plain',
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail documentId={mockDocument.docId} onClose={jest.fn()} />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 验证文档内容显示
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-content"]',
        mockDocument.content,
      );
    });

    it('应该处理关闭操作', async () => {
      const mockDocument = TestDataFactory.createDocument();
      const mockOnClose = jest.fn();

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail
          documentId={mockDocument.docId}
          onClose={mockOnClose}
        />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 点击关闭按钮
      const closeButton = screen.getByTestId('close-document-detail');
      fireEvent.click(closeButton);

      // 验证关闭回调被调用
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('应该处理文档加载错误', async () => {
      const mockDocumentId = 'non-existent-doc';

      // 模拟API错误
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockRejectedValue(new Error('文档不存在'));

      render(
        <DocumentDetail documentId={mockDocumentId} onClose={jest.fn()} />,
      );

      // 等待错误显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="document-error"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="document-error"]',
          '文档不存在',
        );
      });
    });

    it('应该显示文档操作按钮', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail documentId={mockDocument.docId} onClose={jest.fn()} />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 验证操作按钮存在
      AssertionHelpers.assertElementExists('[data-testid="download-button"]');
      AssertionHelpers.assertElementExists('[data-testid="preview-button"]');
      AssertionHelpers.assertElementExists('[data-testid="edit-button"]');
      AssertionHelpers.assertElementExists('[data-testid="delete-button"]');
    });
  });

  describe('文档预览测试', () => {
    it('应该显示文档预览组件', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容',
        type: 'text/plain',
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证文档预览组件存在
      AssertionHelpers.assertElementExists('[data-testid="document-preview"]');
    });

    it('应该预览文本文件', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容\n包含多行文本\n用于测试预览功能',
        type: 'text/plain',
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证文本内容显示
      AssertionHelpers.assertElementContainsText(
        '[data-testid="preview-content"]',
        mockDocument.content,
      );
    });

    it('应该预览Markdown文件', () => {
      const markdownContent = `# 标题

这是一个**Markdown**文档，包含：

- 列表项1
- 列表项2
- 列表项3

\`\`\`javascript
console.log('代码块');
\`\`\`
`;
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.md',
        content: markdownContent,
        type: 'text/markdown',
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证Markdown渲染
      AssertionHelpers.assertElementExists('[data-testid="markdown-preview"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="markdown-preview"]',
        '标题',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="markdown-preview"]',
        '这是一个Markdown文档',
      );
    });

    it('应该处理PDF文件预览', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.pdf',
        content: '', // PDF内容通常不直接显示
        type: 'application/pdf',
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证PDF预览器
      AssertionHelpers.assertElementExists('[data-testid="pdf-preview"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="pdf-preview"]',
        'PDF预览',
      );
    });

    it('应该处理不支持的文件类型', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文件.exe',
        content: '',
        type: 'application/x-executable',
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证不支持预览提示
      AssertionHelpers.assertElementExists(
        '[data-testid="unsupported-preview"]',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="unsupported-preview"]',
        '此文件类型不支持预览',
      );
    });

    it('应该处理大文件预览限制', () => {
      const largeContent = 'x'.repeat(5 * 1024 * 1024); // 5MB
      const mockDocument = TestDataFactory.createDocument({
        name: '大文件.txt',
        content: largeContent,
        type: 'text/plain',
        size: 5 * 1024 * 1024,
      });

      render(<DocumentPreview document={mockDocument} />);

      // 验证文件过大提示
      AssertionHelpers.assertElementExists('[data-testid="file-too-large"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="file-too-large"]',
        '文件过大，无法预览',
      );
    });

    it('应该处理预览错误', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '损坏的文件.txt',
        content: '',
        type: 'text/plain',
      });

      render(
        <DocumentPreview
          document={mockDocument}
          error={new Error('文件损坏')}
        />,
      );

      // 验证错误显示
      AssertionHelpers.assertElementExists('[data-testid="preview-error"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="preview-error"]',
        '文件损坏',
      );
    });
  });

  describe('文档下载测试', () => {
    it('应该显示文档下载组件', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
      });
      const mockOnClose = jest.fn();

      render(
        <DocumentDownload document={mockDocument} onClose={mockOnClose} />,
      );

      // 验证文档下载组件存在
      AssertionHelpers.assertElementExists('[data-testid="document-download"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="document-download"]',
        '下载文档',
      );
    });

    it('应该显示下载选项', () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
      });

      render(<DocumentDownload document={mockDocument} onClose={jest.fn()} />);

      // 验证下载选项
      AssertionHelpers.assertElementExists('[data-testid="download-original"]');
      AssertionHelpers.assertElementExists('[data-testid="download-as-text"]');
      AssertionHelpers.assertElementExists(
        '[data-testid="download-as-markdown"]',
      );

      // 验证文件信息显示
      AssertionHelpers.assertElementContainsText(
        '[data-testid="download-file-name"]',
        mockDocument.name,
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="download-file-type"]',
        mockDocument.type,
      );
    });

    it('应该处理原始文件下载', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
        content: '这是测试文档的内容',
      });
      const mockDownloadFile =
        require('../../src/utils/fileDownloader').downloadFile;

      render(<DocumentDownload document={mockDocument} onClose={jest.fn()} />);

      // 点击原始文件下载按钮
      const downloadButton = screen.getByTestId('download-original');
      fireEvent.click(downloadButton);

      // 验证下载函数被调用
      expect(mockDownloadFile).toHaveBeenCalledWith(
        mockDocument.name,
        mockDocument.content,
        mockDocument.type,
      );
    });

    it('应该处理文本格式下载', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.md',
        type: 'text/markdown',
        content: '# 标题\n这是Markdown内容',
      });
      const mockDownloadAsText =
        require('../../src/utils/fileDownloader').downloadAsText;

      render(<DocumentDownload document={mockDocument} onClose={jest.fn()} />);

      // 点击文本格式下载按钮
      const downloadButton = screen.getByTestId('download-as-text');
      fireEvent.click(downloadButton);

      // 验证下载函数被调用
      expect(mockDownloadAsText).toHaveBeenCalledWith(
        '测试文档.txt',
        mockDocument.content,
      );
    });

    it('应该处理Markdown格式下载', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
        content: '这是普通文本内容',
      });
      const mockDownloadAsMarkdown =
        require('../../src/utils/fileDownloader').downloadAsMarkdown;

      render(<DocumentDownload document={mockDocument} onClose={jest.fn()} />);

      // 点击Markdown格式下载按钮
      const downloadButton = screen.getByTestId('download-as-markdown');
      fireEvent.click(downloadButton);

      // 验证下载函数被调用
      expect(mockDownloadAsMarkdown).toHaveBeenCalledWith(
        '测试文档.md',
        mockDocument.content,
      );
    });

    it('应该处理下载关闭', () => {
      const mockDocument = TestDataFactory.createDocument();
      const mockOnClose = jest.fn();

      render(
        <DocumentDownload document={mockDocument} onClose={mockOnClose} />,
      );

      // 点击关闭按钮
      const closeButton = screen.getByTestId('close-download');
      fireEvent.click(closeButton);

      // 验证关闭回调被调用
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('应该处理下载错误', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
      });
      const mockDownloadFile =
        require('../../src/utils/fileDownloader').downloadFile;
      mockDownloadFile.mockImplementation(() => {
        throw new Error('下载失败');
      });

      render(<DocumentDownload document={mockDocument} onClose={jest.fn()} />);

      // 点击下载按钮
      const downloadButton = screen.getByTestId('download-original');
      fireEvent.click(downloadButton);

      // 验证错误显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="download-error"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="download-error"]',
          '下载失败',
        );
      });
    });
  });

  describe('文档页面集成测试', () => {
    it('应该能够打开文档详情', async () => {
      const mockDocuments = TestDataFactory.createDocuments(3);

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocuments.mockResolvedValue({
        data: mockDocuments,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 3,
          limit: 20,
        },
      });
      documentsApi.getDocument.mockResolvedValue(mockDocuments[0]);

      render(<DocumentsPage />);

      // 等待文档列表加载
      await waitFor(() => {
        expect(documentsApi.getDocuments).toHaveBeenCalled();
      });

      // 点击查看第一个文档
      const viewButton = screen.getByTestId('view-document-0');
      fireEvent.click(viewButton);

      // 验证文档详情模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="document-detail-modal"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="document-detail-modal"]',
          '文档详情',
        );
      });

      // 验证文档详情API被调用
      expect(documentsApi.getDocument).toHaveBeenCalledWith(
        mockDocuments[0].docId,
      );
    });

    it('应该能够从文档详情打开预览', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        content: '这是测试文档的内容',
        type: 'text/plain',
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail documentId={mockDocument.docId} onClose={jest.fn()} />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 点击预览按钮
      const previewButton = screen.getByTestId('preview-button');
      fireEvent.click(previewButton);

      // 验证预览模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="preview-modal"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="preview-modal"]',
          '文档预览',
        );
      });
    });

    it('应该能够从文档详情打开下载', async () => {
      const mockDocument = TestDataFactory.createDocument({
        name: '测试文档.txt',
        type: 'text/plain',
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      render(
        <DocumentDetail documentId={mockDocument.docId} onClose={jest.fn()} />,
      );

      // 等待文档加载
      await waitFor(() => {
        expect(documentsApi.getDocument).toHaveBeenCalledWith(
          mockDocument.docId,
        );
      });

      // 点击下载按钮
      const downloadButton = screen.getByTestId('download-button');
      fireEvent.click(downloadButton);

      // 验证下载模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="download-modal"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="download-modal"]',
          '下载文档',
        );
      });
    });

    it('应该能够从搜索结果打开文档详情', async () => {
      const mockSearchResults = TestDataFactory.createSearchResults(3);
      const mockDocument = TestDataFactory.createDocument({
        docId: mockSearchResults[0].metadata.docId,
        name: mockSearchResults[0].metadata.docName,
      });

      // 模拟API响应
      const { documentsApi } = require('../../src/services/api');
      documentsApi.getDocument.mockResolvedValue(mockDocument);

      // 模拟搜索页面
      const SearchPage = require('../../src/pages/SearchPage').default;
      render(<SearchPage />);

      // 模拟搜索结果选择
      const onResultSelect =
        screen.getByTestId('search-results').props.onResultSelect;
      onResultSelect(mockSearchResults[0]);

      // 验证文档详情模态框打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="document-detail-modal"]',
        );
      });

      // 验证文档详情API被调用
      expect(documentsApi.getDocument).toHaveBeenCalledWith(mockDocument.docId);
    });
  });
});
