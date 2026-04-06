import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getASNs, updateASN, getPurchaseOrders } from '../../firebase/firestore';
import { formatDate } from '../../utils/helpers';
import { 
  Truck, Search, Package, MapPin, 
  Calendar, Hash, CheckCircle2, Clock, 
  ChevronRight, ExternalLink, Ship
} from 'lucide-react';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };

export default function ASNList() {
  const [asns, setAsns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getASNs();
      setAsns(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const filtered = asns.filter(a => 
    !search || 
    a.asnNumber?.toLowerCase().includes(search.toLowerCase()) || 
    a.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>ASN - Sevk Bildirimleri</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Tedarikçilerden gelen ön sevkiyat bildirimleri ve kargo takibi</p>
        </div>
        <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 16px', gap: 16 }}>
           <div style={{ textAlign: 'center' }}>
             <p style={{ margin: 0, fontSize: 10, color: '#475569', fontWeight: 800 }}>YOLDA OLAN</p>
             <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#3b82f6' }}>{asns.filter(a=>a.status==='Yolda').length}</p>
           </div>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 24, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="ASN no veya tedarikçi ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>ASN No</th>
              <th style={TH}>Tedarikçi / PO</th>
              <th style={TH}>Çıkış Tarihi</th>
              <th style={TH}>Tahmini Varış</th>
              <th style={TH}>Kargo / Takip</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Aktif sevk bildirimi bulunmuyor." /></td></tr> : filtered.map(a => (
              <tr key={a.id} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{a.asnNumber}</td>
                <td style={TD}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{a.supplierName}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>PO: {a.poNumber}</span>
                   </div>
                </td>
                <td style={TD}>{formatDate(a.shipDate)}</td>
                <td style={TD}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', fontWeight: 700 }}>
                      <Calendar size={14} /> {formatDate(a.estimatedArrival)}
                   </div>
                </td>
                <td style={TD}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{a.carrier || 'Kargo Belirtilmedi'}</span>
                      <span style={{ fontSize: 11, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Hash size={10}/> {a.trackingNumber} <ExternalLink size={10}/>
                      </span>
                   </div>
                </td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                      background: a.status === 'Yolda' ? '#1e3a8a' : '#064e3b',
                      color: a.status === 'Yolda' ? '#60a5fa' : '#34d399'
                   }}>{a.status?.toUpperCase()}</span>
                </td>
                <td style={TD}><ChevronRight size={16} color="#334155" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
