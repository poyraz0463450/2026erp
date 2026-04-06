import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Binary,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cpu,
  Crosshair,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Handshake,
  HardDrive,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { logoutUser } from '../../firebase/auth';
import { ROLE_LABELS } from '../../utils/helpers';

const SECTIONS = [
  {
    id: 'engineering',
    label: 'Malzeme Yönetimi',
    icon: Binary,
    roles: ['admin', 'engineer', 'warehouse', 'kalite', 'viewer'],
    items: [
      { to: '/parts', label: 'Parça Master (Kütüphane)', icon: Package, badgeId: 'criticalStock' },
      { to: '/models', label: 'Modeller', icon: Crosshair },
    ],
  },
  {
    id: 'purchasing',
    label: 'Satınalma (SCM)',
    icon: ShoppingCart,
    roles: ['admin', 'satin_alma', 'warehouse'],
    items: [
      { to: '/purchasing', label: 'Satınalma Paneli', icon: LayoutDashboard },
      { to: '/purchasing/mrp', label: 'MRP Planlaması', icon: FileSpreadsheet },
      { to: '/purchasing/rfq', label: 'Teklif Toplama (RFQ)', icon: FileText },
      { to: '/purchasing/requests', label: 'Satınalma Talepleri', icon: ListOrdered },
      { to: '/purchasing/orders', label: 'Satınalma Siparişleri', icon: ShoppingCart, badgeId: 'delayedPO' },
      { to: '/purchasing/asn', label: 'ASN - Sevk Bildirimi', icon: Truck, badgeId: 'pendingGRN' },
      { to: '/purchasing/receipts', label: 'Mal Kabul (GRN)', icon: FileCheck },
      { to: '/purchasing/invoices', label: 'Faturalar', icon: FileText },
      { to: '/purchasing/suppliers', label: 'Tedarikçiler', icon: Building2 },
    ],
  },
  {
    id: 'quality',
    label: 'Kalite (QMS)',
    icon: ShieldCheck,
    roles: ['admin', 'kalite'],
    items: [
      { to: '/qc/plans', label: 'Muayene Planları', icon: FileSpreadsheet },
      { to: '/qc/inspections', label: 'Muayene Kayıtları', icon: ShieldCheck, badgeId: 'pendingQC' },
      { to: '/qc/ncr', label: 'Uygunsuzluk (NCR)', icon: ShieldAlert, badgeId: 'openNCR' },
      { to: '/qc/tools', label: 'Ölçüm Cihazları', icon: HardDrive, badgeId: 'expiredCalibration' },
    ],
  },
  {
    id: 'warehouse',
    label: 'Depo (WMS)',
    icon: Package,
    roles: ['admin', 'warehouse', 'kalite'],
    items: [
      { to: '/inventory/material-control', label: 'Malzeme Kontrol Merkezi', icon: AlertTriangle, badgeId: 'criticalStock' },
      { to: '/stock-movements', label: 'Stok Hareketleri', icon: ArrowLeftRight },
      { to: '/inventory/cycle-counts', label: 'Periyodik Sayım', icon: ListOrdered },
      { to: '/inventory/traceability', label: 'İzlenebilirlik', icon: Crosshair },
    ],
  },
  {
    id: 'sales',
    label: 'Satış ve CRM',
    icon: ShoppingBag,
    roles: ['admin', 'sales'],
    items: [
      { to: '/sales/customers', label: 'Müşteriler', icon: Handshake },
      { to: '/sales/orders', label: 'Satış Siparişleri', icon: ListOrdered },
      { to: '/sales/shipping', label: 'Sevkiyat (ASN-Out)', icon: Truck },
    ],
  },
  {
    id: 'finance',
    label: 'Finansal Analiz',
    icon: Landmark,
    roles: ['admin', 'finance'],
    items: [
      { to: '/financials/invoices', label: 'Faturalar (AR)', icon: Receipt },
      { to: '/financials/costing', label: 'Birim Maliyet (COGS)', icon: Calculator },
    ],
  },
  {
    id: 'production',
    label: 'Üretim (MES)',
    icon: ClipboardList,
    roles: ['admin', 'engineer', 'kalite', 'operator', 'viewer'],
    items: [
      { to: '/work-centers', label: 'İş Merkezleri', icon: Cpu },
      { to: '/machines', label: 'Makine Planlama', icon: Settings },
      { to: '/work-orders', label: 'İş Emirleri', icon: ListOrdered },
      { to: '/gantt', label: 'Üretim Planı (Gantt)', icon: Binary },
    ],
  },
  {
    id: 'docs',
    label: 'Dokümanlar (PDM)',
    icon: FileText,
    roles: ['admin', 'engineer', 'kalite', 'viewer'],
    items: [
      { to: '/documents', label: 'Tüm Dokümanlar', icon: FileText },
    ],
  },
];

