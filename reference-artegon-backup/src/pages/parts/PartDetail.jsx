import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getPartById, updatePart, getModels, getInventoryBatches, 
  getStockMovements, getQcInspections, getDocuments, getSupplierParts, getPriceHistory,
  addPart, addInventoryBatch, addStockMovement
} from '../../firebase/firestore';
import Modal from '../../components/ui/Modal';
import { 
  PART_CATEGORIES, PART_SUB_CATEGORIES, PART_UNITS, REVISION_STATUSES, STOCK_STATUSES,
  formatNumber, formatDate, formatDateOnly, formatCurrency
} from '../../utils/helpers';
import { generateLotNumber } from '../../utils/autoGen';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, Save, Plus, History, Layers, Package, ShieldCheck, FileText, 
  ShoppingCart, TrendingUp, AlertTriangle, Crosshair, Box, Tag, Calculator,
  Download, ExternalLink, Trash2, Clock, CheckCircle2, XCircle, CloudUpload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const TAB_STYLE = (active, disabled) => ({ 
  padding: '12px 24px', 
  fontSize: 13, 
  fontWeight: 600, 
  color: active ? '#f1f5f9' : '#64748b', 
  borderBottom: active ? '2px solid #dc2626' : '2px solid transparent', 
  background: 'transparent', 
  cursor: disabled ? 'not-allowed' : 'pointer', 
  opacity: disabled ? 0.4 : 1,
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: 8
});

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em' };
const INPUT_STYLE = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function PartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userDoc, isAdmin, isEngineer, isWarehouse, isKalite, isSatinAlma } = useAuth();
  
  // Refined permissions
  const canEditGenel = isAdmin || isEngineer;
  const canEditStock = isAdmin || isWarehouse;
  const canEditQuality = isAdmin || isKalite;
  const canEditCommercial = isAdmin || isSatinAlma;
  
  // Legacy canEdit for global actions
  const canEdit = isAdmin || isEngineer;

  const [loading, setLoading] = useState(true);
  const [part, setPart] = useState(null);
  const [showLotModal, setShowLotModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Genel');
  const [isGeneratingLot, setIsGeneratingLot] = useState(false);
  
  // Related Data
  const [models, setModels] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);

  // Form States
  const [bomForm, setBomForm] = useState({ partNumber: '', name: '', qty: 1, unit: 'Adet' });
  const [lotForm, setLotForm] = useState({ lotNumber: '', quantity: 1, warehouseLocation: '' });
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ supplierId: '', unitPrice: '', currency: 'TRY', leadTimeDays: 7 });

  useEffect(() => {
    const init = async () => {
      // Global data needed for both new and existing parts
      try {
        const [m, s] = await Promise.all([getModels(), getSuppliers()]);
        setModels(m.docs.map(x => ({ id: x.id, ...x.data() })));
        setAllSuppliers(s.docs.map(x => ({ id: x.id, ...x.data() })));
      } catch (e) {
        console.error("Global data error:", e);
      }

      if (id === 'new') {
        setPart({
          partNumber: '', name: '', category: 'Hammadde', subCategory: 'Çelik', unit: 'Adet', quantity: 0,
          revision: 'A', revisionStatus: 'Aktif', revisionHistory: [], isAssembly: false, 
          isCritical: false, isForeignMilitary: false, currentStock: 0, minStock: 0, maxStock: 0,
          warehouseLocation: '', stockStatus: 'Sağlam', isActive: true, components: [], usedInModels: [],
          material: '', materialStandard: '', surfaceTreatment: '', hardness: '', weight: '', dimensions: '',
          leadTimeDays: 7, safetyStockDays: 3, avgDailyConsumption: 0, reorderPoint: 0, reorderQty: 50
        });
        setLoading(false);
      } else {
        await load();
      }
    };
    init();
  }, [id]);

  const load = async () => {
    try {
      const pDoc = await getPartById(id);
      if (!pDoc.exists()) {
        toast.error('Parça bulunamadı');
        navigate('/parts');
        return;
      }
      const data = { id: pDoc.id, ...pDoc.data() };
      setPart(data);

      const [b, mv, qc, d, sp, ph] = await Promise.all([
        getInventoryBatches(), getStockMovements(), 
        getQcInspections(), getDocuments(), getSupplierParts(), getPriceHistory()
      ]);

      setBatches(b.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.partId === id));
      setMovements(mv.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.partId === id).slice(0, 50));
      setInspections(qc.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.partId === id));
      setDocs(d.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.linkedPartId === id));
      setSuppliers(sp.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.partId === id));
      setPriceHistory(ph.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.partId === id));

      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Hata: Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      if (id === 'new') {
        const docRef = await addPart({
          ...part,
          createdAt: new Date().toISOString(),
          createdBy: userDoc?.displayName || 'Sistem'
        });
        toast.success('Yeni malzeme başarıyla eklendi');
        navigate(`/parts/${docRef.id}`);
      } else {
        await updatePart(id, {
          ...part,
          updatedAt: new Date().toISOString(),
          updatedBy: userDoc?.displayName || 'Sistem'
        });
        toast.success('Malzeme güncellendi');
        navigate('/parts');
      }
    } catch (e) {
      toast.error('Kayıt sırasında hata oluştu');
    }
  };

  const handleTabClick = (tab) => {
    if (id === 'new' && tab !== 'Genel') {
      toast.error('Lütfen diğer sekmelere geçmeden önce parçayı kaydedin');
      return;
    }
    setActiveTab(tab);
  };

  const handleAddBOMComponent = () => {
    if (!bomForm.partNumber || !bomForm.name) return toast.error('Parça no ve ad zorunludur');
    const newComponent = { ...bomForm, id: Date.now().toString() };
    const updatedComponents = [...(part.components || []), newComponent];
    setPart({ ...part, components: updatedComponents });
    setBomForm({ partNumber: '', name: '', qty: 1, unit: 'Adet' });
  };

  const handleRemoveBOMComponent = (compId) => {
    const updatedComponents = (part.components || []).filter(c => c.id !== compId);
    setPart({ ...part, components: updatedComponents });
  };

  const handleAddBatch = async () => {
    if (!lotForm.lotNumber || !lotForm.quantity) return toast.error('Lot no ve miktar zorunludur');
    try {
      const batchData = {
        partId: id,
        partNumber: part.partNumber,
        batchId: lotForm.lotNumber,
        quantity: Number(lotForm.quantity),
        remainingQty: Number(lotForm.quantity),
        warehouseLocation: lotForm.warehouseLocation,
        receivedDate: new Date().toISOString(),
        qcStatus: 'Karantina'
      };
      await addInventoryBatch(batchData);
      
      const movementData = {
        partId: id,
        batchId: lotForm.lotNumber,
        movementType: 'Giriş (Manuel Lot Ekleme)',
        qty: Number(lotForm.quantity),
        performedBy: userDoc?.displayName || 'Sistem',
        referenceNumber: 'MANUEL',
        createdAt: new Date().toISOString()
      };
      await addStockMovement(movementData);

      const newStock = (part.currentStock || 0) + Number(lotForm.quantity);
      
      // Part state update
      const updatedPart = { ...part, currentStock: newStock };
      setPart(updatedPart);
      await updatePart(id, { currentStock: newStock });

      toast.success('Lot başarıyla eklendi ve stok güncellendi');
      setShowLotModal(false);
      setLotForm({ lotNumber: '', quantity: 1, warehouseLocation: '' });
      setBatches([{ id: Date.now().toString(), ...batchData }, ...batches]);
      setMovements([{ id: Date.now().toString(), ...movementData }, ...movements]);
    } catch (e) {
      toast.error('Lot eklenirken bir hata oluştu');
      console.error(e);
    }
  };

  const autoGenLot = async () => {
    setIsGeneratingLot(true);
    try {
      const nextLot = await generateLotNumber();
      setLotForm({ ...lotForm, lotNumber: nextLot });
    } catch (err) {
      toast.error('Lot numarası üretilemedi');
    } finally {
      setIsGeneratingLot(false);
    }
  };

  const handleAddSupplierToAVL = async () => {
    if (!supplierForm.supplierId) return toast.error('Tedarikçi seçiniz');
    try {
      const selectedS = allSuppliers.find(s => s.id === supplierForm.supplierId);
      const data = {
        partId: id,
        partNumber: part.partNumber,
        supplierId: supplierForm.supplierId,
        supplierName: selectedS.name,
        unitPrice: Number(supplierForm.unitPrice),
        currency: supplierForm.currency,
        leadTimeDays: Number(supplierForm.leadTimeDays),
        isPreferred: suppliers.length === 0
      };
      await addSupplierPart(data);
      setSuppliers([...suppliers, { id: Date.now().toString(), ...data }]);
      setShowSupplierModal(false);
      toast.success('Tedarikçi listeye eklendi');
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const docData = {
      title: formData.get('title'),
      docNumber: formData.get('docNumber'),
      revision: formData.get('revision') || 'A',
      category: 'Teknik Resim', // Fixed category for this tab
      linkedPartId: id,
      linkedPartNumber: part.partNumber,
      uploadedBy: userDoc?.displayName || 'Sistem',
      uploadedAt: new Date().toISOString(),
      approvedBy: userDoc?.displayName || 'Sistem',
      approvedAt: new Date().toISOString(),
      revisionStatus: 'Onaylandı',
      isDownloadable: true,
      url: '#' // Placeholder for actual file upload (Firebase Storage integration)
    };
    
    if (!docData.title || !docData.docNumber) return toast.error('Başlık ve numara zorunludur');
    
    try {
      await addDocument(docData);
      setDocs([{ id: Date.now().toString(), ...docData }, ...docs]);
      setShowDocumentModal(false);
      toast.success('Döküman başarıyla eklendi');
    } catch (e) {
      console.error(e);
      toast.error('Hata oluştu');
    }
  };

  const EmptyStateUI = ({ message, action }) => (
    <div style={{ padding: 40, textAlign: 'center', background: '#0a0f1e', borderRadius: 12, border: '1px dashed #1e293b', width: '100%' }}>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: action ? 16 : 0, fontWeight: 600 }}>{message}</p>
      {action}
    </div>
  );

  const openNewRevision = async () => {
    const reason = prompt('Yeni revizyon açma gerekçesi (ECN):');
    if (!reason) return;
    if (id === 'new') return toast.error('Önce parçayı kaydedin.');

    const oldRev = part.revision;
    const nextRev = String.fromCharCode(oldRev.charCodeAt(0) + 1);
    
    try {
      // 1. Set current to Pasif
      await updatePart(id, { revisionStatus: 'Pasif' });
      
      // 2. Clone to new object
      const newPart = {
        ...part,
        revision: nextRev,
        revisionStatus: 'Aktif',
        revisionHistory: [
          ...(part.revisionHistory || []),
          { rev: oldRev, changedBy: userDoc?.displayName, changeDate: new Date().toISOString(), changeReason: reason }
        ],
        currentStock: 0,
        reservedStock: 0
      };
      delete newPart.id;

      const docRef = await addPart(newPart);
      toast.success(`Yeni Revizyon: ${nextRev} tasarımı açıldı.`);
      navigate(`/parts/${docRef.id}`);
    } catch (err) {
      toast.error('Revizyon açılırken hata oluştu');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* HEADER SECTION */}
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/parts')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={20} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{id === 'new' ? 'Yeni Malzeme Tanımı' : part.partNumber}</h1>
                {id !== 'new' && <span style={{ padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#60a5fa', fontSize: 11, fontWeight: 800 }}>REV {part.revision}</span>}
                {id !== 'new' && <span style={{ padding: '4px 10px', borderRadius: 6, background: part.isActive ? '#065f46' : '#1e293b', color: part.isActive ? '#34d399' : '#64748b', fontSize: 11, fontWeight: 800 }}>{part.revisionStatus}</span>}
              </div>
              <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{part.name || 'Malzeme detayları ve planlama ayarları'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {id !== 'new' && canEdit && (
              <button onClick={openNewRevision} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', border: '1px solid #1e293b', background: '#0d1117', color: '#f1f5f9', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 8 }}>
                <History size={16} /> Yeni Revizyon Aç
              </button>
            )}
            {canEdit && (
              <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
                <Save size={18} /> {id === 'new' ? 'Oluştur' : 'Değişiklikleri Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', display: 'flex', padding: '0 24px' }}>
        <button style={TAB_STYLE(activeTab==='Genel', false)} onClick={()=>handleTabClick('Genel')}><Package size={16}/> Genel Bilgiler</button>
        <button style={TAB_STYLE(activeTab==='BOM', id === 'new')} onClick={()=>handleTabClick('BOM')}><Layers size={16}/> BOM / Ürün Ağacı</button>
        <button style={TAB_STYLE(activeTab==='Stok', id === 'new')} onClick={()=>handleTabClick('Stok')}><Box size={16}/> Stok & Lot Takibi</button>
        <button style={TAB_STYLE(activeTab==='Kalite', id === 'new')} onClick={()=>handleTabClick('Kalite')}><ShieldCheck size={16}/> Kalite Geçmişi</button>
        <button style={TAB_STYLE(activeTab==='TeknikResim', id === 'new')} onClick={()=>handleTabClick('TeknikResim')}><FileText size={16}/> Teknik Resimler</button>
        <button style={TAB_STYLE(activeTab==='Tedarik', id === 'new')} onClick={()=>handleTabClick('Tedarik')}><ShoppingCart size={16}/> Tedarik</button>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
        
        {/* TAB 1: GENEL BİLGİLER */}
        {activeTab === 'Genel' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
            <div className="section">
              {part.revisionStatus === 'Pasif' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '12px 16px', borderRadius: 8, display: 'flex', gap: 12, marginBottom: 20 }}>
                  <AlertTriangle color="#ef4444" size={24} />
                  <div>
                    <h4 style={{ margin: 0, color: '#ef4444', fontSize: 13, fontWeight: 700 }}>OBSOLETE - PASİF REVİZYON</h4>
                    <p style={{ margin: '4px 0 0', color: '#fca5a5', fontSize: 11 }}>Bu revizyon pasife çekilmiştir (Rev {part.revision}). İş emirlerinde veya yeni satınalmalarda kullanılamaz.</p>
                  </div>
                </div>
              )}
              {part.isCritical && (
                <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', padding: '12px 16px', borderRadius: 8, display: 'flex', gap: 12, marginBottom: 20 }}>
                  <AlertTriangle color="#fbbf24" size={24} />
                  <div>
                    <h4 style={{ margin: 0, color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>EMNİYET KRİTİK PARÇA</h4>
                    <p style={{ margin: '4px 0 0', color: '#fcd34d', fontSize: 11 }}>Bu parça silah sisteminin emniyeti için kritiktir. Tüm işlemlere %100 muayene uygulanmalıdır.</p>
                  </div>
                </div>
              )}
              
              <div style={CARD_STYLE}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16}/> Tanımlama & Temel Bilgiler</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LABEL_STYLE}>Parça Numarası</label>
                    <input style={INPUT_STYLE} value={part.partNumber} onChange={e=>setPart({...part,partNumber:e.target.value})} disabled={!canEditGenel} placeholder="Örn: AG-100-01" />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LABEL_STYLE}>Parça Adı</label>
                    <input style={INPUT_STYLE} value={part.name} onChange={e=>setPart({...part,name:e.target.value})} disabled={!canEditGenel} placeholder="Örn: Gövde Grubu" />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Kategori</label>
                    <select style={INPUT_STYLE} value={part.category} onChange={e=>setPart({...part,category:e.target.value})} disabled={!canEditGenel}>
                      <option value="Hammadde">Hammadde</option>
                      <option value="Parça">Parça</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Alt Kategori</label>
                    <select style={INPUT_STYLE} value={part.subCategory} onChange={e=>setPart({...part,subCategory:e.target.value})} disabled={!canEditGenel}>
                      {PART_SUB_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Birim</label>
                    <select style={INPUT_STYLE} value={part.unit} onChange={e=>setPart({...part,unit:e.target.value})} disabled={!canEditGenel}>
                      {PART_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div><label style={LABEL_STYLE}>Mevcut Fiili Stok (Adet)</label><input type="number" style={{...INPUT_STYLE, fontWeight: 800, color: '#34d399'}} value={part.currentStock || 0} onChange={e=>setPart({...part,currentStock:Number(e.target.value)})} disabled={!canEditGenel} /></div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={16}/> MRP / Planlama Ayarları</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  <div><label style={LABEL_STYLE}>Kritik Stok Adedi</label><input type="number" min="0" style={INPUT_STYLE} value={part.minStock || 0} onChange={e=>setPart({...part, minStock: Number(e.target.value)})} disabled={!canEditGenel} /></div>
                  
                  {/* Kullanılan Modeller ve Miktar */}
                  <div style={{ marginTop: 12 }}>
                    <label style={LABEL_STYLE}>Kullanılan Modeller & Tüketim (BOM Link)</label>
                    <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8, padding: 12 }}>
                      {canEditGenel && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <select style={{...INPUT_STYLE, flex: 2}} id="modelSelect">
                            <option value="">Model Seç...</option>
                            {models.map(m => (
                              <option key={m.id} value={m.id}>{m.modelCode} - {m.modelName}</option>
                            ))}
                          </select>
                          <input type="number" style={{...INPUT_STYLE, flex: 1}} id="modelQty" placeholder="Tüketim/Adet" defaultValue={1} />
                          <button 
                            onClick={() => {
                              const modId = document.getElementById('modelSelect').value;
                              const modQty = Number(document.getElementById('modelQty').value);
                              if (!modId) return toast.error('Model seçiniz');
                              if (!modQty || modQty <= 0) return toast.error('Geçerli bir miktar giriniz');
                              const model = models.find(m => m.id === modId);
                              const exists = (part.usedInModels || []).some(x => x.modelId === modId);
                              if (exists) return toast.error('Bu model zaten ekli');
                              const updated = [...(part.usedInModels || []), { 
                                modelId: modId, 
                                modelCode: model.modelCode, 
                                qtyPerUnit: modQty 
                              }];
                              setPart({ ...part, usedInModels: updated });
                            }}
                            style={{ padding: '0 16px', background: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Ekle
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(!part.usedInModels || part.usedInModels.length === 0) ? (
                          <span style={{ fontSize: 12, color: '#475569' }}>Kullanılan model tanımı bulunmuyor.</span>
                        ) : (
                          part.usedInModels.map((m, idx) => (
                            <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', minWidth: 160 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{m.modelCode}</span>
                                <span style={{ fontSize: 12, fontWeight: 900, color: '#3b82f6' }}>{m.qtyPerUnit} {part.unit || 'Adet'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                 <span style={{ fontSize: 10, color: '#475569' }}>Birim Tüketim</span>
                                 {canEditGenel && (
                                   <button 
                                      onClick={() => setPart({...part, usedInModels: part.usedInModels.filter(x => x.modelId !== m.modelId)})}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                   >
                                      <Trash2 size={12} />
                                   </button>
                                 )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div style={CARD_STYLE}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>📐 Malzeme & Teknik Spesifikasyon</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><label style={LABEL_STYLE}>Malzeme</label><input style={INPUT_STYLE} value={part.material} onChange={e=>setPart({...part,material:e.target.value})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Malzeme Standardı</label><input style={INPUT_STYLE} value={part.materialStandard} onChange={e=>setPart({...part,materialStandard:e.target.value})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Üst Tolerans (+)</label><input type="number" step="0.01" style={INPUT_STYLE} value={part.toleranceUpper || 0} onChange={e=>setPart({...part,toleranceUpper:Number(e.target.value)})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Alt Tolerans (-)</label><input type="number" step="0.01" style={INPUT_STYLE} value={part.toleranceLower || 0} onChange={e=>setPart({...part,toleranceLower:Number(e.target.value)})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Yüzey İşlem</label><input style={INPUT_STYLE} value={part.surfaceTreatment} onChange={e=>setPart({...part,surfaceTreatment:e.target.value})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Sertlik</label><input style={INPUT_STYLE} value={part.hardness} onChange={e=>setPart({...part,hardness:e.target.value})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Ağırlık (Gram)</label><input type="number" style={INPUT_STYLE} value={part.weight} onChange={e=>setPart({...part,weight:e.target.value})} disabled={!canEditGenel} /></div>
                  <div><label style={LABEL_STYLE}>Boyutlar / CTQ Flag</label><input style={INPUT_STYLE} value={part.dimensions} onChange={e=>setPart({...part,dimensions:e.target.value})} placeholder="Örn: Ø20x100 [CTQ]" disabled={!canEditGenel} /></div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}><History size={16}/> Revizyon Geçmişi (PDM)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(!part.revisionHistory || part.revisionHistory.length === 0) ? (
                    <p style={{ color: '#475569', fontSize: 12 }}>Henüz bir revizyon geçmişi yok.</p>
                  ) : (
                    part.revisionHistory.map((h, i) => (
                      <div key={i} style={{ borderLeft: '2px solid #1e293b', paddingLeft: 16, position: 'relative' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', position: 'absolute', left: -5, top: 6 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Revizyon {h.rev}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{formatDateOnly(h.changeDate)}</span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: 12, color: '#94a3b8' }}>{h.changeReason}</p>
                        <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>Değiştiren: {h.changedBy}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOM / ÜRÜN AĞACI */}
        {activeTab === 'BOM' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {!part.isAssembly ? (
              <EmptyState message="Bu parça bir montaj grubu değil. BOM yönetmek için 'BOM Var' seçeneğini işaretleyin." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                <div style={CARD_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Ürün Ağacı (BOM)</h3>
                    <button style={{ height: 32, padding: '0 12px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 4, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>BOM İndir (Excel)</button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Poz. No</th>
                        <th style={TH}>Parça No</th>
                        <th style={TH}>Ad</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
                        <th style={TH}>Birim</th>
                        <th style={{ ...TH, width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: '#111827', borderBottom: '2px solid #1e293b' }}>
                        <td style={TD}>*</td>
                        <td style={{ ...TD, padding: '8px' }}>
                          <input style={{...INPUT_STYLE, padding: '6px 10px'}} placeholder="Parça No" value={bomForm.partNumber} onChange={e=>setBomForm({...bomForm, partNumber:e.target.value})} disabled={!canEdit}/>
                        </td>
                        <td style={{ ...TD, padding: '8px' }}>
                          <input style={{...INPUT_STYLE, padding: '6px 10px'}} placeholder="Ad" value={bomForm.name} onChange={e=>setBomForm({...bomForm, name:e.target.value})} disabled={!canEdit}/>
                        </td>
                        <td style={{ ...TD, padding: '8px' }}>
                          <input type="number" style={{...INPUT_STYLE, padding: '6px 10px', textAlign: 'right'}} min="0.1" step="any" value={bomForm.qty} onChange={e=>setBomForm({...bomForm, qty:e.target.value})} disabled={!canEdit}/>
                        </td>
                        <td style={{ ...TD, padding: '8px' }}>
                          <select style={{...INPUT_STYLE, padding: '6px 10px'}} value={bomForm.unit} onChange={e=>setBomForm({...bomForm, unit:e.target.value})} disabled={!canEdit}>
                            {PART_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ ...TD, padding: '8px' }}>
                          <button onClick={handleAddBOMComponent} disabled={!canEdit} style={{ width: 32, height: 32, background: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', cursor: canEdit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} strokeWidth={3} /></button>
                        </td>
                      </tr>
                      {(!part.components || part.components.length === 0) ? (
                        <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}><EmptyStateUI message="BOM'a henüz montaj parçası eklenmemiş." /></td></tr>
                      ) : (
                        part.components.map((c, idx) => (
                          <tr key={c.id || idx}>
                            <td style={TD}>{idx + 1}</td>
                            <td style={{ ...TD, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>{c.partNumber}</td>
                            <td style={TD}>{c.name}</td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#f1f5f9' }}>{c.qty}</td>
                            <td style={TD}>{c.unit || 'Adet'}</td>
                            <td style={TD}>
                              <button onClick={() => handleRemoveBOMComponent(c.id)} style={{ background: 'transparent', border: 'none', color: '#450a0a', cursor: 'pointer' }}><Trash2 size={14}/></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="summary">
                  <div style={CARD_STYLE}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>BOM Özeti</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Toplam Kalem:</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{part.components?.length || 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Kritik Parça Sayısı:</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>0</span>
                      </div>
                      <div style={{ height: 1, background: '#1e293b', margin: '4px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Tahmini Maliyet:</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>₺0,00</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ ...CARD_STYLE, opacity: 0.5 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#64748b', margin: '0 0 12px' }}>Üretim Rotaları</h4>
                    <p style={{ fontSize: 11, color: '#475569' }}>Bu montaj için tanımlanmış aktif rota bulunmamaktadır.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STOK & LOT TAKİBİ */}
        {activeTab === 'Stok' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24, maxWidth: 1600, margin: '0 auto' }}>
            <div className="main">
              <div style={CARD_STYLE}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Aktif Lot / Batch Listesi</h3>
                  <button onClick={() => setShowLotModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={14} /> Lot Girişi Yap
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH}>Lot Numarası</th>
                      <th style={TH}>Kabul Tarihi</th>
                      <th style={TH}>Kalite Durumu</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Orijinal Miktar</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Kalan Miktar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Stokta lot kaydı bulunmuyor.</td></tr>
                    ) : (
                      batches.map(b => (
                        <tr key={b.id}>
                          <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9' }}>{b.batchId}</td>
                          <td style={TD}>{formatDateOnly(b.receivedDate)}</td>
                          <td style={TD}>
                             <span style={{ 
                               fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, 
                               background: b.qcStatus === 'Sağlam' ? '#065f46' : (b.qcStatus === 'Karantina' ? '#422006' : '#450a0a'),
                               color: b.qcStatus === 'Sağlam' ? '#34d399' : (b.qcStatus === 'Karantina' ? '#fbbf24' : '#f87171')
                             }}>
                               {b.qcStatus || 'BİLİNMİYOR'}
                             </span>
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }}>{b.quantity}</td>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f1f5f9', fontSize: 14 }}>{b.remainingQty}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={CARD_STYLE}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: '0 0 20px' }}>Stok Hareket Geçmişi (Son 50)</h3>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                      <tr><th style={TH}>Tarih</th><th style={TH}>Tür</th><th style={TH}>Miktar</th><th style={TH}>Kullanıcı</th><th style={TH}>Referans</th></tr>
                    </thead>
                    <tbody>
                      {movements.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Hareket kaydı bulunmuyor.</td></tr>
                      ) : (
                        movements.map(m => (
                          <tr key={m.id}>
                            <td style={{ ...TD, fontSize: 12 }}>{formatDate(m.createdAt)}</td>
                            <td style={TD}>
                              <span style={{ 
                                fontSize: 11, fontWeight: 600, 
                                color: m.movementType?.includes('Giriş') ? '#34d399' : '#f87171' 
                              }}>{m.movementType}</span>
                            </td>
                            <td style={{ ...TD, fontWeight: 700, color: '#f1f5f9' }}>{m.movementType?.includes('Giriş') ? '+' : '-'}{m.qty}</td>
                            <td style={TD}>{m.performedBy || 'Sistem'}</td>
                            <td style={{ ...TD, fontSize: 11, color: '#64748b' }}>{m.referenceNumber || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="sidebar">
              <div style={CARD_STYLE}>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Stok Özeti</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>Fiili Stok</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>{formatNumber(part.currentStock)}</span>
                  </div>
                  <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>Rezerve</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#6366f1' }}>{formatNumber(part.reservedStock || 0)}</span>
                  </div>
                </div>
                <div style={{ marginTop: 12, background: 'rgba(52, 211, 153, 0.05)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid rgba(52, 211, 153, 0.1)' }}>
                  <span style={{ display: 'block', fontSize: 10, color: '#34d399', marginBottom: 4, textTransform: 'uppercase', fontWeight: 800 }}>Kullanılabilir Müsait Stok</span>
                  <span style={{ fontSize: 28, fontWeight: 900, color: '#34d399' }}>{formatNumber((part.currentStock || 0) - (part.reservedStock || 0))}</span>
                </div>
              </div>

              {movements.length > 0 && (
                <div style={{ ...CARD_STYLE, padding: '20px 10px' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px', paddingLeft: 10 }}>Stok Eğilimi</h4>
                  <div style={{ height: 200, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={movements.slice().reverse()}>
                        <defs><linearGradient id="colorStog" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1e293b' }} itemStyle={{ color: '#fff' }} />
                        <Area type="monotone" dataKey="qty" stroke="#3b82f6" fillOpacity={1} fill="url(#colorStog)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: KALİTE GEÇMİŞİ */}
        {activeTab === 'Kalite' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
              <div style={CARD_STYLE}>
                <span style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 4 }}>TOPLAM MUAYENE</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>{inspections.length}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ display: 'block', fontSize: 11, color: '#34d399', marginBottom: 4 }}>KABUL ORANI</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#34d399' }}>
                   {inspections.length > 0 ? `${Math.round((inspections.filter(i=>i.overallResult==='Kabul').length / inspections.length) * 100)}%` : '-%'}
                </span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ display: 'block', fontSize: 11, color: '#f87171', marginBottom: 4 }}>RET EDİLEN</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>{inspections.filter(i=>i.overallResult==='Red').length}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>SON SONUÇ</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {inspections[0]?.overallResult === 'Kabul' ? <CheckCircle2 size={18} color="#34d399"/> : <XCircle size={18} color="#f87171"/>}
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{inspections[0]?.overallResult || '—'}</span>
                </div>
              </div>
            </div>

            <div style={CARD_STYLE}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: '0 0 20px' }}>Detaylı Muayene Kayıtları</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>QC No</th>
                    <th style={TH}>Tarih</th>
                    <th style={TH}>Tür</th>
                    <th style={TH}>Lot No</th>
                    <th style={TH}>Müfettiş</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Sonuç</th>
                  </tr>
                </thead>
                <tbody>
                   {inspections.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' }}><EmptyStateUI message="Bu parça için muayene kaydı bulunmuyor." /></td></tr>
                   ) : (
                     inspections.map(i => (
                       <tr key={i.id}>
                         <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9' }}>{i.inspectionNo || i.id.slice(0,8).toUpperCase()}</td>
                         <td style={TD}>{formatDateOnly(i.inspectionDate || i.createdAt)}</td>
                         <td style={TD}>{i.inspectionType}</td>
                         <td style={{ ...TD, fontFamily: 'monospace' }}>{i.lotNumber || '—'}</td>
                         <td style={TD}>{i.inspectorName}</td>
                         <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{ 
                               fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                               background: i.overallResult === 'Kabul' ? '#065f46' : '#450a0a',
                               color: i.overallResult === 'Kabul' ? '#34d399' : '#f87171'
                            }}>{i.overallResult}</span>
                         </td>
                       </tr>
                     ))
                   )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: TEKNİK RESİMLER */}
        {activeTab === 'TeknikResim' && (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
               {docs.length === 0 ? (
                 <div style={{ gridColumn: '1/-1' }}><EmptyState message="Bu parça için yüklenmiş teknik döküman bulunamadı." /></div>
               ) : (
                 docs.map(doc => {
                   const isCurrent = doc.revision === part.revision;
                   return (
                     <div key={doc.id} style={{ ...CARD_STYLE, position: 'relative', overflow: 'hidden', padding: 0 }}>
                       {!isCurrent && <div style={{ position: 'absolute', top: 10, right: -25, background: '#1e293b', color: '#64748b', fontSize: 9, fontWeight: 800, padding: '4px 30px', transform: 'rotate(45deg)' }}>OBSOLETE</div>}
                       <div style={{ padding: 16 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <FileText size={32} color={isCurrent ? '#3b82f6' : '#475569'} />
                            <span style={{ fontSize: 10, fontWeight: 800, color: isCurrent ? '#3b82f6' : '#475569' }}>REV {doc.revision}</span>
                         </div>
                         <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '16px 0 4px' }}>{doc.title}</h4>
                         <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{doc.docNumber}</p>
                         <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                           <button style={{ flex: 1, height: 32, background: '#1e1b4b', border: 'none', borderRadius: 6, color: '#818cf8', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Download size={12}/> İndir</button>
                           <button style={{ flex: 1, height: 32, background: 'transparent', border: '1px solid #1e293b', borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Görüntüle</button>
                         </div>
                       </div>
                       <div style={{ background: '#111827', padding: '8px 16px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, color: '#475569' }}>Onaylayan: {doc.approvedBy || '—'}</span>
                          <span style={{ fontSize: 9, color: '#475569' }}>{formatDateOnly(doc.approvedAt)}</span>
                       </div>
                     </div>
                   );
                 })
               )}
               {canEditGenel && (
                 <div onClick={() => setShowDocumentModal(true)} style={{ ...CARD_STYLE, borderStyle: 'dashed', borderDashArray: '4', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                   <div style={{ textAlign: 'center' }}>
                     <Plus size={24} color="#334155" style={{ margin: '0 auto 8px' }} />
                     <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569' }}>Yeni Döküman Yükle</span>
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* TAB 6: TEDARİK */}
        {activeTab === 'Tedarik' && (
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24 }}>
              <div className="main">
                <div style={CARD_STYLE}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                     <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Onaylı Tedarikçi Listesi (AVL)</h3>
                     {canEdit && (
                       <button onClick={() => setShowSupplierModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                         <Plus size={14} /> Tedarikçi Ekle
                       </button>
                     )}
                   </div>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                     <thead>
                       <tr>
                         <th style={TH}>Tedarikçi</th>
                         <th style={TH}>Tedarikçi Kodu</th>
                         <th style={{ ...TH, textAlign: 'right' }}>Birim Fiyat</th>
                         <th style={TH}>Termin (Gün)</th>
                         <th style={TH}>Öncelik</th>
                       </tr>
                     </thead>
                     <tbody>
                       {suppliers.length === 0 ? (
                         <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}><EmptyStateUI message="Bu parça için tedarikçi tanımı bulunmuyor." /></td></tr>
                       ) : (
                         suppliers.map(s => (
                           <tr key={s.id}>
                             <td style={{ ...TD, fontWeight: 700, color: '#f1f5f9' }}>{s.supplierName}</td>
                             <td style={{ ...TD, fontFamily: 'monospace' }}>{s.supplierPartCode || '—'}</td>
                             <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>{formatCurrency(s.unitPrice, s.currency)}</td>
                             <td style={TD}>{s.leadTimeDays || '—'}</td>
                             <td style={TD}>
                               {s.isPreferred ? <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: '#065f46', color: '#34d399' }}>ANA TEDARİKÇİ</span> : <span style={{ fontSize: 10, color: '#64748b' }}>ALTERNATİF</span>}
                             </td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                </div>

                <div style={CARD_STYLE}>
                   <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: '0 0 20px' }}>Satınalma Fiyat Geçmişi</h3>
                   <div style={{ height: 300, width: '100%' }}>
                     {priceHistory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={priceHistory.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="purchaseDate" tickFormatter={d => formatDateOnly(d)} stroke="#475569" fontSize={10} />
                            <YAxis stroke="#475569" fontSize={10} />
                            <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1e293b' }} itemStyle={{ color: '#fff' }} />
                            <Line type="monotone" dataKey="unitPrice" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626' }} />
                          </LineChart>
                        </ResponsiveContainer>
                     ) : (
                       <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #1e293b', borderRadius: 8, color: '#475569', fontSize: 13 }}>Fiili satın alma verisi bulunmuyor.</div>
                     )}
                   </div>
                </div>
             </div>

             <div className="summary">
                <div style={CARD_STYLE}>
                   <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Maliyet Analizi</h4>
                   <div style={{ background: '#0a0f1e', padding: 20, borderRadius: 8, textAlign: 'center', border: '1px solid #1e293b' }}>
                      <span style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', fontWeight: 800 }}>Son Alım Fiyatı</span>
                      <span style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9' }}>{formatCurrency(part.lastPurchasePrice, part.lastPurchaseCurrency)}</span>
                   </div>
                   <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                         <span style={{ color: '#64748b' }}>Standart Maliyet:</span>
                         <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{formatCurrency(part.standardCost || 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                         <span style={{ color: '#64748b' }}>Varyans:</span>
                         <span style={{ fontWeight: 700, color: '#f87171' }}>0.00%</span>
                      </div>
                   </div>
                </div>
                
                <div style={CARD_STYLE}>
                   <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 12px' }}>Açık Siparişler (PO)</h4>
                   <p style={{ fontSize: 11, color: '#475569' }}>Bu parça için beklenen sevkiyat bulunmuyor.</p>
                </div>
             </div>
          </div>
        )}

      </div>

      {/* LOT ENTRY MODAL */}
      <Modal isOpen={showLotModal} onClose={() => setShowLotModal(false)} title="Yeni Lot Girişi Yap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Lot Numarası</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                style={{ ...INPUT_STYLE, flex: 1, fontFamily: 'monospace' }} 
                value={lotForm.lotNumber} 
                onChange={e => setLotForm({ ...lotForm, lotNumber: e.target.value })} 
                placeholder="Örn: LOT-2026-04-001"
              />
              <button 
                 onClick={autoGenLot}
                 disabled={isGeneratingLot}
                 style={{ padding: '0 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                 {isGeneratingLot ? '...' : 'OTO ÜRET'}
              </button>
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Miktar ({part?.unit || 'Adet'})</label>
            <input type="number" style={INPUT_STYLE} value={lotForm.quantity} onChange={e => setLotForm({ ...lotForm, quantity: e.target.value })} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Depo Lokasyonu</label>
            <input style={INPUT_STYLE} value={lotForm.warehouseLocation} onChange={e => setLotForm({ ...lotForm, warehouseLocation: e.target.value })} placeholder="Örn: A-12-04" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <button onClick={() => setShowLotModal(false)} style={{ height: 38, padding: '0 16px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
            <button onClick={handleAddBatch} style={{ height: 38, padding: '0 24px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Stok Girişi Yap</button>
          </div>
        </div>
      </Modal>

      {/* SUPPLIER MODAL */}
      <Modal isOpen={showSupplierModal} onClose={() => setShowSupplierModal(false)} title="AVL'ye Tedarikçi Ekle">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Tedarikçi Seçin</label>
            <select style={INPUT_STYLE} value={supplierForm.supplierId} onChange={e=>setSupplierForm({...supplierForm, supplierId: e.target.value})}>
              <option value="">Seçiniz...</option>
              {allSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Birim Fiyat</label>
              <input type="number" style={INPUT_STYLE} value={supplierForm.unitPrice} onChange={e=>setSupplierForm({...supplierForm, unitPrice: e.target.value})} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Para Birimi</label>
              <select style={INPUT_STYLE} value={supplierForm.currency} onChange={e=>setSupplierForm({...supplierForm, currency: e.target.value})}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Teslim Süresi (Gün)</label>
            <input type="number" style={INPUT_STYLE} value={supplierForm.leadTimeDays} onChange={e=>setSupplierForm({...supplierForm, leadTimeDays: e.target.value})} />
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={() => setShowSupplierModal(false)} style={{ background: 'transparent', color: '#f1f5f9', border: '1px solid #1e293b', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>İptal</button>
            <button onClick={handleAddSupplierToAVL} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </Modal>

      {/* DOCUMENT MODAL */}
      <Modal isOpen={showDocumentModal} onClose={() => setShowDocumentModal(false)} title="Yeni Teknik Döküman / Resim Yükle">
        <form onSubmit={handleAddDocument} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Döküman Adı / Tanımı</label>
            <input name="title" style={INPUT_STYLE} placeholder="Örn: Gövde Teknik Resmi" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Döküman No</label>
              <input name="docNumber" style={INPUT_STYLE} placeholder="Örn: TR-100-001" required />
            </div>
            <div>
              <label style={LABEL_STYLE}>Revizyon</label>
              <input name="revision" style={INPUT_STYLE} defaultValue={part.revision || 'A'} />
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Dosya Seç (PDF/DWG/JPG)</label>
            <div style={{ border: '2px dashed #1e293b', borderRadius: 8, padding: '20px', textAlign: 'center', background: '#0a0f1e' }}>
              <input type="file" style={{ display: 'none' }} id="fileDetail" />
              <label htmlFor="fileDetail" style={{ cursor: 'pointer' }}>
                <CloudUpload size={32} color="#3b82f6" style={{ margin: '0 auto 8px' }} />
                <span style={{ display: 'block', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>Tıklayın veya Sürükleyin</span>
                <span style={{ display: 'block', fontSize: 11, color: '#475569', marginTop: 4 }}>Maksimum Dosya Boyutu: 25MB</span>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setShowDocumentModal(false)} style={{ background: 'transparent', color: '#f1f5f9', border: '1px solid #1e293b', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>İptal</button>
            <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Yükle ve Kaydet</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
