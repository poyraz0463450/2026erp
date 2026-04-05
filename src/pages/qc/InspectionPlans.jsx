import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getInspectionPlans, addInspectionPlan, updateInspectionPlan, getParts 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Pencil, Trash2, ClipboardCheck, 
  ShieldCheck, AlertCircle, Save, Layers, ListChecks
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function InspectionPlans() {
  const { isAdmin, isKalite } = useAuth();
  const canEdit = isAdmin || isKalite;
  
  const [plans, setPlans] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ partId: '', revision: 'A', title: '', aqlLevel: 'II', sampleSize: 5, checkpoints: [] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pRes, plRes] = await Promise.all([getParts(), getInspectionPlans()]);
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setPlans(plRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Muayene planları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editId) await updateInspectionPlan(editId, form);
      else await addInspectionPlan(form);
      toast.success(editId ? 'Plan güncellendi' : 'Yeni plan eklendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const addCheckpoint = () => {
    const cp = [...form.checkpoints];
    cp.push({ characteristic: '', nominalValue: '', minVal: '', maxVal: '', method: 'Kumpas', isCritical: false });
    setForm({ ...form, checkpoints: cp });
  };

  const updateCheckpoint = (idx, field, val) => {
    const cp = [...form.checkpoints];
    cp[idx][field] = val;
    setForm({ ...form, checkpoints: cp });
  };

  const removeCheckpoint = (idx) => {
    const cp = [...form.checkpoints];
    cp.splice(idx, 1);
    setForm({ ...form, checkpoints: cp });
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Muayene Planları (QMS)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Parça bazlı kontrol kriterleri, toleranslar ve AQL tanımları</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm({ partId: '', revision: 'A', title: '', aqlLevel: 'II', sampleSize: 5, checkpoints: [] }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={18} strokeWidth={2.5} /> Yeni Muayene Planı
          </button>
        )}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Parça No</th>
              <th style={TH}>Plan Başlığı</th>
              <th style={TH}>Rev</th>
              <th style={{ ...TH, textAlign: 'center' }}>Kriter Sayısı</th>
              <th style={TH}>AQL Seviyesi</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? <tr><td colSpan={6} style={{ padding: 48 }}><EmptyState message="Tanımlı muayene planı bulunmuyor." /></td></tr> : plans.map(p => {
              const targetPart = parts.find(x => x.id === p.partId);
              return (
                <tr key={p.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{targetPart?.partNumber || '—'}</td>
                  <td style={{ ...TD, fontWeight: 600, color: '#e2e8f0' }}>{p.title}</td>
                  <td style={TD}><span style={{ color: '#64748b' }}>{p.revision}</span></td>
                  <td style={{ ...TD, textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: '#1e293b', color: '#818cf8', fontSize: 11, fontWeight: 800 }}>{p.checkpoints?.length || 0}</span></td>
                  <td style={TD}><span style={{ color: '#fbbf24', fontWeight: 700 }}>MIL-STD-105E ({p.aqlLevel})</span></td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <button onClick={() => { setEditId(p.id); setForm(p); setModal(true); }} style={{ height: 32, width: 32, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Pencil size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Muayene Planını Düzenle' : 'Yeni Muayene Planı Oluştur'} width={900}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={LABEL_STYLE}>Hangi Parça İçin?</label>
              <select style={INPUT} value={form.partId} onChange={e => setForm({ ...form, partId: e.target.value })} required>
                <option value="">Seçin...</option>
                {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
              </select>
            </div>
            <div><label style={LABEL_STYLE}>Plan Revizyonu</label><input style={INPUT} value={form.revision} onChange={e => setForm({ ...form, revision: e.target.value })} required /></div>
            <div style={{ gridColumn: 'span 3' }}><label style={LABEL_STYLE}>Plan Başlığı / Tanımı</label><input style={INPUT} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Örn: 1029-A Kritik Kriterler Kontrolü" /></div>
          </div>

          <div style={{ border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#0d1117', padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h4 style={{ margin: 0, fontSize: 13, color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ListChecks size={16}/> Kontrol Kriterleri</h4>
               <button type="button" onClick={addCheckpoint} style={{ height: 28, padding: '0 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Ekle</button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#0a0f1e' }}>
                    <th style={{ ...TH, fontSize: 10, padding: 8 }}>Karakteristik / Ölçü</th>
                    <th style={{ ...TH, fontSize: 10, padding: 8 }}>Nominal</th>
                    <th style={{ ...TH, fontSize: 10, padding: 8 }}>Min</th>
                    <th style={{ ...TH, fontSize: 10, padding: 8 }}>Max</th>
                    <th style={{ ...TH, fontSize: 10, padding: 8, width: 120 }}>Yöntem</th>
                    <th style={{ ...TH, fontSize: 10, padding: 8, width: 40 }}>Kritik</th>
                    <th style={{ ...TH, width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                   {form.checkpoints.length === 0 ? <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 12 }}>Kriter eklenmedi</td></tr> : form.checkpoints.map((cp, idx) => (
                     <tr key={idx} style={{ background: cp.isCritical ? 'rgba(251, 191, 36, 0.05)' : 'transparent' }}>
                       <td style={{ ...TD, padding: 4 }}><input style={{ ...INPUT, height: 32 }} value={cp.characteristic} onChange={e => updateCheckpoint(idx, 'characteristic', e.target.value)} placeholder="Dış Çap" /></td>
                       <td style={{ ...TD, padding: 4 }}><input style={{ ...INPUT, height: 32 }} value={cp.nominalValue} onChange={e => updateCheckpoint(idx, 'nominalValue', e.target.value)} /></td>
                       <td style={{ ...TD, padding: 4 }}><input style={{ ...INPUT, height: 32 }} value={cp.minVal} onChange={e => updateCheckpoint(idx, 'minVal', e.target.value)} /></td>
                       <td style={{ ...TD, padding: 4 }}><input style={{ ...INPUT, height: 32 }} value={cp.maxVal} onChange={e => updateCheckpoint(idx, 'maxVal', e.target.value)} /></td>
                       <td style={{ ...TD, padding: 4 }}>
                         <select style={{ ...INPUT, height: 32 }} value={cp.method} onChange={e => updateCheckpoint(idx, 'method', e.target.value)}>
                            {['Gözle Görsel','Kumpas','Mikrometre','Mastar','CMM','Sertlik Cihazı','Profil Projeksiyon'].map(m => <option key={m} value={m}>{m}</option>)}
                         </select>
                       </td>
                       <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={cp.isCritical} onChange={e => updateCheckpoint(idx, 'isCritical', e.target.checked)} /></td>
                       <td style={TD}><button type="button" onClick={() => removeCheckpoint(idx)} style={{ background: 'transparent', border: 'none', color: '#450a0a', cursor: 'pointer' }}><Trash2 size={12}/></button></td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 40, padding: '0 32px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Planı Kaydet</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };
