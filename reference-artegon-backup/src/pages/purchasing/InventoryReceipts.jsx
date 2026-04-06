import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getPurchaseOrders, updatePurchaseOrder, addGoodsReceipt, 
  getParts, updatePart, addStockMovement, addInventoryBatch
} from '../../firebase/firestore';
import { formatNumber, formatDate } from '../../utils/helpers';
import { 
  Truck, Search, ChevronLeft, Save, Plus, Trash2, 
  ArrowRight, ShieldCheck, ClipboardCheck, Package, 
  MapPin, Hash, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

export default function InventoryReceipts() {
  const { userDoc, isSatinAlma, isAdmin, isWarehouse } = useAuth();
  const canOperate = isAdmin || isSatinAlma || isWarehouse;
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'new'
  const [receipts, setReceipts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [parts, setParts] = useState([]);
  
  // Form State
  const [form, setForm] = useState({ 
    receiptNo: '', poId: '', poNumber: '', supplierName: '', 
    waybillNo: '', waybillDate: new Date().toISOString().split('T')[0],
    receivedDate: new Date().toISOString().split('T')[0],
    damageStatus: 'Hasarsız',
    damageNotes: '',
    items: [] 
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, pRes] = await Promise.all([getPurchaseOrders(), getParts()]);
      setOrders(oRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => ['Gönderildi', 'Kısmi Teslim'].includes(o.status)));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
      // Note: receipts list would come from a goods_receipts collection if implemented
      setLoading(false);
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    }
  };

  const selectPO = (po) => {
    const items = po.items.map(it => {
      const part = parts.find(p => p.id === it.partId);
      const isCritical = part?.isCritical || false;
      const expectedQty = it.qty - (it.deliveredQty || 0);
      
      const now = new Date();
      const lotNo = `LOT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random()*9000)+1000}`;

      return {
        ...it,
        receivedQty: expectedQty,
        lotNumber: lotNo,
        location: part?.warehouseLocation || 'A-01-01',
        status: 'Karantina',
        isCritical,
        serials: isCritical ? Array(expectedQty).fill('') : [],
        damagePhoto: null
      };
    });
    setForm({
      ...form,
      receiptNo: `GRN-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`,
      poId: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      items
    });
    setView('new');
  };

  const handleProcess = async () => {
    if (!canOperate) return;
    
    // Validate serials if critical
    for (const item of form.items) {
      if (item.isCritical && item.serials.some(s => !s)) {
        return toast.error(`${item.partNumber} için tüm seri numaralarını giriniz.`);
      }
    }

    try {
      // 1. Update Inventory for each item
      for (const item of form.items) {
          if (item.receivedQty <= 0) continue;

          if (item.isCritical) {
            // Each serial is a separate batch
            for (const serial of item.serials) {
              await addInventoryBatch({
                partId: item.partId,
                partNumber: item.partNumber,
                lotNumber: item.lotNumber,
                serialNumber: serial,
                quantity: 1,
                remainingQty: 1,
                location: item.location,
                status: 'Karantina',
                supplierId: form.supplierId,
                poId: form.poId,
                waybillNo: form.waybillNo,
                damageStatus: form.damageStatus,
                receivedDate: new Date().toISOString()
              });
            }
          } else {
            // Single batch for the lot
            await addInventoryBatch({
              partId: item.partId,
              partNumber: item.partNumber,
              lotNumber: item.lotNumber,
              quantity: item.receivedQty,
              remainingQty: item.receivedQty,
              location: item.location,
              status: 'Karantina',
              supplierId: form.supplierId,
              poId: form.poId,
              waybillNo: form.waybillNo,
              damageStatus: form.damageStatus,
              receivedDate: new Date().toISOString()
            });
          }

          // Add Stock Movement
          await addStockMovement({
            partId: item.partId,
            type: 'Satınalma Girişi',
            quantity: item.receivedQty,
            lotNumber: item.lotNumber,
            reference: form.receiptNo,
            notes: `${form.poNumber} nolu siparişten mal kabul. İrsaliye: ${form.waybillNo}`
          });

          // Update Part Master Total Stock
          const p = parts.find(x => x.id === item.partId);
          await updatePart(item.partId, {
            currentStock: (p.currentStock || 0) + item.receivedQty
          });
      }

      // 2. Update PO status
      await updatePurchaseOrder(form.poId, {
        status: 'Kısmi Teslim' // Simple toggle for now
      });

      toast.success('Mal kabul başarıyla tamamlandı. Parçalar karantinaya alındı.');
      navigate('/purchasing/orders');
    } catch (e) {
      toast.error('İşlem sırasında hata oluştu');
      console.error(e);
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
                     <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Giriş Ambar Fişi: {form.receiptNo}</h1>
                     <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>Ref: {form.poNumber} — {form.supplierName}</p>
                  </div>
               </div>
               <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleProcess} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#0e7490', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8, boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)' }}>
                     <ShieldCheck size={18} /> Sayımı Onayla & Karantinaya Al
                  </button>
               </div>
            </div>
         </div>

         <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
               <div className="main">
                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Gelen Parça Listesi</h3>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr>
                              <th style={TH}>Parça No / Adı</th>
                              <th style={{ ...TH, textAlign: 'right' }}>Sipariş Miktarı</th>
                              <th style={{ ...TH, textAlign: 'right' }}>Gelen Miktar</th>
                              <th style={TH}>Lot / Batch No</th>
                              <th style={TH}>Adres (Depo)</th>
                              <th style={TH}>Durum</th>
                           </tr>
                        </thead>
                        <tbody>
                           {form.items.map((item, idx) => (
                             <div key={idx} style={{ display: 'contents' }}>
                               <tr key={idx}>
                                  <td style={TD}>
                                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{item.partNumber}</span>
                                        <span style={{ fontSize: 11, color: '#475569' }}>{item.partName}</span>
                                     </div>
                                  </td>
                                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{item.qty}</td>
                                  <td style={{ ...TD, textAlign: 'right' }}>
                                     <input 
                                       type="number" 
                                       style={{ ...INPUT, width: 80, height: 32, textAlign: 'right', borderColor: '#0e7490' }} 
                                       value={item.receivedQty} 
                                       onChange={e => {
                                         const items = [...form.items];
                                         items[idx].receivedQty = Number(e.target.value);
                                         setForm({ ...form, items });
                                       }}
                                     />
                                  </td>
                                  <td style={TD}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                         <Hash size={12} color="#475569" />
                                         <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e2e8f0' }}>{item.lotNumber}</span>
                                      </div>
                                   </td>
                                   <td style={TD}>
                                      <input 
                                        style={{ ...INPUT, height: 32, fontSize: 11 }} 
                                        value={item.location} 
                                        onChange={e => {
                                          const items = [...form.items];
                                          items[idx].location = e.target.value;
                                          setForm({ ...form, items });
                                        }}
                                      />
                                   </td>
                                   <td style={TD}>
                                      <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: '#422006', color: '#fbbf24' }}>KARANTİNA</span>
                                   </td>
                                </tr>
                                {item.isCritical && (
                                  <tr key={`serials-${idx}`}>
                                    <td colSpan={6} style={{ padding: '0 16px 16px', background: 'rgba(239, 68, 68, 0.02)' }}>
                                       <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, border: '1px dashed #ef4444' }}>
                                          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#ef4444' }}>🔴 KRİTİK PARÇA - SERİ NUMARASI GİRİŞİ ZORUNLUDUR</p>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                             {item.serials.map((s, sIdx) => (
                                               <input 
                                                 key={sIdx} 
                                                 placeholder={`Seri No ${sIdx + 1}`} 
                                                 style={{ ...INPUT, height: 30, fontSize: 11 }} 
                                                 value={s}
                                                 onChange={e => {
                                                    const items = [...form.items];
                                                    items[idx].serials[sIdx] = e.target.value;
                                                    setForm({ ...form, items });
                                                 }}
                                               />
                                             ))}
                                          </div>
                                       </div>
                                    </td>
                                  </tr>
                                )}
                             </div>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="sidebar">
                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                     <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Mal Kabul Bilgileri</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div><label style={LABEL_STYLE}>İrsaliye / Fatura No</label><input style={INPUT} value={form.waybillNo} onChange={e=>setForm({...form, waybillNo: e.target.value})} placeholder="Örn: IRS-10293" /></div>
                        <div><label style={LABEL_STYLE}>İrsaliye Tarihi</label><input type="date" style={INPUT} value={form.waybillDate} onChange={e=>setForm({...form, waybillDate: e.target.value})} /></div>
                        <div><label style={LABEL_STYLE}>Fiziki Durum</label>
                           <select style={INPUT} value={form.damageStatus} onChange={e=>setForm({...form, damageStatus: e.target.value})}>
                              <option value="Hasarsız">Hasarsız (Kabul)</option>
                              <option value="Hasarlı">Hasarlı (Karantina/Ret)</option>
                              <option value="Kısmi Hasar">Kısmi Hasarlı</option>
                           </select>
                        </div>
                        {form.damageStatus !== 'Hasarsız' && (
                          <div><label style={LABEL_STYLE}>Hasar Notu / Açıklama</label><textarea style={{...INPUT, height: 60, padding: 8}} value={form.damageNotes} onChange={e=>setForm({...form, damageNotes: e.target.value})} /></div>
                        )}
                        <div><label style={LABEL_STYLE}>Kabul Tarihi</label><input type="date" style={INPUT} value={form.receivedDate} onChange={e=>setForm({...form, receivedDate: e.target.value})} /></div>
                        <div><label style={LABEL_STYLE}>Kabul Eden</label><input style={INPUT} value={userDoc?.displayName} disabled /></div>
                        
                        <div style={{ background: '#0a0f1e', padding: 16, borderRadius: 8, border: '1px solid #1e293b', marginTop: 10 }}>
                           <p style={{ margin: 0, fontSize: 11, color: '#475569', fontStyle: 'italic', lineHeight: '1.4' }}>Dikkat: Tüm girişler savunma sanayi standartları gereği otomatik olarak <strong>Karantina</strong> statüsünde açılır. Kalite onayından sonra stoklara geçer.</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Giriş Kalite & Mal Kabul</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Tedarikçiden gelen sevkiyatların sisteme kabulü ve lotlama işlemleri</p>
        </div>
        <div style={{ padding: '8px 16px', background: '#064e3b', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
           <Truck size={18} color="#34d399" />
           <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>{orders.length} BEKLEYEN SEVKİYAT</span>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24, textAlign: 'center' }}>
         <h3 style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', margin: '0 0 12px' }}>Sevkiyat Bekleyen Siparişler</h3>
         <p style={{ color: '#475569', marginBottom: 24 }}>Lütfen mal kabulü yapılacak olan siparişi (PO) seçiniz.</p>
         
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16, textAlign: 'left' }}>
            {orders.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Şu an bekleyen sevkiyat bulunmuyor." /></div> : (
               orders.map(o => (
                  <div key={o.id} onClick={() => selectPO(o)} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='#0e7490'; e.currentTarget.style.background='#0d1117'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e293b'; e.currentTarget.style.background='#0a0f1e'}}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{o.poNumber}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: '#1e3a5f', color: '#60a5fa' }}>{o.status?.toUpperCase()}</span>
                     </div>
                     <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{o.supplierName}</h4>
                     <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                        <span style={{ fontSize: 11, color: '#475569' }}>{o.items?.length || 0} Kalem</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{formatDate(o.orderDate)}</span>
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
}
