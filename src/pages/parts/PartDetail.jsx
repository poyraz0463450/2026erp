import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Box,
  ChevronLeft,
  FileText,
  Layers,
  Package,
  Plus,
  Save,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import {
  addInventoryBatch,
  addPart,
  addStockMovement,
  getDocuments,
  getInventoryBatches,
  getModels,
  getNcrRecords,
  getPartById,
  getParts,
  getQcInspections,
  getStockMovements,
  getSupplierParts,
  updatePart,
} from '../../firebase/firestore';
import {
  DOMAIN_PART_CATEGORIES,
  DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY,
  DOMAIN_PART_UNITS,
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatNumber,
} from '../../utils/helpers';
import { generateLotNumber } from '../../utils/autoGen';

const TABS = [
  ['Genel', 'Genel Bilgiler', Package],
  ['BOM', 'BOM / Ürün Ağacı', Layers],
  ['Stok', 'Stok & Lot', Box],
  ['Kalite', 'Kalite Geçmişi', ShieldCheck],
  ['Teknik', 'Teknik Resimler', FileText],
  ['Tedarik', 'Tedarik', ShoppingCart],
];

const pageCard = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 14, padding: 20 };
const statCard = { background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 1) 100%)', border: '1px solid #1e293b', borderRadius: 12, padding: 16 };
const input = { width: '100%', height: 40, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const textarea = { ...input, height: 86, padding: 12, resize: 'vertical' };
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' };
const th = { background: '#0a0f1e', color: '#64748b', fontSize: 11, fontWeight: 700, padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td = { padding: '12px 16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const actionButton = { height: 38, padding: '0 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 };

const emptyPart = () => ({
  partNumber: '',
  name: '',
  category: 'Parça',
  subCategory: '4140 Çelik',
  subCategoryOther: '',
  unit: 'Adet',
  revision: 'A',
  revisionStatus: 'Aktif',
  currentStock: 0,
  reservedStock: 0,
  minStock: 0,
  material: '',
  materialStandard: '',
  upperTolerance: '',
  lowerTolerance: '',
  surfaceTreatment: '',
  hardness: '',
  weight: '',
  dimensions: '',
  description: '',
  warehouseLocation: '',
  stockStatus: 'Sağlam',
  isAssembly: false,
  isCritical: false,
  usedInModels: [],
  components: [],
});

const rows = (snapshot) => (snapshot?.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }));
const getTimeValue = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};
const sortByLatest = (list, ...keys) => [...list].sort((left, right) => (keys.map((key) => getTimeValue(right?.[key])).find(Boolean) || 0) - (keys.map((key) => getTimeValue(left?.[key])).find(Boolean) || 0));
const getBadgeTone = (text = '') => {
  const normalized = String(text).toLowerCase();
  if (normalized.includes('aktif') || normalized.includes('sağlam') || normalized.includes('kabul') || normalized.includes('kapalı')) return 'success';
  if (normalized.includes('karantina') || normalized.includes('şartlı') || normalized.includes('bekliyor') || normalized.includes('inceleme')) return 'warning';
  if (normalized.includes('pasif') || normalized.includes('red') || normalized.includes('fire')) return 'danger';
  return 'info';
};
const buildLocalLotNumber = (batches = []) => {
  const now = new Date();
  const prefix = `LOT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seqs = batches.map((item) => item.batchId || item.lotNumber || '').filter((value) => value.startsWith(prefix)).map((value) => Number.parseInt(value.split('-').pop(), 10)).filter((value) => Number.isFinite(value));
  return `${prefix}-${String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0')}`;
};

function Badge({ text, tone = 'info' }) {
  const tones = { success: ['#064e3b', '#34d399'], warning: ['#422006', '#fbbf24'], danger: ['#450a0a', '#f87171'], info: ['#1e3a8a', '#60a5fa'] };
  const [background, color] = tones[tone] || tones.info;
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background, color, letterSpacing: '0.04em' }}>{text || '-'}</span>;
}

