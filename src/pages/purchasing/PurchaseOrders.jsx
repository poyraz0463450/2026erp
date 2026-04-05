import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getPurchaseOrders, updatePurchaseOrder, addGoodsReceipt, 
  getSuppliers, getSupplierParts, getParts 
} from '../../firebase/firestore';
import { formatNumber, formatDate, PO_STATUSES } from '../../utils/helpers';
import { 
  Search, ChevronLeft, Send, Save, Truck, Printer, 
  FileText, CreditCard, Calendar, Hash, Building2, 
  Plus, Trash2, ArrowRight, UserCheck, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

export default function PurchaseOrders() {
  const { userDoc, isSatinAlma, isAdmin } = useAuth();
  const canEdit = isSatinAlma || isAdmin;
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [currentPo, setCurrentPo] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPurchaseOrders();
      setOrders(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (po) => {
    setCurrentPo(po);
    setView('detail');
  };

  const handleSave = async () => {
    try {
      await updatePurchaseOrder(currentPo.id, currentPo);
      toast.success('Satınalma siparişi güncellendi');
      setView('list');
      load();
    } catch (e) {
      toast.error('Kayıt başarısız');
    }
  };

  const createGRN = async (po) => {
    if (!['Gönderildi', 'Kısmi Teslim'].includes(po.status)) {
       toast.error('Mal kabul için siparişin gönderilmiş olması gerekir');
       return;
    }
    navigate('/purchasing/receipts', { state: { poId: po.id, poNumber: po.poNumber } });
  };

  const filtered = orders.filter(o => 
    !search || 
    o.poNumber?.toLowerCase().includes(search.toLowerCase()) || 
    o.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  if (view === 'detail') {
    return (
      <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
         <div style={{ background: '#0a0f1e', borderBottom: '1px solid #dc2626', padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <ChevronLeft size={20} />
                  </button>
                  <div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{currentPo.poNumber}</h1>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#fbbf24', fontSize: 10, fontWeight: 900 }}>{currentPo.status?.toUpperCase()}</span>
                     </div>
                     <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{currentPo.supplierName} • {formatDate(currentPo.createdAt || currentPo.orderDate)}</p>
                  </div>
               </div>
               <div style={{ display: 'flex', gap: 12 }}>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}><Printer size={18}/> PDF İndir</button>
                  {canEdit && (
                    <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
                       <Save size={18} /> Kaydet
                    </button>
                  )}
               </div>
            </div>
         </div>

         <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
               
               <div className="main">
                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: 0, textTransform: 'uppercase' }}>Sipariş Kalemleri (Line Items)</h3>
                        <span style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>TOPLAM {currentPo.items?.length || 0} KALEM</span>
                     </div>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr>
                              <th style={TH}>#</th>
                              <th style={TH}>Parça Tanımı</th>
                              <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
                              <th style={TH}>Birim</th>
                              <th style={{ ...TH, textAlign: 'right' }}>Birim Fiyat</th>
                              <th style={{ ...TH, textAlign: 'right' }}>Satırı Toplamı</th>
                           </tr>
                        </thead>
                        <tbody>
                           {currentPo.items?.map((item, idx) => (
                             <tr key={idx}>
                                <td style={{ ...TD, fontSize: 11, color: '#475569' }}>{idx + 1}</td>
                                <td style={TD}>
                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{item.partNumber}</span>
                                      <span style={{ fontSize: 11, color: '#475569' }}>{item.partName}</span>
                                   </div>
                                </td>
                                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f1f5f9' }}>{item.qty}</td>
                                <td style={TD}>{item.unit || 'ADET'}</td>
                                <td style={{ ...TD, textAlign: 'right', color: '#94a3b8' }}>{formatNumber(item.unitPrice)} {currentPo.currency}</td>
                                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{formatNumber(item.totalPrice)} {currentPo.currency}</td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                     
                     <div style={{ marginTop: 24, borderTop: '2px solid #1e293b', paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: 300 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                              <span style={{ color: '#475569' }}>Ara Toplam (Net):</span>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{formatNumber(currentPo.totalAmount * 0.8)} {currentPo.currency}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                              <span style={{ color: '#475569' }}>Vergi (%20 KDV):</span>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{formatNumber(currentPo.totalAmount * 0.2)} {currentPo.currency}</span>
                           </div>
                           <div style={{ height: 1, background: '#1e293b', margin: '12px 0' }} />
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                              <span style={{ fontWeight: 800, color: '#fff' }}>GENEL TOPLAM:</span>
                              <span style={{ fontWeight: 900, color: '#34d399' }}>{formatNumber(currentPo.totalAmount)} {currentPo.currency}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Hüküm & Koşullar (T&C)</h3>
                     <textarea style={{ ...INPUT, height: 100, padding: 12, resize: 'none' }} value={currentPo.notes} onChange={e=>setCurrentPo({...currentPo, notes: e.target.value})} placeholder="Özel teslimat koşulları, paketleme talimatları vb." />
                  </div>
               </div>

               <div className="sidebar">
                  <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                     <h4 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 16px' }}>Lojistik & Teslimat</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div><label style={LABEL_STYLE}>Beklenen Varış</label><input type="date" style={INPUT} value={currentPo.expectedDeliveryDate} onChange={e=>setCurrentPo({...currentPo, expectedDeliveryDate: e.target.value})} /></div>
                        <div><label style={LABEL_STYLE}>Teslimat Şekli (Incoterms)</label><select style={INPUT}><option>FCA - Serbest Taşıyıcı</option><option>EXW - İş Yerinde Teslim</option><option>DAP - Belirlenen Yerde Teslim</option></select></div>
                        <div><label style={LABEL_STYLE}>Ödeme Vadesi</label><input style={INPUT} value={currentPo.paymentTerms || '30 Gün'} onChange={e=>setCurrentPo({...currentPo, paymentTerms: e.target.value})} /></div>
                     </div>
                  </div>

                  {['Gönderildi', 'Kısmi Teslim'].includes(currentPo.status) && (
                    <button onClick={() => createGRN(currentPo)} style={{ width: '100%', height: 50, background: '#0e7490', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)' }}>
                       <Truck size={20}/> Mal Kabul İşlemi
                    </button>
                  )}
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
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Satın Alma Siparişleri (PO)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Resmi tedarikçi siparişleri, bütçe kontrolü ve tedarik takibi</p>
        </div>
        <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: '8px 16px', gap: 20 }}>
           <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 10, color: '#475569', fontWeight: 800 }}>AÇIK SİPARİŞ</p><p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>{orders.filter(o=>o.status==='Gönderildi').length}</p></div>
           <div style={{ width: 1, background: '#1e293b' }} />
           <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 10, color: '#475569', fontWeight: 800 }}>BÜTÇE (AYLIK)</p><p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#34d399' }}>₺1.2M</p></div>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="PO no veya tedarikçi ile ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-2xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>PO Numarası</th>
              <th style={TH}>Tedarikçi Ünvanı</th>
              <th style={TH}>Oluşturma Tarihi</th>
              <th style={{ ...TH, textAlign: 'right' }}>Toplam Tutar</th>
              <th style={TH}>Termin</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Kayıtlı sipariş bulunmuyor." /></td></tr> : filtered.map(o => (
              <tr key={o.id} onClick={() => openDetail(o)} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{o.poNumber}</td>
                <td style={{ ...TD, fontWeight: 700, color: '#e2e8f0' }}>{o.supplierName}</td>
                <td style={TD}>{formatDate(o.createdAt || o.orderDate)}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{formatNumber(o.totalAmount)} {o.currency}</td>
                <td style={TD}>{o.expectedDeliveryDate ? formatDate(o.expectedDeliveryDate) : '—'}</td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                      background: o.status === 'Gönderildi' ? '#422006' : (o.status === 'Tamamlandı' ? '#065f46' : '#1e3a8a'),
                      color: o.status === 'Gönderildi' ? '#fbbf24' : (o.status === 'Tamamlandı' ? '#34d399' : '#60a5fa')
                   }}>{o.status?.toUpperCase()}</span>
                </td>
                <td style={TD}><ArrowRight size={16} color="#334155" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
