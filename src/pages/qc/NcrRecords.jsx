import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getNcrRecords, getParts, updateNcrRecord, addNcrRecord 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  AlertTriangle, Search, Filter, Trash2, 
  ChevronRight, CheckCircle2, FlaskConical, Ban, 
  RotateCcw, ShieldAlert, History, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { formatDateOnly } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

export default function NcrRecords() {
  const { isAdmin, isKalite } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || isKalite;
  
  // Modal for Disposition / Analysis (Now redundant but keeping state for small things or just removing)
  const [ncrs, setNcrs] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [nRes, pRes] = await Promise.all([getNcrRecords(), getParts()]);
      setNcrs(nRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('NCR kayıtları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateNcrRecord(selNcr.id, selNcr);
      toast.success('NCR güncellendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Giriş başarısız');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Yeni': return { bg: '#450a0a', color: '#ef4444' };
      case 'Analizde': return { bg: '#422006', color: '#fbbf24' };
      case 'Dispositioned': return { bg: '#1e3a8a', color: '#60a5fa' };
      case 'Kapalı': return { bg: '#065f46', color: '#34d399' };
      default: return { bg: '#1e293b', color: '#94a3b8' };
    }
  };

  const filtered = ncrs.filter(n => {
    const p = parts.find(x => x.id === n.partId);
    return !search || p?.partNumber?.toLowerCase().includes(search.toLowerCase()) || n.lotNumber?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Uygunsuzluk Raporları (NCR)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Kalite sapmaları, hurda takibi ve kök neden analizleri</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <div style={{ background: '#0d1117', border: '1px solid #dc2626', padding: '10px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert color="#ef4444" size={24} />
              <div>
                 <span style={{ display: 'block', fontSize: 10, color: '#ef4444', fontWeight: 800 }}>AÇIK NCR</span>
                 <span style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>{ncrs.filter(n=>n.status!=='Kapalı').length}</span>
              </div>
           </div>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
           <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
           <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Parça veya Lot No ile ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <button style={{ ...INPUT, width: 'auto', background: 'transparent' }}><Filter size={16}/></button>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>NCR No</th>
              <th style={TH}>Tarih</th>
              <th style={TH}>Parça / Ürün</th>
              <th style={TH}>Lot No</th>
              <th style={TH}>Hata Özeti</th>
              <th style={TH}>Durum</th>
              <th style={TH}>Karar (Disposition)</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 48 }}><EmptyState message="Aktif NRC kaydı bulunmamaktadır." /></td></tr> : filtered.map(n => {
              const p = parts.find(x => x.id === n.partId);
              const ss = getStatusStyle(n.status);
              return (
                <tr key={n.id} onClick={() => navigate(`/qc/ncr/${n.id}`)} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{n.id.slice(0,8).toUpperCase()}</td>
                  <td style={TD}>{formatDateOnly(n.createdAt)}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{p?.partNumber || '—'}</span>
                       <span style={{ fontSize: 11, color: '#475569' }}>{p?.name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{n.lotNumber || '—'}</td>
                  <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.description}</td>
                  <td style={TD}>
                     <span style={{ 
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                        background: ss.bg, color: ss.color
                     }}>{n.status?.toUpperCase()}</span>
                  </td>
                  <td style={TD}>
                     {n.disposition ? (
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: n.disposition==='Scrap'?'#f87171':'#60a5fa' }}>
                          {n.disposition === 'Scrap' ? <Ban size={12}/> : <RotateCcw size={12}/>}
                          {n.disposition === 'Scrap' ? 'HURDA' : n.disposition?.toUpperCase()}
                       </div>
                     ) : '—'}
                  </td>
                  <td style={TD}><ChevronRight size={16} color="#334155" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
