import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getInvoices, updateInvoice, getShipments 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, CheckCircle2, AlertTriangle, 
  ChevronRight, Calendar, User, Download, Search, DollarSign
} from 'lucide-react';
import { formatDate, formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };

export default function Invoices() {
  const { isAdmin, isFinance } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getInvoices();
      setInvoices(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Faturalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (id, status) => {
    try {
      await updateInvoice(id, { paymentStatus: status });
      toast.success(`Durum: ${status}`);
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const filtered = invoices.filter(i => 
    i.invoiceNo.toLowerCase().includes(search.toLowerCase()) || 
    i.customerName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Satış Faturaları (Billing)</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Sevkiyat temelli faturalandırma ve ödeme takibi</p>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
         <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input style={{ width: '100%', height: 38, padding: '0 12px 0 36px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }} placeholder="Fatura no veya müşteri ara..." value={search} onChange={e=>setSearch(e.target.value)} />
         </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Fatura No</th>
              <th style={TH}>Müşteri</th>
              <th style={TH}>Ürün / Kalem</th>
              <th style={TH}>Fatura Tarihi</th>
              <th style={{ ...TH, textAlign: 'right' }}>Toplam Tutar</th>
              <th style={TH}>Ödeme Durumu</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 100 }}><EmptyState message="Fatura kaydı bulunamadı." /></td></tr> : filtered.map(inv => (
              <tr key={inv.id}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{inv.invoiceNo}</td>
                <td style={TD}>{inv.customerName}</td>
                <td style={TD}>{inv.partNumber} x {inv.quantity}</td>
                <td style={TD}>{formatDate(inv.invoiceDate || inv.createdAt)}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 900, color: '#f1f5f9' }}>
                   {formatNumber(inv.totalAmount)} {inv.currency || 'USD'}
                </td>
                <td style={TD}>
                   <select 
                      style={{ height: 28, background: '#0a0f1e', border: '1px solid #334155', color: inv.paymentStatus==='Paid'?'#34d399':'#fbbf24', fontSize: 11, fontWeight: 800, borderRadius: 4, padding: '0 8px' }}
                      value={inv.paymentStatus || 'Pending'}
                      onChange={e=>updatePaymentStatus(inv.id, e.target.value)}
                   >
                      <option value="Pending">Beklemede</option>
                      <option value="Paid">Ödendi</option>
                      <option value="Cancelled">İptal</option>
                   </select>
                </td>
                <td style={TD}>
                   <button style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Download size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
