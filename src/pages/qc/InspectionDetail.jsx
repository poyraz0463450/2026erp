import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getQcInspectionById, addQcInspection, updateQcInspection, 
  getParts, getWorkOrders, getInspectionPlans, updatePart,
  addNcrRecord, updateInventoryBatch
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, Save, Plus, Trash2, CheckCircle2, 
  XCircle, AlertTriangle, ShieldCheck, ClipboardCheck, 
  Target, Info, ArrowRight, FilePlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, getAQLSampling } from '../../utils/helpers';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' };
const INPUT_STYLE = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userDoc, isAdmin, isKalite } = useAuth();
  const canEdit = isAdmin || isKalite;

  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState(null);
  
  // Lookup Data
  const [parts, setParts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (id === 'new') {
      const state = location.state || {};
      setInspection({
        inspectionNo: `QC-${new Date().getFullYear()}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`,
        inspectionType: 'Proses Muayenesi',
        partId: state.partId || '',
        workOrderId: state.woId || '',
        workOrderNo: state.woNumber || '',
        lotNumber: state.lotNumber || '',
        lotSize: state.lotSize || 0,
        batchId: state.batchId || '',
        inspectorName: userDoc?.displayName || userDoc?.email || '',
        overallResult: 'Kabul',
        measurements: [],
        notes: '',
        status: 'Açık'
      });
      setLoading(false);
    } else {
      load();
    }
  }, [id, userDoc]);

  const load = async () => {
    try {
      const [iDoc, pData, plData, oData] = await Promise.all([
        id === 'new' ? null : getQcInspectionById(id),
        getParts(),
        getInspectionPlans(),
        getWorkOrders()
      ]);

      if (id !== 'new') {
        if (!iDoc.exists()) {
          toast.error('Kayıt bulunamadı');
          navigate('/qc/inspections');
          return;
        }
        setInspection({ id: iDoc.id, ...iDoc.data() });
      }

      setParts(pData.docs.map(x => ({ id: x.id, ...x.data() })));
      setPlans(plData.docs.map(x => ({ id: x.id, ...x.data() })));
      setOrders(oData.docs.map(x => ({ id: x.id, ...x.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = (planId) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const measures = plan.checkpoints.map(cp => ({
      characteristic: cp.characteristic,
      nominal: cp.nominalValue,
      min: cp.minVal,
      max: cp.maxVal,
      method: cp.method,
      actual: '',
      result: 'Kabul',
      isCritical: cp.isCritical
    }));
    setInspection({ ...inspection, measurements: measures });
    toast.success('Muayene kriterleri plana göre yüklendi.');
  };

  const updateMeasurement = (idx, val) => {
    const ms = [...inspection.measurements];
    ms[idx].actual = val;
    
    // Auto Pass/Fail Logic if numeric
    const actualNum = parseFloat(val);
    const min = parseFloat(ms[idx].min);
    const max = parseFloat(ms[idx].max);
    
    if (!isNaN(actualNum) && !isNaN(min) && !isNaN(max)) {
      ms[idx].result = (actualNum >= min && actualNum <= max) ? 'Kabul' : 'Red';
    }
    
    setInspection({ ...inspection, measurements: ms });
    
    // Auto overall result
    const hasFail = ms.some(m => m.result === 'Red');
    setInspection(prev => ({ ...prev, measurements: ms, overallResult: hasFail ? 'Red' : 'Kabul' }));
  };

  const handleSave = async () => {
    try {
      let finalId = id;
      if (id === 'new') {
        const res = await addQcInspection(inspection);
        finalId = res.id;
        toast.success('Muayene kaydı oluşturuldu');
      } else {
        await updateQcInspection(id, inspection);
        toast.success('Kayıt güncellendi');
      }

      // Logic: If result is KABUL, update inventory batch status
      if (inspection.overallResult === 'Kabul' && inspection.batchId) {
        await updateInventoryBatch(inspection.batchId, {
          status: 'Sağlam', // Now available for production
          qcReleasedDate: new Date().toISOString(),
          qcReleasedBy: userDoc?.displayName
        });
        toast.success('Parçalar KARANTİNA -> SAĞLAM stoklara aktarıldı.');
      }

      // Logic: If result is RED, suggest NCR
      if (inspection.overallResult === 'Red') {
        const createNcr = confirm('Muayene RED edildi. Otomatik Uygunsuzluk Raporu (NCR) oluşturulsun mu?');
        if (createNcr) {
           await addNcrRecord({
             inspectionId: finalId,
             inspectionNo: inspection.inspectionNo,
             partId: inspection.partId,
             lotNumber: inspection.lotNumber,
             description: 'Muayene kriterlerinde tolerans dışı ölçüm tespit edildi.',
             status: 'Yeni',
             reportedBy: userDoc?.displayName,
             findings: inspection.measurements.filter(m => m.result === 'Red'),
             createdAt: new Date().toISOString(),
             // 8D structure placeholders
             d1_team: [], d2_problem: '', d3_containment: '', d4_root_cause: '', 
             d5_corrective_action: '', d6_implementation: '', d7_prevention: '', d8_closure: ''
           });
           toast.success('NCR kaydı oluşturuldu.');
        }
      }
      
      navigate('/qc/inspections');
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
       <div style={{ background: '#0a0f1e', borderBottom: '1px solid #dc2626', padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => navigate('/qc/inspections')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <ChevronLeft size={20} />
                </button>
                <div>
                   <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{inspection.inspectionNo}</h1>
                   <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{inspection.overallResult === 'Kabul' ? <span style={{ color: '#34d399', fontWeight: 800 }}>✓ KABUL EDİLDİ</span> : <span style={{ color: '#f87171', fontWeight: 800 }}>✗ RED EDİLDİ</span>}</p>
                </div>
             </div>
             <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
                   <Save size={18} /> Raporu Onayla & Kapat
                </button>
             </div>
          </div>
       </div>

       <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1fr', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
             <div className="main">
                <div style={CARD_STYLE}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', margin: 0, textTransform: 'uppercase' }}>Karakteristik Ölçüm Matrisi</h3>
                      {id === 'new' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                           <select style={{ ...INPUT_STYLE, width: 220, fontSize: 12 }} onChange={e => applyPlan(e.target.value)}>
                              <option value="">Muayene Planından Yükle...</option>
                              {plans.filter(p => p.partId === inspection.partId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                           </select>
                        </div>
                      )}
                   </div>
                   
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                         <tr style={{ background: '#0a0f1e' }}>
                            <th style={{ ...TH, fontSize: 10, padding: 8 }}>Özellik</th>
                            <th style={{ ...TH, fontSize: 10, padding: 8 }}>Nominal</th>
                            <th style={{ ...TH, fontSize: 10, padding: 8 }}>Tol -</th>
                            <th style={{ ...TH, fontSize: 10, padding: 8 }}>Tol +</th>
                            <th style={{ ...TH, fontSize: 10, padding: 8, width: 140 }}>Ölçülen Değer</th>
                            <th style={{ ...TH, fontSize: 10, padding: 8, width: 80, textAlign: 'center' }}>Sonuç</th>
                         </tr>
                      </thead>
                      <tbody>
                         {inspection.measurements.length === 0 ? (
                           <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Kriter seçilmedi veya plan yüklenmedi.</td></tr>
                         ) : inspection.measurements.map((m, idx) => {
                            const isCrit = m.isCritical;
                            const isFail = m.result === 'Red';
                            return (
                               <tr key={idx} style={{ background: isFail ? 'rgba(248, 113, 113, 0.05)' : 'transparent' }}>
                                  <td style={TD}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {isCrit && <AlertTriangle size={12} color="#fbbf24" />}
                                        <span style={{ fontWeight: 600, color: isCrit ? '#fbbf24' : '#e2e8f0' }}>{m.characteristic}</span>
                                     </div>
                                  </td>
                                  <td style={{ ...TD, fontWeight: 700 }}>{m.nominal}</td>
                                  <td style={TD}>{m.min}</td>
                                  <td style={TD}>{m.max}</td>
                                  <td style={{ ...TD, padding: 4 }}>
                                     <input 
                                       style={{ ...INPUT_STYLE, height: 32, borderColor: isFail ? '#f87171' : '#334155', fontWeight: 800, fontSize: 14 }} 
                                       value={m.actual} 
                                       onChange={e => updateMeasurement(idx, e.target.value)}
                                     />
                                  </td>
                                  <td style={{ ...TD, textAlign: 'center' }}>
                                     <span style={{ 
                                        fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4,
                                        background: m.result === 'Kabul' ? '#065f46' : '#450a0a',
                                        color: m.result === 'Kabul' ? '#34d399' : '#f87171'
                                     }}>{m.result?.toUpperCase()}</span>
                                  </td>
                               </tr>
                            )
                         })}
                      </tbody>
                   </table>
                </div>

                <div style={CARD_STYLE}>
                   <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px', textTransform: 'uppercase' }}>Hata & Karşılaşılan Problemler</h3>
                   <textarea style={{ ...INPUT_STYLE, height: 100, padding: 12, resize: 'none' }} value={inspection.notes} onChange={e => setInspection({...inspection, notes: e.target.value})} placeholder="Bulgular, sapmalar veya gözlemler..." />
                </div>
             </div>

             <div className="sidebar">
                <div style={CARD_STYLE}>
                   <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Üretim Bağlantısı</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                         <label style={LABEL_STYLE}>Silah Modeli / Parça</label>
                         <select style={INPUT_STYLE} value={inspection.partId} onChange={e => setInspection({...inspection, partId: e.target.value})} disabled={id !== 'new'}>
                            <option value="">Seçin...</option>
                            {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
                         </select>
                      </div>
                      <div>
                         <label style={LABEL_STYLE}>Lot / Batch No</label>
                         <input style={INPUT_STYLE} value={inspection.lotNumber} onChange={e => setInspection({...inspection, lotNumber: e.target.value})} />
                      </div>
                      <div>
                         <label style={LABEL_STYLE}>İş Emri Bağlantısı</label>
                         <select style={INPUT_STYLE} value={inspection.workOrderId} onChange={e => setInspection({...inspection, workOrderId: e.target.value})}>
                            <option value="">İş Emri Yok (Giriş Muayenesi)</option>
                            {orders.map(o => <option key={o.id} value={o.id}>{o.woNumber}</option>)}
                         </select>
                      </div>
                      <div style={{ paddingTop: 12, borderTop: '1px solid #1e293b' }}>
                         <span style={LABEL_STYLE}>MUAYENE TÜRÜ</span>
                         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['Giriş', 'Proses', 'Final', 'İlk Parça'].map(t => (
                              <button key={t} onClick={() => setInspection({...inspection, inspectionType: t})} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', background: inspection.inspectionType === t ? '#dc2626' : '#1e293b', color: inspection.inspectionType === t ? '#fff' : '#94a3b8', cursor: 'pointer' }}>{t}</button>
                            ))}
                         </div>
                      </div>
                      <div style={CARD_STYLE}>
                         <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>ISO 2859-1 (MIL-STD-105E)</h4>
                         {(() => {
                            const plan = plans.find(p => p.partId === inspection.partId);
                            const aql = plan?.aqlLevel || 1.0;
                            const { code, sampleSize, ac, re } = getAQLSampling(inspection.lotSize || 1, aql);
                            return (
                              <div style={{ background: '#0a0f1e', padding: 16, borderRadius: 8, border: '1px solid #1e293b' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                                    <span style={{ color: '#475569' }}>Parti Büyüklüğü:</span>
                                    <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{inspection.lotSize || 0} ADET</span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                                    <span style={{ color: '#475569' }}>Kod Harfi (Lvl II):</span>
                                    <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{code}</span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                                    <span style={{ color: '#475569' }}>Numune Büyüklüğü:</span>
                                    <span style={{ fontWeight: 900, color: '#3b82f6' }}>{sampleSize} ADET</span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                                    <span style={{ color: '#475569' }}>Kabul Sayısı (Ac):</span>
                                    <span style={{ fontWeight: 800, color: '#34d399' }}>{ac}</span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <span style={{ color: '#475569' }}>Red Sayısı (Re):</span>
                                    <span style={{ fontWeight: 800, color: '#f87171' }}>{re}</span>
                                 </div>
                                 
                                 <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #1e293b', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                                   AQL Seviyesi: {aql} (Plan tabanlı)
                                 </div>
                              </div>
                            );
                         })()}
                       </div>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
