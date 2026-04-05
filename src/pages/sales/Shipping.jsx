import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getSalesOrders, updateSalesOrder, addShipment, 
  getBatchesByPart, updateInventoryBatch, addStockMovement, updatePart, getParts,
  addInvoice 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Truck, ArrowRight, Package, 
  CheckCircle2, AlertOctagon, 
  ChevronRight, Calendar, User, Search
} from 'lucide-react';
import { formatDate, formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 };

export default function Shipping() {
  const { isAdmin, isWarehouse } = useAuth();
  const canShip = isAdmin || isWarehouse;

  const [orders, setOrders] = useState([]);
  const [allParts, setAllParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, pRes] = await Promise.all([getSalesOrders(), getParts()]);
      setOrders(oRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.status === 'Ready for Shipping' || o.status === 'Confirmed'));
      setAllParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
       toast.error('Veriler yüklenemedi');
    } finally {
       setLoading(false);
    }
  };

  const handleShipmentOpen = async (order) => {
    setSelectedOrder(order);
    try {
      const bRes = await getBatchesByPart(order.productPartId);
      setBatches(bRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.remainingQty > 0));
    } catch (e) {
       toast.error('Lot bilgileri alınamadı');
    }
  };

  const finalizeShipment = async () => {
    if (!selectedBatchId) return toast.error('Lütfen bir lot seçin');
    const batch = batches.find(b => b.id === selectedBatchId);
    if (batch.remainingQty < selectedOrder.quantity) return toast.error('Seçilen lotta yeterli miktar yok');

    toast.loading('Sevkiyat hazırlanıyor...', { id: 'ship' });
    try {
       // 1. Update Batch Stock
       await updateInventoryBatch(batch.id, { remainingQty: batch.remainingQty - selectedOrder.quantity });
       
       // 2. Add Stock Movement
       await addStockMovement({
          partId: selectedOrder.productPartId,
          partNumber: selectedOrder.productPartNumber,
          type: 'Satış Sevkiyat (Out)',
          quantity: selectedOrder.quantity,
          reference: selectedOrder.soNumber,
          batchId: batch.id,
          lotNumber: batch.lotNumber,
          timestamp: new Date().toISOString()
       });

       // 3. Update Master Part Stock
       const p = allParts.find(x => x.id === selectedOrder.productPartId);
       await updatePart(selectedOrder.productPartId, { currentStock: p.currentStock - selectedOrder.quantity });

       // 4. Update Sales Order
       await updateSalesOrder(selectedOrder.id, { status: 'Shipped', shippedDate: new Date().toISOString() });

       // 5. Create Shipment Record (ASN Out)
       const shipmentData = {
          soId: selectedOrder.id,
          soNumber: selectedOrder.soNumber,
          customerName: selectedOrder.customerName,
          partNumber: selectedOrder.productPartNumber,
          quantity: selectedOrder.quantity,
          lotNumber: batch.lotNumber,
          shippedAt: new Date().toISOString()
       };
       await addShipment(shipmentData);

       // 6. Auto-Create Invoice
       await addInvoice({
          invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
          soId: selectedOrder.id,
          customerName: selectedOrder.customerName,
          partNumber: selectedOrder.productPartNumber,
          quantity: selectedOrder.quantity,
          unitPrice: selectedOrder.unitPrice || 0,
          totalAmount: (selectedOrder.unitPrice || 0) * selectedOrder.quantity,
          currency: selectedOrder.currency || 'USD',
          paymentStatus: 'Pending',
          invoiceDate: new Date().toISOString()
       });

       toast.success('Sevkiyat ve Fatura tamamlandı!', { id: 'ship' });
       setSelectedOrder(null);
       load();
    } catch (e) {
       toast.error('Sevkiyat başarısız', { id: 'ship' });
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Giden Sevkiyat & Lojistik (Shipping)</h1>
        <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Hazır siparişlerin paketlenmesi ve müşteriye sevki</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 450px' : '1fr', gap: 24 }}>
         <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                  <tr style={{ background: '#0a0f1e' }}>
                     <th style={{ ...TD, fontWeight: 800, color: '#475569', fontSize: 11 }}>SİPARİŞ NO</th>
                     <th style={{ ...TD, fontWeight: 800, color: '#475569', fontSize: 11 }}>MÜŞTERİ</th>
                     <th style={{ ...TD, fontWeight: 800, color: '#475569', fontSize: 11 }}>ÜRÜN</th>
                     <th style={{ ...TD, fontWeight: 800, color: '#475569', fontSize: 11 }}>MİKTAR</th>
                     <th style={{ ...TD, fontWeight: 800, color: '#475569', fontSize: 11 }}>DURUM</th>
                     <th style={TD}></th>
                  </tr>
               </thead>
               <tbody>
                  {orders.length === 0 ? <tr><td colSpan={6} style={{ padding: 100 }}><EmptyState message="Sevkiyata hazır sipariş bulunamadı." /></td></tr> : orders.map(o => (
                     <tr key={o.id} onClick={() => handleShipmentOpen(o)} style={{ cursor: 'pointer', background: selectedOrder?.id === o.id ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                        <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{o.soNumber}</td>
                        <td style={TD}>{o.customerName}</td>
                        <td style={TD}>{o.productName}</td>
                        <td style={{ ...TD, fontWeight: 800, color: '#e2e8f0' }}>{o.quantity} Adet</td>
                        <td style={TD}>
                           <span style={{ fontSize: 9, fontWeight: 900, padding: '4px 10px', borderRadius: 6, background: o.status==='Ready for Shipping'?'rgba(16,185,129,0.1)':'#1e293b', color: o.status==='Ready for Shipping'?'#10b981':'#94a3b8' }}>
                              {o.status.toUpperCase()}
                           </span>
                        </td>
                        <td style={TD}><ArrowRight size={18} color="#334155" /></td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {selectedOrder && (
            <div className="anim-slide-left">
               <div style={CARD_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                     <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Sevkiyat Detayı</h3>
                     <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Kapat</button>
                  </div>
                  
                  <div style={{ background: '#0a0f1e', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                     <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                           <Truck size={20} />
                        </div>
                        <div>
                           <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>MÜŞTERİ</p>
                           <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{selectedOrder.customerName}</p>
                        </div>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                        <div>
                           <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>ÜRÜN</p>
                           <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{selectedOrder.productPartNumber}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                           <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>SEVK MİKTARI</p>
                           <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{selectedOrder.quantity} Adet</p>
                        </div>
                     </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                     <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 10 }}>SEVK EDİLECEK LOT (STOKTAN SEÇ)</label>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {batches.length === 0 ? (
                           <div style={{ padding: 12, border: '1px solid #450a0a', borderRadius: 8, color: '#f87171', fontSize: 11 }}>Bu ürün için hazır stok bulunamadı!</div>
                        ) : batches.map(b => (
                           <div key={b.id} onClick={() => setSelectedBatchId(b.id)} style={{ padding: 12, border: `1px solid ${selectedBatchId === b.id ? '#3b82f6' : '#1e293b'}`, background: selectedBatchId === b.id ? 'rgba(59,130,246,0.1)' : '#0a0f1e', borderRadius: 8, cursor: 'pointer' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <div>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>{b.lotNumber}</span>
                                    <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>Kabul: {formatDate(b.receivedDate)}</p>
                                 </div>
                                 <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>{b.remainingQty} Adet</span>
                                    <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>Mevcut</p>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {canShip && (
                     <button onClick={finalizeShipment} style={{ width: '100%', height: 44, background: '#10b981', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <CheckCircle2 size={20}/> SEVKİYATI TAMAMLA (ASN-OUT)
                     </button>
                  )}
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
