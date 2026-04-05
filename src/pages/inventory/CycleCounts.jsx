import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getCycleCounts, addCycleCount, updateCycleCount, 
  getParts, updatePart, addStockMovement 
} from '../../firebase/firestore';
import { formatDate, formatNumber } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  ClipboardCheck, Plus, Search, CheckCircle2, 
  AlertTriangle, Filter, ArrowRight, History 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };

export default function CycleCounts() {
  const { userDoc, isAdmin, isWarehouse } = useAuth();
  const canApprove = isAdmin || isWarehouse;

  const [counts, setCounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modal, setModal] = useState(false);
  const [newCount, setNewCount] = useState({ partId: '', countedQty: 0, location: '', note: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([getCycleCounts(), getParts()]);
      setCounts(cRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCount = async (e) => {
    e.preventDefault();
    if (!newCount.partId) return toast.error('Parça seçiniz');
    
    const part = parts.find(p => p.id === newCount.partId);
    try {
      await addCycleCount({
        ...newCount,
        partNumber: part.partNumber,
        partName: part.name,
        systemQty: part.currentStock || 0,
        status: 'Taslak',
        createdBy: userDoc?.displayName || userDoc?.email,
      });
      toast.success('Sayım kaydı oluşturuldu');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const handleApprove = async (count) => {
    if (!window.confirm('Sayım sonucunu onaylayıp stokları güncellemek istiyor musunuz?')) return;
    
    const variance = count.countedQty - count.systemQty;
    try {
      // 1. Durumu güncelle
      await updateCycleCount(count.id, { 
        status: 'Tamamlandı', 
        approvedBy: userDoc?.displayName || userDoc?.email,
        approvedAt: new Date().toISOString() 
      });

      if (variance !== 0) {
        // 2. Stok hareketini işle
        await addStockMovement({
          partId: count.partId,
          movementType: variance > 0 ? 'Sayım Düzeltme (+)' : 'Sayım Düzeltme (-)',
          qty: Math.abs(variance),
          note: `Sayım Farkı (ID: ${count.id})`,
          timestamp: new Date().toISOString(),
          performedBy: 'Sistem (Sayım Modülü)'
        });

        // 3. Parça stok miktarını güncelle
        const part = parts.find(p => p.id === count.partId);
        await updatePart(count.partId, { currentStock: (part.currentStock || 0) + variance });
      }

      toast.success('Sayım başarıyla sonuçlandırıldı');
      load();
    } catch (e) {
      toast.error('Onaylama işlemi başarısız');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Periyodik Sayım (Cycle Count)</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Depo stok doğruluğu denetimleri ve envanter düzeltmeleri</p>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          <Plus size={20} /> Yeni Sayım Başlat
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
         {[
           { label: 'Açık Sayımlar', val: counts.filter(c=>c.status==='Taslak').length, color: '#fbbf24', icon: <History size={20}/> },
           { label: 'Doğruluk Oranı (Aylık)', val: '%99.2', color: '#34d399', icon: <CheckCircle2 size={20}/> },
           { label: 'Bekleyen Düzeltmeler', val: counts.filter(c => c.status === 'Taslak' && c.countedQty !== c.systemQty).length, color: '#60a5fa', icon: <AlertTriangle size={20}/> }
         ].map((s, i) => (
           <div key={i} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
              <div><p style={{ margin: 0, fontSize: 12, color: '#475569', fontWeight: 700 }}>{s.label}</p><p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>{s.val}</p></div>
           </div>
         ))}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Tarih</th>
              <th style={TH}>Parça No / Adı</th>
              <th style={TH}>Lokasyon</th>
              <th style={{ ...TH, textAlign: 'right' }}>Sistem Miktarı</th>
              <th style={{ ...TH, textAlign: 'right' }}>Sayılan Miktar</th>
              <th style={{ ...TH, textAlign: 'right' }}>Fark</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 140 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {counts.length === 0 ? <tr><td colSpan={8} style={{ padding: 48 }}><EmptyState message="Henüz bir sayım kaydı bulunmuyor." /></td></tr> : counts.map(c => {
               const diff = c.countedQty - c.systemQty;
               return (
                 <tr key={c.id}>
                    <td style={TD}>{formatDate(c.createdAt)}</td>
                    <td style={TD}>
                       <div style={{ fontWeight: 800, color: '#f1f5f9' }}>{c.partNumber}</div>
                       <div style={{ fontSize: 11, color: '#475569' }}>{c.partName}</div>
                    </td>
                    <td style={TD}>{c.location || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{formatNumber(c.systemQty)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 800 }}>{formatNumber(c.countedQty)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 900, color: diff === 0 ? '#34d399' : (diff > 0 ? '#60a5fa' : '#f87171') }}>
                       {diff > 0 ? '+' : ''}{diff}
                    </td>
                    <td style={TD}>
                       <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 8px', borderRadius: 4, background: c.status === 'Tamamlandı' ? '#064e3b' : '#1e3a8a', color: c.status === 'Tamamlandı' ? '#34d399' : '#60a5fa' }}>{c.status.toUpperCase()}</span>
                    </td>
                    <td style={TD}>
                       {c.status === 'Taslak' && canApprove && (
                         <button onClick={() => handleApprove(c)} style={{ background: '#34d399', border: 'none', color: '#064e3b', fontSize: 11, fontWeight: 800, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={14}/> ONAYLA
                         </button>
                       )}
                    </td>
                 </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Sayım Girişi" width={500}>
        <form onSubmit={handleStartCount} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>SAYILACAK PARÇA</label>
              <select style={INPUT} onChange={e => setNewCount({...newCount, partId: e.target.value})}>
                 <option value="">Seçiniz...</option>
                 {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
              </select>
           </div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>SAYILAN MİKTAR</label><input type="number" style={INPUT} onChange={e=>setNewCount({...newCount, countedQty: Number(e.target.value)})} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>LOKASYON / ADRES</label><input style={INPUT} placeholder="Örn: A-12-B" onChange={e=>setNewCount({...newCount, location: e.target.value})} /></div>
           </div>
           <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>NOTLAR</label><textarea style={{ ...INPUT, height: 60, padding: 12, resize: 'none' }} placeholder="..." onChange={e=>setNewCount({...newCount, note: e.target.value})} /></div>
           <button type="submit" style={{ height: 44, background: '#dc2626', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, borderRadius: 8, cursor: 'pointer' }}>SAYIMI ENVANTERE İŞLE</button>
        </form>
      </Modal>
    </div>
  );
}
