import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getQcInspections, getParts, getWorkOrders, getInventoryBatches 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Filter, CheckCircle2, XCircle, 
  Clock, ArrowRight, ShieldCheck, FileDown, 
  AlertTriangle, FlaskConical, Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const RESULT_STYLE = {
  'Kabul': { bg: '#065f46', color: '#34d399' },
  'Koşullu Kabul': { bg: '#78350f', color: '#fbbf24' },
  'Kısmi Red': { bg: '#7c2d12', color: '#fb923c' },
  'Red': { bg: '#450a0a', color: '#f87171' },
};

export default function InspectionsList() {
  const { isAdmin, isKalite } = useAuth();
  const navigate = useNavigate();
  
  const [inspections, setInspections] = useState([]);
  const [pendingBatches, setPendingBatches] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('completed'); // completed | pending
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [iRes, pRes, bRes] = await Promise.all([getQcInspections(), getParts(), getInventoryBatches()]);
      setInspections(iRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingBatches(bRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.status === 'Karantina'));
    } catch (e) {
      toast.error('Muayene kayıtları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const filtered = inspections.filter(i => {
    const p = parts.find(x => x.id === i.partId);
    return !search || 
      p?.partNumber?.toLowerCase().includes(search.toLowerCase()) || 
      i.inspectionNo?.toLowerCase().includes(search.toLowerCase()) ||
      i.lotNumber?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Giriş & Proses Muayeneleri</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Tüm kalite kontrol raporları ve operasyonel denetim günlükleri</p>
        </div>
        {(isAdmin || isKalite) && (
          <button onClick={() => navigate('/qc/inspections/new')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#0e7490', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)' }}>
            <Plus size={18} strokeWidth={2.5} /> Yeni Muayene Kaydı
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, borderBottom: '1px solid #1e293b' }}>
        <button onClick={() => setActiveTab('completed')} style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'completed' ? '2px solid #dc2626' : 'none', color: activeTab === 'completed' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>TAMAMLANANLAR</button>
        <button onClick={() => setActiveTab('pending')} style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'pending' ? '2px solid #dc2626' : 'none', color: activeTab === 'pending' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          BEKLEYENLER
          {pendingBatches.length > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{pendingBatches.length}</span>}
        </button>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input 
            type="text" 
            placeholder="Parça No, Lot No veya QC No ile ara..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>
        <button style={{ ...INPUT, width: 'auto', padding: '0 16px', cursor: 'pointer' }}><Filter size={16} /></button>
        <button style={{ ...INPUT, width: 'auto', padding: '0 16px', cursor: 'pointer' }}><FileDown size={16} /></button>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-2xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {activeTab === 'completed' ? (
              <tr>
                <th style={TH}>QC Rapor No</th>
                <th style={TH}>Tarih</th>
                <th style={TH}>Muayene Türü</th>
                <th style={TH}>Parça / Ürün</th>
                <th style={TH}>Lot No / İş Emri</th>
                <th style={TH}>Müfettiş</th>
                <th style={{ ...TH, textAlign: 'center' }}>Sonuç</th>
                <th style={{ ...TH, width: 40 }}></th>
              </tr>
            ) : (
              <tr>
                <th style={TH}>Giriş Tarihi</th>
                <th style={TH}>Parça / Ürün</th>
                <th style={TH}>Lot No</th>
                <th style={{ ...TH, textAlign: 'right' }}>Lot Miktarı</th>
                <th style={TH}>Tedarikçi / Kaynak</th>
                <th style={{ ...TH, textAlign: 'right' }}>İşlem</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'completed' ? (
              filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 48 }}><EmptyState message="Muayene kaydı bulunamadı." /></td></tr> : filtered.map(ins => {
                const p = parts.find(x => x.id === ins.partId);
                const style = RESULT_STYLE[ins.overallResult] || RESULT_STYLE.Red;
                return (
                  <tr key={ins.id} onClick={() => navigate(`/qc/inspections/${ins.id}`)} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{ins.inspectionNo || ins.id.slice(0,8).toUpperCase()}</td>
                    <td style={TD}>{formatDateOnly(ins.createdAt || ins.inspectionDate)}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#111827', color: '#60a5fa' }}>{ins.inspectionType?.toUpperCase() || 'PROSES'}</span>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                         <div style={{ width: 32, height: 32, borderRadius: 6, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <Target size={16} />
                         </div>
                         <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9' }}>{p?.partNumber || '—'}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{p?.name || 'Bilinmiyor'}</p>
                         </div>
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{ins.lotNumber || '—'}</span>
                         {ins.workOrderNo && <span style={{ fontSize: 10, color: '#475569' }}>İş Emri: {ins.workOrderNo}</span>}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                         <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1e293b', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ins.inspectorName?.[0]}</div>
                         <span style={{ fontSize: 11 }}>{ins.inspectorName || 'N/A'}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                       <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800 }}>
                          {ins.overallResult === 'Kabul' ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                          {ins.overallResult?.toUpperCase()}
                       </div>
                    </td>
                    <td style={TD}><ArrowRight size={16} color="#334155" /></td>
                  </tr>
                );
              })
            ) : (
              pendingBatches.length === 0 ? <tr><td colSpan={6} style={{ padding: 48 }}><EmptyState message="Bekleyen muayene bulunmuyor." /></td></tr> : pendingBatches.map(batch => {
                const p = parts.find(x => x.id === batch.partId);
                return (
                  <tr key={batch.id}>
                    <td style={TD}>{formatDateOnly(batch.entryDate || batch.createdAt)}</td>
                    <td style={TD}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9' }}>{p?.partNumber || '—'}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{p?.name || '—'}</p>
                      </div>
                    </td>
                    <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800 }}>{batch.lotNumber}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f1f5f9' }}>{batch.quantity} {p?.unit}</td>
                    <td style={TD}>{batch.supplierName || 'Şirket İçi'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                       <button 
                        onClick={() => navigate('/qc/inspections/new', { state: { partId: batch.partId, lotNumber: batch.lotNumber, lotSize: batch.quantity, batchId: batch.id } })}
                        style={{ height: 32, padding: '0 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                       >
                         Muayene Başlat
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
