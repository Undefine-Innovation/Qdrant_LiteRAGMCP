import { Link } from 'react-router-dom';

const Nav = () => {
  return (
    <nav>
        <Link to="/Collection"><p>Collection 管理</p></Link>
        <Link to="/Version"><p>Version 管理</p></Link>
        <Link to="/Document"><p>Document 管理</p></Link>
        <Link to="/Search"><p>搜索</p></Link>
    </nav>
  );
};

export default Nav;