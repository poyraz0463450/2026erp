import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import {
  addInvoice,
  getInvoices,
  getPurchaseOrders,
  updateInvoice,
} from '../../firebase/firestore';
import { formatDate, formatNumber } from '../../utils/helpers';
import {
  ArrowRight,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
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
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    invoiceNo: '',
    supplierId: '',
    supplierName: '',
    poId: '',
    poNumber: '',
    amount: 0,
    currency: 'TRY',
    invoiceDate: '',
    dueDate: '',
    status: 'Bekliyor',
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [invoiceSnap, orderSnap] = await Promise.all([getInvoices(), getPurchaseOrders()]);
      setInvoices(
        invoiceSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((row) => row.invoiceKind === 'purchase' || row.supplierName)
      );
      setOrders(orderSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Tedarikçi faturaları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, invoiceKind: 'purchase' };
      if (editId) {
        await updateInvoice(editId, payload);
      } else {
        await addInvoice({ ...payload, createdAt: new Date().toISOString() });
      }
      toast.success('Fatura kaydı güncellendi');
      setModal(false);
      load();
    } catch (error) {
      console.error(error);
      toast.error('Fatura kaydı oluşturulamadı');
    }
  };

  const filtered = invoices.filter((invoice) => {
    const needle = search.toLowerCase();
    return (
      !search ||
      invoice.invoiceNo?.toLowerCase().includes(needle) ||
      invoice.supplierName?.toLowerCase().includes(needle)
    );
  });

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Fatura Doğrulama</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Tedarikçi faturaları, PO eşleştirme ve ödeme hazırlığı</p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            setForm({ invoiceNo: '', supplierId: '', supplierName: '', poId: '', poNumber: '', amount: 0, currency: 'TRY', invoiceDate: '', dueDate: '', status: 'Bekliyor' });
            setModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}
        >
          <Plus size={18} strokeWidth={2.5} /> Yeni Fatura Kaydı
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Bekleyen Ödemeler', val: invoices.filter((row) => row.status === 'Bekliyor').length, color: '#fbbf24', icon: <Clock size={16} /> },
          { label: 'Ödenen Faturalar', val: invoices.filter((row) => row.status === 'Ödendi').length, color: '#34d399', icon: <CheckCircle2 size={16} /> },
          { label: 'Vadesi Yaklaşan', val: invoices.filter((row) => row.status === 'Onaylandı').length, color: '#f87171', icon: <AlertTriangle size={16} /> },
          { label: 'Aylık Borç', val: `₺${formatNumber(invoices.reduce((sum, row) => sum + (row.amount || row.totalAmount || 0), 0))}`, color: '#60a5fa', icon: <CreditCard size={16} /> },
        ].map((stat, index) => (
          <div key={index} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>{stat.label}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Fatura no veya firma adı ile ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 48 }}>
                  <EmptyState message="Kayıtlı tedarikçi faturası bulunmuyor." />
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => {
                    setEditId(invoice.id);
                    setForm(invoice);
                    setModal(true);
                  }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{invoice.invoiceNo}</td>
                  <td style={{ ...TD, fontWeight: 700, color: '#e2e8f0' }}>{invoice.supplierName}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{invoice.poNumber || '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{formatNumber(invoice.amount || invoice.totalAmount)} {invoice.currency}</td>
                  <td style={{ ...TD, color: '#ef4444', fontWeight: 600 }}>{formatDate(invoice.dueDate)}</td>
                  <td style={TD}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6, background: invoice.status === 'Ödendi' ? '#065f46' : '#1e3a8a', color: invoice.status === 'Ödendi' ? '#34d399' : '#60a5fa' }}>
                      {invoice.status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={TD}><ArrowRight size={16} color="#334155" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? `Fatura No: ${form.invoiceNo}` : 'Tedarikçi Faturası Kaydet'} width={700}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Fatura Seri/No</label>
              <input style={INPUT} value={form.invoiceNo} onChange={(event) => setForm({ ...form, invoiceNo: event.target.value })} required />
            </div>
            <div>
              <label style={LABEL_STYLE}>İlgili Sipariş (PO)</label>
              <select
                style={INPUT}
                value={form.poId}
                onChange={(event) => {
                  const po = orders.find((row) => row.id === event.target.value);
                  setForm({
                    ...form,
                    poId: event.target.value,
                    poNumber: po?.poNumber || '',
                    supplierId: po?.supplierId || '',
                    supplierName: po?.supplierName || '',
                    amount: po?.totalAmount || 0,
                    currency: po?.currency || 'TRY',
                  });
                }}
              >
                <option value="">Sipariş seçin...</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.poNumber} ({order.supplierName})</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: '#0a0f1e', padding: 20, borderRadius: 12, border: '1px solid #1e293b' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Fatura Toplam Tutar</label>
                <input type="number" step="any" style={INPUT} value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>Döviz</label>
                <select style={INPUT} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Fatura Tarihi</label>
              <input type="date" style={INPUT} value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} required />
            </div>
            <div>
              <label style={LABEL_STYLE}>Vade Tarihi</label>
              <input type="date" style={INPUT} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required />
            </div>
            <div>
              <label style={LABEL_STYLE}>Ödeme Durumu</label>
              <select style={INPUT} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="Bekliyor">Bekliyor</option>
                <option value="Onaylandı">Onaylandı</option>
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
