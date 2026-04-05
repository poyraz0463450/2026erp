import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../utils/helpers';
import { Bell, LogOut } from 'lucide-react';
import { logoutUser } from '../../firebase/auth';

const titles = {
  '/': 'Gösterge Paneli',
  '/parts': 'Parçalar & Stok',
  '/stock-movements': 'Stok Hareketleri',
  '/work-orders': 'İş Emirleri',
  '/documents': 'Doküman Yönetimi',
  '/admin/users': 'Kullanıcı Yönetimi',
};

export default function Header() {
  const { pathname } = useLocation();
  const { user, userDoc, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = userDoc?.displayName || user?.email?.split('@')[0] || '?';

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 260, right: 0, zIndex: 40,
      height: 56, minHeight: 56, background: '#0d1117',
      borderBottom: '1px solid #1e293b',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
    }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
        {titles[pathname] || 'ARTEGON ERP'}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Bell */}
        <button style={{
          width: 32, height: 32, border: 'none', background: 'transparent',
          color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
        >
          <Bell size={17} strokeWidth={1.7} />
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: '#1e293b' }} />

        {/* Avatar */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: '#1e293b', color: '#94a3b8',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {name[0].toUpperCase()}
          </button>
          {open && (
            <div className="anim-slide" style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 8,
              width: 180, background: '#0d1117', border: '1px solid #1e293b',
              borderRadius: 6, overflow: 'hidden', zIndex: 60,
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{name}</p>
                <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>{ROLE_LABELS[role]}</p>
              </div>
              <button
                onClick={async () => { await logoutUser(); navigate('/login'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={14} strokeWidth={1.7} />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
