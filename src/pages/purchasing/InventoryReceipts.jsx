import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import {
  addGoodsReceipt,
  addInventoryBatch,
  addStockMovement,
  getDocuments,
  getParts,
  getPurchaseOrders,
  updatePart,
  updatePurchaseOrder,
} from '../../firebase/firestore';
import { generateLotNumber } from '../../utils/autoGen';
import { formatDate } from '../../utils/helpers';
import {
  ChevronLeft,
  Hash,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const LABEL = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

const buildReceiptNumber = () => `GRN-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
const previewLot = (index) => {
  const now = new Date();
  return `LOT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`;
};

export default function InventoryReceipts() {
  const { userDoc, isAdmin, isSatinAlma, isWarehouse } = useAuth();
  const canOperate = isAdmin || isSatinAlma || isWarehouse;

  const [orders, setOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [form, setForm] = useState({
    receiptNo: '',
    poId: '',
    poNumber: '',
    supplierId: '',
    supplierName: '',
    waybillNo: '',
    waybillDate: new Date().toISOString().split('T')[0],
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [orderSnap, partSnap, docSnap] = await Promise.all([getPurchaseOrders(), getParts(), getDocuments()]);
      setOrders(
        orderSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((order) => ['Gönderildi', 'Kısmi Teslim', 'Sent', 'Partial'].includes(order.status))
      );
      setParts(partSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setDocs(docSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Mal kabul verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const selectPurchaseOrder = (order) => {
    const items = (order.items || []).map((item, index) => {
      const part = parts.find((row) => row.id === item.partId);
      const remainingQty = Number(item.remainingQty ?? item.qty ?? 0);

      return {
        ...item,
        receivedQty: remainingQty,
        location: part?.warehouseLocation || 'KARANTINA-A01',
        lotNumber: previewLot(index),
        qcStatus: 'Karantina',
      };
    });

    setForm({
      receiptNo: buildReceiptNumber(),
      poId: order.id,
      poNumber: order.poNumber,
      supplierId: order.supplierId || '',
      supplierName: order.supplierName || '',
      waybillNo: '',
      waybillDate: new Date().toISOString().split('T')[0],
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
      items,
    });
    setView('new');
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: field === 'receivedQty' ? Number(value) : value };
      return { ...prev, items };
    });
  };

  const handleProcess = async () => {
    if (!canOperate) return;

    const sourceOrder = orders.find((order) => order.id === form.poId);
    if (!sourceOrder) {
      toast.error('Bağlı satın alma siparişi bulunamadı');
      return;
    }

    const validItems = form.items.filter((item) => Number(item.receivedQty || 0) > 0);
    if (!validItems.length) {
      toast.error('En az bir kalem için gelen miktar giriniz');
      return;
    }

    try {
      const actorName = userDoc?.full_name || userDoc?.displayName || userDoc?.email || 'Sistem';
      const processedItems = [];
      const nextPoItems = (sourceOrder.items || []).map((item) => ({ ...item }));

      for (const item of validItems) {
        const orderLine = nextPoItems.find((row) => row.partId === item.partId);
        const allowedQty = Number(orderLine?.remainingQty ?? orderLine?.qty ?? 0);
        const receivedQty = Number(item.receivedQty || 0);

        if (receivedQty > allowedQty) {
          toast.error(`${item.partNumber} için gelen miktar sipariş miktarını aşamaz`);
          return;
        }

        const lotNumber = await generateLotNumber();
        const part = parts.find((row) => row.id === item.partId);
        const hasTechnicalPdf = docs.some(
          (doc) =>
            doc.linkedPartId === item.partId &&
            doc.category === 'Teknik Resim' &&
            String(doc.fileName || '').toLowerCase().endsWith('.pdf')
        );

        if (!hasTechnicalPdf) {
          toast.error(`${item.partNumber} için teknik resim PDF bağlı olmadan mal kabul yapılamaz`);
          return;
        }

        await addInventoryBatch({
          batchId: lotNumber,
          lotNumber,
          partId: item.partId,
          partNumber: item.partNumber,
          partName: item.partName,
          quantity: receivedQty,
          remainingQty: receivedQty,
          receivedDate: new Date(`${form.receivedDate}T00:00:00`).toISOString(),
          warehouseLocation: item.location || part?.warehouseLocation || 'KARANTINA-A01',
          location: item.location || part?.warehouseLocation || 'KARANTINA-A01',
          supplierId: form.supplierId,
          supplierName: form.supplierName,
          poId: form.poId,
          poNumber: form.poNumber,
          grnNumber: form.receiptNo,
          waybillNo: form.waybillNo || '',
          qcStatus: 'Karantina',
          status: 'Karantina',
          createdBy: actorName,
        });

        await addStockMovement({
          partId: item.partId,
          partNumber: item.partNumber,
          movementType: 'Satınalma Girişi',
          qty: receivedQty,
          lotNumber,
          referenceNumber: form.receiptNo,
          note: `${form.poNumber} siparişinden mal kabul`,
          performedBy: actorName,
          toLocation: item.location || part?.warehouseLocation || 'KARANTINA-A01',
          createdAt: new Date().toISOString(),
        });

        if (part) {
          await updatePart(part.id, {
            currentStock: Number(part.currentStock || 0) + receivedQty,
            stockStatus: 'Karantina',
            warehouseLocation: part.warehouseLocation || item.location || 'KARANTINA-A01',
          });
        }

        if (orderLine) {
          const nextDelivered = Number(orderLine.deliveredQty || 0) + receivedQty;
          orderLine.deliveredQty = nextDelivered;
          orderLine.remainingQty = Math.max(0, Number(orderLine.qty || 0) - nextDelivered);
        }

        processedItems.push({
          ...item,
          lotNumber,
          receivedQty,
          qcStatus: 'Karantina',
        });
      }

      const poStatus = nextPoItems.every((item) => Number(item.remainingQty || 0) === 0) ? 'Teslim Edildi' : 'Kısmi Teslim';

      await addGoodsReceipt({
        receiptNo: form.receiptNo,
        grnNumber: form.receiptNo,
        poId: form.poId,
        poNumber: form.poNumber,
        supplierId: form.supplierId,
        supplierName: form.supplierName,
        waybillNo: form.waybillNo,
        waybillDate: form.waybillDate,
        receivedDate: new Date(`${form.receivedDate}T00:00:00`).toISOString(),
        status: 'QC Bekliyor',
        notes: form.notes || '',
        receivedBy: actorName,
        items: processedItems,
      });

      await updatePurchaseOrder(form.poId, {
        items: nextPoItems,
        status: poStatus,
      });

      toast.success('Mal kabul tamamlandı, lotlar karantinaya alındı');
      setView('list');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Mal kabul işlemi tamamlanamadı');
    }
  };

  if (loading) return <Spinner />;

  if (view === 'new') {
    return (
      <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
        <div style={{ background: '#0a0f1e', borderBottom: '1px solid #0e7490', padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Mal Kabul Fişi: {form.receiptNo}</h1>
                <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{form.poNumber} - {form.supplierName}</p>
              </div>
            </div>
            <button onClick={handleProcess} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#0e7490', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
              <ShieldCheck size={18} />
              Mal Kabulü Tamamla
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, maxWidth: 1440, margin: '0 auto' }}>
            <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 18px' }}>Gelen Kalemler</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Parça</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Kalan Sipariş</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Gelen</th>
                    <th style={TH}>Lot</th>
                    <th style={TH}>Lokasyon</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={`${item.partId}-${index}`}>
                      <td style={TD}>
                        <div style={{ fontWeight: 800, color: '#f8fafc' }}>{item.partNumber}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{item.partName}</div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 800 }}>{item.remainingQty ?? item.qty}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <input type="number" min="0" max={item.remainingQty ?? item.qty} style={{ ...INPUT, width: 90, textAlign: 'right' }} value={item.receivedQty} onChange={(event) => updateItem(index, 'receivedQty', event.target.value)} />
                      </td>
                      <td style={{ ...TD, fontFamily: 'monospace', color: '#60a5fa' }}>{item.lotNumber}</td>
                      <td style={TD}>
                        <input style={{ ...INPUT, height: 32 }} value={item.location} onChange={(event) => updateItem(index, 'location', event.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Fiş Bilgileri</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={LABEL}>İrsaliye / Fatura No</label>
                  <input style={INPUT} value={form.waybillNo} onChange={(event) => setForm((prev) => ({ ...prev, waybillNo: event.target.value }))} />
                </div>
                <div>
                  <label style={LABEL}>İrsaliye Tarihi</label>
                  <input type="date" style={INPUT} value={form.waybillDate} onChange={(event) => setForm((prev) => ({ ...prev, waybillDate: event.target.value }))} />
                </div>
                <div>
                  <label style={LABEL}>Kabul Tarihi</label>
                  <input type="date" style={INPUT} value={form.receivedDate} onChange={(event) => setForm((prev) => ({ ...prev, receivedDate: event.target.value }))} />
                </div>
                <div>
                  <label style={LABEL}>Notlar</label>
                  <textarea style={{ ...INPUT, height: 80, padding: 10, resize: 'none' }} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
                <div style={{ padding: 14, background: '#0a0f1e', borderRadius: 10, border: '1px solid #1e293b', color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                  Gelen tüm kalemler otomatik olarak <strong style={{ color: '#fbbf24' }}>Karantina</strong> lotu olarak açılır.
                  <br />
                  Kalite onayından sonra üretim ve sevkiyat için kullanılabilir.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Mal Kabul</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Sevk edilmiş satın alma siparişlerinden lot bazlı kabul</p>
        </div>
        <div style={{ padding: '8px 16px', background: '#064e3b', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Truck size={18} color="#34d399" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>{orders.length} bekleyen sipariş</span>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {orders.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState message="Mal kabul bekleyen sipariş bulunmuyor." />
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} onClick={() => selectPurchaseOrder(order)} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, padding: 18, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>{order.poNumber}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>{order.status}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>{order.supplierName}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                  <span>{(order.items || []).length} kalem</span>
                  <span>{formatDate(order.createdAt || order.orderDate)}</span>
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 11 }}>
                  <Package size={14} />
                  Teslim alınan miktar lot bazında karantinaya açılır
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
