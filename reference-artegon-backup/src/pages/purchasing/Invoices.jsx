import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getInvoices, addInvoice, updateInvoice, 
  getPurchaseOrders, getSuppliers 
} from '../../firebase/firestore';
import { formatNumber, formatDate } from '../../utils/helpers';
import { 
  FileCheck, Search, Plus, Filter, CreditCard, 
  Clock, CheckCircle2, AlertTriangle, ArrowRight,
  User, Building2, Calendar, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ 
    invoiceNo: '', supplierId: '', supplierName: '', 
    poId: '', amount: 0, currency: 'TRY', 
    invoiceDate: '', dueDate: '', status: 'Bekliyor' 
  });
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [iRes, oRes] = await Promise.all([getInvoices(), getPurchaseOrders()]);
      setInvoices(iRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrders(oRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Faturalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editId) await updateInvoice(editId, form);
      else await addInvoice({ ...form, createdAt: new Date().toISOString() });
      toast.success('Fatura kaydı başarılı');
      setModal(false);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const filtered = invoices.filter(i => 
    !search || 
    i.invoiceNo?.toLowerCase().includes(search.toLowerCase()) || 
    i.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Fatura Doğrulama (AP)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Tedarikçi faturaları, 3-way matching ve ödeme onayları</p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ invoiceNo: '', supplierId: '', supplierName: '', poId: '', amount: 0, currency: 'TRY', invoiceDate: '', dueDate: '', status: 'Bekliyor' }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
          <Plus size={18} strokeWidth={2.5} /> Yeni Fatura Kaydı
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
         {[ 
           { label: 'Bekleyen Ödemeler', val: invoices.filter(i=>i.status==='Bekliyor').length, color: '#fbbf24', icon: <Clock size={16}/> },
           { label: 'Ödenen Faturalar', val: invoices.filter(i=>i.status==='Ödendi').length, color: '#34d399', icon: <CheckCircle2 size={16}/> },
           { label: 'Vadesi Geçen', val: '0', color: '#f87171', icon: <AlertTriangle size={16}/> },
           { label: 'Aylık Ciro (Borç)', val: '₺1.4M', color: '#60a5fa', icon: <CreditCard size={16}/> }
         ].map((stat, i) => (
           <div key={i} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
              <div><p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>{stat.label}</p><p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>{stat.val}</p></div>
           </div>
         ))}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Fatura no veya firma adı ile ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-2xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Fatura No</th>
              <th style={TH}>Tedarikçi</th>
              <th style={TH}>İlgili PO</th>
              <th style={{ ...TH, textAlign: 'right' }}>Tutar</th>
              <th style={TH}>Vade Tarihi</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Kayıtlı fatura bulunmuyor." /></td></tr> : filtered.map(i => (
              <tr key={i.id} onClick={() => { setEditId(i.id); setForm(i); setModal(true); }} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{i.invoiceNo}</td>
                <td style={{ ...TD, fontWeight: 700, color: '#e2e8f0' }}>{i.supplierName}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{i.poNumber || '—'}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{formatNumber(i.amount)} {i.currency}</td>
                <td style={{ ...TD, color: '#ef4444', fontWeight: 600 }}>{formatDate(i.dueDate)}</td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                      background: i.status === 'Ödendi' ? '#065f46' : '#1e3a8a',
                      color: i.status === 'Ödendi' ? '#34d399' : '#60a5fa'
                   }}>{i.status?.toUpperCase()}</span>
                </td>
                <td style={TD}><ArrowRight size={16} color="#334155" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? `Fatura No: ${form.invoiceNo}` : 'Tedarikçi Faturası Kaydet'} width={700}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={LABEL_STYLE}>Fatura Seri/No</label><input style={INPUT} value={form.invoiceNo} onChange={e=>setForm({...form, invoiceNo: e.target.value})} required /></div>
              <div>
                 <label style={LABEL_STYLE}>İlgili Sipariş (PO)</label>
                 <select style={INPUT} value={form.poId} onChange={e => {
                    const po = orders.find(o => o.id === e.target.value);
                    setForm({ ...form, poId: e.target.value, poNumber: po?.poNumber, supplierId: po?.supplierId, supplierName: po?.supplierName, amount: po?.totalAmount || 0, currency: po?.currency || 'TRY' });
                 }}>
                    <option value="">Sipariş Seçin...</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.poNumber} ({o.supplierName})</option>)}
                 </select>
              </div>
           </div>

           <div style={{ background: '#0a0f1e', padding: 20, borderRadius: 12, border: '1px solid #1e293b' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                 <div><label style={LABEL_STYLE}>Fatura Toplam Tutar (KDV Dahil)</label><input type="number" step="any" style={INPUT} value={form.amount} onChange={e=>setForm({...form, amount: Number(e.target.value)})} required /></div>
                 <div>
                    <label style={LABEL_STYLE}>Döviz</label>
                    <select style={INPUT} value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})}>
                       <option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
                    </select>
                 </div>
              </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div><label style={LABEL_STYLE}>Fatura Tarihi</label><input type="date" style={INPUT} value={form.invoiceDate} onChange={e=>setForm({...form, invoiceDate: e.target.value})} required /></div>
              <div><label style={LABEL_STYLE}>Vade Tarihi</label><input type="date" style={INPUT} value={form.dueDate} onChange={e=>setForm({...form, dueDate: e.target.value})} required /></div>
              <div>
                 <label style={LABEL_STYLE}>Ödeme Durumu</label>
                 <select style={INPUT} value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>
                    <option value="Bekliyor">Bekliyor (AP)</option>
                    <option value="Onaylandı">Ödeme Onayı Verildi</option>
                    <option value="Ödendi">Ödendi</option>
                 </select>
              </div>
           </div>

           <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Vazgeç</button>
              <button type="submit" style={{ height: 40, padding: '0 32px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Uygula</button>
           </div>
        </form>
      </Modal>
    </div>
  );
}
