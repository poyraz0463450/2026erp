import { useEffect, useState } from 'react';
import StatusBadge from '../../components/ui/StatusBadge';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getGoodsReceipts, updateGoodsReceipt, getPurchaseOrders, updatePurchaseOrder, addInventoryBatch, getParts, updatePart, getInventoryBatches } from '../../firebase/firestore';
import { formatNumber, formatDate, GRN_STATUSES } from '../../utils/helpers';
import { Search, ChevronLeft, Save, ShieldAlert, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

export default function GoodsReceipts() {
  const { userDoc, isSatinAlma, isAdmin, isWarehouse } = useAuth();
  const canEdit = isSatinAlma || isAdmin || isWarehouse;
  
  const [receipts, setReceipts] = useState([]);
  const [pos, setPos] = useState([]);
  const [parts, setParts] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [currentGr, setCurrentGr] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { load(); }, [view]);

  const load = async () => {
    try {
      const [g, o, p, b] = await Promise.all([getGoodsReceipts(), getPurchaseOrders(), getParts(), getInventoryBatches()]);
      setReceipts(g.docs.map(d => ({ id: d.id, ...d.data() })));
      setPos(o.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(p.docs.map(d => ({ id: d.id, ...d.data() })));
      setAllBatches(b.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const openDetail = (gr) => {
    setCurrentGr(JSON.parse(JSON.stringify(gr)));
    setView('detail');
  };

  const updateItem = (itemIdx, field, value) => {
    const updated = { ...currentGr };
    updated.items[itemIdx][field] = value;
    setCurrentGr(updated);
  };

  const getNextBatchId = () => {
    const year = new Date().getFullYear();
    const nums = allBatches.map(b => { const m = (b.batchId||'').match(/LOT-\d{4}-(\d+)/); return m ? parseInt(m[1],10):0; });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setAllBatches(prev => [...prev, { batchId: `LOT-${year}-${String(next).padStart(4, '0')}` }]); // optimistically push block to avoid duplicate during loop
    return `LOT-${year}-${String(next).padStart(4, '0')}`;
  };

  const submitGRN = async () => {
    if (!canEdit) return;
    if (!confirm('Mal Kabul fişi kaydedilecek ve stoklara işlenecek. Onaylıyor musunuz?')) return;
    
    setLoading(true);
    let anyQcReq = false;
    let anyRejected = false;
    let anyDelivered = false;

    // Process PO
    const linkedPO = pos.find(o => o.id === currentGr.poId);
    let poUpdated = false;

    for (const it of currentGr.items) {
      const recv = Number(it.receivedQty) || 0;
      const rej = Number(it.rejectedQty) || 0;
      
      if (recv > 0) {
        anyDelivered = true;
        const batchId = getNextBatchId();
        it.lotNumber = batchId;
        const stockStatus = it.qcRequired ? 'Karantina' : 'Sağlam';
        if (it.qcRequired) anyQcReq = true;
        
        // Create LOT
        await addInventoryBatch({
          batchId, partId: it.partId, partNumber: it.partNumber,
          quantity: recv, remainingQty: recv,
          receivedDate: new Date().toISOString(),
          grnId: currentGr.id, grnNumber: currentGr.grnNumber,
          supplierId: currentGr.supplierId, supplierName: currentGr.supplierName,
          qcStatus: stockStatus,
          warehouseLocation: it.warehouseLocation || ''
        });

        // Update Part Stock
        const targetPart = parts.find(p => p.id === it.partId);
        if (targetPart) {
          const newStock = (targetPart.currentStock || 0) + recv;
          // If a part becomes quarantine, its aggregate status should maybe flag, but here we just increment raw stock
          await updatePart(it.partId, { currentStock: newStock });
        }
      }
      
      if (rej > 0) anyRejected = true;

      // Update PO Delivered Qty
      if (linkedPO) {
        const poItem = linkedPO.items.find(pi => pi.partId === it.partId);
        if (poItem) {
          poItem.deliveredQty = (poItem.deliveredQty || 0) + recv;
          poItem.remainingQty = poItem.qty - poItem.deliveredQty;
          poUpdated = true;
        }
      }
    }

    let finalGrnStatus = 'Stoka Alındı';
    if (anyQcReq) finalGrnStatus = 'QC Bekliyor';
    if (anyRejected && !anyDelivered) finalGrnStatus = 'Kısmi Red';

    currentGr.status = finalGrnStatus;
    await updateGoodsReceipt(currentGr.id, currentGr);

    if (linkedPO && poUpdated) {
      let isFullyDelivered = true;
      linkedPO.items.forEach(pi => {
        if (pi.remainingQty > 0) isFullyDelivered = false;
      });
      linkedPO.status = isFullyDelivered ? 'Teslim Edildi' : 'Kısmi Teslim';
      await updatePurchaseOrder(linkedPO.id, linkedPO);
    }

    alert('Mal Kabul işlemi başarılı. Stoklar güncellendi.');
    setView('list');
    load();
  };

  const filtered = receipts.filter(r => {
    const s = search.toLowerCase();
    return (!search || r.grnNumber?.toLowerCase().includes(s) || r.poNumber?.toLowerCase().includes(s) || r.supplierName?.toLowerCase().includes(s)) &&
           (!filterStatus || r.status === filterStatus);
  });

  if (loading) return <Spinner />;

  if (view === 'detail' && currentGr) {
    const isLocked = currentGr.status !== 'Kaydedildi';

    return (
      <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: '#1e293b', border: 'none', borderRadius: '50%', color: '#f1f5f9', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>{currentGr.grnNumber}</h2>
                <StatusBadge status={currentGr.status} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#eab308' }}>Tedarikçi: {currentGr.supplierName} | Sipariş: {currentGr.poNumber}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            {currentGr.status === 'Kaydedildi' && canEdit && (
              <button onClick={submitGRN} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Save size={15} /> İşlemi Tamamla & Stoklara İşle
              </button>
            )}
            {isLocked && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 13, fontWeight: 600, padding: '0 16px', border: '1px solid #14532d', borderRadius: 6, background: '#052e16' }}>
                <CheckCircle size={15} /> İşlem Tamamlandı
              </span>
            )}
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Fiş Kalemleri (Kalite Kontrol & Kabul)</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <div><label style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Kabul Yapan:</label><span style={{ fontSize: 13, color: '#e2e8f0', fontWeight:600 }}>{currentGr.receivedBy}</span></div>
              <div><label style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Tarih:</label><span style={{ fontSize: 13, color: '#e2e8f0', fontWeight:600 }}>{formatDate(currentGr.receivedDate)}</span></div>
              <div><label style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Fatura No (Ops.):</label><input style={{...INPUT, height: 28, width: 120}} value={currentGr.invoiceNo||''} onChange={e=>setCurrentGr({...currentGr, invoiceNo: e.target.value})} disabled={isLocked || !canEdit}/></div>
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}><tr>
                <th style={TH}>Kalem</th><th style={{...TH, textAlign: 'center'}}>Sipariş Mik.</th><th style={{...TH, textAlign: 'center', color: '#4ade80'}}>Kabul Mik.</th><th style={{...TH, textAlign: 'center', color: '#f87171'}}>Ret Mik.</th>
                <th style={TH}>Müstakbel Lokasyon</th><th style={{...TH, textAlign: 'center'}}>Zorunlu QC</th><th style={TH}>Oluşan LOT</th>
              </tr></thead>
              <tbody>
                {currentGr.items?.map((it, idx) => (
                  <tr key={idx} style={{ background: it.qcRequired ? 'rgba(234,179,8,0.05)' : 'transparent' }}>
                    <td style={TD}>
                      <p style={{ fontWeight: 600, margin: '0 0 2px' }}>{it.partName}</p>
                      <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', margin: 0 }}>{it.partNumber}</p>
                    </td>
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{it.orderedQty} <span style={{fontSize: 10, color:'#64748b'}}>{it.unit}</span></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="number" min="0" style={{...INPUT, width: 80, padding: '0 8px', textAlign: 'center', borderColor: '#14532d'}} value={it.receivedQty} onChange={e=>updateItem(idx,'receivedQty',e.target.value)} disabled={isLocked || !canEdit} />
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="number" min="0" style={{...INPUT, width: 80, padding: '0 8px', textAlign: 'center', borderColor: '#450a0a'}} value={it.rejectedQty} onChange={e=>updateItem(idx,'rejectedQty',e.target.value)} disabled={isLocked || !canEdit} />
                      </div>
                    </td>
                    <td style={TD}>
                      <input type="text" style={{...INPUT, width: 120}} placeholder="A-1-Raf" value={it.warehouseLocation||''} onChange={e=>updateItem(idx,'warehouseLocation',e.target.value)} disabled={isLocked || !canEdit} />
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: (isLocked||!canEdit)?'default':'pointer' }}>
                        <input type="checkbox" checked={it.qcRequired} onChange={e=>updateItem(idx,'qcRequired',e.target.checked)} disabled={isLocked || !canEdit} />
                        {it.qcRequired && <ShieldAlert size={14} color="#eab308" />}
                      </label>
                    </td>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: '#38bdf8' }}>{it.lotNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #1e293b' }}>
            <label style={{ fontSize: 11, color: '#64748b' }}>Genel Notlar</label>
            <textarea rows={2} style={{ ...INPUT, height: 'auto', padding: 8, resize: 'none', marginTop: 4 }} value={currentGr.notes||''} onChange={e=>setCurrentGr({...currentGr, notes: e.target.value})} disabled={isLocked || !canEdit} />
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} strokeWidth={1.7} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input type="text" placeholder="Ara (MAL No, SİP No, Tedarikçi)..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...INPUT, paddingLeft: 32, width: 260 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...INPUT, width: 160, cursor: 'pointer' }}>
          <option value="">Tüm Durumlar</option>
          {GRN_STATUSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#475569' }}>{filtered.length} mal kabul fişi</span>
      </div>

      {filtered.length === 0 ? <EmptyState message="Mal kabul işlemi bulunamadı." /> : (
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>MAL No</th><th style={TH}>Sipariş No</th><th style={TH}>Tedarikçi</th><th style={TH}>Tarih</th><th style={TH}>Kabul Yapan</th><th style={TH}>Durum</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => openDetail(r)} style={{ cursor: 'pointer' }} onMouseEnter={e=>{e.currentTarget.style.background='#111827'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{r.grnNumber}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>{r.poNumber}</td>
                  <td style={{ ...TD, fontWeight: 500 }}>{r.supplierName}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{formatDate(r.receivedDate)}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{r.receivedBy}</td>
                  <td style={TD}><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
