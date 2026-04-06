import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import {
  addWorkOrder,
  deleteWorkOrder,
  getModels,
  getParts,
  getWorkCenters,
  getWorkOrders,
  updateWorkOrder,
} from '../../firebase/firestore';
import { generateWorkOrderNumber } from '../../utils/autoGen';
import { WO_STATUS_FLOW, formatDate, formatNumber } from '../../utils/helpers';
import {
  ensureProductPartForModel,
} from '../../services/salesOrderFlowService';
import {
  getAvailableStock,
  getModelBomRows,
  resolveProductPartForModel,
} from '../../services/modelBomService';

const INPUT = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  background: '#0a0f1e',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
};
const TH = {
  background: '#0d1117',
  color: '#475569',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '12px 16px',
  textAlign: 'left',
  borderBottom: '2px solid #1e3a5f',
  whiteSpace: 'nowrap',
};
const TD = {
  padding: '0 16px',
  height: 56,
  fontSize: 13,
  color: '#94a3b8',
  borderBottom: '1px solid #1a2332',
  verticalAlign: 'middle',
};

function SortableCard({ id, order, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: '#0d1117',
        border: '1px solid #1e293b',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(order.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>{order.woNumber}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: order.priority === 'Acil' ? '#f87171' : '#64748b' }}>{order.priority || 'Normal'}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>{order.modelCode || order.productPartNumber || order.productName}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{order.modelName || order.productName || 'Model tanımı yok'}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
        <span>{formatNumber(order.quantity)} {order.unit || 'Adet'}</span>
        <span>{order.plannedEnd ? formatDate(order.plannedEnd) : 'Termin yok'}</span>
      </div>
    </div>
  );
}

