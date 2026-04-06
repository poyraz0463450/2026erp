import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getWorkCenters, addWorkCenter, updateWorkCenter } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Pencil, Cpu, Activity, Clock, 
  AlertOctagon, CheckCircle2, MoreVertical, Layout 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function WorkCenters() {
  const { isAdmin, isEngineer } = useAuth();
  const canEdit = isAdmin || isEngineer;
  
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'CNC', status: 'Ready', capacity: 100, currentLoad: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getWorkCenters();
      setCenters(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('İş merkezleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editId) await updateWorkCenter(editId, form);
      else await addWorkCenter(form);
      toast.success(editId ? 'İş merkezi güncellendi' : 'İş merkezi eklendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Kayıt başarısız');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Ready': return { bg: '#064e3b', color: '#10b981', icon: <CheckCircle2 size={12}/>, label: 'HAZIR' };
      case 'Down': return { bg: '#450a0a', color: '#ef4444', icon: <AlertOctagon size={12}/>, label: 'ARIZALI' };
      case 'Maintenance': return { bg: '#422006', color: '#f59e0b', icon: <Clock size={12}/>, label: 'BAKIMDA' };
      default: return { bg: '#111827', color: '#64748b', icon: <Activity size={12}/>, label: 'PLANLI' };
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>İş Merkezleri (Shop Floor)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Üretim hatları, makineler ve montaj istasyonları</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm({ code: '', name: '', type: 'CNC', status: 'Ready', capacity: 100, currentLoad: 0 }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={18} strokeWidth={2.5} />Yeni İstasyon Ekle
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {centers.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Henüz bir iş merkezi tanımlanmamış." /></div> : (
          centers.map(c => {
            const sb = getStatusBadge(c.status);
            const loadPercent = Math.min(100, Math.round(((c.currentLoad || 0) / (c.capacity || 100)) * 100));
            return (
              <div key={c.id} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-lg', transition: 'transform 0.2s' }}>
                <div style={{ padding: 20 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                         <div style={{ width: 44, height: 44, borderRadius: 10, background: '#111827', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                           <Cpu size={22} />
                         </div>
                         <div>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>{c.code}</p>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{c.name}</h3>
                         </div>
                      </div>
                      <button onClick={() => { setEditId(c.id); setForm(c); setModal(true); }} style={{ background: 'transparent', border: 'none', color: '#334155', cursor: 'pointer' }}><Pencil size={14}/></button>
                   </div>

                   <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#1e1b4b', color: '#818cf8', letterSpacing: '0.05em' }}>{c.type}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: sb.bg, color: sb.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                         {sb.icon} {sb.label}
                      </span>
                   </div>

                   <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                         <span style={{ fontSize: 11, color: '#64748b' }}>Kapasite Kullanımı (Yük)</span>
                         <span style={{ fontSize: 11, fontWeight: 800, color: loadPercent > 90 ? '#ef4444' : '#e2e8f0' }}>{loadPercent}%</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#111827', borderRadius: 3, overflow: 'hidden' }}>
                         <div style={{ width: `${loadPercent}%`, height: '100%', background: loadPercent > 90 ? '#ef4444' : (loadPercent > 50 ? '#fbbf24' : '#34d399'), transition: 'width 0.5s ease-out' }} />
                      </div>
                   </div>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                      <div>
                         <span style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 2 }}>GÜNLÜK VERİM</span>
                         <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>%94.2</span>
                      </div>
                      <div>
                         <span style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 2 }}>AKTİF İŞ EMRİ</span>
                         <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>2 ADET</span>
                      </div>
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'İş Merkezini Düzenle' : 'Yeni İş Merkezi Tanımı'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>İSTASYON KODU</label><input style={INPUT} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="Örn: CNC-01" /></div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>İSTASYON ADI</label><input style={INPUT} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>TÜR</label>
              <select style={INPUT} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {['CNC', 'Montaj', 'Kalite Test', 'Boyahane', 'Isıl İşlem', 'Paketleme'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>DURUM</label>
              <select style={INPUT} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Ready">Hazır / Boşta</option>
                <option value="Running">Çalışıyor</option>
                <option value="Down">Arızalı / Stop</option>
                <option value="Maintenance">Bakımda</option>
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>TEORİK KAPASİTE (Saat/Hafta)</label><input type="number" style={INPUT} value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>YÜKDELİK (Mevcut Saat)</label><input type="number" style={INPUT} value={form.currentLoad} onChange={e => setForm({ ...form, currentLoad: Number(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
