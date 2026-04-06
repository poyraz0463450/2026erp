import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';
import { seedLocalDepartmentDemos } from '../../firebase/localDemo';
import { syncMaterialPlanning } from '../../services/materialPlanningService';

export default function Layout() {
  const { loading, user, userDoc, isAdmin, isEngineer } = useAuth();

  useEffect(() => {
    seedLocalDepartmentDemos();
  }, []);

  useEffect(() => {
    if (loading || !user || (!isAdmin && !isEngineer)) return;

    const runSync = () =>
      syncMaterialPlanning({
        actorName: userDoc?.full_name || userDoc?.displayName || user.email || 'Sistem',
        actorEmail: user.email || 'system@artegon.local',
      }).catch((error) => {
        console.error('material planning sync error', error);
      });

    runSync();
    const intervalId = window.setInterval(runSync, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading, user, userDoc, isAdmin, isEngineer]);

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