export default function Sidebar() {
  const { role, user, userDoc } = useAuth();
  const { counts } = useNotifications();
  const navigate = useNavigate();

  const [openSections, setOpenSections] = useState({
    engineering: true,
    production: true,
    warehouse: true,
    sales: false,
    finance: false,
    quality: false,
    purchasing: false,
    docs: false,
  });

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const name =
    userDoc?.full_name ||
    userDoc?.displayName ||
    user?.email?.split('@')[0] ||
    '?';
  const isAllowed = (roles) => roles.includes(role);

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 260,
        background: '#0a0f1e',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      <div style={{ padding: '24px 24px 12px' }}>
        <img src="/logo.png" alt="ARTEGON" style={{ height: 40, objectFit: 'contain', display: 'block', marginBottom: 8 }} />
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: '#64748b', margin: 0, textTransform: 'uppercase' }}>
          DEFENSE SYSTEMS OS
        </p>
      </div>

      <div style={{ width: '80%', height: 1, background: '#dc2626', margin: '4px auto 16px', opacity: 0.3 }} />

      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 40,
            padding: '0 16px',
            marginBottom: 12,
            borderRadius: 8,
            background: isActive ? '#dc2626' : 'transparent',
            color: isActive ? '#fff' : '#94a3b8',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.2s',
          })}
        >
          <LayoutDashboard size={18} />
          <span>Ana Panel</span>
        </NavLink>

        {SECTIONS.filter((section) => isAllowed(section.roles)).map((section) => (
          <div key={section.id} style={{ marginBottom: 6 }}>
            <button
              onClick={() => toggleSection(section.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 38,
                padding: '0 12px',
                border: 'none',
                background: 'transparent',
                color: openSections[section.id] ? '#f1f5f9' : '#475569',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 1,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <section.icon size={14} color={openSections[section.id] ? '#dc2626' : '#475569'} />
                <span>{section.label}</span>
              </div>
              {openSections[section.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {openSections[section.id] && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      height: 34,
                      padding: '0 16px',
                      marginBottom: 2,
                      borderRadius: 6,
                      background: isActive ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
                      color: isActive ? '#dc2626' : '#94a3b8',
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    })}
                  >
                    {({ isActive }) => (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <item.icon size={16} strokeWidth={isActive ? 2.5 : 1.5} />
                          <span>{item.label}</span>
                        </div>
                        {item.badgeId && counts[item.badgeId] > 0 && (
                          <span
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 12,
                              minWidth: 20,
                              textAlign: 'center',
                            }}
                          >
                            {counts[item.badgeId]}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}

        {role === 'admin' && (
          <div style={{ marginTop: 24, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
            <p style={{ padding: '0 16px', fontSize: 10, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 8 }}>Sistem</p>
            <NavLink
              to="/admin/users"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                height: 40,
                padding: '0 16px',
                borderRadius: 8,
                background: isActive ? '#dc2626' : 'transparent',
                color: isActive ? '#fff' : '#94a3b8',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              })}
            >
              <Users size={18} />
              <span>Kullanıcı Yönetimi</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div style={{ padding: '16px', background: '#05070a', borderTop: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 0 15px rgba(220, 38, 38, 0.3)',
            }}
          >
            {name[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', margin: 0, textTransform: 'uppercase' }}>{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await logoutUser();
            navigate('/login');
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 36,
            border: '1px solid #1e293b',
            borderRadius: 8,
            background: '#0d1117',
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <LogOut size={14} strokeWidth={2} />
          Sistemden Çık
        </button>
      </div>
    </aside>
  );
}
