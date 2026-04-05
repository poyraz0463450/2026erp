import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{
        marginLeft: 260,
        width: 'calc(100vw - 260px)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0a0f1e',
      }}>
        <Header />
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 56 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
