import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getWorkOrders, getParts, updateWorkOrder, addWorkOrder, getWorkCenters 
} from '../../firebase/firestore';
import { 
  WO_STATUS_FLOW, formatDate, formatNumber 
} from '../../utils/helpers';
import { generateWorkOrderNumber } from '../../utils/autoGen';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import { 
  Plus, Search, Filter, LayoutGrid, List, ChevronRight, 
  Clock, PlayCircle, CheckCircle2, AlertCircle, Calendar, Hash
} from 'lucide-react';
import toast from 'react-hot-toast';

// DnD Kit
import {
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

// ── KANBAN COMPONENTS ────────────────────────────────────────────────────────

function SortableItem({ id, order, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    background: '#0d1117',
    border: '1px solid #1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    cursor: 'grab',
    boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.4)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onClick(order.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', fontFamily: 'monospace' }}>{order.woNumber}</span>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#94a3b8' }}>{order.priority || 'Normal'}</span>
      </div>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{order.productName}</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <span style={{ fontSize: 11, color: '#475569' }}>Miktar: <strong style={{ color: '#e2e8f0' }}>{order.quantity}</strong></span>
         <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
            <Calendar size={10} />
            {order.plannedEnd ? formatDate(order.plannedEnd) : 'N/A'}
         </div>
      </div>
    </div>
  );
}

