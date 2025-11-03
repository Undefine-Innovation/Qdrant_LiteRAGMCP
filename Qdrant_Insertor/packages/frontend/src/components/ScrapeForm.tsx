import React, { useState, ChangeEvent } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { scrapeApiService } from '../services/scrape-api';
import type { ScrapeConfig, ScrapeSelectors } from '../types/scrape';

interface ScrapeFormProps {
  onSuccess?: (taskId: string) => void;
  onError?: (error: string) => void;
}

export const ScrapeForm: React.FC<ScrapeFormProps> = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ScrapeConfig>({
    url: '',
    maxDepth: 1,
    followLinks: false,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (compatible; QdrantRAG/1.0)',
    selectors: {
      title: 'title, h1',
      content: 'main, article, .content, #content',
      links: 'a[href]',
    },
    headers: {},
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHeaders, setCustomHeaders] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 解析自定义headers
      let headers = {};
      if (customHeaders.trim()) {
        try {
          headers = JSON.parse(customHeaders);
        } catch {
          throw new Error('Invalid JSON format for custom headers');
        }
      }

      const requestConfig: ScrapeConfig = {
        ...config,
        headers,
      };

      const response = await scrapeApiService.startScrapeTask(requestConfig);
      
      if (response.success) {
        onSuccess?.(response.taskId);
        // 重置表单
        setConfig({
          url: '',
          maxDepth: 1,
          followLinks: false,
          timeout: 30000,
          userAgent: 'Mozilla/5.0 (compatible; QdrantRAG/1.0)',
          selectors: {
            title: 'title, h1',
            content: 'main, article, .content, #content',
            links: 'a[href]',
          },
          headers: {},
        });
        setCustomHeaders('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start scrape task';
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateSelectors = (field: keyof ScrapeSelectors, value: string) => {
    setConfig(prev => ({
      ...prev,
      selectors: {
        ...prev.selectors,
        [field]: value,
      },
    }));
  };

  const resetForm = () => {
    setConfig({
      url: '',
      maxDepth: 1,
      followLinks: false,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (compatible; QdrantRAG/1.0)',
      selectors: {
        title: 'title, h1',
        content: 'main, article, .content, #content',
        links: 'a[href]',
      },
      headers: {},
    });
    setCustomHeaders('');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">创建爬虫任务</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL输入 */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            目标URL *
          </label>
          <input
            id="url"
            type="url"
            value={config.url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://example.com"
            required
            className="input w-full"
          />
        </div>

        {/* 基本配置 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-1">
              最大深度
            </label>
            <input
              id="maxDepth"
              type="number"
              min="1"
              max="5"
              value={config.maxDepth}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-1">
              超时时间(ms)
            </label>
            <input
              id="timeout"
              type="number"
              min="5000"
              max="300000"
              step="1000"
              value={config.timeout}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              className="input w-full"
            />
          </div>
        </div>

        {/* 跟随链接开关 */}
        <div className="flex items-center space-x-2">
          <input
            id="followLinks"
            type="checkbox"
            checked={config.followLinks}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, followLinks: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="followLinks" className="text-sm font-medium text-gray-700">
            跟随页面链接
          </label>
        </div>

        {/* 高级设置 */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? '隐藏' : '显示'}高级设置
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* CSS选择器 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">CSS选择器</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600">标题选择器</label>
                  <input
                    type="text"
                    value={config.selectors?.title || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSelectors('title', e.target.value)}
                    placeholder="title, h1"
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">内容选择器</label>
                  <input
                    type="text"
                    value={config.selectors?.content || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSelectors('content', e.target.value)}
                    placeholder="main, article, .content"
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">链接选择器</label>
                  <input
                    type="text"
                    value={config.selectors?.links || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSelectors('links', e.target.value)}
                    placeholder="a[href]"
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* User Agent */}
            <div>
              <label htmlFor="userAgent" className="block text-sm font-medium text-gray-700 mb-1">
                User Agent
              </label>
              <input
                id="userAgent"
                type="text"
                value={config.userAgent}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, userAgent: e.target.value }))}
                className="input w-full text-sm"
              />
            </div>

            {/* 自定义Headers */}
            <div>
              <label htmlFor="headers" className="block text-sm font-medium text-gray-700 mb-1">
                自定义Headers (JSON格式)
              </label>
              <textarea
                id="headers"
                value={customHeaders}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCustomHeaders(e.target.value)}
                placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                rows={3}
                className="input w-full text-sm font-mono"
              />
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
          >
            重置
          </button>
          <button type="submit" disabled={loading || !config.url} className="btn btn-primary">
            {loading ? <LoadingSpinner size="sm" /> : '开始爬取'}
          </button>
        </div>
      </form>
    </div>
  );
};