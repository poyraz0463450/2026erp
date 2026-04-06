import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getMachines, addMachine, updateMachine, getWorkCenters 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Cpu, Plus, Settings, AlertOctagon, 
  CheckCircle2, Clock, Activity, HardDrive 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s' };
const STATUS_COLORS = { Ready: '#34d399', Running: '#60a5fa', Down: '#f87171', Maintenance: '#f59e0b' };

export default function Machines() {
  const { isAdmin, isEngineer } = useAuth();
  const canEdit = isAdmin || isEngineer;

  const [machines, setMachines] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', type: 'CNC', status: 'Ready', workCenterId: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([getMachines(), getWorkCenters()]);
      setMachines(mRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setCenters(cRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Makineler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addMachine(form);
      toast.success('Makine başarıyla eklendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await updateMachine(id, { status: newStatus });
      toast.success('Durum güncellendi');
      load();
    } catch (e) {
      toast.error('Güncelleme başarısız');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Makine & Ekipman İzleme</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Atölyedeki tüm aktif cihazların anlık durum ve verimlilik takibi</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <Plus size={20}/> Yeni Makine Tanımla
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
        {machines.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Tanımlı makine bulunamadı." /></div> : machines.map(m => (
          <div key={m.id} style={CARD_STYLE}>
            <div style={{ padding: 20 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                     <div style={{ width: 48, height: 48, borderRadius: 12, background: `${STATUS_COLORS[m.status]}10`, border: `1px solid ${STATUS_COLORS[m.status]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STATUS_COLORS[m.status] }}>
                        <HardDrive size={24} />
                     </div>
                     <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{m.name}</h3>
                        <p style={{ margin: 0, fontSize: 11, color: '#475569', fontWeight: 700 }}>{m.code} — {m.type}</p>
                     </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <span style={{ fontSize: 9, fontWeight: 900, padding: '4px 10px', borderRadius: 20, background: `${STATUS_COLORS[m.status]}15`, color: STATUS_COLORS[m.status] }}>
                        {m.status.toUpperCase()}
                     </span>
                  </div>
               </div>

               <div style={{ background: '#0a0f1e', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: '#475569' }}>BAĞLI İŞ MERKEZİ</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{centers.find(c=>c.id===m.workCenterId)?.name || 'Atanmamış'}</p>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 10 }}>
                     <span style={{ display: 'block', fontSize: 9, color: '#475569', marginBottom: 4 }}>GÜNLÜK VERİMLİLİK</span>
                     <span style={{ fontSize: 16, fontWeight: 900, color: '#34d399' }}>%98.4</span>
                  </div>
                  <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 10 }}>
                     <span style={{ display: 'block', fontSize: 9, color: '#475569', marginBottom: 4 }}>TOPLAM ÇALIŞMA</span>
                     <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>1.240 <small style={{ fontSize: 10 }}>saat</small></span>
                  </div>
               </div>

               <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStatus(m.id, 'Running')} style={{ flex: 1, height: 32, background: m.status==='Running'?'#1e3a8a':'#111827', border: '1px solid #1e293b', borderRadius: 6, color: m.status==='Running'?'#60a5fa':'#64748b', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>ÇALIŞTIR</button>
                  <button onClick={() => updateStatus(m.id, 'Down')} style={{ flex: 1, height: 32, background: m.status==='Down'?'#450a0a':'#111827', border: '1px solid #1e293b', borderRadius: 6, color: m.status==='Down'?'#ef4444':'#64748b', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>ARIZA</button>
                  <button onClick={() => updateStatus(m.id, 'Maintenance')} style={{ flex: 1, height: 32, background: m.status==='Maintenance'?'#422006':'#111827', border: '1px solid #1e293b', borderRadius: 6, color: m.status==='Maintenance'?'#f59e0b':'#64748b', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>BAKIM</button>
               </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Makine Tanımla" width={500}>
         <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MAKİNE KODU</label><input style={{ width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} value={form.code} onChange={e=>setForm({...form, code: e.target.value})} placeholder="CNC-01" required /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MAKİNE ADI</label><input style={{ width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Mazak VCN-530C" required /></div>
            </div>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>İŞ MERKEZİ (LOKASYON)</label>
               <select style={{ width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} value={form.workCenterId} onChange={e=>setForm({...form, workCenterId: e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MAKİNE TÜRÜ</label>
               <select style={{ width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
                  {['CNC Freze', 'CNC Torna', 'Tel Erozyon', 'Manuel Tezgah', 'Montaj Hattı', 'Boyama Ünitesi'].map(t => <option key={t} value={t}>{t}</option>)}
               </select>
            </div>
            <button type="submit" style={{ height: 44, background: '#dc2626', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, borderRadius: 8, cursor: 'pointer', marginTop: 10 }}>MAKİNEYİ SİSTEME KAYDET</button>
         </form>
      </Modal>
    </div>
  );
}
