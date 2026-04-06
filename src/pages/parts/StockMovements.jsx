import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileDown, Flame, Plus, Search } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import {
  addInventoryBatch,
  addStockMovement,
  getBatchesByPart,
  getParts,
  getStockMovements,
  updateInventoryBatch,
  updatePart,
} from '../../firebase/firestore';
import { generateLotNumber } from '../../utils/autoGen';
import { MOVEMENT_TYPES, formatDate, formatNumber } from '../../utils/helpers';

const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };

const isInputMovement = (movementType) => ['Üretim Girişi', 'Satınalma Girişi', 'İade', 'Sayım Düzeltme'].includes(movementType);
const isOutputMovement = (movementType) => ['İş Emri Çıkışı', 'Fire'].includes(movementType);

const createInitialForm = () => ({
  partId: '',
  movementType: 'Satınalma Girişi',
  qty: 1,
  fromLocation: '',
  toLocation: '',
  lotNumber: '',
  note: '',
  referenceNumber: '',
  selectedBatchId: '',
});

export default function StockMovements() {
  const { isAdmin, isWarehouse, userDoc } = useAuth();
  const canMove = isAdmin || isWarehouse;

  const [moves, setMoves] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(createInitialForm());
  const [availableBatches, setAvailableBatches] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!form.partId) {
      setAvailableBatches([]);
      return;
    }
    fetchBatches(form.partId);
  }, [form.partId]);

  useEffect(() => {
    if (!modal || !isInputMovement(form.movementType) || form.movementType !== 'Satınalma Girişi') return;
    if (form.lotNumber) return;

    generateLotNumber()
      .then((lotNumber) => setForm((prev) => ({ ...prev, lotNumber })))
      .catch(() => {});
  }, [form.movementType, modal, form.lotNumber]);

  const load = async () => {
    setLoading(true);
    try {
      const [movementSnap, partSnap] = await Promise.all([getStockMovements(), getParts()]);
      setMoves(movementSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setParts(partSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Stok hareketleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (partId) => {
    try {
      const snapshot = await getBatchesByPart(partId);
      const rows = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((batch) => Number(batch.remainingQty || 0) > 0)
        .filter((batch) => ['Sağlam', 'Kabul', 'Released', undefined, ''].includes(batch.qcStatus));
      setAvailableBatches(rows.sort((left, right) => new Date(left.receivedDate || 0) - new Date(right.receivedDate || 0)));
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setForm(createInitialForm());
    setAvailableBatches([]);
  };

  const handleOpenModal = async (movementType = 'Satınalma Girişi') => {
    const nextForm = { ...createInitialForm(), movementType };
    if (movementType === 'Satınalma Girişi') {
      try {
        nextForm.lotNumber = await generateLotNumber();
      } catch {
        nextForm.lotNumber = '';
      }
    }
    setForm(nextForm);
    setModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.partId || Number(form.qty || 0) <= 0) {
      toast.error('Parça ve miktar zorunludur');
      return;
    }

    const part = parts.find((item) => item.id === form.partId);
    if (!part) {
      toast.error('Parça bulunamadı');
      return;
    }

    const qty = Number(form.qty);
    const actor = userDoc?.full_name || userDoc?.displayName || userDoc?.email || 'Sistem';
    const input = isInputMovement(form.movementType);
    const output = isOutputMovement(form.movementType);

    try {
      if (output) {
        const batch = availableBatches.find((item) => item.id === form.selectedBatchId);
        if (!batch) {
          toast.error('Çıkış için onaylı bir lot seçiniz');
          return;
        }
        if (Number(batch.remainingQty || 0) < qty) {
          toast.error('Seçilen lotta yeterli miktar yok');
          return;
        }

        await updateInventoryBatch(batch.id, {
          remainingQty: Number(batch.remainingQty || 0) - qty,
        });
      }

      if (input && form.movementType === 'Satınalma Girişi') {
        const lotNumber = form.lotNumber || await generateLotNumber();
        await addInventoryBatch({
          batchId: lotNumber,
          lotNumber,
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.name,
          quantity: qty,
          remainingQty: qty,
          receivedDate: new Date().toISOString(),
          warehouseLocation: form.toLocation || part.warehouseLocation || 'KARANTINA-A01',
          location: form.toLocation || part.warehouseLocation || 'KARANTINA-A01',
          qcStatus: 'Karantina',
          status: 'Karantina',
          supplierName: form.note || '',
          grnNumber: form.referenceNumber || '',
          createdBy: actor,
        });
      }

      await addStockMovement({
        partId: part.id,
        partNumber: part.partNumber,
        movementType: form.movementType,
        qty,
        fromLocation: form.fromLocation || '',
        toLocation: form.toLocation || '',
        lotNumber: form.lotNumber || availableBatches.find((item) => item.id === form.selectedBatchId)?.batchId || '',
        referenceNumber: form.referenceNumber || '',
        note: form.note || '',
        performedBy: actor,
        createdAt: new Date().toISOString(),
      });

      const delta = input ? qty : output ? -qty : 0;
      await updatePart(part.id, {
        currentStock: Math.max(0, Number(part.currentStock || 0) + delta),
      });

      toast.success('Stok hareketi işlendi');
      setModal(false);
      resetForm();
      load();
    } catch (error) {
      console.error(error);
      toast.error('Stok hareketi kaydedilemedi');
    }
  };

  const filtered = useMemo(
    () =>
      moves.filter((move) => {
        const part = parts.find((item) => item.id === move.partId);
        const searchTarget = `${part?.partNumber || ''} ${part?.name || ''} ${move.referenceNumber || ''}`.toLowerCase();
        return (!search || searchTarget.includes(search.toLowerCase())) && (!filterType || move.movementType === filterType);
      }),
    [moves, parts, search, filterType]
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Stok Hareketleri</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Depo giriş, çıkış ve lot bazlı hareket kaydı</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => handleOpenModal('Fire')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', background: 'transparent', border: '1px solid #fbbf24', borderRadius: 6, color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Flame size={16} />
            Fire Bildir
          </button>
          <button onClick={() => handleOpenModal('Satınalma Girişi')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={18} />
            Yeni Hareket
          </button>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Parça, referans veya lot ile ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select style={{ ...INPUT, width: 220 }} value={filterType} onChange={(event) => setFilterType(event.target.value)}>
          <option value="">Tüm hareket türleri</option>
          {MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <button style={{ ...INPUT, width: 'auto', padding: '0 16px', cursor: 'pointer' }}>
          <FileDown size={16} />
        </button>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Tarih</th>
              <th style={TH}>Parça</th>
              <th style={TH}>Hareket</th>
              <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
              <th style={TH}>Lokasyon</th>
              <th style={TH}>Lot / Ref</th>
              <th style={TH}>İşlem Yapan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 48 }}>
                  <EmptyState message="Hareket kaydı bulunamadı." />
                </td>
              </tr>
            ) : (
              filtered.map((move) => {
                const part = parts.find((item) => item.id === move.partId);
                const input = isInputMovement(move.movementType);
                return (
                  <tr key={move.id}>
                    <td style={{ ...TD, fontSize: 12 }}>{formatDate(move.createdAt || move.timestamp)}</td>
                    <td style={TD}>
                      <div style={{ fontWeight: 800, color: '#f8fafc' }}>{part?.partNumber || move.partNumber || '-'}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{part?.name || '-'}</div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: input ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: input ? '#34d399' : '#f87171' }}>
                        {move.movementType}
                      </span>
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 900, color: input ? '#34d399' : '#f87171' }}>{input ? '+' : '-'}{formatNumber(move.qty)}</td>
                    <td style={TD}>
                      <div style={{ fontSize: 12, color: '#cbd5e1' }}>{move.toLocation || move.location || '-'}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{move.fromLocation || '-'}</div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa' }}>{move.lotNumber || '-'}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{move.referenceNumber || '-'}</div>
                    </td>
                    <td style={TD}>{move.performedBy || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); resetForm(); }} title="Stok Hareketi" width={640}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Parça</label>
              <select style={INPUT} value={form.partId} onChange={(event) => setForm((prev) => ({ ...prev, partId: event.target.value }))} required>
                <option value="">Seçiniz...</option>
                {parts.map((part) => <option key={part.id} value={part.id}>{part.partNumber} - {part.name} (Stok: {formatNumber(part.currentStock || 0)})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Hareket Türü</label>
              <select style={INPUT} value={form.movementType} onChange={(event) => setForm((prev) => ({ ...prev, movementType: event.target.value, selectedBatchId: '', lotNumber: prev.movementType !== event.target.value && event.target.value === 'Satınalma Girişi' ? '' : prev.lotNumber }))}>
                {MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Miktar</label>
              <input type="number" min="1" style={INPUT} value={form.qty} onChange={(event) => setForm((prev) => ({ ...prev, qty: Number(event.target.value) }))} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Çıkış Lokasyonu</label>
              <input style={INPUT} value={form.fromLocation} onChange={(event) => setForm((prev) => ({ ...prev, fromLocation: event.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Varış Lokasyonu</label>
              <input style={INPUT} value={form.toLocation} onChange={(event) => setForm((prev) => ({ ...prev, toLocation: event.target.value }))} />
            </div>
            {isOutputMovement(form.movementType) ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Lot Seçimi</label>
                <select style={INPUT} value={form.selectedBatchId} onChange={(event) => {
                  const batch = availableBatches.find((item) => item.id === event.target.value);
                  setForm((prev) => ({ ...prev, selectedBatchId: event.target.value, lotNumber: batch?.batchId || batch?.lotNumber || '' }));
                }}>
                  <option value="">Onaylı lot seçiniz...</option>
                  {availableBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {(batch.batchId || batch.lotNumber)} - {formatNumber(batch.remainingQty || 0)} adet - {formatDate(batch.receivedDate)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {isInputMovement(form.movementType) ? (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Lot Numarası</label>
                <input style={INPUT} value={form.lotNumber} onChange={(event) => setForm((prev) => ({ ...prev, lotNumber: event.target.value }))} placeholder="Otomatik atanır" />
              </div>
            ) : null}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Referans</label>
              <input style={INPUT} value={form.referenceNumber} onChange={(event) => setForm((prev) => ({ ...prev, referenceNumber: event.target.value }))} placeholder="PO / WO / Sayım" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Not</label>
            <textarea style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => { setModal(false); resetForm(); }} style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" style={{ height: 38, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Hareketi İşle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
