import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getWorkOrderById, updateWorkOrder, getWorkCenters, getParts, 
  getQcInspections, getDocuments, addStockMovement, updatePart,
  addWorkLog, getWorkLogs, getBatchesByPart, updateInventoryBatch 
} from '../../firebase/firestore';
import { 
  WO_STATUS_FLOW, formatDate, formatNumber, WO_OPERATIONS 
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, Save, Play, CheckCircle2, AlertTriangle, 
  Clock, Settings, ClipboardList, Layers, ShieldCheck, 
  FileText, Users, Cpu, MoreVertical, Plus, Trash2, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const TAB_STYLE = (active) => ({ 
  padding: '12px 24px', fontSize: 13, fontWeight: 600, 
  color: active ? '#f1f5f9' : '#64748b', 
  borderBottom: active ? '2px solid #dc2626' : '2px solid transparent', 
  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 
});

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' };
const INPUT_STYLE = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userDoc, isAdmin, isEngineer, isOperator } = useAuth();
  const canEdit = isAdmin || isEngineer;
  const canOperate = canEdit || isOperator;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('Genel');
  
  // Related Data
  const [centers, setCenters] = useState([]);
  const [allParts, setAllParts] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null); // { opIdx, startTime }

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const doc = await getWorkOrderById(id);
      if (!doc.exists()) {
        toast.error('İş emri bulunamadı');
        navigate('/work-orders');
        return;
      }
      setOrder({ id: doc.id, ...doc.data() });

      const [c, p, qc, d, logs] = await Promise.all([
        getWorkCenters(), getParts(), getQcInspections(), getDocuments(), getWorkLogs(id)
      ]);
      setCenters(c.docs.map(x => ({ id: x.id, ...x.data() })));
      setAllParts(p.docs.map(x => ({ id: x.id, ...x.data() })));
      setInspections(qc.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.workOrderId === id));
      setDocs(d.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.linkedPartId === doc.data().productPartId));
      setWorkLogs(logs.docs.map(x => ({ id: x.id, ...x.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateWorkOrder(id, order);
      toast.success('Değişiklikler kaydedildi');
    } catch (e) {
       toast.error('Kayıt başarısız');
    }
  };

  const updateOpStatus = async (idx, status) => {
    const ops = [...(order.operations || [])];
    ops[idx].status = status;
    if (status === 'Bitti') {
       ops[idx].completedAt = new Date().toISOString();
       await backflushMaterials();
    }
    setOrder({ ...order, operations: ops });
    
    // Auto status logic
    let newWOStatus = order.status;
    if (status === 'Üretimde' && order.status === 'Onaylı') newWOStatus = 'Üretimde';
    if (ops.every(o => o.status === 'Bitti') && order.status === 'Üretimde') newWOStatus = 'Kalitede';
    
    await updateWorkOrder(id, { operations: ops, status: newWOStatus });
    if (newWOStatus !== order.status) setOrder(prev => ({ ...prev, status: newWOStatus }));
    toast.success(`Aşama '${ops[idx].name}' durumu güncellendi.`);
  };

  const startOperation = (idx) => {
    setActiveTimer({ opIdx: idx, startTime: Date.now() });
    const ops = [...(order.operations || [])];
    ops[idx].status = 'Üretimde';
    setOrder({ ...order, operations: ops });
    toast.success('Zamanlayıcı başlatıldı');
  };

  const stopOperation = async (idx) => {
    if (!activeTimer) return;
    const durationMs = Date.now() - activeTimer.startTime;
    const hours = (durationMs / (1000 * 60 * 60)).toFixed(4);

    try {
       await addWorkLog({
         workOrderId: id,
         operationName: order.operations[idx].name,
         durationHours: Number(hours),
         operator: userDoc?.displayName || userDoc?.email,
         timestamp: new Date().toISOString()
       });
       setActiveTimer(null);
       updateOpStatus(idx, 'Bitti');
    } catch (e) {
       toast.error('Log kaydedilemedi');
    }
  };

  const backflushMaterials = async () => {
    if (!order.components?.length) return;
    toast.loading('Malzemeler düşülüyor...', { id: 'bf' });
    try {
       for (const comp of order.components) {
          const needed = comp.qty * order.quantity;
          const res = await getBatchesByPart(comp.partId);
          const batches = res.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=> new Date(a.receivedDate) - new Date(b.receivedDate));
          
          let remainingToDeduct = needed;
          for (const batch of batches) {
             if (remainingToDeduct <= 0) break;
             const take = Math.min(batch.remainingQty, remainingToDeduct);
             await updateInventoryBatch(batch.id, { remainingQty: batch.remainingQty - take });
             remainingToDeduct -= take;
          }
          // Update master part stock
          const p = allParts.find(x => x.id === comp.partId);
          if (p) {
             await updatePart(comp.partId, { currentStock: Math.max(0, p.currentStock - needed) });
          }
       }
       toast.success('BOM malzemeleri FIFO ile düşüldü.', { id: 'bf' });
       load();
    } catch (e) {
       toast.error('Düşüm hatası', { id: 'bf' });
    }
  };

  const addOperation = () => {
    const ops = [...(order.operations || [])];
    ops.push({ step: ops.length + 1, name: 'CNC Frezeleme', workCenterId: '', status: 'Beklemede', manualHours: 0 });
    setOrder({ ...order, operations: ops });
  };

  const removeOperation = (idx) => {
    const ops = [...(order.operations || [])];
    ops.splice(idx, 1);
    setOrder({ ...order, operations: ops.map((op, i) => ({ ...op, step: i + 1 })) });
  };

  const progress = useMemo(() => {
    if (!order?.operations?.length) return 0;
    const completed = order.operations.filter(o => o.status === 'Bitti').length;
    return Math.round((completed / order.operations.length) * 100);
  }, [order]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
       {/* HEADER SECTION */}
       <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => navigate('/work-orders')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <ChevronLeft size={20} />
                </button>
                <div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{order.woNumber}</h1>
                      <span style={{ padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#60a5fa', fontSize: 11, fontWeight: 800 }}>{order.status}</span>
                      {order.priority === 'Yüksek' && <span style={{ padding: '4px 10px', borderRadius: 6, background: '#450a0a', color: '#ef4444', fontSize: 10, fontWeight: 900 }}>ACİL</span>}
                   </div>
                   <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{order.productPartNumber} — {order.productName}</p>
                </div>
             </div>
             
             <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'right', marginRight: 16 }}>
                   <span style={{ display: 'block', fontSize: 10, color: '#475569', fontWeight: 800 }}>HAZIRLIK ORANI</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 100, height: 6, background: '#1e293b', borderRadius: 3 }}>
                         <div style={{ width: `${progress}%`, height: '100%', background: '#34d399', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>%{progress}</span>
                   </div>
                </div>
                {canEdit && (
                  <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
                    <Save size={18} /> Kaydet
                  </button>
                )}
             </div>
          </div>
       </div>

       {/* TABS NAVIGATION */}
       <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', display: 'flex', padding: '0 24px' }}>
          <button style={TAB_STYLE(activeTab==='Genel')} onClick={()=>setActiveTab('Genel')}><ClipboardList size={16}/> Genel Durum</button>
          <button style={TAB_STYLE(activeTab==='Rota')} onClick={()=>setActiveTab('Rota')}><Settings size={16}/> Operasyon Rotası</button>
          <button style={TAB_STYLE(activeTab==='BOM')} onClick={()=>setActiveTab('BOM')}><Layers size={16}/> Malzeme (BOM)</button>
          <button style={TAB_STYLE(activeTab==='Kalite')} onClick={()=>setActiveTab('Kalite')}><ShieldCheck size={16}/> Kalite & Muayene</button>
          <button style={TAB_STYLE(activeTab==='Dokümanlar')} onClick={()=>setActiveTab('Dokümanlar')}><FileText size={16}/> Dökümanlar</button>
       </div>

       {/* CONTENT AREA */}
       <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
          
          {/* TAB 1: GENEL DURUM */}
          {activeTab === 'Genel' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
               <div className="section">
                  <div style={CARD_STYLE}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Planlama Detayları</h3>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <div><label style={LABEL_STYLE}>İş Emri No</label><input style={INPUT_STYLE} value={order.woNumber} disabled /></div>
                        <div><label style={LABEL_STYLE}>Üretim Miktarı</label><input style={INPUT_STYLE} value={order.quantity} disabled /></div>
                        <div><label style={LABEL_STYLE}>Birim</label><input style={INPUT_STYLE} value={order.unit || 'Adet'} disabled /></div>
                        <div><label style={LABEL_STYLE}>Planlanan Başlangıç</label><input type="date" style={INPUT_STYLE} value={order.plannedStart} onChange={e=>setOrder({...order,plannedStart:e.target.value})} disabled={!canEdit} /></div>
                        <div><label style={LABEL_STYLE}>Planlanan Bitiş</label><input type="date" style={INPUT_STYLE} value={order.plannedEnd} onChange={e=>setOrder({...order,plannedEnd:e.target.value})} disabled={!canEdit} /></div>
                        <div><label style={LABEL_STYLE}>İş Emri Türü</label><select style={INPUT_STYLE} value={order.type || 'Seri Üretim'} disabled={!canEdit}><option>Seri Üretim</option><option>Prototip</option><option>Tamir/Rework</option></select></div>
                     </div>
                  </div>

                  <div style={CARD_STYLE}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Teknik Bilgiler (Ürün)</h3>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div><label style={LABEL_STYLE}>Ham Malzeme</label><div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>SAE 4140 Çelik Dolu Çubuk</div></div>
                        <div><label style={LABEL_STYLE}>Teknik Resim No</label><div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>ART-TR-1029-A</div></div>
                        <div><label style={LABEL_STYLE}>Net Ağırlık (Birim)</label><div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>1,240 gr</div></div>
                        <div><label style={LABEL_STYLE}>Montaj / Operasyon Grubu</label><div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>Alt Gövde Grubu</div></div>
                     </div>
                  </div>

                  <div style={CARD_STYLE}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Notlar & Talimatlar</h3>
                     <textarea style={{ ...INPUT_STYLE, height: 120, padding: 12, resize: 'none' }} value={order.notes} onChange={e=>setOrder({...order,notes:e.target.value})} disabled={!canEdit} placeholder="Üretim ekibi için özel talimatlar..." />
                  </div>
               </div>

               <div className="sidebar">
                  <div style={CARD_STYLE}>
                     <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Sorumlu Ekip</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                           <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94a3b8' }}>MÜ</div>
                           <div>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{order.assignedEngineerName || 'Ahmet Mühendis'}</p>
                              <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>Proje Mühendisi</p>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                           <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#818cf8' }}>OP</div>
                           <div>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{order.operatorName || 'Mehmet Operatör'}</p>
                              <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>Sorumlu Operatör</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div style={CARD_STYLE}>
                     <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Üretim Metrikleri</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                           <span style={{ color: '#64748b' }}>Harcanan Mesai:</span>
                           <span style={{ fontWeight: 700, color: '#e2e8f0' }}>14.5 Saat</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                           <span style={{ color: '#64748b' }}>Planlanan Süre:</span>
                           <span style={{ fontWeight: 700, color: '#e2e8f0' }}>24.0 Saat</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                           <span style={{ color: '#64748b' }}>Hammadde Fire Oranı:</span>
                           <span style={{ fontWeight: 700, color: '#34d399' }}>%1.2</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* TAB 2: OPERASYON ROTASI */}
          {activeTab === 'Rota' && (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>İmalat Akış Planı (Routing)</h3>
                  {canEdit && (
                    <button onClick={addOperation} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                       <Plus size={14}/> Yeni Operasyon Ekle
                    </button>
                  )}
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {order.operations?.length === 0 ? <EmptyState message="Rota tanımlanmamış." /> : (
                    order.operations.map((op, idx) => {
                       const isDone = op.status === 'Bitti' || op.status === 'Tamamlandı';
                       const isRunning = op.status === 'Üretimde' || op.status === 'Devam Ediyor';
                       return (
                          <div key={idx} style={{ 
                             background: isRunning ? 'linear-gradient(90deg, #0d1117 0%, rgba(251, 191, 36, 0.05) 100%)' : '#0d1117', 
                             border: `1px solid ${isRunning ? '#fbbf24' : '#1e293b'}`, 
                             borderRadius: 12, padding: 16 
                          }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isDone ? '#065f46' : (isRunning ? '#422006' : '#111827'), border: `2px solid ${isDone ? '#34d399' : (isRunning ? '#fbbf24' : '#1e293b')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDone ? '#34d399' : (isRunning ? '#fbbf24' : '#475569') }}>
                                   {isDone ? <CheckCircle2 size={18}/> : (isRunning ? <Clock size={18} className="spin-slow" /> : <span style={{ fontSize: 14, fontWeight: 900 }}>{op.step}</span>)}
                                </div>
                                <div style={{ flex: 1 }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{op.name}</h4>
                                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: '#1e293b', color: '#64748b' }}>ADIM {op.step}</span>
                                   </div>
                                   <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                                      <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={12}/> {centers.find(c=>c.id===op.workCenterId)?.name || 'Merkez Bekleniyor'}</span>
                                      {op.completedAt && <span style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/> {formatDate(op.completedAt)}</span>}
                                   </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {canOperate && !isDone && (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                         {isRunning && activeTimer?.opIdx === idx ? (
                                           <button onClick={() => stopOperation(idx)} style={{ height: 34, padding: '0 16px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <Clock size={14} className="spin-slow" /> DURDUR & BİTİR
                                           </button>
                                         ) : (
                                           <button onClick={() => startOperation(idx)} disabled={activeTimer} style={{ height: 34, padding: '0 16px', background: '#1e3a8a', border: 'none', borderRadius: 6, color: '#60a5fa', fontSize: 11, fontWeight: 800, cursor: activeTimer ? 'not-allowed' : 'pointer', opacity: activeTimer ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <Play size={14}/> BAŞLAT
                                           </button>
                                         )}
                                      </div>
                                    )}
                                    {canEdit && (
                                      <select 
                                        style={{ ...INPUT_STYLE, width: 150, height: 34, fontSize: 12, borderColor: isRunning ? '#fbbf24' : '#1e293b' }} 
                                        value={op.status} 
                                        onChange={e => updateOpStatus(idx, e.target.value)}
                                      >
                                         <option value="Beklemede">Beklemede</option>
                                         <option value="Hazırlık">Hazırlık</option>
                                         <option value="Üretimde">Üretimde</option>
                                         <option value="Bitti">Bitti (Kabul)</option>
                                         <option value="Durduruldu">Durduruldu</option>
                                      </select>
                                    )}
                                    {canEdit && (
                                      <button onClick={() => removeOperation(idx)} style={{ background: 'transparent', border: 'none', color: '#450a0a', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                    )}
                                 </div>
                             </div>
                          </div>
                       )
                    })
                  )}
               </div>
            </div>
          )}

          {/* TAB 3: BOM / MALZEME */}
          {activeTab === 'BOM' && (
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
               <div style={CARD_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                     <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Üretim Reçetesi & Hammadde Kullanımı</h3>
                     <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ height: 32, padding: '0 12px', background: '#0e7490', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                           <Clock size={14}/> Stok Rezervasyonu Yap
                        </button>
                     </div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Parça No</th>
                        <th style={TH}>Parça Adı</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Reçete Mik.</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Top. İhtiyaç</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Mevcut Stok</th>
                        <th style={TH}>Lot No</th>
                        <th style={TH}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!order.components || order.components.length === 0) ? (
                        <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>BOM verisi bulunamadı.</td></tr>
                      ) : (
                        order.components.map((c, i) => {
                          const p = allParts.find(x => x.id === c.partId);
                          const totalNeeded = c.qty * order.quantity;
                          const hasStock = (p?.currentStock || 0) >= totalNeeded;
                          return (
                            <tr key={i}>
                              <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{c.partNumber}</td>
                              <td style={TD}>{c.name}</td>
                              <td style={{ ...TD, textAlign: 'right' }}>{c.qty}</td>
                              <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#e2e8f0' }}>{formatNumber(totalNeeded)}</td>
                              <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: hasStock ? '#34d399' : '#f87171' }}>{p?.currentStock || 0}</td>
                              <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>LOT-2026-X11</td>
                              <td style={TD}>
                                {hasStock ? <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>MÜSAİT</span> : <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>STOK YETERSİZ</span>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* TAB 4: KALİTE GEÇMİŞİ */}
          {activeTab === 'Kalite' && (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Kalite Kontrol & Muayene Kayıtları</h3>
                  <button onClick={() => navigate('/qc/inspections/new', { state: { woId: id, partId: order.productPartId } })} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#0e7490', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                     <Plus size={14}/> Yeni Muayene Başlat
                  </button>
               </div>

               {inspections.length === 0 ? <EmptyState message="Bu iş emri için henüz muayene yapılmadı." /> : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {inspections.map(ins => (
                       <div key={ins.id} style={CARD_STYLE}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ins.overallResult==='Kabul'?'#34d399':'#f87171' }}>
                                   {ins.overallResult === 'Kabul' ? <CheckCircle2 size={24}/> : <XCircle size={24}/>}
                                </div>
                                <div>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{ins.inspectionType}</h4>
                                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: '#1e293b', color: '#60a5fa' }}>{ins.inspectionNo || 'QC-N/A'}</span>
                                   </div>
                                   <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>Müfettiş: {ins.inspectorName} — Tarih: {formatDate(ins.createdAt)}</p>
                                </div>
                             </div>
                             <div style={{ textAlign: 'right' }}>
                                <span style={{ 
                                   fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 6,
                                   background: ins.overallResult === 'Kabul' ? '#065f46' : '#450a0a',
                                   color: ins.overallResult === 'Kabul' ? '#34d399' : '#f87171'
                                }}>{ins.overallResult?.toUpperCase()}</span>
                                <button style={{ marginLeft: 12, background: 'transparent', border: 'none', color: '#334155', cursor: 'pointer' }}><ChevronRight size={18}/></button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {/* TAB 5: DÖKÜMANLAR */}
          {activeTab === 'Dokümanlar' && (
            <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
               {docs.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Tanımlı teknik resim veya talimat bulunamadı." /></div> : (
                  docs.map(doc => (
                    <div key={doc.id} style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
                       <div style={{ pading: 16, display: 'flex', gap: 16, padding: 16 }}>
                          <FileText size={36} color="#3b82f6" />
                          <div>
                             <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{doc.title}</h4>
                             <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>{doc.docNumber} — Rev {doc.revision}</p>
                          </div>
                       </div>
                       <div style={{ background: '#111827', padding: 12, display: 'flex', gap: 8 }}>
                          <button style={{ flex: 1, height: 32, background: '#1e293b', border: 'none', borderRadius: 4, color: '#f1f5f9', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Görüntüle</button>
                          <button style={{ height: 32, width: 32, background: 'transparent', border: '1px solid #1e293b', borderRadius: 4, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Download size={14}/></button>
                       </div>
                    </div>
                  ))
               )}
            </div>
          )}

       </div>
    </div>
  );
}

function XCircle({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
  );
}
