import { useEffect } from 'react';
import { collectionsApi, documentsApi, commonApi } from '../services/api';
import { useApi } from '../hooks/useApi';

/**
 * 首页组件
 * 显示应用概览和快速操作入口
 */
const HomePage = () => {
  // 获取集合数量
  const { state: collectionsState, execute: executeCollections } = useApi(() =>
    collectionsApi.getCollections({ page: 1, limit: 1 }),
  );

  // 获取文档数量
  const { state: documentsState, execute: executeDocuments } = useApi(() =>
    documentsApi.getDocuments({ page: 1, limit: 1 }),
  );

  // 获取系统状态
  const { state: systemState, execute: executeSystem } = useApi(() =>
    commonApi.healthCheck(),
  );

  // 初始加载
  useEffect(() => {
    executeCollections();
    executeDocuments();
    executeSystem();
  }, []);

  const collectionsCount = collectionsState.data?.pagination?.total || 0;
  const documentsCount = documentsState.data?.pagination?.total || 0;
  const systemStatus = systemState.data?.status || 'unknown';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-secondary-800 mb-4">
          欢迎使用 Qdrant Insertor
        </h1>
        <p className="text-secondary-600 mb-6">
          这是一个基于 Qdrant
          的文档插入和检索系统，帮助您高效管理和搜索文档内容。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-2">
              📚 集合管理
            </h3>
            <p className="text-secondary-600 text-sm mb-4">
              创建和管理文档集合，组织您的知识库
            </p>
            <a href="/collections" className="btn btn-primary text-sm">
              管理集合
            </a>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-2">
              📄 文档管理
            </h3>
            <p className="text-secondary-600 text-sm mb-4">
              上传、编辑和删除文档，构建内容库
            </p>
            <a href="/documents" className="btn btn-primary text-sm">
              管理文档
            </a>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-2">
              🔍 智能搜索
            </h3>
            <p className="text-secondary-600 text-sm mb-4">
              使用向量搜索技术快速找到相关内容
            </p>
            <a href="/search" className="btn btn-primary text-sm">
              开始搜索
            </a>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-2">
              📊 数据统计
            </h3>
            <p className="text-secondary-600 text-sm mb-4">
              查看系统使用情况和性能指标
            </p>
            <button className="btn btn-secondary text-sm" disabled>
              即将推出
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-secondary-800 mb-4">
          系统状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-secondary-50 rounded-md">
            <div className="text-2xl font-bold text-primary-600">
              {collectionsState.loading ? '...' : collectionsCount}
            </div>
            <div className="text-sm text-secondary-600">集合数量</div>
          </div>
          <div className="text-center p-4 bg-secondary-50 rounded-md">
            <div className="text-2xl font-bold text-primary-600">
              {documentsState.loading ? '...' : documentsCount}
            </div>
            <div className="text-sm text-secondary-600">文档数量</div>
          </div>
          <div className="text-center p-4 bg-secondary-50 rounded-md">
            <div className="text-2xl font-bold text-primary-600">
              {systemState.loading
                ? '...'
                : systemStatus === 'healthy'
                  ? '正常'
                  : systemStatus}
            </div>
            <div className="text-sm text-secondary-600">系统状态</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
