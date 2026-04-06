import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useNavigate } from 'react-router-dom';
import { getModels, addModel, updateModel, deleteModel, getParts } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Pencil, Trash2, Box, Download, 
  ExternalLink, Crosshair, ArrowRight, ShieldCheck, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { formatNumber, STOCK_STATUSES } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function ModelsList() {
  const navigate = useNavigate();
  const { isAdmin, isEngineer, isWarehouse, role } = useAuth();
  const canEdit = isAdmin || isEngineer;
  const isReadOnly = isWarehouse || role === 'viewer';

  const [models, setModels] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ modelCode: '', modelName: '', description: '', isActive: true });
  
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([getModels(), getParts()]);
      setModels(m.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(p.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Modeller yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    try {
      if (editId) await updateModel(editId, form);
      else await addModel(form);
      toast.success(editId ? 'Model güncellendi' : 'Yeni model eklendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!confirm('Bu modeli kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    try {
      await deleteModel(id);
      toast.success('Model silindi');
      load();
    } catch (e) {
      toast.error('Silme işlemi başarısız');
    }
  };

  const getModelParts = (modelId) => {
    return parts.filter(p => p.usedInModels?.some(m => m.modelId === modelId))
      .map(p => ({
        ...p,
        usage: p.usedInModels.find(m => m.modelId === modelId)
      }));
  };

  const calcMaxProduction = (modelParts) => {
    if (!modelParts || modelParts.length === 0) return 0;
    let bottleneck = Infinity;
    modelParts.forEach(p => {
      const perUnit = p.usage?.qtyPerUnit || 1;
      const stock = p.currentStock || 0;
      const possible = Math.floor(stock / perUnit);
      if (possible < bottleneck) bottleneck = possible;
    });
    return bottleneck === Infinity ? 0 : bottleneck;
  };

  const filtered = models.filter(m => 
    !search || 
    m.modelCode?.toLowerCase().includes(search.toLowerCase()) || 
    m.modelName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Silah Modelleri</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Üretimi yapılan ana ürün grupları ve model tanımları</p>
        </div>
        {!isReadOnly && (
          <button onClick={() => { setEditId(null); setForm({ modelCode: '', modelName: '', description: '', isActive: true }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
            <Plus size={18} strokeWidth={2.5} /> Yeni Model Ekle
          </button>
        )}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input 
            type="text" 
            placeholder="Model kodu veya adı ile ara..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Model Kodu</th>
              <th style={TH}>Model Adı</th>
              <th style={TH}>Açıklama</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, textAlign: 'right' }}>Max Üretim Kapasitesi</th>
              <th style={{ ...TH, width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const mp = getModelParts(m.id);
              const maxP = calcMaxProduction(mp);
              return (
                <tr 
                  key={m.id} 
                  onClick={() => navigate(`/models/${m.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...TD, fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Crosshair size={14} color="#60a5fa" />
                      <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{m.modelCode}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, fontWeight: 600, color: '#e2e8f0' }}>{m.modelName}</td>
                  <td style={TD}>{m.description || '—'}</td>
                  <td style={TD}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                      background: m.isActive ? '#065f46' : '#1e1b4b',
                      color: m.isActive ? '#34d399' : '#818cf8'
                    }}>{m.isActive ? 'AKTİF' : 'PASİF'}</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: maxP > 5 ? '#34d399' : (maxP > 0 ? '#fbbf24' : '#f87171') }}>{maxP} Adet</span>
                      <span style={{ fontSize: 10, color: '#475569' }}>Stoktaki ham/yarı mamul ile</span>
                    </div>
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/models/${m.id}`); }}
                        style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#60a5fa', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <ExternalLink size={12} /> Gör
                      </button>
                      {!isReadOnly && (
                        <button onClick={(e) => { e.stopPropagation(); setEditId(m.id); setForm(m); setModal(true); }} style={{ height: 32, width: 32, borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} style={{ height: 32, width: 32, borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#450a0a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>



      {/* EDIT MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Modeli Düzenle' : 'Yeni Silah Modeli Tanımla'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MODEL KODU</label><input style={INPUT} value={form.modelCode} onChange={e => setForm({ ...form, modelCode: e.target.value })} required placeholder="Örn: AR-15-X" /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MODEL ADI</label><input style={INPUT} value={form.modelName} onChange={e => setForm({ ...form, modelName: e.target.value })} required /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>AÇIKLAMA</label><textarea style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Aktif Üretim Modeli</label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
