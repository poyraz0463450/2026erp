import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getQcInspections, addQcInspection, updateInventoryBatch, getInventoryBatches, getParts, updatePart } from '../../firebase/firestore';
import { QC_RESULTS, formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { Plus, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function QcInspections() {
  const { isKalite, isAdmin, userDoc } = useAuth();
  const canEdit = isKalite || isAdmin;
  const [inspections, setInspections] = useState([]);
  const [batches, setBatches] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ partId: '', batchId: '', result: 'Kabul', notes: '', measurements: [] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [i, b, p] = await Promise.all([getQcInspections(), getInventoryBatches(), getParts()]);
      setInspections(i.docs.map(d => ({ id: d.id, ...d.data() })));
      setBatches(b.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(p.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const openNew = (b = null) => {
    setForm({
      partId: b ? b.partId : '',
      batchId: b ? b.id : '',
      result: 'Kabul',
      notes: '',
      measurements: []
    });
    setModal(true);
  };

  const addMeasurement = () => {
    setForm({ ...form, measurements: [...form.measurements, { parameter: '', nominal: '', tolerance: '', actual: '', pass: true }] });
  };
  const updateMeasurement = (idx, field, val) => {
    const m = [...form.measurements];
    m[idx][field] = val;
    // auto-calc pass
    if (field === 'actual' || field === 'nominal' || field === 'tolerance') {
      const nom = Number(m[idx].nominal);
      const tol = Number(m[idx].tolerance);
      const act = Number(m[idx].actual);
      m[idx].pass = act >= nom - tol && act <= nom + tol;
    }
    // auto update overall result based on failures
    let anyFail = false;
    for (let x of m) if (!x.pass) anyFail = true;
    setForm({ ...form, measurements: m, result: anyFail ? 'Red' : 'Kabul' });
  };

  const submit = async () => {
    if (!form.batchId || !form.partId) return;
    const batch = batches.find(b => b.id === form.batchId);
    if (!batch) return;

    // 1. Create QC inspection record
    await addQcInspection({
      ...form, inspector: userDoc?.displayName, inspectionDate: new Date().toISOString()
    });

    // 2. Update Batch status
    await updateInventoryBatch(batch.id, { qcStatus: form.result });

    // 3. Update Part stock status
    const p = parts.find(x => x.id === form.partId);
    if (p) {
       // if Kabul -> stockStatus remains Sağlam or Karantina (maybe update to Sağlam)
       // if Red -> stockStatus Red or Fire? Will just mark batch but part may still have healthy stock from elsewhere
       if (form.result === 'Red') {
         await updatePart(p.id, { stockStatus: 'Karantina' });
       } else if (form.result === 'Kabul' && p.stockStatus === 'Karantina') {
         // Check if other batches are still pending/red
         const otherKarantina = batches.filter(x => x.partId === part.id && (x.qcStatus === 'Bekliyor' || x.qcStatus === 'Red'));
         if (otherKarantina.length <= 1) {
           await updatePart(p.id, { stockStatus: 'Sağlam' });
         }
       }
    }

    setModal(false); load();
  };

  const pName = id => parts.find(p => p.id === id)?.name || id;

  if (loading) return <Spinner />;

  const pendingBatches = batches.filter(b => b.qcStatus === 'Bekliyor');

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        {/* Left: Pending Inspections */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Onay Bekleyen Lotlar</h2>
            <span style={{ fontSize: 11, color: '#475569' }}>{pendingBatches.length} adet</span>
          </div>
          {pendingBatches.length === 0 ? <EmptyState message="Bekleyen QC kaydı yok" /> : pendingBatches.map(b => (
            <div key={b.id} style={{ background: '#0d1117', border: '1px solid #ca8a04', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>{b.batchId}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{b.quantity} Adet</span>
              </div>
              <p style={{ margin: '0 0 12px', color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{b.partName}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => openNew(b)} style={{ height: 28, padding: '0 12px', background: 'transparent', border: '1px solid #fbbf24', borderRadius: 6, color: '#fbbf24', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Muayene Et</button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Inspection History */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Muayene Geçmişi</h2>
            {canEdit && <button onClick={() => openNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} strokeWidth={2} /> Yeni Kayıt</button>}
          </div>

          {inspections.length === 0 ? <EmptyState message="Geçmiş kayıt bulunamadı" /> : (
            <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={TH}>Tarih</th><th style={TH}>Lot / Parça</th><th style={TH}>Sonuç</th><th style={TH}>Müfettiş</th>
                </tr></thead>
                <tbody>
                  {inspections.map(i => {
                    const b = batches.find(x => x.id === i.batchId);
                    return (
                    <tr key={i.id} onMouseEnter={e=>{e.currentTarget.style.background='#111827'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                      <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(i.inspectionDate)}</td>
                      <td style={TD}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{b?.batchId || i.batchId}</span><br/>{pName(i.partId)}</td>
                      <td style={TD}><StatusBadge status={i.result} /></td>
                      <td style={TD}>{i.inspector || '—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* QC Form Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Kalite Kontrol Muayenesi" width={700}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Lot (Batch)</label><select value={form.batchId} onChange={e=>{const b=batches.find(x=>x.id===e.target.value); setForm({...form,batchId:e.target.value,partId:b?.partId||''})}} style={{ ...INPUT, cursor: 'pointer' }}><option value="">Seçin...</option>{batches.filter(b=>b.qcStatus!=='Kabul').map(b=><option key={b.id} value={b.id}>{b.batchId} — {b.partName}</option>)}</select></div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Parça</label><input value={pName(form.partId)} style={INPUT} disabled /></div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: 0 }}>Ölçüm Raporu</label>
              <button onClick={addMeasurement} style={{ height: 26, padding: '0 10px', background: '#334155', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Satır Ekle</button>
            </div>
            {form.measurements.length === 0 ? <p style={{ fontSize: 12, color: '#475569' }}>Ölçüm girilmedi.</p> : (
              <div style={{ border: '1px solid #1e293b', borderRadius: 6, overflow: 'x-auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={TH}>Parametre</th><th style={TH}>Nominal</th><th style={TH}>Tolerans (±)</th><th style={TH}>Gerçek</th><th style={{...TH, textAlign: 'center'}}>T/F</th></tr></thead>
                  <tbody>
                    {form.measurements.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                        <td style={TD}><input placeholder="Çap (mm)" value={m.parameter} onChange={e=>updateMeasurement(i,'parameter',e.target.value)} style={{ ...INPUT, height: 28, fontSize: 11 }}/></td>
                        <td style={TD}><input type="number" step="any" value={m.nominal} onChange={e=>updateMeasurement(i,'nominal',e.target.value)} style={{ ...INPUT, height: 28, fontSize: 11 }}/></td>
                        <td style={TD}><input type="number" step="any" value={m.tolerance} onChange={e=>updateMeasurement(i,'tolerance',e.target.value)} style={{ ...INPUT, height: 28, fontSize: 11 }}/></td>
                        <td style={TD}><input type="number" step="any" value={m.actual} onChange={e=>updateMeasurement(i,'actual',e.target.value)} style={{ ...INPUT, height: 28, fontSize: 11, borderColor: m.pass ? '#1a2332' : '#dc2626' }}/></td>
                        <td style={{ ...TD, textAlign: 'center' }}>{m.pass ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#dc2626" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Notlar</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{ ...INPUT, height: 'auto', padding: 8, resize: 'none' }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Nihai Karar</label><select value={form.result} onChange={e=>setForm({...form,result:e.target.value})} style={{ ...INPUT, cursor: 'pointer', borderColor: form.result==='Red'?'#dc2626':form.result==='Kabul'?'#22c55e':'#334155' }}>{QC_RESULTS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={() => setModal(false)} style={{ height: 36, padding: '0 18px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>İptal</button>
            <button onClick={submit} style={{ height: 36, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Kaydet</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
