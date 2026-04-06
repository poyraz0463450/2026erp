import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getRFQs, addRFQ, updateRFQ, getPurchaseRequests, 
  getSuppliers, addPurchaseOrder, updatePurchaseRequest 
} from '../../firebase/firestore';
import { formatDate, formatNumber, formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, Plus, FileText, Building2, CheckCircle2, 
  Clock, XCircle, ArrowRight, Table, Scale, ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };
const LABEL = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };

export default function RFQModule() {
  const { isAdmin, isSatinAlma, userDoc } = useAuth();
  const canEdit = isAdmin || isSatinAlma;
  const navigate = useNavigate();

  const [rfqs, setRfqs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'compare'
  const [currentRfq, setCurrentRfq] = useState(null);

  // New RFQ Form
  const [newRfq, setNewRfq] = useState({
    prId: '', partId: '', partNumber: '', partName: '', requestedQty: 1, 
    targetDeliveryDate: '', vendors: [], status: 'Açık'
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, pRes, sRes] = await Promise.all([getRFQs(), getPurchaseRequests(), getSuppliers()]);
      setRfqs(rRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setRequests(pRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'Onaylandı'));
      setSuppliers(sRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRfq = async () => {
    if (!newRfq.prId || newRfq.vendors.length === 0) return toast.error('PR ve en az bir tedarikçi seçilmelidir');
    try {
      const rfqNumber = `TKL-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`;
      await addRFQ({ ...newRfq, rfqNumber, createdAt: new Date().toISOString() });
      toast.success('Teklif talebi başarıyla oluşturuldu');
      setView('list');
      load();
    } catch (e) {
      toast.error('Hata oluştu');
    }
  };

  const addVendorToRfq = (vendorId) => {
    if (newRfq.vendors.find(v => v.supplierId === vendorId)) return;
    const s = suppliers.find(x => x.id === vendorId);
    setNewRfq({
      ...newRfq,
      vendors: [...newRfq.vendors, { supplierId: s.id, supplierName: s.name, unitPrice: 0, currency: 'TRY', leadTimeDays: 7, status: 'Bekleniyor' }]
    });
  };

  const handleUpdateOffer = async (rfqId, vendorIdx, field, value) => {
    const rfq = rfqs.find(r => r.id === rfqId);
    const updatedVendors = [...rfq.vendors];
    updatedVendors[vendorIdx][field] = value;
    if (field === 'unitPrice') updatedVendors[vendorIdx].status = 'Alındı';
    
    try {
      await updateRFQ(rfqId, { vendors: updatedVendors, status: 'Değerlendirmede' });
      const newRfqs = rfqs.map(r => r.id === rfqId ? { ...r, vendors: updatedVendors, status: 'Değerlendirmede' } : r);
      setRfqs(newRfqs);
      if (currentRfq?.id === rfqId) setCurrentRfq({ ...currentRfq, vendors: updatedVendors });
    } catch (e) {
      toast.error('Güncelleme başarısız');
    }
  };

  const selectWinner = async (rfq, vendor) => {
    if (!window.confirm(`${vendor.supplierName} tedarikçisini seçip PO oluşturmak istiyor musunuz?`)) return;
    try {
      const poNo = `PO-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`;
      const poData = {
        poNumber: poNo,
        rfqId: rfq.id,
        supplierId: vendor.supplierId,
        supplierName: vendor.supplierName,
        status: 'Taslak',
        totalAmount: rfq.requestedQty * vendor.unitPrice,
        currency: vendor.currency,
        items: [{
          partId: rfq.partId,
          partNumber: rfq.partNumber,
          partName: rfq.partName,
          qty: rfq.requestedQty,
          unitPrice: vendor.unitPrice,
          totalPrice: rfq.requestedQty * vendor.unitPrice
        }],
        createdAt: new Date().toISOString()
      };
      const poRes = await addPurchaseOrder(poData);
      await updateRFQ(rfq.id, { status: 'Kapatıldı', selectedVendorId: vendor.supplierId, linkedPOId: poRes.id });
      if (rfq.prId) await updatePurchaseRequest(rfq.prId, { status: 'Siparişe Dönüştü', linkedPoId: poRes.id });
      
      toast.success('PO Başarıyla Oluşturuldu!');
      setView('list');
      load();
    } catch (e) {
      toast.error('PO oluşturulamadı');
    }
  };

  if (loading) return <Spinner />;

  if (view === 'create') {
    return (
      <div className="anim-fade" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer' }}>
            <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Yeni Teklif Talebi (RFQ)</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px' }}>Talep Detayları</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={LABEL}>Onaylı Satınalma Talebi (PR)</label>
                <select style={INPUT} onChange={e => {
                  const pr = requests.find(r => r.id === e.target.value);
                  setNewRfq({ ...newRfq, prId: pr.id, partId: pr.partId, partNumber: pr.partNumber, partName: pr.partName, requestedQty: pr.requestedQty });
                }}>
                  <option value="">Seçiniz...</option>
                  {requests.map(r => <option key={r.id} value={r.id}>{r.prNumber} - {r.partName} ({r.requestedQty} Adet)</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={LABEL}>Parça No</label><input style={INPUT} value={newRfq.partNumber} disabled /></div>
                <div><label style={LABEL}>Miktar</label><input style={INPUT} value={newRfq.requestedQty} disabled /></div>
              </div>
              <div><label style={LABEL}>Hedef Teslim Tarihi</label><input type="date" style={INPUT} value={newRfq.targetDeliveryDate} onChange={e=>setNewRfq({...newRfq, targetDeliveryDate: e.target.value})} /></div>
            </div>
          </div>

          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
             <h3 style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px' }}>Tedarikçi Seçimi</h3>
             <select style={INPUT} onChange={e => addVendorToRfq(e.target.value)}>
                <option value="">Tedarikçi Ekle...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {newRfq.vendors.map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0f1e', padding: '10px 16px', borderRadius: 8, border: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{v.supplierName}</span>
                    <button onClick={() => setNewRfq({...newRfq, vendors: newRfq.vendors.filter((_, idx) => idx !== i)})} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><XCircle size={16}/></button>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleCreateRfq} style={{ height: 48, padding: '0 40px', background: '#34d399', border: 'none', color: '#064e3b', fontSize: 14, fontWeight: 800, borderRadius: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(52, 211, 153, 0.3)' }}>RFQ BAŞLAT (TEKLİF TOPLA)</button>
        </div>
      </div>
    );
  }

  if (view === 'compare') {
    return (
      <div className="anim-fade" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer' }}>
            <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Teklif Karşılaştırma - {currentRfq.rfqNumber}</h1>
            <p style={{ color: '#475569', fontSize: 14 }}>{currentRfq.partNumber} - {currentRfq.partName} ({currentRfq.requestedQty} Adet)</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${currentRfq.vendors.length}, 1fr)`, gap: 24 }}>
           {currentRfq.vendors.map((v, i) => (
             <div key={i} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: 20, background: '#111827', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                   <Building2 size={32} style={{ margin: '0 auto 12px' }} color="#60a5fa" />
                   <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>{v.supplierName}</h3>
                </div>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                   <div>
                      <label style={LABEL}>Birim Fiyat</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="number" style={INPUT} value={v.unitPrice} onChange={e => handleUpdateOffer(currentRfq.id, i, 'unitPrice', e.target.value)} />
                        <select style={{ ...INPUT, width: 80 }} value={v.currency} onChange={e => handleUpdateOffer(currentRfq.id, i, 'currency', e.target.value)}>
                          <option>TRY</option><option>USD</option><option>EUR</option>
                        </select>
                      </div>
                   </div>
                   <div>
                      <label style={LABEL}>Teslim Süresi (LT)</label>
                      <input type="number" style={INPUT} value={v.leadTimeDays} onChange={e => handleUpdateOffer(currentRfq.id, i, 'leadTimeDays', e.target.value)} />
                   </div>
                   <div style={{ background: '#0a0f1e', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 4 }}>TOPLAM TUTAR</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#34d399' }}>{formatCurrency(v.unitPrice * currentRfq.requestedQty, v.currency)}</span>
                   </div>
                   
                   <button 
                    disabled={currentRfq.status === 'Kapatıldı'} 
                    onClick={() => selectWinner(currentRfq, v)}
                    style={{ 
                      width: '100%', height: 44, background: currentRfq.selectedVendorId === v.supplierId ? '#065f46' : '#1e293b', 
                      color: currentRfq.selectedVendorId === v.supplierId ? '#34d399' : '#f1f5f9', border: 'none', 
                      borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    >
                      {currentRfq.selectedVendorId === v.supplierId ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CheckCircle2 size={18}/> KAZANAN</div>
                      ) : 'SEÇ & PO OLUŞTUR'}
                   </button>
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Teklif Toplama (RFQ)</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Tedarikçilerden fiyat ve termin toplama süreçleri</p>
        </div>
        <button onClick={() => setView('create')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
          <Plus size={20} strokeWidth={3} /> Yeni RFQ Başlat
        </button>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>TKL No</th>
              <th style={TH}>Parça / Ürün</th>
              <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
              <th style={TH}>Tedarikçi Sayısı</th>
              <th style={TH}>Durum</th>
              <th style={TH}>Tarih</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rfqs.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Henüz bir teklif talebi bulunmuyor." /></td></tr> : rfqs.map(r => (
              <tr key={r.id} onClick={() => { setCurrentRfq(r); setView('compare'); }} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{r.rfqNumber}</td>
                <td style={TD}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{r.partNumber}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{r.partName}</span>
                   </div>
                </td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 800 }}>{r.requestedQty} ADET</td>
                <td style={TD}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={14} color="#3b82f6" />
                      <span style={{ fontWeight: 700 }}>{r.vendors?.length || 0} Tedarikçi</span>
                   </div>
                </td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                      background: r.status === 'Açık' ? '#1e3a8a' : (r.status === 'Kapatıldı' ? '#064e3b' : '#3f2a08'),
                      color: r.status === 'Açık' ? '#60a5fa' : (r.status === 'Kapatıldı' ? '#34d399' : '#fbbf24')
                   }}>{r.status?.toUpperCase()}</span>
                </td>
                <td style={TD}>{formatDate(r.createdAt)}</td>
                <td style={TD}><ArrowRight size={16} color="#334155" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