function KanbanColumn({ id, title, orders, onCardClick, color }) {
  return (
    <div style={{ flex: 1, minWidth: 260, background: 'rgba(10, 15, 30, 0.5)', borderRadius: 12, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {title}
         </h3>
         <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#0a0f1e', padding: '2px 8px', borderRadius: 10 }}>{orders.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <SortableContext items={orders.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {orders.map(order => (
            <SortableItem key={order.id} id={order.id} order={order} onClick={onCardClick} />
          ))}
        </SortableContext>
        {orders.length === 0 && <div style={{ height: 100, border: '2px dashed #1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>Boş</div>}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function WorkOrderList() {
  const { isAdmin, isEngineer, userDoc } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || isEngineer;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // 'list' or 'kanban'
  const [search, setSearch] = useState('');
  
  // New Work Order Modal State
  const [modal, setModal] = useState(false);
  const [parts, setParts] = useState([]);
  const [models, setModels] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [form, setForm] = useState({
    woNumber: '',
    productId: '',
    productName: '',
    modelId: '',
    modelCode: '',
    quantity: 1,
    plannedStart: new Date().toISOString().slice(0, 16),
    plannedEnd: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
    priority: 'Normal',
    responsibleEngineer: ''
  });
  
  // DnD State
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [woRes, pRes, mRes] = await Promise.all([
        getWorkOrders(),
        getParts(),
        getModels()
      ]);
      setOrders(woRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setModels(mRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = async () => {
    setIsGenerating(true);
    try {
      const nextId = await generateWorkOrderNumber();
      setForm({ ...form, woNumber: nextId, responsibleEngineer: userDoc?.displayName || '' });
      setModal(true);
    } catch (err) {
      toast.error('İş emri numarası üretilemedi');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateWO = async (e) => {
    e.preventDefault();
    if (!form.productId || !form.quantity) return toast.error('Ürün ve miktar zorunludur');
    
    try {
      const selectedPart = parts.find(p => p.id === form.productId);
      const selectedModel = models.find(m => m.id === form.modelId);
      
      const woData = {
        ...form,
        productName: selectedPart?.name || '',
        productNumber: selectedPart?.partNumber || '',
        modelCode: selectedModel?.modelCode || '',
        status: 'Taslak',
        createdAt: new Date().toISOString(),
        createdBy: userDoc?.displayName || 'Sistem'
      };
      
      const docRef = await addWorkOrder(woData);
      toast.success('İş emri başarıyla oluşturuldu');
      setModal(false);
      navigate(`/work-orders/${docRef.id}`);
    } catch (err) {
      toast.error('İş emri oluşturulamadı');
    }
  };

  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeOrder = orders.find(o => o.id === active.id);
    const overId = over.id;

    // Logic: if dropped over a column id or an item in another column
    let newStatus = overId;
    if (!WO_STATUS_FLOW.includes(overId)) {
       const overOrder = orders.find(o => o.id === overId);
       newStatus = overOrder ? overOrder.status : activeOrder.status;
    }

    if (activeOrder.status !== newStatus) {
       // Update status in state immediately for UX
       const updatedOrders = orders.map(o => o.id === activeId ? { ...o, status: newStatus } : o);
       setOrders(updatedOrders);
       
       try {
         await updateWorkOrder(active.id, { status: newStatus });
         toast.success(`${activeOrder.woNumber} durumu '${newStatus}' olarak güncellendi.`);
       } catch (e) {
         toast.error('Güncelleme başarısız');
         load();
       }
    }
    setActiveId(null);
  };

  const filtered = useMemo(() => {
    return orders.filter(o => 
      !search || 
      o.woNumber?.toLowerCase().includes(search.toLowerCase()) || 
      o.productName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [orders, search]);

  const ordersByStatus = (status) => filtered.filter(o => o.status === status);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Üretim İş Emirleri (MES)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Atölye iş yükü planlama ve canlı üretim takibi</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: 4 }}>
             <button onClick={() => setView('kanban')} style={{ width: 36, height: 32, borderRadius: 6, border: 'none', background: view==='kanban'?'#1e293b':'transparent', color: view==='kanban'?'#f1f5f9':'#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid size={16}/></button>
             <button onClick={() => setView('list')} style={{ width: 36, height: 32, borderRadius: 6, border: 'none', background: view==='list'?'#1e293b':'transparent', color: view==='list'?'#f1f5f9':'#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><List size={16}/></button>
          </div>
          {canEdit && (
            <button onClick={openNewModal} disabled={isGenerating} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
              <Plus size={18} strokeWidth={2.5} /> {isGenerating ? 'Hazırlanıyor...' : 'Yeni Üretim Emri'}
            </button>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
           <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
           <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <button style={{ ...INPUT, width: 'auto', background: 'transparent', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Filter size={14}/> Filtrele</button>
        <button style={{ ...INPUT, width: 'auto', background: 'transparent', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Calendar size={14}/> Planlanan</button>
      </div>

      {/* VIEW CONTENT */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {view === 'kanban' ? (
          <div style={{ height: '100%', overflowX: 'auto' }}>
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveId(e.active.id)} onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', gap: 16, height: '100%', paddingBottom: 16 }}>
                 <KanbanColumn id="Taslak" title="Taslak" orders={ordersByStatus('Taslak')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#64748b" />
                 <KanbanColumn id="Onaylı" title="Planlanan" orders={ordersByStatus('Onaylı')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#3b82f6" />
                 <KanbanColumn id="Üretimde" title="Üretimde" orders={ordersByStatus('Üretimde')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#fbbf24" />
                 <KanbanColumn id="Kalitede" title="Kalite Kontrol" orders={ordersByStatus('Kalitede')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#a855f7" />
                 <KanbanColumn id="Tamamlandı" title="Tamamlandı" orders={ordersByStatus('Tamamlandı')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#22c55e" />
                 <KanbanColumn id="İptal" title="İptal" orders={ordersByStatus('İptal')} onCardClick={id => navigate(`/work-orders/${id}`)} color="#ef4444" />
              </div>
              <DragOverlay dropAnimation={defaultDropAnimationSideEffects}>
                {activeId ? (
                  <div style={{ background: '#0d1117', border: '1px solid #dc2626', borderRadius: 8, padding: 12, width: 260, cursor: 'grabbing', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', opacity: 0.9 }}>
                    <h4 style={{ margin: 0, fontSize: 13, color: '#fff' }}>{orders.find(o => o.id === activeId)?.productName}</h4>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#dc2626', fontWeight: 800 }}>TAŞINIYOR...</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>İş Emri No</th>
                  <th style={TH}>Ürün Adı</th>
                  <th style={TH}>Miktar</th>
                  <th style={TH}>Durum</th>
                  <th style={TH}>P. Bitiş</th>
                  <th style={TH}>Öncelik</th>
                  <th style={{ ...TH, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="İş emri bulunamadı." /></td></tr> : filtered.map(o => (
                  <tr key={o.id} onClick={() => navigate(`/work-orders/${o.id}`)} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{o.woNumber}</td>
                    <td style={{ ...TD, fontWeight: 600, color: '#e2e8f0' }}>{o.productName}</td>
                    <td style={TD}>{o.quantity} {o.unit || 'Adet'}</td>
                    <td style={TD}>
                       <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#94a3b8' }}>{o.status}</span>
                    </td>
                    <td style={TD}>{o.plannedEnd ? formatDate(o.plannedEnd) : '—'}</td>
                    <td style={TD}><span style={{ color: o.priority==='Yüksek'?'#f87171':'#64748b' }}>{o.priority || 'Normal'}</span></td>
                    <td style={TD}><ChevronRight size={18} color="#334155" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW WORK ORDER MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Üretim Emri Oluştur" width={600}>
        <form onSubmit={handleCreateWO} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>İş Emri No</label>
                <input style={{ ...INPUT, fontWeight: 800, color: '#3b82f6' }} value={form.woNumber} readOnly />
             </div>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Sorumlu Mühendis</label>
                <input style={INPUT} value={form.responsibleEngineer} onChange={e=>setForm({...form, responsibleEngineer: e.target.value})} />
             </div>
          </div>

          <div>
             <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Üretilecek Ürün (Parça)</label>
             <select style={{ ...INPUT, cursor: 'pointer' }} value={form.productId} onChange={e=>setForm({...form, productId: e.target.value})} required>
                <option value="">Ürün Seçiniz...</option>
                {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} — {p.name}</option>)}
             </select>
          </div>

          <div>
             <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>İlgili Silah Modeli</label>
             <select style={{ ...INPUT, cursor: 'pointer' }} value={form.modelId} onChange={e=>setForm({...form, modelId: e.target.value})}>
                <option value="">Model Seçiniz...</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.modelCode} — {m.modelName}</option>)}
             </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Üretim Miktarı</label>
                <input type="number" min="1" style={INPUT} value={form.quantity} onChange={e=>setForm({...form, quantity: Number(e.target.value)})} required />
             </div>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Öncelik</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.priority} onChange={e=>setForm({...form, priority: e.target.value})}>
                   <option value="Normal">Normal</option>
                   <option value="Yüksek">Yüksek</option>
                   <option value="Acil">Acil</option>
                </select>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Planlanan Başlangıç</label>
                <input type="datetime-local" style={INPUT} value={form.plannedStart} onChange={e=>setForm({...form, plannedStart: e.target.value})} />
             </div>
             <div>
                <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Planlanan Bitiş</label>
                <input type="datetime-local" style={INPUT} value={form.plannedEnd} onChange={e=>setForm({...form, plannedEnd: e.target.value})} />
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 40, padding: '0 32px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontWeight: 800, cursor: 'pointer' }}>Üretim Emrini Yayınla</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
