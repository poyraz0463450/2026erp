import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getCollection, addData, updateData, deleteData 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Pencil, Trash2, Calendar, 
  Wrench, Hash, AlertTriangle, CheckCircle2, 
  History, Bell, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { formatDateOnly } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };

export default function MeasuringTools() {
  const { isAdmin, isKalite } = useAuth();
  const canEdit = isAdmin || isKalite;
  
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', toolId: '', serialNo: '', lastCalibration: '', nextCalibration: '', status: 'Aktif' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getCollection('measuring_tools');
      setTools(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Cihazlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editId) await updateData('measuring_tools', editId, form);
      else await addData('measuring_tools', form);
      toast.success('Kayıt güncellendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const getCalibrationStatus = (nextDate) => {
    if (!nextDate) return { label: 'Bilinmiyor', color: '#94a3b8' };
    const diff = new Date(nextDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { label: 'KALİBRASYON GEÇTİ', color: '#ef4444', icon: <AlertTriangle size={12}/> };
    if (days <= 30) return { label: `${days} GÜN KALDI`, color: '#fbbf24', icon: <Bell size={12}/> };
    return { label: 'GÜNCEL', color: '#34d399', icon: <CheckCircle2 size={12}/> };
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Ölçüm Cihazları & Kalibrasyon</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Kumpas, mikrometre ve diğer hassas ölçüm aletlerinin periyodik takibi</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm({ name: '', toolId: '', serialNo: '', lastCalibration: '', nextCalibration: '', status: 'Aktif' }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#0e7490', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={18} /> Yeni Cihaz Ekle
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {tools.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Tanımlı ölçüm cihazı bulunmuyor." /></div> : tools.map(t => {
          const stat = getCalibrationStatus(t.nextCalibration);
          return (
            <div key={t.id} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, position: 'relative' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                     <Wrench size={20} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: `1px solid ${stat.color}44`, color: stat.color, fontSize: 10, fontWeight: 900 }}>
                     {stat.icon} {stat.label}
                  </div>
               </div>
               
               <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{t.name}</h3>
               <p style={{ margin: '0 0 16px', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>ID: {t.toolId} | SN: {t.serialNo}</p>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                  <div>
                    <span style={{ display: 'block', fontSize: 9, color: '#475569', fontWeight: 800 }}>SON KALİBRASYON</span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{formatDateOnly(t.lastCalibration)}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 9, color: '#475569', fontWeight: 800 }}>GELECEK TARİH</span>
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>{formatDateOnly(t.nextCalibration)}</span>
                  </div>
               </div>

               <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditId(t.id); setForm(t); setModal(true); }} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer' }}><Pencil size={14}/></button>
                  <button style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: '#450a0a', cursor: 'pointer' }}><Trash2 size={14}/></button>
               </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Cihazı Düzenle' : 'Yeni Ölçüm Cihazı Kaydı'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={LABEL_STYLE}>Cihaz Adı</label><input style={INPUT} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Örn: Dijital Kumpas 0-150mm" required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
             <div><label style={LABEL_STYLE}>Envanter No</label><input style={INPUT} value={form.toolId} onChange={e=>setForm({...form, toolId: e.target.value})} placeholder="QC-T-001" /></div>
             <div><label style={LABEL_STYLE}>Seri No</label><input style={INPUT} value={form.serialNo} onChange={e=>setForm({...form, serialNo: e.target.value})} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
             <div><label style={LABEL_STYLE}>Son Kalibrasyon</label><input type="date" style={INPUT} value={form.lastCalibration} onChange={e=>setForm({...form, lastCalibration: e.target.value})} /></div>
             <div><label style={LABEL_STYLE}>Gelecek Kalibrasyon</label><input type="date" style={INPUT} value={form.nextCalibration} onChange={e=>setForm({...form, nextCalibration: e.target.value})} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 40, padding: '0 32px', background: '#0e7490', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };
