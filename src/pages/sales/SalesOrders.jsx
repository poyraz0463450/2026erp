import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getSalesOrders, addSalesOrder, updateSalesOrder, 
  getCustomers, getParts, addWorkOrder 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, ShoppingBag, 
  Clock, CheckCircle2, AlertTriangle, 
  ChevronRight, Calendar, User, Package, 
  Activity, ArrowRightCircle
} from 'lucide-react';
import { formatDate, formatNumber, generateWONumber } from '../../utils/helpers';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };

export default function SalesOrders() {
  const { isAdmin, isEngineer } = useAuth();
  const canEdit = isAdmin || isEngineer;

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ 
    soNumber: `SO-${Date.now().toString().slice(-6)}`, 
    customerId: '', productPartId: '', quantity: 1, 
    unitPrice: 0, currency: 'USD', status: 'Draft', 
    requestedDate: new Date().toISOString().split('T')[0] 
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, cRes, pRes] = await Promise.all([getSalesOrders(), getCustomers(), getParts()]);
      setOrders(oRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomers(cRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const customer = customers.find(c => c.id === form.customerId);
      const product = parts.find(p => p.id === form.productPartId);
      
      await addSalesOrder({
        ...form,
        customerName: customer?.name,
        productPartNumber: product?.partNumber,
        productName: product?.name
      });
      toast.success('Satış siparişi oluşturuldu');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Kayıt başarısız');
    }
  };

  const createWOForSO = async (so) => {
    try {
      const woNum = generateWONumber();
      await addWorkOrder({
        woNumber: woNum,
        salesOrderId: so.id,
        productPartId: so.productPartId,
        productPartNumber: so.productPartNumber,
        productName: so.productName,
        quantity: so.quantity,
        status: 'Taslak',
        priority: 'Normal',
        plannedStart: new Date().toISOString().split('T')[0],
        plannedEnd: so.requestedDate,
        operations: [] // Template will be added by user in details
      });
      await updateSalesOrder(so.id, { status: 'In Production', workOrderId: woNum });
      toast.success('Üretim emri oluşturuldu');
      load();
    } catch (e) {
      toast.error('Üretim emri oluşturulamadı');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await updateSalesOrder(id, { status });
      toast.success(`Durum: ${status}`);
      load();
    } catch (e) {
      toast.error('Hata');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Satış Siparişleri (Customer Orders)</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Müşteri talepleri ve teslimat takvimi yönetimi</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <Plus size={20}/> Yeni Sipariş Girişi
          </button>
        )}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Sipariş No</th>
              <th style={TH}>Müşteri</th>
              <th style={TH}>Ürün</th>
              <th style={TH}>Miktar</th>
              <th style={{ ...TH, textAlign: 'right' }}>Birim Fiyat</th>
              <th style={TH}>Termin</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, textAlign: 'center' }}>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan={8} style={{ padding: 100 }}><EmptyState message="Henüz sipariş girişi yapılmamış." /></td></tr> : orders.map(o => {
               const stock = parts.find(p => p.id === o.productPartId)?.currentStock || 0;
               const needsProduction = stock < o.quantity && o.status === 'Confirmed';
               return (
                <tr key={o.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{o.soNumber}</td>
                  <td style={TD}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={14} color="#60a5fa" />
                        {o.customerName}
                     </div>
                  </td>
                  <td style={TD}>
                     <div style={{ fontSize: 11, color: '#475569', fontWeight: 800 }}>{o.productPartNumber}</div>
                     <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{o.productName}</div>
                  </td>
                  <td style={TD}>
                    <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{o.quantity}</span>
                    <span style={{ fontSize: 11, marginLeft: 6, color: '#64748b' }}>(Stok: {stock})</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#22c55e' }}>{formatNumber(o.unitPrice)} {o.currency}</td>
                  <td style={TD}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: new Date(o.requestedDate) < new Date() ? '#f87171' : '#94a3b8' }}>
                        <Calendar size={14} />
                        {formatDate(o.requestedDate)}
                     </div>
                  </td>
                  <td style={TD}>
                     <span style={{ 
                        fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                        background: o.status==='Shipped'?'rgba(34,197,94,0.1)':'rgba(251,191,36,0.1)',
                        color: o.status==='Shipped'?'#22c55e':'#fbbf24'
                     }}>{o.status.toUpperCase()}</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                     {o.status === 'Draft' && (
                        <button onClick={() => updateStatus(o.id, 'Confirmed')} style={{ height: 28, padding: '0 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>ONAYLA</button>
                     )}
                     {needsProduction && !o.workOrderId && (
                        <button onClick={() => createWOForSO(o)} style={{ height: 28, padding: '0 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                           <ArrowRightCircle size={12}/> ÜRETİME GÖNDER
                        </button>
                     )}
                     {o.status === 'Confirmed' && stock >= o.quantity && (
                        <button onClick={() => updateStatus(o.id, 'Ready for Shipping')} style={{ height: 28, padding: '0 12px', background: '#10b981', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>SEVKİYATA HAZIR</button>
                     )}
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Satış Siparişi" width={600}>
         <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MÜŞTERİ SEÇİMİ</label>
               <select style={INPUT} value={form.customerId} onChange={e=>setForm({...form, customerId: e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>ÜRÜN / PARÇA</label>
               <select style={INPUT} value={form.productPartId} onChange={e=>setForm({...form, productPartId: e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {parts.filter(p => p.type === 'Product' || p.type === 'Assembly').map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
               </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>TERMİN TARİHİ</label><input type="date" style={INPUT} value={form.requestedDate} onChange={e=>setForm({...form, requestedDate: e.target.value})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MİKTAR</label><input type="number" style={INPUT} value={form.quantity} onChange={e=>setForm({...form, quantity: Number(e.target.value)})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>BİRİM FİYAT</label><input type="number" style={INPUT} value={form.unitPrice} onChange={e=>setForm({...form, unitPrice: Number(e.target.value)})} /></div>
               <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>PARA BİRİMİ</label>
                  <select style={INPUT} value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})}>
                     <option value="USD">USD ($)</option>
                     <option value="EUR">EUR (€)</option>
                     <option value="TRY">TRY (₺)</option>
                  </select>
               </div>
            </div>
            <button type="submit" style={{ height: 44, background: '#dc2626', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, borderRadius: 8, cursor: 'pointer', marginTop: 10 }}>SİPARİŞİ OLUŞTUR</button>
         </form>
      </Modal>
    </div>
  );
}