function StatBox({ labelText, value, accent = '#60a5fa', helpText }) {
  return (
    <div style={{ ...statCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>{labelText}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{value}</div>
      {helpText ? <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{helpText}</div> : null}
    </div>
  );
}

export default function PartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userDoc, isAdmin, isEngineer, isWarehouse } = useAuth();
  const actorName = userDoc?.full_name || userDoc?.displayName || userDoc?.email || 'Sistem';
  const canEdit = isAdmin || isEngineer;
  const canManageStock = isAdmin || isWarehouse || isEngineer;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('Genel');
  const [part, setPart] = useState(emptyPart());
  const [models, setModels] = useState([]);
  const [allParts, setAllParts] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [modelLink, setModelLink] = useState({ modelId: '', qtyPerUnit: 1 });
  const [lotModal, setLotModal] = useState(false);
  const [lotForm, setLotForm] = useState({ lotNumber: '', quantity: 1, location: '', qcStatus: 'Karantina', referenceNumber: '', note: '', sourceType: 'Stok Açılışı', receivedDate: new Date().toISOString().split('T')[0] });

  const nextLotPreview = useMemo(() => buildLocalLotNumber(allBatches), [allBatches]);
  const availableSubCategories = useMemo(
    () => DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY[part.category] || DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY.Parça,
    [part.category]
  );
  const hasTechnicalPdf = useMemo(
    () =>
      docs.some(
        (doc) =>
          doc.linkedPartId === id &&
          doc.category === 'Teknik Resim' &&
          String(doc.fileName || '').toLowerCase().endsWith('.pdf')
      ),
    [docs, id]
  );
  const modelUsageRows = useMemo(() => (part.usedInModels || []).map((usage) => {
    const modelDoc = models.find((model) => model.id === usage.modelId);
    return { ...usage, modelName: usage.modelName || modelDoc?.modelName || '-', modelCode: usage.modelCode || modelDoc?.modelCode || '-', isActive: modelDoc?.isActive ?? true };
  }).sort((left, right) => String(left.modelCode).localeCompare(String(right.modelCode))), [models, part.usedInModels]);
  const availableComponentParts = useMemo(() => allParts.filter((item) => item.id !== id), [allParts, id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const loadSafe = async (fn) => { try { return rows(await fn()); } catch { return []; } };
        const [modelRows, partRows, batchRows, movementRows, inspectionRows, ncrRows, documentRows, supplierRows] = await Promise.all([loadSafe(getModels), loadSafe(getParts), loadSafe(getInventoryBatches), loadSafe(getStockMovements), loadSafe(getQcInspections), loadSafe(getNcrRecords), loadSafe(getDocuments), loadSafe(getSupplierParts)]);
        setModels(modelRows);
        setAllParts(partRows);
        setAllBatches(batchRows);

        if (id === 'new') {
          setPart(emptyPart());
          setBatches([]);
          setMovements([]);
          setInspections([]);
          setNcrs([]);
          setDocs([]);
          setSuppliers([]);
          setModelLink({ modelId: '', qtyPerUnit: 1 });
          return;
        }

        const partDoc = await getPartById(id);
        if (!partDoc.exists()) {
          toast.error('Parça bulunamadı');
          navigate('/parts');
          return;
        }
        const rawPart = { ...emptyPart(), id: partDoc.id, ...partDoc.data(), usedInModels: partDoc.data().usedInModels || [], components: partDoc.data().components || [] };
        const validOptions =
          DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY[rawPart.category] ||
          DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY.Parça;
        const currentPart =
          rawPart.subCategory && !validOptions.includes(rawPart.subCategory)
            ? { ...rawPart, subCategoryOther: rawPart.subCategory, subCategory: 'Diğer' }
            : rawPart;
        setPart(currentPart);
        setBatches(sortByLatest(batchRows.filter((item) => item.partId === id), 'receivedDate', 'createdAt'));
        setMovements(sortByLatest(movementRows.filter((item) => item.partId === id), 'createdAt').slice(0, 50));
        setInspections(sortByLatest(inspectionRows.filter((item) => item.partId === id), 'inspectionDate', 'createdAt'));
        setNcrs(sortByLatest(ncrRows.filter((item) => item.partId === id), 'updatedAt', 'createdAt'));
        setDocs(sortByLatest(documentRows.filter((item) => item.linkedPartId === id), 'updatedAt', 'createdAt'));
        setSuppliers(sortByLatest(supplierRows.filter((item) => item.partId === id), 'updatedAt', 'createdAt'));
      } catch (error) {
        console.error(error);
        toast.error('Parça detayları yüklenemedi');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleFieldChange = (field, value) =>
    setPart((prev) => {
      if (field === 'category') {
        const nextSubCategories = DOMAIN_PART_SUBCATEGORY_OPTIONS_BY_CATEGORY[value] || [];
        const nextSubCategory = nextSubCategories.includes(prev.subCategory) ? prev.subCategory : nextSubCategories[0] || '';
        return {
          ...prev,
          category: value,
          subCategory: nextSubCategory,
          subCategoryOther: nextSubCategory === 'Diğer' ? prev.subCategoryOther : '',
          isAssembly: value === 'Montaj' || value === 'Mamul' ? true : prev.isAssembly,
        };
      }

      if (field === 'subCategory') {
        return {
          ...prev,
          subCategory: value,
          subCategoryOther: value === 'Diğer' ? prev.subCategoryOther : '',
        };
      }

      return { ...prev, [field]: value };
    });

  const save = async () => {
    if (!canEdit) return;
    if (!part.partNumber?.trim() || !part.name?.trim()) {
      toast.error('Parça numarası ve parça adı zorunludur');
      return;
    }
    if (!part.category || !part.subCategory || !part.unit) {
      toast.error('Kategori, alt kategori ve birim seçimi zorunludur');
      return;
    }
    if (part.subCategory === 'Diğer' && !part.subCategoryOther?.trim()) {
      toast.error('Alt kategoride Diğer seçildiyse manuel açıklama zorunludur');
      return;
    }
    if (id === 'new' && Number(part.currentStock || 0) > 0) {
      toast.error('Teknik PDF bağlanmadan başlangıç stoğu açılamaz. Önce parça kartını kaydedin, sonra doküman ekleyin.');
      return;
    }

    setSaving(true);
    try {
      const { id: partId, createdAt, updatedAt, ...rest } = part;
      const payload = {
        ...rest,
        partNumber: part.partNumber.trim(),
        name: part.name.trim(),
        subCategory: part.subCategory === 'Diğer' ? part.subCategoryOther.trim() : part.subCategory,
        minStock: Number(part.minStock || 0),
        currentStock: Number(part.currentStock || 0),
        reservedStock: Number(part.reservedStock || 0),
        usedInModels: (part.usedInModels || []).map((item) => ({
          modelId: item.modelId,
          modelCode: item.modelCode || '',
          modelName: item.modelName || '',
          qtyPerUnit: Number(item.qtyPerUnit || 0),
        })),
        components: (part.components || [])
          .filter((item) => item.partId && Number(item.qty) > 0)
          .map((item) => ({
            partId: item.partId,
            partNumber: item.partNumber || '',
            name: item.name || '',
            qty: Number(item.qty || 0),
            unit: item.unit || 'Adet',
          })),
      };

      if (id === 'new') {
        const docRef = await addPart(payload);
        toast.success('Parça oluşturuldu');
        navigate(`/parts/${docRef.id}`);
      } else {
        await updatePart(id, payload);
        toast.success('Parça kaydedildi');
      }
    } catch (error) {
      console.error(error);
      toast.error('Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrUpdateModelUsage = async () => {
    if (!canEdit) return;
    if (!modelLink.modelId) {
      toast.error('Önce model seçiniz');
      return;
    }

    const qtyPerUnit = Number(modelLink.qtyPerUnit || 0);
    if (qtyPerUnit <= 0) {
      toast.error('Tüketim miktarı sıfırdan büyük olmalıdır');
      return;
    }

    const selectedModel = models.find((item) => item.id === modelLink.modelId);
    if (!selectedModel) {
      toast.error('Model bulunamadı');
      return;
    }

    const existing = part.usedInModels || [];
    const hasLink = existing.some((item) => item.modelId === modelLink.modelId);
    const nextUsage = hasLink
      ? existing.map((item) =>
          item.modelId === modelLink.modelId
            ? {
                ...item,
                modelCode: selectedModel.modelCode,
                modelName: selectedModel.modelName,
                qtyPerUnit,
              }
            : item
        )
      : [
          ...existing,
          {
            modelId: selectedModel.id,
            modelCode: selectedModel.modelCode,
            modelName: selectedModel.modelName,
            qtyPerUnit,
          },
        ];

    try {
      if (id !== 'new') await updatePart(id, { usedInModels: nextUsage });
      setPart((prev) => ({ ...prev, usedInModels: nextUsage }));
      setModelLink({ modelId: '', qtyPerUnit: 1 });
      toast.success(hasLink ? 'Model tüketimi güncellendi' : 'Model bağlantısı eklendi');
    } catch (error) {
      console.error(error);
      toast.error('Model bağlantısı kaydedilemedi');
    }
  };

  const handleRemoveModelUsage = async (modelId) => {
    if (!canEdit) return;
    const nextUsage = (part.usedInModels || []).filter((item) => item.modelId !== modelId);

    try {
      if (id !== 'new') await updatePart(id, { usedInModels: nextUsage });
      setPart((prev) => ({ ...prev, usedInModels: nextUsage }));
      toast.success('Model bağlantısı kaldırıldı');
    } catch (error) {
      console.error(error);
      toast.error('Model bağlantısı kaldırılamadı');
    }
  };

  const addComponentRow = () => {
    setPart((prev) => ({
      ...prev,
      isAssembly: true,
      components: [...(prev.components || []), { partId: '', partNumber: '', name: '', qty: 1, unit: 'Adet' }],
    }));
  };

  const updateComponentRow = (index, field, value) => {
    setPart((prev) => {
      const nextComponents = [...(prev.components || [])];
      const current = { ...(nextComponents[index] || {}) };

      if (field === 'partId') {
        const selectedPart = availableComponentParts.find((item) => item.id === value);
        current.partId = value;
        current.partNumber = selectedPart?.partNumber || '';
        current.name = selectedPart?.name || '';
        current.unit = selectedPart?.unit || 'Adet';
      } else if (field === 'qty') {
        current.qty = Number(value || 0);
      } else {
        current[field] = value;
      }

      nextComponents[index] = current;
      return { ...prev, components: nextComponents };
    });
  };

  const removeComponentRow = (index) => {
    setPart((prev) => ({
      ...prev,
      components: (prev.components || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const assignAutomaticLot = async () => {
    let generated = '';
    try {
      generated = await generateLotNumber();
    } catch {
      generated = '';
    }

    const existingLots = new Set(allBatches.map((item) => item.batchId || item.lotNumber));
    const safeLot = !generated || existingLots.has(generated) ? buildLocalLotNumber(allBatches) : generated;
    setLotForm((prev) => ({ ...prev, lotNumber: safeLot }));
    return safeLot;
  };

  const openLotEntry = async () => {
    if (!hasTechnicalPdf) {
      toast.error('Teknik resim PDF olmadan lot girişi yapılamaz');
      return;
    }
    const generatedLot = await assignAutomaticLot();
    setLotForm({
      lotNumber: generatedLot,
      quantity: 1,
      location: part.warehouseLocation || '',
      qcStatus: 'Karantina',
      referenceNumber: '',
      note: '',
      sourceType: 'Stok Açılışı',
      receivedDate: new Date().toISOString().split('T')[0],
    });
    setLotModal(true);
  };

  const handleCreateLot = async () => {
    if (!canManageStock || id === 'new') return;
    if (!hasTechnicalPdf) {
      toast.error('Teknik resim PDF olmadan stok / lot girişi yapılamaz');
      return;
    }

    const quantity = Number(lotForm.quantity || 0);
    if (!lotForm.lotNumber?.trim()) {
      toast.error('Lot numarası zorunludur');
      return;
    }
    if (quantity <= 0) {
      toast.error('Miktar sıfırdan büyük olmalıdır');
      return;
    }

    const exists = allBatches.some((item) => (item.batchId || item.lotNumber || '').toLowerCase() === lotForm.lotNumber.trim().toLowerCase());
    if (exists) {
      toast.error('Bu lot numarası zaten kullanılıyor');
      return;
    }

    const batchPayload = {
      batchId: lotForm.lotNumber.trim(),
      lotNumber: lotForm.lotNumber.trim(),
      partId: id,
      partNumber: part.partNumber,
      partName: part.name,
      quantity,
      remainingQty: quantity,
      warehouseLocation: lotForm.location || part.warehouseLocation || '',
      location: lotForm.location || part.warehouseLocation || '',
      qcStatus: lotForm.qcStatus,
      status: lotForm.qcStatus,
      sourceType: lotForm.sourceType,
      referenceNumber: lotForm.referenceNumber || '',
      receivedDate: new Date(`${lotForm.receivedDate}T00:00:00`).toISOString(),
      createdBy: actorName,
      note: lotForm.note || '',
    };

    const movementPayload = {
      partId: id,
      partNumber: part.partNumber,
      movementType: 'Manuel Lot Girişi',
      qty: quantity,
      lotNumber: lotForm.lotNumber.trim(),
      referenceNumber: lotForm.referenceNumber || lotForm.lotNumber.trim(),
      performedBy: actorName,
      note: lotForm.note || `${lotForm.sourceType} ile lot açıldı`,
      toLocation: lotForm.location || part.warehouseLocation || '',
    };

    try {
      const batchRef = await addInventoryBatch(batchPayload);
      const movementRef = await addStockMovement(movementPayload);
      const nextStock = Number(part.currentStock || 0) + quantity;
      const nextStatus = lotForm.qcStatus === 'Karantina' ? 'Karantina' : part.stockStatus || 'Sağlam';

      await updatePart(id, {
        currentStock: nextStock,
        warehouseLocation: part.warehouseLocation || lotForm.location || '',
        stockStatus: nextStatus,
      });

      const optimisticBatch = { id: batchRef.id, ...batchPayload, createdAt: new Date().toISOString() };
      const optimisticMovement = { id: movementRef.id, ...movementPayload, createdAt: new Date().toISOString() };

      setAllBatches((prev) => [optimisticBatch, ...prev]);
      setBatches((prev) => sortByLatest([optimisticBatch, ...prev], 'receivedDate', 'createdAt'));
      setMovements((prev) => [optimisticMovement, ...prev].slice(0, 50));
      setPart((prev) => ({
        ...prev,
        currentStock: nextStock,
        warehouseLocation: prev.warehouseLocation || lotForm.location || '',
        stockStatus: nextStatus,
      }));
      setLotModal(false);
      toast.success(`Lot oluşturuldu: ${lotForm.lotNumber.trim()}`);
    } catch (error) {
      console.error(error);
      toast.error('Lot oluşturulamadı');
    }
  };

  const renderGeneralTab = () => (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <StatBox labelText="Kullanıldığı Model" value={formatNumber(part.usedInModels?.length || 0)} accent="#60a5fa" helpText="MRP ve kapasite hesabında kullanılır" />
        <StatBox labelText="Ortaklık Seviyesi" value={(part.usedInModels?.length || 0) > 1 ? 'Ortak' : 'Tekil'} accent="#34d399" helpText={(part.usedInModels?.length || 0) > 1 ? 'Birden fazla model bu parçayı kullanıyor' : 'Tek model / bağımsız kullanım'} />
        <StatBox labelText="Fiili Stok" value={`${formatNumber(part.currentStock || 0)} ${part.unit || 'Adet'}`} accent="#f59e0b" helpText={`Rezerve: ${formatNumber(part.reservedStock || 0)} ${part.unit || 'Adet'}`} />
        <StatBox labelText="Lot Sayısı" value={formatNumber(batches.length)} accent="#a78bfa" helpText={batches[0] ? `Son lot: ${batches[0].batchId || batches[0].lotNumber}` : 'Henüz lot oluşmadı'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
        <div style={pageCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 17, fontWeight: 800 }}>Tanımlama ve Planlama</h3>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={Boolean(part.isAssembly)} disabled={!canEdit} onChange={(event) => handleFieldChange('isAssembly', event.target.checked)} />
              Montaj / mamul kalem
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Parça Numarası</label>
              <input style={input} value={part.partNumber || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('partNumber', event.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Parça Adı</label>
              <input style={input} value={part.name || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('name', event.target.value)} />
            </div>
            <div>
              <label style={label}>Kategori</label>
              <select style={input} value={part.category || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('category', event.target.value)}>
                {DOMAIN_PART_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Alt Kategori</label>
              <select style={input} value={part.subCategory || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('subCategory', event.target.value)}>
                {availableSubCategories.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            {part.subCategory === 'Diğer' ? (
              <div>
                <label style={label}>Diğer Açıklaması</label>
                <input
                  style={input}
                  value={part.subCategoryOther || ''}
                  disabled={!canEdit}
                  onChange={(event) => handleFieldChange('subCategoryOther', event.target.value)}
                  placeholder="Manuel alt kategori / malzeme tipi giriniz"
                />
              </div>
            ) : null}
            <div>
              <label style={label}>Birim</label>
              <select style={input} value={part.unit || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('unit', event.target.value)}>
                {DOMAIN_PART_UNITS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Varsayılan Lokasyon</label>
              <input style={input} value={part.warehouseLocation || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('warehouseLocation', event.target.value)} />
            </div>
            <div>
              <label style={label}>{id === 'new' ? 'Başlangıç Stoğu' : 'Fiili Stok'}</label>
              <input type="number" min="0" style={input} value={part.currentStock || 0} disabled={!canEdit} onChange={(event) => handleFieldChange('currentStock', Number(event.target.value))} />
            </div>
            <div>
              <label style={label}>Rezerve Stok</label>
              <input type="number" min="0" style={input} value={part.reservedStock || 0} disabled={!canEdit} onChange={(event) => handleFieldChange('reservedStock', Number(event.target.value))} />
            </div>
            <div>
              <label style={label}>Kritik Stok</label>
              <input type="number" style={input} value={part.minStock || 0} disabled={!canEdit} onChange={(event) => handleFieldChange('minStock', Number(event.target.value))} />
            </div>
            <div>
              <label style={label}>Revizyon Durumu</label>
              <input style={input} value={part.revisionStatus || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('revisionStatus', event.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Açıklama</label>
              <textarea style={textarea} value={part.description || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('description', event.target.value)} />
            </div>
          </div>
        </div>

        <div style={pageCard}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Teknik Spesifikasyon</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Malzeme</label>
              <input style={input} value={part.material || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('material', event.target.value)} />
            </div>
            <div>
              <label style={label}>Malzeme Standardı</label>
              <input style={input} value={part.materialStandard || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('materialStandard', event.target.value)} />
            </div>
            <div>
              <label style={label}>Üst Tolerans</label>
              <input style={input} value={part.upperTolerance || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('upperTolerance', event.target.value)} />
            </div>
            <div>
              <label style={label}>Alt Tolerans</label>
              <input style={input} value={part.lowerTolerance || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('lowerTolerance', event.target.value)} />
            </div>
            <div>
              <label style={label}>Yüzey İşlem</label>
              <input style={input} value={part.surfaceTreatment || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('surfaceTreatment', event.target.value)} />
            </div>
            <div>
              <label style={label}>Sertlik</label>
              <input style={input} value={part.hardness || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('hardness', event.target.value)} />
            </div>
            <div>
              <label style={label}>Ağırlık</label>
              <input style={input} value={part.weight || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('weight', event.target.value)} />
            </div>
            <div>
              <label style={label}>Boyutlar / CTQ</label>
              <input style={input} value={part.dimensions || ''} disabled={!canEdit} onChange={(event) => handleFieldChange('dimensions', event.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div style={pageCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div>
            <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 17, fontWeight: 800 }}>Kullanıldığı Modeller ve Tüketim</h3>
            <p style={{ color: '#475569', fontSize: 12, margin: '6px 0 0' }}>Her model için bu parçanın birim başına kaç adet tüketildiği burada tanımlanır.</p>
          </div>
          {(part.usedInModels?.length || 0) > 1 ? <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: 12, fontWeight: 800 }}>Ortak kullanım: {part.usedInModels.length} model</div> : null}
        </div>

        {canEdit ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.2fr) 180px auto', gap: 12, marginBottom: 18, padding: 16, borderRadius: 12, background: '#0a0f1e', border: '1px solid #1e293b' }}>
            <div>
              <label style={label}>Model</label>
              <select style={input} value={modelLink.modelId} onChange={(event) => setModelLink((prev) => ({ ...prev, modelId: event.target.value }))}>
                <option value="">Model seçiniz</option>
                {models.map((item) => <option key={item.id} value={item.id}>{item.modelCode} - {item.modelName}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Birim Tüketim</label>
              <input type="number" min="1" step="1" style={input} value={modelLink.qtyPerUnit} onChange={(event) => setModelLink((prev) => ({ ...prev, qtyPerUnit: event.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={handleAddOrUpdateModelUsage} style={{ ...actionButton, background: '#2563eb', color: '#fff', width: '100%', justifyContent: 'center' }}><Plus size={16} />Ekle / Güncelle</button>
            </div>
          </div>
        ) : null}

        <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Model Kodu</th>
                <th style={th}>Model Adı</th>
                <th style={{ ...th, textAlign: 'right' }}>Birim Tüketim</th>
                <th style={th}>Durum</th>
                <th style={{ ...th, width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {modelUsageRows.length === 0 ? (
                <tr><td colSpan={5}><EmptyState message="Bu parça henüz herhangi bir modele bağlanmadı." /></td></tr>
              ) : (
                modelUsageRows.map((item) => (
                  <tr key={item.modelId}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.modelCode}</td>
                    <td style={{ ...td, color: '#e2e8f0', fontWeight: 700 }}>{item.modelName}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#f8fafc', fontWeight: 900 }}>{formatNumber(item.qtyPerUnit)}</td>
                    <td style={td}><Badge text={item.isActive ? 'Aktif Model' : 'Pasif Model'} tone={item.isActive ? 'success' : 'danger'} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => navigate(`/models/${item.modelId}`)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #1e293b', background: '#0f172a', color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}><ArrowRight size={14} />Aç</button>
                        {canEdit ? <button onClick={() => handleRemoveModelUsage(item.modelId)} style={{ height: 32, width: 32, borderRadius: 8, border: '1px solid #1e293b', background: '#0f172a', color: '#f87171', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBomTab = () => (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <StatBox labelText="BOM Kalemi" value={formatNumber(part.components?.length || 0)} accent="#60a5fa" helpText="Alt bileşen sayısı" />
        <StatBox labelText="Montaj Tipi" value={part.isAssembly ? 'Montaj / Mamul' : 'Tekil Parça'} accent="#34d399" helpText={part.isAssembly ? 'Ürün ağacı bu kalem üzerinde yönetilir' : 'Alt seviye parça olarak izlenir'} />
        <StatBox labelText="Ortak Bileşen Riski" value={formatNumber((part.components || []).filter((item) => (allParts.find((row) => row.id === item.partId)?.usedInModels || []).length > 1).length)} accent="#f59e0b" helpText="Birden fazla modelde geçen alt bileşen sayısı" />
      </div>

      {!part.isAssembly ? (
        <div style={pageCard}>
          <EmptyState message="Bu kalem montaj / mamul olarak işaretlenmediği için ürün ağacı burada açılmıyor." />
          {canEdit ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}><button onClick={() => handleFieldChange('isAssembly', true)} style={{ ...actionButton, background: '#2563eb', color: '#fff' }}><Layers size={16} />Montaj Olarak İşaretle</button></div> : null}
        </div>
      ) : (
        <div style={pageCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div>
              <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 17, fontWeight: 800 }}>Ürün Ağacı Yönetimi</h3>
              <p style={{ color: '#475569', fontSize: 12, margin: '6px 0 0' }}>Bu tabloda montajı oluşturan alt parçalar ve birim tüketimleri yönetilir.</p>
            </div>
            {canEdit ? <button onClick={addComponentRow} style={{ ...actionButton, background: '#2563eb', color: '#fff' }}><Plus size={16} />BOM Kalemi Ekle</button> : null}
          </div>

          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Poz</th>
                  <th style={th}>Alt Parça</th>
                  <th style={th}>Tanım</th>
                  <th style={{ ...th, textAlign: 'right' }}>Birim Tüketim</th>
                  <th style={{ ...th, textAlign: 'right' }}>Mevcut Stok</th>
                  <th style={th}>Ortaklık</th>
                  <th style={{ ...th, width: 64 }} />
                </tr>
              </thead>
              <tbody>
                {(part.components || []).length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="Henüz BOM bileşeni eklenmedi." /></td></tr>
                ) : (
                  (part.components || []).map((item, index) => {
                    const selectedPart = availableComponentParts.find((row) => row.id === item.partId);
                    const sharedCount = selectedPart?.usedInModels?.length || 0;
                    return (
                      <tr key={`${item.partId || 'row'}-${index}`}>
                        <td style={{ ...td, color: '#f8fafc', fontWeight: 800 }}>{index + 1}</td>
                        <td style={td}>
                          {canEdit ? (
                            <select style={input} value={item.partId || ''} onChange={(event) => updateComponentRow(index, 'partId', event.target.value)}>
                              <option value="">Parça seçiniz</option>
                              {availableComponentParts.map((row) => <option key={row.id} value={row.id}>{row.partNumber} - {row.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.partNumber || '-'}</span>
                          )}
                        </td>
                        <td style={{ ...td, color: '#e2e8f0' }}>{item.name || selectedPart?.name || '-'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {canEdit ? <input type="number" min="0" step="0.01" style={{ ...input, width: 120, marginLeft: 'auto', textAlign: 'right' }} value={item.qty ?? 1} onChange={(event) => updateComponentRow(index, 'qty', event.target.value)} /> : <span style={{ color: '#f8fafc', fontWeight: 900 }}>{formatNumber(item.qty)}</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: '#f8fafc', fontWeight: 900 }}>{formatNumber(selectedPart?.currentStock || 0)} {selectedPart?.unit || item.unit || ''}</td>
                        <td style={td}><Badge text={sharedCount > 1 ? `${sharedCount} modelde ortak` : 'Tekil kullanım'} tone={sharedCount > 1 ? 'warning' : 'info'} /></td>
                        <td style={{ ...td, textAlign: 'right' }}>{canEdit ? <button onClick={() => removeComponentRow(index)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #1e293b', background: '#0f172a', color: '#f87171', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button> : null}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderStockTab = () => (
    <div style={{ maxWidth: 1520, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 360px', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={pageCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div>
              <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 17, fontWeight: 800 }}>Lot Havuzu</h3>
              <p style={{ color: '#475569', fontSize: 12, margin: '6px 0 0' }}>Otomatik lot numarası ile lot açabilir, kalan stok ve kalite durumunu izleyebilirsiniz.</p>
            </div>
            {canManageStock && id !== 'new' ? <button onClick={openLotEntry} style={{ ...actionButton, background: '#2563eb', color: '#fff' }}><Plus size={16} />Yeni Lot Aç</button> : null}
          </div>

          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Lot No</th>
                  <th style={th}>Tarih</th>
                  <th style={th}>Kalite</th>
                  <th style={th}>Lokasyon</th>
                  <th style={{ ...th, textAlign: 'right' }}>Giriş</th>
                  <th style={{ ...th, textAlign: 'right' }}>Kalan</th>
                  <th style={th}>Referans</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="Bu parçaya ait lot kaydı bulunmuyor." /></td></tr>
                ) : (
                  batches.map((item) => (
                    <tr key={item.id}>
                      <td style={{ ...td, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.batchId || item.lotNumber}</td>
                      <td style={td}>{formatDateOnly(item.receivedDate || item.createdAt)}</td>
                      <td style={td}><Badge text={item.qcStatus || 'Bilinmiyor'} tone={getBadgeTone(item.qcStatus)} /></td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{item.warehouseLocation || item.location || '-'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{formatNumber(item.quantity)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#f8fafc', fontWeight: 900 }}>{formatNumber(item.remainingQty)}</td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{item.referenceNumber || item.grnNumber || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={pageCard}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Stok Hareket Geçmişi</h3>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Tarih</th>
                  <th style={th}>Hareket</th>
                  <th style={{ ...th, textAlign: 'right' }}>Miktar</th>
                  <th style={th}>Lot</th>
                  <th style={th}>Kullanıcı</th>
                  <th style={th}>Referans</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState message="Stok hareket kaydı bulunmuyor." /></td></tr>
                ) : (
                  movements.map((item) => (
                    <tr key={item.id}>
                      <td style={td}>{formatDate(item.createdAt)}</td>
                      <td style={{ ...td, color: '#e2e8f0', fontWeight: 700 }}>{item.movementType || item.type || '-'}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#f8fafc', fontWeight: 900 }}>{formatNumber(item.qty || item.quantity)}</td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{item.lotNumber || '-'}</td>
                      <td style={td}>{item.performedBy || '-'}</td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{item.referenceNumber || item.reference || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={pageCard}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>Stok Özeti</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ ...statCard, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Fiili Stok</div><div style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc' }}>{formatNumber(part.currentStock || 0)}</div></div>
            <div style={{ ...statCard, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Rezerve</div><div style={{ fontSize: 24, fontWeight: 900, color: '#818cf8' }}>{formatNumber(part.reservedStock || 0)}</div></div>
            <div style={{ ...statCard, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Açık Lot</div><div style={{ fontSize: 24, fontWeight: 900, color: '#34d399' }}>{formatNumber(batches.length)}</div></div>
            <div style={{ ...statCard, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Durum</div><div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>{part.stockStatus || 'Sağlam'}</div></div>
          </div>
        </div>

        <div style={pageCard}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>Otomatik Lot Stratejisi</h3>
          <div style={{ ...statCard, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Sıradaki önerilen lot</div>
            <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: '#60a5fa' }}>{nextLotPreview}</div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>Lot numarası otomatik olarak <strong>LOT-YIL-AY-SIRA</strong> formatında önerilir. Aynı ay içindeki sıra numarası mevcut kayıt sayısına göre artırılır.</p>
          {canManageStock && id !== 'new' ? <button onClick={openLotEntry} style={{ ...actionButton, background: '#dc2626', color: '#fff', width: '100%', justifyContent: 'center', marginTop: 16 }}><Plus size={16} />Otomatik Lot Ata ve Aç</button> : null}
        </div>
      </div>
    </div>
  );

  const renderQualityTab = () => (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <StatBox labelText="Toplam Muayene" value={formatNumber(inspections.length)} accent="#60a5fa" helpText="Giriş, proses ve final kayıtları" />
        <StatBox labelText="Kabul Oranı" value={inspections.length ? `${Math.round((inspections.filter((item) => item.overallResult === 'Kabul').length / inspections.length) * 100)}%` : '-'} accent="#34d399" helpText="Muayene sonucuna göre" />
        <StatBox labelText="Uygunsuzluk" value={formatNumber(ncrs.length)} accent="#f87171" helpText="Açık ve kapalı NCR kayıtları" />
        <StatBox labelText="Son Sonuç" value={inspections[0]?.overallResult || '-'} accent="#f59e0b" helpText={inspections[0] ? formatDateOnly(inspections[0].inspectionDate || inspections[0].createdAt) : 'Henüz ölçüm yok'} />
      </div>

      <div style={pageCard}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Muayene Kayıtları</h3>
        <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>QC No</th>
                <th style={th}>Tarih</th>
                <th style={th}>Tür</th>
                <th style={th}>Lot</th>
                <th style={th}>Muayeneci</th>
                <th style={{ ...th, textAlign: 'center' }}>Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr><td colSpan={6}><EmptyState message="Kalite muayene kaydı bulunmuyor." /></td></tr>
              ) : (
                inspections.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.inspectionNo || item.id}</td>
                    <td style={td}>{formatDateOnly(item.inspectionDate || item.createdAt)}</td>
                    <td style={td}>{item.inspectionType || '-'}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{item.lotNumber || '-'}</td>
                    <td style={td}>{item.inspectorName || '-'}</td>
                    <td style={{ ...td, textAlign: 'center' }}><Badge text={item.overallResult || '-'} tone={getBadgeTone(item.overallResult)} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={pageCard}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Uygunsuzluk Geçmişi</h3>
        <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>NCR No</th>
                <th style={th}>Kaynak</th>
                <th style={th}>Aksiyon</th>
                <th style={th}>Durum</th>
                <th style={th}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {ncrs.length === 0 ? (
                <tr><td colSpan={5}><EmptyState message="Uygunsuzluk kaydı bulunmuyor." /></td></tr>
              ) : (
                ncrs.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.ncrNumber || item.id}</td>
                    <td style={td}>{item.sourceType || '-'}</td>
                    <td style={td}>{item.action || item.disposition || '-'}</td>
                    <td style={td}><Badge text={item.status || '-'} tone={getBadgeTone(item.status)} /></td>
                    <td style={td}>{item.title || item.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTechnicalTab = () => (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <div style={pageCard}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Teknik Dokümanlar</h3>
        {docs.length === 0 ? (
          <EmptyState message="Bu parçaya bağlı teknik resim veya doküman bulunmuyor." />
        ) : (
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Doküman No</th>
                  <th style={th}>Ad</th>
                  <th style={th}>Revizyon</th>
                  <th style={th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 800 }}>{item.docNumber || '-'}</td>
                    <td style={td}>{item.title || '-'}</td>
                    <td style={td}>{item.revision || 'A'}</td>
                    <td style={td}><Badge text={item.revisionStatus || '-'} tone={getBadgeTone(item.revisionStatus)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderSupplyTab = () => (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24 }}>
      <div style={pageCard}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Tedarikçi ve Fiyat Geçmişi</h3>
        {suppliers.length === 0 ? (
          <EmptyState message="Bu parçaya bağlı tedarikçi kaydı bulunmuyor." />
        ) : (
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Tedarikçi</th>
                  <th style={th}>Tedarikçi Kodu</th>
                  <th style={{ ...th, textAlign: 'right' }}>Birim Fiyat</th>
                  <th style={th}>Termin</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...td, color: '#f8fafc', fontWeight: 700 }}>{item.supplierName || '-'}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{item.supplierPartCode || '-'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#60a5fa', fontWeight: 900 }}>{formatCurrency(item.unitPrice, item.currency)}</td>
                    <td style={td}>{item.leadTimeDays ? `${item.leadTimeDays} gün` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={pageCard}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>Son Fiyatlar</h3>
        {suppliers.length === 0 ? (
          <EmptyState message="Fiyat kaydı yok." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {suppliers.slice(0, 5).map((item) => (
              <div key={item.id} style={{ ...statCard, borderTop: '3px solid #60a5fa' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>{formatCurrency(item.unitPrice, item.currency)}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{item.supplierName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCurrentTab = () => {
    if (tab === 'Genel') return renderGeneralTab();
    if (tab === 'BOM') return renderBomTab();
    if (tab === 'Stok') return renderStockTab();
    if (tab === 'Kalite') return renderQualityTab();
    if (tab === 'Teknik') return renderTechnicalTab();
    if (tab === 'Tedarik') return renderSupplyTab();
    return <div />;
  };

  if (loading) return <Spinner />;
  if (!part) return <EmptyState message="Parça verisi bulunamadı" />;

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '18px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/parts')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #1e293b', background: '#111827', color: '#cbd5e1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', margin: 0 }}>{part.partNumber || 'Yeni Parça'}</h1>
                <Badge text={`REV ${part.revision || 'A'}`} tone="info" />
                <Badge text={part.stockStatus || 'Sağlam'} tone={getBadgeTone(part.stockStatus)} />
                {(part.usedInModels?.length || 0) > 1 ? <Badge text="ORTAK PARÇA" tone="warning" /> : null}
              </div>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>{part.name || 'Parça tanımı oluşturuluyor'}</p>
              {!hasTechnicalPdf && id !== 'new' ? (
                <p style={{ margin: '8px 0 0', color: '#f87171', fontSize: 12, fontWeight: 700 }}>
                  Teknik resim PDF bağlı değil. Bu parça için lot / stok girişi kapalı.
                </p>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canManageStock && id !== 'new' ? <button onClick={openLotEntry} disabled={!hasTechnicalPdf} style={{ ...actionButton, background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0', opacity: hasTechnicalPdf ? 1 : 0.45, cursor: hasTechnicalPdf ? 'pointer' : 'not-allowed' }}><Plus size={16} />Lot Girişi</button> : null}
            {canEdit ? <button onClick={save} disabled={saving} style={{ ...actionButton, background: '#dc2626', color: '#fff', boxShadow: '0 10px 24px rgba(220, 38, 38, 0.18)', opacity: saving ? 0.7 : 1 }}><Save size={16} />{saving ? 'Kaydediliyor' : 'Kaydet'}</button> : null}
          </div>
        </div>
      </div>

      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', display: 'flex', padding: '0 24px', overflowX: 'auto' }}>
        {TABS.map(([key, text, Icon]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '13px 24px', fontSize: 13, fontWeight: 800, color: tab === key ? '#f8fafc' : '#64748b', borderBottom: tab === key ? '2px solid #dc2626' : '2px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <Icon size={16} />
            {text}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>{renderCurrentTab()}</div>

      <Modal open={lotModal} onClose={() => setLotModal(false)} title="Yeni Lot Aç">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={label}>Lot Numarası</label>
              <input style={{ ...input, fontFamily: 'monospace' }} value={lotForm.lotNumber} onChange={(event) => setLotForm((prev) => ({ ...prev, lotNumber: event.target.value }))} />
            </div>
            <button onClick={assignAutomaticLot} style={{ ...actionButton, background: '#0f172a', border: '1px solid #1e293b', color: '#60a5fa', whiteSpace: 'nowrap' }}>Otomatik Ata</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Miktar</label>
              <input type="number" min="1" style={input} value={lotForm.quantity} onChange={(event) => setLotForm((prev) => ({ ...prev, quantity: event.target.value }))} />
            </div>
            <div>
              <label style={label}>Kalite Durumu</label>
              <select style={input} value={lotForm.qcStatus} onChange={(event) => setLotForm((prev) => ({ ...prev, qcStatus: event.target.value }))}>
                <option value="Karantina">Karantina</option>
                <option value="Sağlam">Sağlam</option>
              </select>
            </div>
            <div>
              <label style={label}>Lokasyon</label>
              <input style={input} value={lotForm.location} onChange={(event) => setLotForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Örn: HAM-A01-01" />
            </div>
            <div>
              <label style={label}>Tarih</label>
              <input type="date" style={input} value={lotForm.receivedDate} onChange={(event) => setLotForm((prev) => ({ ...prev, receivedDate: event.target.value }))} />
            </div>
            <div>
              <label style={label}>Kaynak</label>
              <select style={input} value={lotForm.sourceType} onChange={(event) => setLotForm((prev) => ({ ...prev, sourceType: event.target.value }))}>
                <option value="Stok Açılışı">Stok Açılışı</option>
                <option value="Üretimden Giriş">Üretimden Giriş</option>
                <option value="Sayım Düzeltme">Sayım Düzeltme</option>
                <option value="Elle Düzeltme">Elle Düzeltme</option>
              </select>
            </div>
            <div>
              <label style={label}>Referans No</label>
              <input style={input} value={lotForm.referenceNumber} onChange={(event) => setLotForm((prev) => ({ ...prev, referenceNumber: event.target.value }))} placeholder="PO / WO / SAYIM" />
            </div>
          </div>

          <div>
            <label style={label}>Not</label>
            <textarea style={textarea} value={lotForm.note} onChange={(event) => setLotForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Lot açılışına ilişkin açıklama" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setLotModal(false)} style={{ ...actionButton, background: 'transparent', border: '1px solid #334155', color: '#94a3b8' }}>İptal</button>
            <button type="button" onClick={handleCreateLot} style={{ ...actionButton, background: '#dc2626', color: '#fff' }}>Lotu Oluştur</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