function KanbanColumn({ id, title, color, orders, onOpen }) {
  return (
    <div style={{ flex: 1, minWidth: 260, background: 'rgba(10, 15, 30, 0.75)', border: '1px solid #1e293b', borderRadius: 12 }}>
      <div style={{ padding: 16, borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>{title}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>{orders.length}</span>
      </div>
      <div style={{ padding: 12, minHeight: 220 }}>
        <SortableContext items={orders.map((order) => order.id)} strategy={verticalListSortingStrategy}>
          {orders.map((order) => <SortableCard key={order.id} id={order.id} order={order} onOpen={onOpen} />)}
        </SortableContext>
        {orders.length === 0 ? (
          <div style={{ minHeight: 100, border: '2px dashed #1e293b', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
            Kayıt yok
          </div>
        ) : null}
      </div>
    </div>
  );
}

const createInitialForm = () => ({
  woNumber: '',
  modelId: '',
  modelCode: '',
  modelName: '',
  productId: '',
  productPartId: '',
  productPartNumber: '',
  productName: '',
  quantity: 1,
  unit: 'Adet',
  plannedStart: new Date().toISOString().slice(0, 16),
  plannedEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 16),
  priority: 'Normal',
  responsibleEngineer: '',
  notes: '',
  colorOption: '',
  surfaceOption: '',
  specialRequest: '',
});

const findProductPart = (parts, model) => resolveProductPartForModel({ parts, model });

const getModelRows = (parts, model, productPart) =>
  getModelBomRows(parts, model?.id, productPart, model).map((row) => ({
    partId: row.partId,
    partNumber: row.partNumber,
    name: row.name,
    qty: Number(row.qty || 0),
    unit: row.unit || 'Adet',
  }));

const buildDefaultOperations = (centers = []) => {
  const findCenter = (...keywords) =>
    centers.find((center) =>
      keywords.some((keyword) =>
        `${center.name || ''} ${center.type || ''} ${center.code || ''}`.toLowerCase().includes(keyword)
      )
    )?.id || '';

  return [
    { step: 1, name: 'Malzeme Hazırlık', workCenterId: findCenter('vmc', 'işleme', 'torna'), status: 'Beklemede', manualHours: 1.5 },
    { step: 2, name: 'CNC İşleme', workCenterId: findCenter('vmc', 'hmc', 'torna'), status: 'Beklemede', manualHours: 5 },
    { step: 3, name: 'Tesviye', workCenterId: findCenter('tesviye', 'flat'), status: 'Beklemede', manualHours: 1.25 },
    { step: 4, name: 'Isıl İşlem', workCenterId: findCenter('ısıl', 'isil', 'heat'), status: 'Beklemede', manualHours: 2 },
    { step: 5, name: 'Kaplama / Boya', workCenterId: findCenter('kaplama', 'coat', 'boya'), status: 'Beklemede', manualHours: 1.5 },
    { step: 6, name: 'Montaj', workCenterId: findCenter('montaj', 'assy'), status: 'Beklemede', manualHours: 2.5 },
    { step: 7, name: 'Final Kalite', workCenterId: findCenter('kalite', 'qc'), status: 'Beklemede', manualHours: 1 },
  ];
};

export default function WorkOrderList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isEngineer, userDoc } = useAuth();
  const canEdit = isAdmin || isEngineer;

  const [orders, setOrders] = useState([]);
  const [models, setModels] = useState([]);
  const [parts, setParts] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState(createInitialForm());
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!location.state?.openCreate) return;
    openCreateModal(location.state?.modelId || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const load = async () => {
    setLoading(true);
    try {
      const [orderSnap, modelSnap, partSnap, centerSnap] = await Promise.all([
        getWorkOrders(),
        getModels(),
        getParts(),
        getWorkCenters(),
      ]);

      setOrders(orderSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setModels(modelSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setParts(partSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setWorkCenters(centerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error('İş emirleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const modelMeta = useMemo(
    () =>
      models.map((model) => {
        const productPart = findProductPart(parts, model);
        const bomRows = getModelRows(parts, model, productPart);
        const maxCapacity = bomRows.length
          ? Math.min(
              ...bomRows.map((row) => {
                const part = parts.find((item) => item.id === row.partId);
                return Math.floor(getAvailableStock(part) / Number(row.qty || 1));
              })
            )
          : 0;

        return {
          ...model,
          productPart,
          bomRows,
          maxCapacity: Number.isFinite(maxCapacity) ? maxCapacity : 0,
        };
      }),
    [models, parts]
  );

  const selectedModelMeta = useMemo(
    () => modelMeta.find((model) => model.id === form.modelId) || null,
    [modelMeta, form.modelId]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const target = `${order.woNumber || ''} ${order.modelCode || ''} ${order.productName || ''}`.toLowerCase();
        return !search || target.includes(search.toLowerCase());
      }),
    [orders, search]
  );

  const ordersByStatus = (status) => filteredOrders.filter((order) => order.status === status);

  const applyModelToForm = (modelId, baseForm) => {
    const selectedModel = models.find((item) => item.id === modelId) || null;
    const productPart = selectedModel ? findProductPart(parts, selectedModel) : null;

    return {
      ...baseForm,
      modelId: selectedModel?.id || '',
      modelCode: selectedModel?.modelCode || '',
      modelName: selectedModel?.modelName || '',
      productId: productPart?.id || '',
      productPartId: productPart?.id || '',
      productPartNumber: productPart?.partNumber || '',
      productName: productPart?.name || '',
      unit: productPart?.unit || 'Adet',
    };
  };

  const openCreateModal = async (presetModelId = '') => {
    setGenerating(true);
    try {
      const woNumber = await generateWorkOrderNumber();
      const initialForm = {
        ...createInitialForm(),
        woNumber,
        responsibleEngineer: userDoc?.full_name || userDoc?.displayName || userDoc?.email || '',
      };

      setForm(applyModelToForm(presetModelId, initialForm));
      setModal(true);
    } catch (error) {
      console.error(error);
      toast.error('İş emri numarası üretilemedi');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.modelId) {
      toast.error('İş emri için model seçiniz');
      return;
    }
    if (Number(form.quantity || 0) <= 0) {
      toast.error('Üretim miktarı sıfırdan büyük olmalıdır');
      return;
    }

    const selectedModel = models.find((item) => item.id === form.modelId);
    let productPart = null;
    if (!selectedModel) {
      toast.error('Seçilen model bulunamadı');
      return;
    }
    productPart = await ensureProductPartForModel({ model: selectedModel, parts });
    if (!productPart) {
      toast.error('Seçilen modele bağlı ürün kartı bulunamadı');
      return;
    }

    const components = productPart.components?.length
      ? productPart.components.map((item) => ({
          partId: item.partId,
          partNumber: item.partNumber,
          name: item.name,
          qty: Number(item.qty || 0),
          unit: item.unit || 'Adet',
        }))
      : getModelRows(parts, selectedModel, productPart);

    const workOrderPayload = {
      woNumber: form.woNumber,
      modelId: selectedModel.id,
      modelCode: selectedModel.modelCode,
      modelName: selectedModel.modelName,
      productId: productPart.id,
      productPartId: productPart.id,
      productPartNumber: productPart.partNumber,
      productName: productPart.name,
      quantity: Number(form.quantity),
      unit: productPart.unit || 'Adet',
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
      priority: form.priority,
      status: 'Taslak',
      responsibleEngineer: form.responsibleEngineer,
      colorOption: form.colorOption || '',
      surfaceOption: form.surfaceOption || '',
      specialRequest: form.specialRequest || '',
      notes: form.notes || '',
      createdBy: userDoc?.full_name || userDoc?.displayName || userDoc?.email || 'Sistem',
      createdAt: new Date().toISOString(),
      components,
      operations: buildDefaultOperations(workCenters),
    };

    try {
      const docRef = await addWorkOrder(workOrderPayload);
      toast.success('Üretim emri oluşturuldu');
      setModal(false);
      navigate(`/work-orders/${docRef.id}`);
    } catch (error) {
      console.error(error);
      toast.error('İş emri oluşturulamadı');
    }
  };

  const onDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeOrder = orders.find((order) => order.id === active.id);
    if (!activeOrder) return;

    let nextStatus = over.id;
    if (!WO_STATUS_FLOW.includes(nextStatus)) {
      const targetOrder = orders.find((order) => order.id === over.id);
      nextStatus = targetOrder?.status || activeOrder.status;
    }

    if (nextStatus === activeOrder.status) return;

    setOrders((prev) => {
      const currentItems = [...prev];
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);
      const moved = arrayMove(currentItems, oldIndex, newIndex >= 0 ? newIndex : oldIndex);
      return moved.map((item) => (item.id === active.id ? { ...item, status: nextStatus } : item));
    });

    try {
      await updateWorkOrder(active.id, { status: nextStatus });
      toast.success(`${activeOrder.woNumber} durumu güncellendi`);
    } catch (error) {
      console.error(error);
      toast.error('Durum güncellenemedi');
      load();
    }
  };

  const handleDeleteWorkOrder = async (order) => {
    if (!canEdit) return;
    if (order.status !== 'Taslak') {
      toast.error('Sadece Taslak durumundaki iş emirleri silinebilir');
      return;
    }
    if (!confirm(`${order.woNumber} iş emrini silmek istiyor musunuz?`)) return;
    try {
      await deleteWorkOrder(order.id);
      toast.success('İş emri silindi');
      await load();
    } catch (error) {
      console.error(error);
      toast.error('İş emri silinemedi');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24, maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>İş Emirleri</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Model bazlı üretim talepleri, rota planı ve departman akışı</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: 4 }}>
            <button onClick={() => setView('kanban')} style={{ width: 36, height: 32, border: 'none', borderRadius: 6, background: view === 'kanban' ? '#1e293b' : 'transparent', color: view === 'kanban' ? '#f8fafc' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid size={16} /></button>
            <button onClick={() => setView('list')} style={{ width: 36, height: 32, border: 'none', borderRadius: 6, background: view === 'list' ? '#1e293b' : 'transparent', color: view === 'list' ? '#f8fafc' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><List size={16} /></button>
          </div>
          {canEdit ? (
            <button onClick={() => openCreateModal()} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>
              <Plus size={18} />
              {generating ? 'Hazırlanıyor...' : 'Yeni İş Emri'}
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          ['Açık İş Emri', orders.filter((order) => order.status !== 'Tamamlandı' && order.status !== 'İptal').length, '#60a5fa'],
          ['Kalitede', orders.filter((order) => order.status === 'Kalitede').length, '#a78bfa'],
          ['Acil', orders.filter((order) => order.priority === 'Acil').length, '#f87171'],
          ['Aktif Model', modelMeta.filter((model) => model.isActive).length, '#34d399'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{formatNumber(value)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="İş emri, model veya ürün adı ile ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <button style={{ ...INPUT, width: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', cursor: 'pointer' }}>
          <Filter size={16} />
          Filtrele
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {view === 'kanban' ? (
          <div style={{ height: '100%', overflowX: 'auto' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(event) => setActiveId(event.active.id)}
              onDragEnd={onDragEnd}
            >
              <div style={{ display: 'flex', gap: 16, height: '100%', paddingBottom: 12 }}>
                <KanbanColumn id="Taslak" title="Taslak" color="#64748b" orders={ordersByStatus('Taslak')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
                <KanbanColumn id="Onaylı" title="Planlanan" color="#3b82f6" orders={ordersByStatus('Onaylı')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
                <KanbanColumn id="Malzeme Hazır" title="Malzeme Hazır" color="#22c55e" orders={ordersByStatus('Malzeme Hazır')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
                <KanbanColumn id="Üretimde" title="Üretimde" color="#fbbf24" orders={ordersByStatus('Üretimde')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
                <KanbanColumn id="Kalitede" title="Kalitede" color="#a78bfa" orders={ordersByStatus('Kalitede')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
                <KanbanColumn id="Tamamlandı" title="Tamamlandı" color="#34d399" orders={ordersByStatus('Tamamlandı')} onOpen={(id) => navigate(`/work-orders/${id}`)} />
              </div>
              <DragOverlay dropAnimation={defaultDropAnimationSideEffects}>
                {activeId ? (
                  <div style={{ background: '#0d1117', border: '1px solid #dc2626', borderRadius: 10, padding: 14, width: 260, boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>{orders.find((order) => order.id === activeId)?.woNumber}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{orders.find((order) => order.id === activeId)?.productName}</div>
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
                  <th style={TH}>İş Emri</th>
                  <th style={TH}>Model</th>
                  <th style={TH}>Mamul</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
                  <th style={TH}>Termin</th>
                  <th style={TH}>Durum</th>
                  <th style={TH}>Öncelik</th>
                  <th style={{ ...TH, width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 48 }}>
                      <EmptyState message="İş emri bulunamadı." />
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} onClick={() => navigate(`/work-orders/${order.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f8fafc' }}>{order.woNumber}</td>
                      <td style={TD}>
                        <div style={{ fontWeight: 800, color: '#e2e8f0' }}>{order.modelCode || '-'}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{order.modelName || 'Model tanımı yok'}</div>
                      </td>
                      <td style={TD}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{order.productPartNumber || '-'}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{order.productName || 'Mamul tanımı yok'}</div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>{formatNumber(order.quantity)} {order.unit || 'Adet'}</td>
                      <td style={TD}>{order.plannedEnd ? formatDate(order.plannedEnd) : '-'}</td>
                      <td style={TD}><span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#cbd5e1' }}>{order.status}</span></td>
                      <td style={TD}><span style={{ color: order.priority === 'Acil' ? '#f87171' : order.priority === 'Yüksek' ? '#fbbf24' : '#94a3b8', fontWeight: 800 }}>{order.priority || 'Normal'}</span></td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <ChevronRight size={18} color="#334155" />
                          {canEdit && order.status === 'Taslak' ? (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteWorkOrder(order);
                              }}
                              style={{ height: 26, padding: '0 8px', border: 'none', borderRadius: 4, background: '#7f1d1d', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}
                            >
                              <Trash2 size={12} />
                              SİL
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Üretim Emri" width={760}>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>İş Emri No</label>
              <input style={{ ...INPUT, fontWeight: 800, color: '#60a5fa' }} value={form.woNumber} readOnly />
            </div>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Sorumlu Mühendis</label>
              <input style={INPUT} value={form.responsibleEngineer} onChange={(event) => setForm((prev) => ({ ...prev, responsibleEngineer: event.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Model</label>
            <select
              style={INPUT}
              value={form.modelId}
              onChange={(event) => setForm((prev) => applyModelToForm(event.target.value, prev))}
              required
            >
              <option value="">Model seçiniz...</option>
              {modelMeta.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.modelCode} - {model.modelName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <div style={{ padding: 14, background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', fontWeight: 800 }}>Mamul Kartı</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>{selectedModelMeta?.productPart?.partNumber || '-'}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{selectedModelMeta?.productPart?.name || 'Model seçildiğinde otomatik bağlanır'}</div>
            </div>
            <div style={{ padding: 14, background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', fontWeight: 800 }}>BOM Kalemi</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#60a5fa' }}>{formatNumber(selectedModelMeta?.bomRows?.length || 0)}</div>
            </div>
            <div style={{ padding: 14, background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', fontWeight: 800 }}>Anlık Kapasite</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: (selectedModelMeta?.maxCapacity || 0) > 0 ? '#34d399' : '#f87171' }}>{formatNumber(selectedModelMeta?.maxCapacity || 0)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Üretim Miktarı</label>
              <input type="number" min="1" style={INPUT} value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} required />
            </div>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Öncelik</label>
              <select style={INPUT} value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
                <option value="Normal">Normal</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Acil">Acil</option>
              </select>
            </div>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Birim</label>
              <input style={INPUT} value={form.unit} readOnly />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Planlanan Başlangıç</label>
              <input type="datetime-local" style={INPUT} value={form.plannedStart} onChange={(event) => setForm((prev) => ({ ...prev, plannedStart: event.target.value }))} />
            </div>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Planlanan Bitiş</label>
              <input type="datetime-local" style={INPUT} value={form.plannedEnd} onChange={(event) => setForm((prev) => ({ ...prev, plannedEnd: event.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Renk / Kaplama</label>
              <input style={INPUT} value={form.surfaceOption} onChange={(event) => setForm((prev) => ({ ...prev, surfaceOption: event.target.value }))} placeholder="Örn: Siyah / Cerakote" />
            </div>
            <div>
              <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Renk Opsiyonu</label>
              <input style={INPUT} value={form.colorOption} onChange={(event) => setForm((prev) => ({ ...prev, colorOption: event.target.value }))} placeholder="Örn: FDE" />
            </div>
          </div>

          <div>
            <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>Özel İstek</label>
            <textarea style={{ ...INPUT, height: 78, padding: 12, resize: 'none' }} value={form.specialRequest} onChange={(event) => setForm((prev) => ({ ...prev, specialRequest: event.target.value }))} placeholder="Müşteri özel isteği, seri no blok, işaretleme veya kaplama notu" />
          </div>

          <div>
            <label style={{ ...TH, border: 'none', padding: '0 0 6px', display: 'block' }}>İç Not</label>
            <textarea style={{ ...INPUT, height: 78, padding: 12, resize: 'none' }} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Üretim ve kalite ekiplerine aktarılacak not" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" style={{ height: 40, padding: '0 32px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              Üretim Emrini Oluştur
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
