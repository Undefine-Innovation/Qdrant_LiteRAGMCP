import { Link } from 'react-router-dom';

/**
 * 应用头部组件
 * 包含应用标题和主导航
 */
const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-secondary-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-semibold text-primary-600">
              Qdrant Insertor
            </Link>
          </div>
          <nav className="flex space-x-4">
            <Link
              to="/"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              首页
            </Link>
            <Link
              to="/collections"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              集合
            </Link>
            <Link
              to="/documents"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              文档
            </Link>
            <Link
              to="/search"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              搜索
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
