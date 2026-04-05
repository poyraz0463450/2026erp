import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Crosshair, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import { addModel, deleteModel, getModels, getParts, updateModel } from '../../firebase/firestore';
import { formatNumber } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 56, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 40, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const CARD = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 18 };

export default function ModelsList() {
  const navigate = useNavigate();
  const { isAdmin, isEngineer, role } = useAuth();
  const canEdit = isAdmin || isEngineer;
  const isReadOnly = role === 'warehouse' || role === 'viewer';

  const [models, setModels] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ modelCode: '', modelName: '', description: '', isActive: true });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [modelSnap, partSnap] = await Promise.all([getModels(), getParts()]);
      setModels(modelSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setParts(partSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Modeller yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const modelParts = (modelId) =>
    parts
      .filter((part) => part.usedInModels?.some((item) => item.modelId === modelId))
      .map((part) => ({ ...part, usage: part.usedInModels.find((item) => item.modelId === modelId) }));

  const maxProduction = (rows) => {
    if (!rows.length) return 0;
    let bottleneck = Infinity;
    rows.forEach((row) => {
      const perUnit = row.usage?.qtyPerUnit || 1;
      const stock = row.currentStock || 0;
      bottleneck = Math.min(bottleneck, Math.floor(stock / perUnit));
    });
    return bottleneck === Infinity ? 0 : bottleneck;
  };

  const filtered = useMemo(
    () =>
      models.filter(
        (model) =>
          !search ||
          model.modelCode?.toLowerCase().includes(search.toLowerCase()) ||
          model.modelName?.toLowerCase().includes(search.toLowerCase())
      ),
    [models, search]
  );

  const commonPartCount = parts.filter((part) => (part.usedInModels?.length || 0) > 1).length;

  const openCreateModal = () => {
    setEditId(null);
    setForm({ modelCode: '', modelName: '', description: '', isActive: true });
    setModal(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (isReadOnly) return;
    try {
      if (editId) await updateModel(editId, form);
      else await addModel(form);
      toast.success(editId ? 'Model güncellendi' : 'Yeni model eklendi');
      setModal(false);
      load();
    } catch (error) {
      console.error(error);
      toast.error('Model kaydedilemedi');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!confirm('Bu modeli silmek istediğinizden emin misiniz?')) return;
    try {
      await deleteModel(id);
      toast.success('Model silindi');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Model silinemedi');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Modeller</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Ürün aileleri, BOM yapıları ve ortak parça kullanımları</p>
        </div>
        {canEdit && (
          <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
            <Plus size={18} strokeWidth={2.5} />
            Yeni Model Ekle
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', fontWeight: 800 }}>Toplam Model</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{models.length}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', fontWeight: 800 }}>Toplam Parça Bağı</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#60a5fa' }}>{parts.reduce((sum, part) => sum + (part.usedInModels?.length || 0), 0)}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', fontWeight: 800 }}>Ortak Parça</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399' }}>{commonPartCount}</div>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input type="text" placeholder="Model kodu veya adı ile ara..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT, paddingLeft: 36 }} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Model Kodu</th>
              <th style={TH}>Model Adı</th>
              <th style={{ ...TH, textAlign: 'right' }}>BOM Kalemi</th>
              <th style={{ ...TH, textAlign: 'right' }}>Ortak Parça</th>
              <th style={{ ...TH, textAlign: 'right' }}>Maks. Üretim</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 132 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 48 }}>
                  <EmptyState message={search ? 'Arama kriterine uygun model bulunamadı.' : 'Henüz model tanımı yok.'} />
                  {canEdit && !search && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={16} />
                        İlk Modeli Ekle
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((model) => {
                const rows = modelParts(model.id);
                const sharedCount = rows.filter((row) => (row.usedInModels?.length || 0) > 1).length;
                const capacity = maxProduction(rows);
                return (
                  <tr
                    key={model.id}
                    onClick={() => navigate(`/models/${model.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...TD, fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Crosshair size={14} color="#60a5fa" />
                        <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{model.modelCode}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, fontWeight: 700, color: '#e2e8f0' }}>{model.modelName}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>{formatNumber(rows.length)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{formatNumber(sharedCount)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: capacity > 5 ? '#34d399' : capacity > 0 ? '#fbbf24' : '#f87171' }}>{capacity} Adet</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>Anlık stok kapasitesi</span>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: model.isActive ? '#065f46' : '#1e1b4b', color: model.isActive ? '#34d399' : '#818cf8' }}>
                        {model.isActive ? 'AKTİF' : 'PASİF'}
                      </span>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/models/${model.id}`); }} style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#60a5fa', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={12} />
                          Gör
                        </button>
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); setEditId(model.id); setForm(model); setModal(true); }} style={{ height: 32, width: 32, borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }} style={{ height: 32, width: 32, borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#7f1d1d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Modeli Düzenle' : 'Yeni Model Tanımla'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MODEL KODU</label>
            <input style={INPUT} value={form.modelCode || ''} onChange={(e) => setForm({ ...form, modelCode: e.target.value })} required placeholder="Örn: ART-9-G2" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MODEL ADI</label>
            <input style={INPUT} value={form.modelName || ''} onChange={(e) => setForm({ ...form, modelName: e.target.value })} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>AÇIKLAMA</label>
            <textarea style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Aktif üretim modeli
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <button type="button" onClick={() => setModal(false)} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

