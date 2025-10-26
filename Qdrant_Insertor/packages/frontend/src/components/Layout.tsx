import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children?: React.ReactNode;
}

/**
 * 应用主布局组件
 * 包含头部、侧边栏和主要内容区域
 */
const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-secondary-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children || <Outlet />}</main>
      </div>
    </div>
  );
};

export default Layout;
