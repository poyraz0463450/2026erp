import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getParts, getStockMovements, addStockMovement, updatePart, 
  addInventoryBatch, getBatchesByPart, updateInventoryBatch 
} from '../../firebase/firestore';
import { 
  MOVEMENT_TYPES, formatDate, formatNumber 
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Filter, FileDown, ArrowDownLeft, ArrowUpRight, 
  RefreshCw, Layers, Trash2, SlidersHorizontal, Package, Flame 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function StockMovements() {
  const { isAdmin, isWarehouse, userDoc } = useAuth();
  const canMove = isAdmin || isWarehouse;

  const [moves, setMoves] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ partId: '', movementType: 'Satınalmadan Giriş', qty: 1, fromLocation: '', toLocation: '', lotNumber: '', note: '', referenceNumber: '', selectedBatchId: '' });
  const [availableBatches, setAvailableBatches] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([getStockMovements(), getParts()]);
      setMoves(m.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(p.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Hata: Stok hareketleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (form.partId) {
      fetchBatches(form.partId);
    } else {
      setAvailableBatches([]);
    }
  }, [form.partId]);

  const fetchBatches = async (pid) => {
     try {
        const res = await getBatchesByPart(pid);
        const b = res.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.remainingQty > 0 && x.qcStatus !== 'Red');
        setAvailableBatches(b.sort((a, b) => new Date(a.receivedDate) - new Date(b.receivedDate)));
     } catch (e) { 
        console.error('Batch fetching error:', e); 
     }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.partId || form.qty <= 0) return toast.error('Parça ve miktar zorunludur');

    const targetPart = parts.find(p => p.id === form.partId);
    if (!targetPart) return;

    try {
      const isInput = ['Üretimden Giriş', 'Satınalmadan Giriş', 'İade', 'Sayım Düzeltme (+)', 'Sayım Düzeltme'].includes(form.movementType);
      const isOutput = ['İş Emri Çıkışı', 'Fire', 'Sayım Düzeltme (-)'].includes(form.movementType);
      
      const multiplier = isInput ? 1 : -1;
      const finalQty = Number(form.qty);
      const movementDelta = finalQty * multiplier;
      
      const newStock = Math.max(0, (targetPart.currentStock || 0) + movementDelta);

      // 1. Create Stock Movement Record
      await addStockMovement({
        ...form,
        qty: finalQty,
        performedBy: userDoc?.displayName || userDoc?.email,
        timestamp: new Date().toISOString(),
      });

      // 2. Update Part Master Stock
      await updatePart(form.partId, { currentStock: newStock });

      // 3. Batch Updates
      if (isOutput && form.selectedBatchId) {
          const batch = availableBatches.find(b => b.id === form.selectedBatchId);
          if (batch) {
             await updateInventoryBatch(batch.id, { remainingQty: Math.max(0, batch.remainingQty - finalQty) });
          }
      }

      // 4. LOT Handling for Inputs
      if (isInput && form.movementType === 'Satınalmadan Giriş') {
         const year = new Date().getFullYear();
         const lot = `LOT-${year}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;
         await addInventoryBatch({
            batchId: lot,
            partId: targetPart.id,
            partName: targetPart.name,
            partNumber: targetPart.partNumber,
            receivedDate: new Date().toISOString(),
            quantity: finalQty,
            remainingQty: finalQty,
            qcStatus: 'Karantina', // All purchases go to quarantine
            supplierName: form.note || 'Bilinmiyor',
            grnNumber: form.referenceNumber
         });
         toast.success(`Lot ${lot} oluşturuldu ve Karantina'ya alındı.`);
      }

      toast.success('Stok hareketi başarıyla işlendi');
      setModal(false);
      load();
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  const filtered = useMemo(() => {
    return moves.filter(m => {
      const target = parts.find(p => p.id === m.partId);
      const matchSearch = !search || target?.name?.toLowerCase().includes(search.toLowerCase()) || target?.partNumber?.toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || m.movementType === filterType;
      return matchSearch && matchType;
    });
  }, [moves, search, filterType, parts]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Stok Hareket Defteri</h1>
          <p style={{ color: '#475569', fontSize: 13 }}>Tüm depo giriş, çıkış ve transfer işlemlerinin resmi kaydı</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { setForm({ ...form, movementType: 'Fire' }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', background: 'transparent', border: '1px solid #fbbf24', borderRadius: 6, color: '#fbbf24', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Flame size={16} /> Fire Bildir
          </button>
          <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={18} /> Yeni Stok Hareketi
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input 
            type="text" 
            placeholder="Parça ara..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...INPUT, width: 220 }}>
          <option value="">Tüm Hareket Türleri</option>
          {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button style={{ ...INPUT, width: 'auto', padding: '0 16px', cursor: 'pointer' }}><FileDown size={16} /></button>
      </div>

      {/* TABLE */}
      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Tarih & Saat</th>
              <th style={TH}>Parça Bilgisi</th>
              <th style={TH}>Tür</th>
              <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
              <th style={TH}>Lokasyon (G/Ç)</th>
              <th style={TH}>Lot / Ref</th>
              <th style={TH}>İşlem Yapan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Hareket kaydı bulunamadı." /></td></tr>
            ) : (
              filtered.map(m => {
                const p = parts.find(x => x.id === m.partId);
                const isInput = ['Üretimden Giriş', 'Satınalmadan Giriş', 'İade', 'Sayım Düzeltme (+)', 'Sayım Düzeltme'].includes(m.movementType);
                return (
                  <tr key={m.id}>
                    <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 12 }}>{formatDate(m.timestamp || m.createdAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <div style={{ width: 6, height: 6, borderRadius: '50%', background: isInput ? '#34d399' : '#f87171' }} />
                         <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.01em', fontFamily: 'monospace' }}>{p?.partNumber || '—'}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{p?.name || 'Bilinmiyor'}</p>
                         </div>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{ 
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: isInput ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        color: isInput ? '#34d399' : '#f87171'
                      }}>{m.movementType}</span>
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: isInput ? '#34d399' : '#f87171', fontSize: 15 }}>
                      {isInput ? '+' : '-'}{formatNumber(m.qty)}
                    </td>
                    <td style={TD}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                         <span style={{ color: '#475569' }}>{m.fromLocation || '—'}</span>
                         <ArrowUpRight size={10} color="#334155" />
                         <span style={{ color: '#e2e8f0' }}>{m.toLocation || m.warehouse || 'Depo'}</span>
                       </div>
                    </td>
                    <td style={TD}>
                       <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>{m.lotNumber || '—'}</p>
                       <p style={{ margin: 0, fontSize: 10, color: '#334155' }}>{m.referenceNumber || 'REF-N/A'}</p>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1e293b', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.performedBy?.[0]?.toUpperCase()}</div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{m.performedBy}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title="Stok Hareketi Girişi" width={600}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>PARÇA SEÇİMİ</label>
              <select 
                style={INPUT} 
                value={form.partId} 
                onChange={e => setForm({ ...form, partId: e.target.value })}
                required
              >
                <option value="">Seçin...</option>
                {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name} (Stok: {p.currentStock})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>HAREKET TÜRÜ</label>
              <select 
                style={INPUT} 
                value={form.movementType} 
                onChange={e => setForm({ ...form, movementType: e.target.value })}
              >
                {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MİKTAR</label>
              <input 
                type="number" 
                style={INPUT} 
                value={form.qty} 
                onChange={e => setForm({ ...form, qty: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>ÇIKIŞ LOKASYONU</label>
              <input style={INPUT} value={form.fromLocation} onChange={e => setForm({ ...form, fromLocation: e.target.value })} placeholder="Opsiyonel" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>VARIŞ LOKASYONU</label>
              <input style={INPUT} value={form.toLocation} onChange={e => setForm({ ...form, toLocation: e.target.value })} placeholder="A-12-B" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>REFERANS NO</label>
              <input style={INPUT} value={form.referenceNumber} onChange={e => setForm({ ...form, referenceNumber: e.target.value })} placeholder="WO-001 / PO-001" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>LOT SEÇİMİ (FIFO)</label>
              <select 
                style={{ ...INPUT, border: form.selectedBatchId === availableBatches[0]?.id ? '1px solid #34d399' : '1px solid #334155' }} 
                value={form.selectedBatchId} 
                onChange={e => {
                  const b = availableBatches.find(x => x.id === e.target.value);
                  setForm({ ...form, selectedBatchId: e.target.value, lotNumber: b?.batchId || '' });
                }}
              >
                <option value="">İsteğe bağlı seçim...</option>
                {availableBatches.map((b, i) => (
                  <option key={b.id} value={b.id}>
                    {i === 0 ? '⭐ [EN ESKİ] ' : ''}{b.batchId} ({b.remainingQty} {parts.find(p=>p.id===form.partId)?.unit || 'Adet'}) - {formatDate(b.receivedDate)}
                  </option>
                ))}
              </select>
              {availableBatches.length > 0 && (
                <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                   Savunma sanayii gereği en eski lotu kullanmanız önerilir.
                </p>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MANUEL LOT / SERİ</label>
              <input style={INPUT} value={form.lotNumber} onChange={e => setForm({ ...form, lotNumber: e.target.value })} placeholder="Otomatik dolacaktır" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>NOTLAR</label>
            <textarea 
              style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} 
              value={form.note} 
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
             <button type="button" onClick={() => setModal(false)} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
             <button type="submit" style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Hareketi İşle</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
