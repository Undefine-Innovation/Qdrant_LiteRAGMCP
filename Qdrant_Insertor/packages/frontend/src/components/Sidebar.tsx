import { Link, useLocation } from 'react-router-dom';

/**
 * 侧边栏组件
 * 提供快速导航和功能入口
 */
const Sidebar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const menuItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/collections', label: '集合管理', icon: '📚' },
    { path: '/documents', label: '文档管理', icon: '📄' },
    { path: '/search', label: '搜索', icon: '🔍' },
    { path: '/scrape', label: '网页爬虫', icon: '🕷️' },
    { path: '/scrape/review', label: '抓取结果审核', icon: '✅' },
    { path: '/monitoring', label: '监控面板', icon: '📊' },
  ];

  return (
    <aside className="w-64 bg-white shadow-md h-screen sticky top-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-secondary-800 mb-4">
          功能菜单
        </h2>
        <nav className="space-y-2">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
