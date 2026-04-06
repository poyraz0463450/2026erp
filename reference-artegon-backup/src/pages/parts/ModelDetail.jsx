import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModelById, getParts, updatePart, getInventoryBatches } from '../../firebase/firestore';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  ChevronLeft, Box, Layers, Play, Settings, 
  Trash2, Plus, Calculator, TrendingUp, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { formatNumber, STOCK_STATUSES } from '../../utils/helpers';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 };
const TH = { background: '#0a0f1e', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #1e293b' };
const TD = { padding: '12px 16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#05070a', border: '1px solid #1e293b', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [addPartForm, setAddPartForm] = useState({ partId: '', qty: 1 });

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const [mDoc, pDocs] = await Promise.all([getModelById(id), getParts()]);
      if (!mDoc.exists()) {
        toast.error('Model bulunamadı');
        navigate('/models');
        return;
      }
      setModel({ id: mDoc.id, ...mDoc.data() });
      setParts(pDocs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const modelParts = useMemo(() => {
    return parts.filter(p => p.usedInModels?.some(m => m.modelId === id))
      .map(p => ({
        ...p,
        usage: p.usedInModels.find(m => m.modelId === id)
      }));
  }, [parts, id]);

  const maxProduction = useMemo(() => {
    if (modelParts.length === 0) return 0;
    let bottleneck = Infinity;
    modelParts.forEach(p => {
      const perUnit = p.usage?.qtyPerUnit || 1;
      const stock = p.currentStock || 0;
      const possible = Math.floor(stock / perUnit);
      if (possible < bottleneck) bottleneck = possible;
    });
    return bottleneck === Infinity ? 0 : bottleneck;
  }, [modelParts]);

  const handleAddPart = async () => {
    if (!addPartForm.partId || !addPartForm.qty) return toast.error('Parça ve miktar zorunludur');
    try {
      const part = parts.find(p => p.id === addPartForm.partId);
      const usedInModels = part.usedInModels || [];
      if (usedInModels.some(m => m.modelId === id)) return toast.error('Bu parça zaten modelde ekli');

      const updatedUsedInModels = [...usedInModels, { 
        modelId: id, 
        modelCode: model.modelCode, 
        qtyPerUnit: Number(addPartForm.qty) 
      }];

      await updatePart(part.id, { usedInModels: updatedUsedInModels });
      toast.success('Parça modele eklendi');
      setShowAddPartModal(false);
      load();
    } catch (e) {
      toast.error('Ekleme başarısız');
    }
  };

  const handleRemovePart = async (partId) => {
    if (!confirm('Parçayı bu modelden çıkarmak istediğinize emin misiniz?')) return;
    try {
      const part = parts.find(p => p.id === partId);
      const updatedUsedInModels = part.usedInModels.filter(m => m.modelId !== id);
      await updatePart(partId, { usedInModels: updatedUsedInModels });
      toast.success('Parça modelden çıkarıldı');
      load();
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/models')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>{model.modelCode}</h1>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: model.isActive ? '#065f46' : '#1e1b4b', color: model.isActive ? '#34d399' : '#818cf8', fontSize: 11, fontWeight: 800 }}>{model.isActive ? 'AKTİF ÜRETİM' : 'PASİF'}</span>
            </div>
            <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>{model.modelName} — Ürün Ağacı ve Kapasite Analizi</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#1e293b', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Settings size={18} /> Model Ayarları
          </button>
          <button onClick={() => navigate('/work-orders/new', { state: { modelId: id, modelCode: model.modelCode } })} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
            <Play size={18} fill="currentColor" /> Üretim Emri Aç
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div className="left-col" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
             <div style={{ ...CARD_STYLE, background: 'linear-gradient(135deg, #0d1117 0%, #0a0f1e 100%)', borderTop: '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: 8 }}>
                   <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Toplam Parça (BOM)</span>
                   <Layers size={16} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9' }}>{modelParts.length} <span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Kalem</span></div>
             </div>
             <div style={{ ...CARD_STYLE, background: 'linear-gradient(135deg, #0d1117 0%, #0a0f1e 100%)', borderTop: '4px solid #34d399' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: 8 }}>
                   <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Kritik Parça</span>
                   <AlertTriangle size={16} color="#fbbf24" />
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399' }}>{modelParts.filter(p => (p.currentStock || 0) < (p.usage?.qtyPerUnit || 1) * 10).length} <span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Riskli</span></div>
             </div>
             <div style={{ ...CARD_STYLE, background: 'linear-gradient(135deg, #0d1117 0%, #0a0f1e 100%)', borderTop: '4px solid #dc2626' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: 8 }}>
                   <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Montaj Süresi (Tahmin)</span>
                   <Play size={16} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9' }}>45 <span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Dk / Birim</span></div>
             </div>
          </div>

          {/* BOM Table */}
          <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Ürün Ağacı (Bill of Materials)</h3>
              <button 
                onClick={() => setShowAddPartModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} /> Yeni Parça Ekle
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Parça No</th>
                  <th style={TH}>Parça Adı</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Birim Kullanım</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Stokta Mevcut</th>
                  <th style={TH}>Durum</th>
                  <th style={{ ...TH, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {modelParts.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' }}><EmptyState message="Bu model için henüz bir parça tanımlanmamış." /></td></tr>
                ) : (
                  modelParts.map(p => {
                    const req = p.usage?.qtyPerUnit || 1;
                    const stock = p.currentStock || 0;
                    const isDeficit = stock < req;
                    return (
                      <tr key={p.id}>
                        <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{p.partNumber}</td>
                        <td style={TD}>{p.name}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 800 }}>{req} {p.unit || 'Adet'}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 900, color: isDeficit ? '#f87171' : '#34d399' }}>{formatNumber(stock)}</td>
                        <td style={TD}>
                           <span style={{ 
                             fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                             background: isDeficit ? '#450a0a' : '#065f46',
                             color: isDeficit ? '#f87171' : '#34d399'
                           }}>{isDeficit ? 'STOK YETERSİZ' : 'TAMAM'}</span>
                        </td>
                        <td style={TD}>
                          <button onClick={() => handleRemovePart(p.id)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}>
                             <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="right-col" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
           <div style={{ ...CARD_STYLE, background: 'rgba(52, 211, 153, 0.03)', border: '1px solid rgba(52, 211, 153, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                 <Calculator size={20} color="#34d399" />
                 <h4 style={{ fontSize: 14, fontWeight: 800, color: '#34d399', margin: 0 }}>MAKSİMUM ÜRETİM</h4>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                 <span style={{ fontSize: 48, fontWeight: 900, color: '#f1f5f9' }}>{maxProduction}</span>
                 <span style={{ fontSize: 14, color: '#475569', marginLeft: 10, fontWeight: 700 }}>ADET</span>
              </div>
              <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', margin: '8px 0 0' }}>
                 Tüm parçaların stok durumuna göre şu an hemen üretilebilecek maksimum miktar.
              </p>
           </div>

           <div style={CARD_STYLE}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={14}/> Üretim Planı (Gelecek)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                       <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>WO-2026-042</span>
                       <span style={{ fontSize: 10, color: '#fbbf24' }}>Beklemede</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>150 Adet</div>
                 </div>
                 <button style={{ width: '100%', height: 32, background: 'transparent', border: '1px dashed #1e293b', borderRadius: 6, color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Daha fazla göster</button>
              </div>
           </div>

           <div style={CARD_STYLE}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={14}/> Kalite Standartları</h4>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                 <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}><CheckCircle2 size={14} color="#34d399" /> %100 Atış Testi Zorunlu</li>
                 <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}><CheckCircle2 size={14} color="#34d399" /> Final Montaj Görsel Kontrol</li>
                 <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}><CheckCircle2 size={14} color="#34d399" /> Seri No Lazer Markalama</li>
              </ul>
           </div>
        </div>
      </div>

      {/* ADD PART MODAL */}
      <Modal open={showAddPartModal} onClose={() => setShowAddPartModal(false)} title="Modele Parça Ekle">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>PARÇA SEÇİN</label>
            <select style={INPUT} value={addPartForm.partId} onChange={e => setAddPartForm({ ...addPartForm, partId: e.target.value })}>
               <option value="">Seçiniz...</option>
               {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>BİRİM TÜKETİM MİKTARI</label>
            <input type="number" style={INPUT} min="1" value={addPartForm.qty} onChange={e => setAddPartForm({ ...addPartForm, qty: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button onClick={() => setShowAddPartModal(false)} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button onClick={handleAddPart} style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
