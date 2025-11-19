/**
 * 搜索功能E2E测试
 * 测试搜索组件和搜索页面的功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import SearchBox from '../../src/components/SearchBox';
import SearchPage from '../../src/pages/SearchPage';
import {
  createMockSearchApi,
  createMockCollectionsApi,
} from './mocks/api-mocks';
import {
  TestDataFactory,
  ComponentTestHelpers,
  AssertionHelpers,
} from './utils/test-helpers';

// 模拟API
jest.mock('../../src/services/api', () => ({
  searchApi: createMockSearchApi(),
  collectionsApi: createMockCollectionsApi(),
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

describe('搜索功能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('搜索组件测试', () => {
    it('应该显示搜索输入框和按钮', () => {
      const mockOnSearch = jest.fn();
      const mockCollections = TestDataFactory.createCollections(3);

      render(
        <SearchBox onSearch={mockOnSearch} collections={mockCollections} />,
      );

      // 验证搜索输入框存在
      AssertionHelpers.assertElementExists('[data-testid="search-input"]');
      AssertionHelpers.assertElementAttribute(
        '[data-testid="search-input"]',
        'placeholder',
        '输入搜索关键词...',
      );

      // 验证搜索按钮存在
      AssertionHelpers.assertElementExists('[data-testid="search-button"]');

      // 验证集合选择器存在
      AssertionHelpers.assertElementExists(
        '[data-testid="collection-selector"]',
      );

      // 验证集合选项
      mockCollections.forEach(collection => {
        AssertionHelpers.assertElementContainsText(
          '[data-testid="collection-selector"]',
          collection.name,
        );
      });
    });

    it('应该处理搜索输入', async () => {
      const mockOnSearch = jest.fn();
      const mockCollections = TestDataFactory.createCollections(2);

      render(
        <SearchBox onSearch={mockOnSearch} collections={mockCollections} />,
      );

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      // 验证输入值
      expect(searchInput).toHaveValue('测试关键词');
    });

    it('应该处理搜索按钮点击', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockCollections = TestDataFactory.createCollections(2);

      render(
        <SearchBox onSearch={mockOnSearch} collections={mockCollections} />,
      );

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      // 点击搜索按钮
      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证搜索函数被调用
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('测试关键词', undefined);
      });
    });

    it('应该处理回车键搜索', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockCollections = TestDataFactory.createCollections(2);

      render(
        <SearchBox onSearch={mockOnSearch} collections={mockCollections} />,
      );

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      // 模拟回车键
      ComponentTestHelpers.simulateKeyboard(searchInput, 'Enter');

      // 验证搜索函数被调用
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('测试关键词', undefined);
      });
    });

    it('应该处理集合选择', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockOnCollectionChange = jest.fn();
      const mockCollections = TestDataFactory.createCollections(2);

      render(
        <SearchBox
          onSearch={mockOnSearch}
          collections={mockCollections}
          onCollectionChange={mockOnCollectionChange}
        />,
      );

      // 选择集合
      const collectionSelector = screen.getByTestId('collection-selector');
      fireEvent.change(collectionSelector, {
        target: { value: mockCollections[0].collectionId },
      });

      // 验证集合变化回调被调用
      expect(mockOnCollectionChange).toHaveBeenCalledWith(
        mockCollections[0].collectionId,
      );

      // 输入搜索关键词并搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证搜索函数被调用，包含集合ID
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith(
          '测试关键词',
          mockCollections[0].collectionId,
        );
      });
    });

    it('应该显示搜索历史', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockHistory = [
        {
          query: '历史搜索1',
          collectionId: 'collection1',
          timestamp: Date.now() - 1000,
        },
        {
          query: '历史搜索2',
          collectionId: 'collection2',
          timestamp: Date.now() - 2000,
        },
      ];

      // 模拟搜索历史
      const { SearchHistory } = require('../../src/utils/searchLimiter');
      SearchHistory.get.mockReturnValue(mockHistory);

      render(
        <SearchBox
          onSearch={mockOnSearch}
          collections={TestDataFactory.createCollections(2)}
        />,
      );

      // 点击搜索输入框获取焦点
      const searchInput = screen.getByTestId('search-input');
      fireEvent.focus(searchInput);

      // 验证搜索历史显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-history"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-history"]',
          '历史搜索1',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-history"]',
          '历史搜索2',
        );
      });

      // 点击历史记录
      const historyItem = screen.getByTestId('history-item-0');
      fireEvent.click(historyItem);

      // 验证搜索函数被调用
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('历史搜索1', 'collection1');
      });
    });

    it('应该清空搜索历史', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockHistory = [
        {
          query: '历史搜索1',
          collectionId: 'collection1',
          timestamp: Date.now() - 1000,
        },
      ];

      // 模拟搜索历史
      const { SearchHistory } = require('../../src/utils/searchLimiter');
      SearchHistory.get.mockReturnValue(mockHistory);

      render(
        <SearchBox
          onSearch={mockOnSearch}
          collections={TestDataFactory.createCollections(2)}
        />,
      );

      // 点击搜索输入框获取焦点
      const searchInput = screen.getByTestId('search-input');
      fireEvent.focus(searchInput);

      // 等待历史显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-history"]');
      });

      // 点击清空历史按钮
      const clearButton = screen.getByTestId('clear-history');
      fireEvent.click(clearButton);

      // 验证清空历史函数被调用
      expect(SearchHistory.clear).toHaveBeenCalled();
    });

    it('应该处理搜索建议', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockOnResultSelect = jest.fn();
      const mockSuggestions = TestDataFactory.createSearchResults(3);

      // 模拟搜索API返回建议
      const { searchApi } = require('../../src/services/api');
      searchApi.search.mockResolvedValue(mockSuggestions);

      render(
        <SearchBox
          onSearch={mockOnSearch}
          onResultSelect={mockOnResultSelect}
          collections={TestDataFactory.createCollections(2)}
          showSuggestions={true}
        />,
      );

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试');

      // 等待建议显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="search-suggestions"]',
        );
      });

      // 点击建议项
      const suggestionItem = screen.getByTestId('suggestion-item-0');
      fireEvent.click(suggestionItem);

      // 验证结果选择回调被调用
      expect(mockOnResultSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('应该处理键盘导航', async () => {
      const mockOnSearch = jest.fn().mockResolvedValue(undefined);
      const mockSuggestions = TestDataFactory.createSearchResults(3);

      // 模拟搜索API返回建议
      const { searchApi } = require('../../src/services/api');
      searchApi.search.mockResolvedValue(mockSuggestions);

      render(
        <SearchBox
          onSearch={mockOnSearch}
          collections={TestDataFactory.createCollections(2)}
          showSuggestions={true}
        />,
      );

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试');

      // 等待建议显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="search-suggestions"]',
        );
      });

      // 模拟向下箭头键
      ComponentTestHelpers.simulateKeyboard(searchInput, 'ArrowDown');

      // 验证第一个建议被选中
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="suggestion-item-0"][aria-selected="true"]',
        );
      });

      // 模拟回车键选择建议
      ComponentTestHelpers.simulateKeyboard(searchInput, 'Enter');

      // 验证搜索函数被调用
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalled();
      });
    });
  });

  describe('搜索页面测试', () => {
    it('应该显示搜索页面', () => {
      render(<SearchPage />);

      // 验证页面标题
      AssertionHelpers.assertElementContainsText('h1', '智能搜索');

      // 验证搜索组件存在
      AssertionHelpers.assertElementExists('[data-testid="search-box"]');

      // 验证搜索结果区域存在
      AssertionHelpers.assertElementExists('[data-testid="search-results"]');
    });

    it('应该执行搜索并显示结果', async () => {
      const mockSearchResults = TestDataFactory.createSearchResults(5);
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockResolvedValue({
        data: mockSearchResults,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 5,
          limit: 20,
        },
      });
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalled();
      });

      // 输入搜索关键词
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      // 点击搜索按钮
      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证搜索API被调用
      await waitFor(() => {
        expect(searchApi.searchPaginated).toHaveBeenCalledWith({
          q: '测试关键词',
          collectionId: mockCollections[0].collectionId,
          page: 1,
          limit: 20,
          sort: 'score',
          order: 'desc',
        });
      });

      // 验证搜索结果显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-results"]');
        mockSearchResults.forEach((result, index) => {
          AssertionHelpers.assertElementContainsText(
            `[data-testid="search-result-${index}"]`,
            result.content,
          );
        });
      });
    });

    it('应该处理搜索结果分页', async () => {
      const mockSearchResults = TestDataFactory.createSearchResults(20);
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockResolvedValue({
        data: mockSearchResults.slice(0, 10),
        pagination: {
          page: 1,
          totalPages: 2,
          total: 20,
          limit: 10,
        },
      });
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 等待搜索结果和分页显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="pagination"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="pagination"]',
          '第 1 页',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="pagination"]',
          '共 2 页',
        );
      });

      // 点击下一页
      const nextPageButton = screen.getByTestId('next-page');
      fireEvent.click(nextPageButton);

      // 验证第二页搜索API被调用
      await waitFor(() => {
        expect(searchApi.searchPaginated).toHaveBeenCalledWith({
          q: '测试关键词',
          collectionId: mockCollections[0].collectionId,
          page: 2,
          limit: 10,
          sort: 'score',
          order: 'desc',
        });
      });
    });

    it('应该处理搜索结果选择', async () => {
      const mockSearchResults = TestDataFactory.createSearchResults(3);
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockResolvedValue({
        data: mockSearchResults,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 3,
          limit: 20,
        },
      });
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 等待搜索结果显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-results"]');
      });

      // 点击第一个搜索结果
      const firstResult = screen.getByTestId('search-result-0');
      fireEvent.click(firstResult);

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
    });

    it('应该处理空搜索结果', async () => {
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          totalPages: 0,
          total: 0,
          limit: 20,
        },
      });
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '不存在的关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证空结果显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="empty-search-results"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="empty-search-results"]',
          '未找到相关结果',
        );
      });
    });

    it('应该处理搜索错误', async () => {
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API错误
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockRejectedValue(new Error('搜索服务不可用'));
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证错误处理
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="search-error"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-error"]',
          '搜索服务不可用',
        );
      });
    });

    it('应该处理搜索状态指示器', async () => {
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { searchApi, collectionsApi } = require('../../src/services/api');
      searchApi.searchPaginated.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  data: TestDataFactory.createSearchResults(3),
                  pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 3,
                    limit: 20,
                  },
                }),
              1000,
            ),
          ),
      );
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
      });

      render(<SearchPage />);

      // 执行搜索
      const searchInput = screen.getByTestId('search-input');
      ComponentTestHelpers.simulateUserInput(searchInput, '测试关键词');

      const searchButton = screen.getByTestId('search-button');
      fireEvent.click(searchButton);

      // 验证搜索状态指示器显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="search-status-indicator"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="search-status-indicator"]',
          '搜索中...',
        );
      });

      // 等待搜索完成
      await waitFor(
        () => {
          AssertionHelpers.assertElementNotExists(
            '[data-testid="search-status-indicator"]',
          );
        },
        { timeout: 2000 },
      );
    });
  });
});
