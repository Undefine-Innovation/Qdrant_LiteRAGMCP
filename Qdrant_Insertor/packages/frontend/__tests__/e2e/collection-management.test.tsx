/**
 * 集合管理E2E测试
 * 测试集合的创建、查看、更新和删除功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import CollectionManager from '../../src/components/CollectionManager';
import CollectionForm from '../../src/components/CollectionForm';
import CollectionsPage from '../../src/pages/CollectionsPage';
import { createMockCollectionsApi } from './mocks/api-mocks';
import {
  TestDataFactory,
  ComponentTestHelpers,
  AssertionHelpers,
} from './utils/test-helpers';

// 模拟API
jest.mock('../../src/services/api', () => ({
  collectionsApi: createMockCollectionsApi(),
}));

describe('集合管理测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('集合管理组件测试', () => {
    it('应该显示集合管理组件', () => {
      const mockCollections = TestDataFactory.createCollections(3);
      const mockOnCreate = jest.fn();
      const mockOnUpdate = jest.fn();
      const mockOnDelete = jest.fn();
      const mockOnRefresh = jest.fn();

      render(
        <CollectionManager
          collections={mockCollections}
          loading={false}
          error={null}
          onCreate={mockOnCreate}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          onRefresh={mockOnRefresh}
        />,
      );

      // 验证集合列表存在
      AssertionHelpers.assertElementExists('[data-testid="collection-list"]');

      // 验证集合项显示
      mockCollections.forEach((collection, index) => {
        AssertionHelpers.assertElementContainsText(
          `[data-testid="collection-item-${index}"]`,
          collection.name,
        );
        AssertionHelpers.assertElementContainsText(
          `[data-testid="collection-item-${index}"]`,
          collection.description,
        );
      });

      // 验证创建集合按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="create-collection-button"]',
      );

      // 验证刷新按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="refresh-collections-button"]',
      );
    });

    it('应该处理加载状态', () => {
      const mockOnCreate = jest.fn();
      const mockOnUpdate = jest.fn();
      const mockOnDelete = jest.fn();
      const mockOnRefresh = jest.fn();

      render(
        <CollectionManager
          collections={[]}
          loading={true}
          error={null}
          onCreate={mockOnCreate}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          onRefresh={mockOnRefresh}
        />,
      );

      // 验证加载状态显示
      AssertionHelpers.assertElementExists(
        '[data-testid="collection-loading"]',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="collection-loading"]',
        '加载中...',
      );
    });

    it('应该处理错误状态', () => {
      const mockError = { message: '加载集合失败', code: 'LOAD_ERROR' };
      const mockOnCreate = jest.fn();
      const mockOnUpdate = jest.fn();
      const mockOnDelete = jest.fn();
      const mockOnRefresh = jest.fn();

      render(
        <CollectionManager
          collections={[]}
          loading={false}
          error={mockError}
          onCreate={mockOnCreate}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          onRefresh={mockOnRefresh}
        />,
      );

      // 验证错误状态显示
      AssertionHelpers.assertElementExists('[data-testid="collection-error"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="collection-error"]',
        '加载集合失败',
      );
    });

    it('应该处理空集合状态', () => {
      const mockOnCreate = jest.fn();
      const mockOnUpdate = jest.fn();
      const mockOnDelete = jest.fn();
      const mockOnRefresh = jest.fn();

      render(
        <CollectionManager
          collections={[]}
          loading={false}
          error={null}
          onCreate={mockOnCreate}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          onRefresh={mockOnRefresh}
        />,
      );

      // 验证空状态显示
      AssertionHelpers.assertElementExists('[data-testid="empty-collections"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="empty-collections"]',
        '暂无集合',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="empty-collections"]',
        '创建第一个集合',
      );
    });

    it('应该处理刷新操作', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const mockOnRefresh = jest.fn();

      render(
        <CollectionManager
          collections={mockCollections}
          loading={false}
          error={null}
          onCreate={jest.fn()}
          onUpdate={jest.fn()}
          onDelete={jest.fn()}
          onRefresh={mockOnRefresh}
        />,
      );

      // 点击刷新按钮
      const refreshButton = screen.getByTestId('refresh-collections-button');
      fireEvent.click(refreshButton);

      // 验证刷新回调被调用
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('应该打开创建集合表单', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const mockOnCreate = jest.fn();

      render(
        <CollectionManager
          collections={mockCollections}
          loading={false}
          error={null}
          onCreate={mockOnCreate}
          onUpdate={jest.fn()}
          onDelete={jest.fn()}
          onRefresh={jest.fn()}
        />,
      );

      // 点击创建集合按钮
      const createButton = screen.getByTestId('create-collection-button');
      fireEvent.click(createButton);

      // 验证创建表单打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="collection-form"]',
          '创建集合',
        );
      });
    });

    it('应该打开编辑集合表单', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const mockOnUpdate = jest.fn();

      render(
        <CollectionManager
          collections={mockCollections}
          loading={false}
          error={null}
          onCreate={jest.fn()}
          onUpdate={mockOnUpdate}
          onDelete={jest.fn()}
          onRefresh={jest.fn()}
        />,
      );

      // 点击编辑第一个集合
      const editButton = screen.getByTestId('edit-collection-0');
      fireEvent.click(editButton);

      // 验证编辑表单打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="collection-form"]',
          '编辑集合',
        );
      });

      // 验证表单预填充数据
      const nameInput = screen.getByTestId('collection-name-input');
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );

      expect(nameInput).toHaveValue(mockCollections[0].name);
      expect(descriptionInput).toHaveValue(mockCollections[0].description);
    });

    it('应该处理集合删除', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const mockOnDelete = jest.fn();

      render(
        <CollectionManager
          collections={mockCollections}
          loading={false}
          error={null}
          onCreate={jest.fn()}
          onUpdate={jest.fn()}
          onDelete={mockOnDelete}
          onRefresh={jest.fn()}
        />,
      );

      // 点击删除第一个集合
      const deleteButton = screen.getByTestId('delete-collection-0');
      fireEvent.click(deleteButton);

      // 验证确认对话框显示
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="delete-confirmation-dialog"]',
        );
        AssertionHelpers.assertElementContainsText(
          '[data-testid="delete-confirmation-dialog"]',
          `确定要删除集合 "${mockCollections[0].name}" 吗？`,
        );
      });

      // 确认删除
      const confirmButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmButton);

      // 验证删除回调被调用
      expect(mockOnDelete).toHaveBeenCalledWith(
        mockCollections[0].collectionId,
      );
    });
  });

  describe('集合表单测试', () => {
    it('应该显示创建集合表单', () => {
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 验证表单字段存在
      AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
      AssertionHelpers.assertElementExists(
        '[data-testid="collection-name-input"]',
      );
      AssertionHelpers.assertElementExists(
        '[data-testid="collection-description-input"]',
      );
      AssertionHelpers.assertElementAttribute(
        '[data-testid="collection-name-input"]',
        'placeholder',
        '集合名称',
      );
      AssertionHelpers.assertElementAttribute(
        '[data-testid="collection-description-input"]',
        'placeholder',
        '集合描述',
      );

      // 验证按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="submit-form-button"]',
      );
      AssertionHelpers.assertElementExists(
        '[data-testid="cancel-form-button"]',
      );
    });

    it('应该显示编辑集合表单', () => {
      const mockCollection = TestDataFactory.createCollection({
        name: '测试集合',
        description: '这是一个测试集合',
      });
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm
          collection={mockCollection}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />,
      );

      // 验证表单标题
      AssertionHelpers.assertElementContainsText(
        '[data-testid="collection-form"]',
        '编辑集合',
      );

      // 验证表单字段预填充
      const nameInput = screen.getByTestId('collection-name-input');
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );

      expect(nameInput).toHaveValue('测试集合');
      expect(descriptionInput).toHaveValue('这是一个测试集合');
    });

    it('应该处理表单输入', () => {
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 输入集合名称
      const nameInput = screen.getByTestId('collection-name-input');
      ComponentTestHelpers.simulateUserInput(nameInput, '新集合名称');

      // 输入集合描述
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );
      ComponentTestHelpers.simulateUserInput(descriptionInput, '新集合描述');

      // 验证输入值
      expect(nameInput).toHaveValue('新集合名称');
      expect(descriptionInput).toHaveValue('新集合描述');
    });

    it('应该处理表单提交', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 输入集合名称
      const nameInput = screen.getByTestId('collection-name-input');
      ComponentTestHelpers.simulateUserInput(nameInput, '新集合名称');

      // 输入集合描述
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );
      ComponentTestHelpers.simulateUserInput(descriptionInput, '新集合描述');

      // 点击提交按钮
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      // 验证提交回调被调用
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: '新集合名称',
          description: '新集合描述',
        });
      });
    });

    it('应该处理表单取消', () => {
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 点击取消按钮
      const cancelButton = screen.getByTestId('cancel-form-button');
      fireEvent.click(cancelButton);

      // 验证取消回调被调用
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('应该验证表单输入', async () => {
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 提交空表单
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      // 验证错误提示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="name-error"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="name-error"]',
          '集合名称不能为空',
        );
      });

      // 验证提交回调未被调用
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('应该处理提交错误', async () => {
      const mockOnSubmit = jest
        .fn()
        .mockRejectedValue(new Error('创建集合失败'));
      const mockOnCancel = jest.fn();

      render(
        <CollectionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
      );

      // 输入集合名称
      const nameInput = screen.getByTestId('collection-name-input');
      ComponentTestHelpers.simulateUserInput(nameInput, '新集合名称');

      // 提交表单
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      // 验证错误提示
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="submit-error"]');
        AssertionHelpers.assertElementContainsText(
          '[data-testid="submit-error"]',
          '创建集合失败',
        );
      });
    });
  });

  describe('集合页面集成测试', () => {
    it('应该显示集合页面', () => {
      render(<CollectionsPage />);

      // 验证页面标题
      AssertionHelpers.assertElementContainsText('h1', '集合管理');

      // 验证批量删除按钮存在
      AssertionHelpers.assertElementExists(
        '[data-testid="batch-delete-collections-button"]',
      );

      // 验证集合管理组件存在
      AssertionHelpers.assertElementExists(
        '[data-testid="collection-manager"]',
      );
    });

    it('应该加载并显示集合列表', async () => {
      const mockCollections = TestDataFactory.createCollections(3);

      // 模拟API响应
      const { collectionsApi } = require('../../src/services/api');
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 3,
          limit: 20,
        },
      });

      render(<CollectionsPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalled();
      });

      // 验证集合显示
      mockCollections.forEach((collection, index) => {
        AssertionHelpers.assertElementContainsText(
          `[data-testid="collection-item-${index}"]`,
          collection.name,
        );
      });
    });

    it('应该处理集合创建', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const newCollection = TestDataFactory.createCollection({
        name: '新集合',
        description: '新集合描述',
      });

      // 模拟API响应
      const { collectionsApi } = require('../../src/services/api');
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 2,
          limit: 20,
        },
      });
      collectionsApi.createCollection.mockResolvedValue(newCollection);

      render(<CollectionsPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalled();
      });

      // 点击创建集合按钮
      const createButton = screen.getByTestId('create-collection-button');
      fireEvent.click(createButton);

      // 等待表单打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
      });

      // 输入集合信息
      const nameInput = screen.getByTestId('collection-name-input');
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );

      ComponentTestHelpers.simulateUserInput(nameInput, '新集合');
      ComponentTestHelpers.simulateUserInput(descriptionInput, '新集合描述');

      // 提交表单
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      // 验证创建API被调用
      await waitFor(() => {
        expect(collectionsApi.createCollection).toHaveBeenCalledWith({
          name: '新集合',
          description: '新集合描述',
        });
      });

      // 验证集合列表被刷新
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalledTimes(2);
      });
    });

    it('应该处理集合更新', async () => {
      const mockCollections = TestDataFactory.createCollections(2);
      const updatedCollection = {
        ...mockCollections[0],
        name: '更新的集合名称',
        description: '更新的集合描述',
      };

      // 模拟API响应
      const { collectionsApi } = require('../../src/services/api');
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 2,
          limit: 20,
        },
      });
      collectionsApi.updateCollection.mockResolvedValue(updatedCollection);

      render(<CollectionsPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalled();
      });

      // 点击编辑第一个集合
      const editButton = screen.getByTestId('edit-collection-0');
      fireEvent.click(editButton);

      // 等待表单打开
      await waitFor(() => {
        AssertionHelpers.assertElementExists('[data-testid="collection-form"]');
      });

      // 修改集合信息
      const nameInput = screen.getByTestId('collection-name-input');
      const descriptionInput = screen.getByTestId(
        'collection-description-input',
      );

      ComponentTestHelpers.simulateUserInput(nameInput, '更新的集合名称');
      ComponentTestHelpers.simulateUserInput(
        descriptionInput,
        '更新的集合描述',
      );

      // 提交表单
      const submitButton = screen.getByTestId('submit-form-button');
      fireEvent.click(submitButton);

      // 验证更新API被调用
      await waitFor(() => {
        expect(collectionsApi.updateCollection).toHaveBeenCalledWith(
          mockCollections[0].collectionId,
          {
            name: '更新的集合名称',
            description: '更新的集合描述',
          },
        );
      });

      // 验证集合列表被刷新
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalledTimes(2);
      });
    });

    it('应该处理集合删除', async () => {
      const mockCollections = TestDataFactory.createCollections(2);

      // 模拟API响应
      const { collectionsApi } = require('../../src/services/api');
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections,
        pagination: {
          page: 1,
          totalPages: 1,
          total: 2,
          limit: 20,
        },
      });
      collectionsApi.deleteCollection.mockResolvedValue({ success: true });

      render(<CollectionsPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalled();
      });

      // 点击删除第一个集合
      const deleteButton = screen.getByTestId('delete-collection-0');
      fireEvent.click(deleteButton);

      // 等待确认对话框
      await waitFor(() => {
        AssertionHelpers.assertElementExists(
          '[data-testid="delete-confirmation-dialog"]',
        );
      });

      // 确认删除
      const confirmButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmButton);

      // 验证删除API被调用
      await waitFor(() => {
        expect(collectionsApi.deleteCollection).toHaveBeenCalledWith(
          mockCollections[0].collectionId,
        );
      });

      // 验证集合列表被刷新
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalledTimes(2);
      });
    });

    it('应该处理集合分页', async () => {
      const mockCollections = TestDataFactory.createCollections(25);

      // 模拟API响应
      const { collectionsApi } = require('../../src/services/api');
      collectionsApi.getCollections.mockResolvedValue({
        data: mockCollections.slice(0, 20),
        pagination: {
          page: 1,
          totalPages: 2,
          total: 25,
          limit: 20,
        },
      });

      render(<CollectionsPage />);

      // 等待集合加载
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalledWith({
          page: 1,
          limit: 20,
          sort: 'created_at',
          order: 'desc',
        });
      });

      // 验证分页组件显示
      AssertionHelpers.assertElementExists('[data-testid="pagination"]');
      AssertionHelpers.assertElementContainsText(
        '[data-testid="pagination"]',
        '第 1 页',
      );
      AssertionHelpers.assertElementContainsText(
        '[data-testid="pagination"]',
        '共 2 页',
      );

      // 点击下一页
      const nextPageButton = screen.getByTestId('next-page');
      fireEvent.click(nextPageButton);

      // 验证第二页API被调用
      await waitFor(() => {
        expect(collectionsApi.getCollections).toHaveBeenCalledWith({
          page: 2,
          limit: 20,
          sort: 'created_at',
          order: 'desc',
        });
      });
    });
  });
});
