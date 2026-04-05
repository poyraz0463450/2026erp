import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getParts, getModels } from '../../firebase/firestore';
import { 
  PART_CATEGORIES, 
  REVISION_STATUSES, 
  STOCK_STATUSES, 
  formatNumber, 
  PART_SUB_CATEGORIES 
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, ChevronRight, Layers, Filter, 
  AlertTriangle, ShieldAlert, FileDown, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none', transition: 'border-color 0.15s' };

export default function PartsList() {
  const { isAdmin, isEngineer } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || isEngineer;

  const [parts, setParts] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterSubCat, setFilterSubCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterCritical, setFilterCritical] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([getParts(), getModels()]);
      setParts(p?.docs?.map(d => ({ id: d?.id, ...d?.data?.() })) || []);
      setModels(m?.docs?.map(d => ({ id: d?.id, ...d?.data?.() })) || []);
    } catch (e) {
      console.error(e);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const filtered = parts.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !search || p.name?.toLowerCase().includes(s) || p.partNumber?.toLowerCase().includes(s);
    const matchCat = !filterCat || p.category === filterCat;
    const matchSubCat = !filterSubCat || p.subCategory === filterSubCat;
    const matchStatus = !filterStatus || p.stockStatus === filterStatus;
    const matchCritical = !filterCritical || p.isCritical;
    const matchModel = !filterModel || p.usedInModels?.some(m => m.modelId === filterModel);
    
    return matchSearch && matchCat && matchSubCat && matchStatus && matchCritical && matchModel;
  });

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error('Dışa aktarılacak veri bulunamadı');
    
    const headers = [
      'Parça No', 'Ad', 'Kategori', 'Alt Kategori', 'Birim', 'Revizyon', 
      'Mevcut Stok', 'Kritik Stok (Min)', 'Lokasyon', 'Durum', 'Kritik Mi'
    ];
    
    const rows = filtered.map(p => [
      p.partNumber, p.name, p.category, p.subCategory, p.unit, p.revision,
      p.currentStock || 0, p.minStock || 0, p.warehouseLocation || '-', 
      p.stockStatus || 'Sağlam', p.isCritical ? 'EVET' : 'HAYIR'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Artegon_Malzeme_Listesi_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Excel (CSV) dosyası indirildi');
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header & Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Malzeme Yönetimi & Stok</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Merkezi malzeme kütüphanesi ve envanter kontrol sistemi</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={load} style={{ ...INPUT, width: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCSV} style={{ ...INPUT, width: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <FileDown size={14} /> Excel İndir
          </button>
          {canEdit && (
            <button onClick={() => navigate('/parts/new')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)' }}>
              <Plus size={16} strokeWidth={2.5} /> Yeni Parça Tanımla
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input 
              type="text" 
              placeholder="Parça No veya Adı ile ara..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              style={{ ...INPUT, paddingLeft: 36 }}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', 
              background: showFilters ? '#1e293b' : 'transparent', border: '1px solid #1e293b', 
              borderRadius: 6, color: showFilters ? '#f1f5f9' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' 
            }}
          >
            <Filter size={16} /> 
            Gelişmiş Filtreler
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #1a2332' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Kategori</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={INPUT}>
                <option value="">Tümü</option>
                {PART_CATEGORIES?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Alt Kategori</label>
              <select value={filterSubCat} onChange={e => setFilterSubCat(e.target.value)} style={INPUT}>
                <option value="">Tümü</option>
                {PART_SUB_CATEGORIES?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Stok Durumu</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={INPUT}>
                <option value="">Tümü</option>
                {Object.keys(STOCK_STATUSES || {})?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Model</label>
              <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={INPUT}>
                <option value="">Tüm Modeller</option>
                {models?.map(m => <option key={m?.id} value={m?.id}>{m?.modelCode}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={filterCritical} onChange={e => setFilterCritical(e.target.checked)} />
                Kritik Parçalar
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Parça No</th>
              <th style={TH}>Ad</th>
              <th style={TH}>Rev</th>
              <th style={TH}>Model(ler)</th>
              <th style={TH}>Lokasyon</th>
              <th style={{ ...TH, textAlign: 'right' }}>Stok durumu</th>
              <th style={{ ...TH, textAlign: 'right' }}>Mevcut</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered?.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 48 }}><EmptyState message="Arama kriterlerine uygun parça bulunamadı." /></td></tr>
            ) : (
              filtered?.map(p => {
                const isLow = (p.currentStock || 0) <= (p.minStock || 0);
                const isQuarantine = p.stockStatus === 'Karantina';
                
                // Color coding rows
                let rowStyle = { cursor: 'pointer', transition: 'background 0.1s' };
                if (p.isCritical) rowStyle.borderLeft = '4px solid #fbbf24'; // Gold border for critical
                
                return (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/parts/${p.id}`)}
                    style={rowStyle}
                    className="hover-row"
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...TD, verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 6, background: p.isAssembly ? '#1e1b4b' : '#0f172a', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.isAssembly ? '#818cf8' : '#64748b',
                          border: '1px solid #1e293b'
                        }}>
                          {p.isAssembly ? <Layers size={16} /> : <Binary size={16} />}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.02em', fontFamily: 'monospace' }}>{p.partNumber}</p>
                          {p.isCritical && <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>EMNİYET KRİTİK</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...TD, color: '#e2e8f0', fontWeight: 600 }}>{p.name}</td>
                    <td style={TD}><span style={{ color: '#64748b', fontWeight: 600 }}>{p.revision || 'A'}</span></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {p.usedInModels?.length > 0 ? (
                          p.usedInModels?.slice(0, 2)?.map((m, idx) => (
                            <span key={idx} style={{ fontSize: 10, background: '#1e293b', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>{m?.modelCode || m?.modelName}</span>
                          ))
                        ) : '—'}
                        {p.usedInModels?.length > 2 && <span style={{ fontSize: 10, alignSelf: 'center', color: '#475569' }}>+{p.usedInModels.length - 2}</span>}
                      </div>
                    </td>
                    <td style={TD}>{p.warehouseLocation || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                         {isLow && <AlertTriangle size={14} color="#f87171" />}
                         {isQuarantine && <ShieldAlert size={14} color="#fbbf24" />}
                         <span style={{ 
                           fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, 
                           background: STOCK_STATUSES[p.stockStatus || 'Sağlam']?.color?.split(' ')[0] || '#1e293b', 
                           color: STOCK_STATUSES[p.stockStatus || 'Sağlam']?.color?.split(' ')[1] || '#94a3b8' 
                         }}>
                           {p.stockStatus || 'Sağlam'}
                         </span>
                       </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: isLow ? '#f87171' : '#f1f5f9' }}>{formatNumber(p.currentStock)}</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>Min: {p.minStock || 0} {p.unit}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <button style={{ background: 'transparent', border: 'none', color: '#334155', cursor: 'pointer' }}>
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Binary({ size, style }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={style}
    >
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}
