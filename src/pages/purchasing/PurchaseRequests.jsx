import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getPurchaseRequests, addPurchaseRequest, updatePurchaseRequest,
  getParts, getSupplierParts, addPurchaseOrder 
} from '../../firebase/firestore';
import { PR_STATUSES, formatDate, formatNumber } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Filter, ShoppingCart, RefreshCcw, Building2, 
  ChevronRight, AlertTriangle, Clock, CheckCircle2, User, Pencil, Trash2, 
  BarChart3, Scale, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const LABEL_STYLE = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' };
const createInitialForm = () => ({
  prNumber: '',
  partId: '',
  requestedQty: 1,
  urgency: 'Normal',
  status: 'Taslak',
  neededByDate: '',
  suggestedSupplierId: '',
  notes: '',
  estimatedUnitPrice: 0,
  currency: 'TRY'
});

export default function PurchaseRequests() {
  const { isSatinAlma, isAdmin, userDoc } = useAuth();
  const canEdit = isSatinAlma || isAdmin;
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [parts, setParts] = useState([]);
  const [suppParts, setSuppParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(createInitialForm());
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, sp] = await Promise.all([getPurchaseRequests(), getParts(), getSupplierParts()]);
      setRequests(r.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(p.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppParts(sp.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Talepler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const part = parts.find(p => p.id === form.partId);
      const data = {
        ...form,
        partNumber: part?.partNumber || '',
        partName: part?.name || '',
        requestedBy: userDoc?.displayName || userDoc?.email,
        createdAt: new Date().toISOString()
      };

      if (editId) await updatePurchaseRequest(editId, data);
      else {
        const prNo = `SAT-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`;
        await addPurchaseRequest({ ...data, prNumber: prNo });
      }
      
      toast.success(editId ? 'Talep güncellendi' : 'Talep oluşturuldu');
      setModal(false);
      load();
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  const convertToPO = async (pr) => {
    if (pr.status !== 'Onaylandı') {
      toast.error('Sadece onaylı talepler siparişe dönüştürülebilir');
      return;
    }
    try {
      const poNo = `PO-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`;
      const poData = {
        poNumber: poNo,
        supplierId: pr.suggestedSupplierId || 'manual',
        supplierName: pr.suggestedSupplierName || 'Belirtilmedi',
        status: 'Taslak',
        totalAmount: pr.requestedQty * (pr.estimatedUnitPrice || 0),
        currency: pr.currency || 'TRY',
        items: [{
          partId: pr.partId,
          partNumber: pr.partNumber,
          partName: pr.partName,
          qty: pr.requestedQty,
          unitPrice: pr.estimatedUnitPrice || 0,
          totalPrice: pr.requestedQty * (pr.estimatedUnitPrice || 0)
        }],
        createdAt: new Date().toISOString()
      };
      const res = await addPurchaseOrder(poData);
      await updatePurchaseRequest(pr.id, { status: 'Siparişe Dönüştü', linkedPoId: res.id });
      toast.success('PO Başarıyla Oluşturuldu!');
      load();
    } catch (e) {
      toast.error('PO oluşturulamadı');
    }
  };

  const handleDelete = async () => {
    if (!editId || !canEdit) return;
    if (!confirm(`${form.prNumber || 'Talep'} kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      await updatePurchaseRequest(editId, {
        isDeleted: true,
        status: 'İptal',
        deletedAt: new Date().toISOString(),
      });
      toast.success('Talep arşive alındı');
      setModal(false);
      setEditId(null);
      setForm(createInitialForm());
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Talep silinemedi');
    }
  };

  const activeRequests = requests.filter((r) => !r.isDeleted);
  const filtered = activeRequests.filter(r => 
    !search || 
    r.prNumber?.toLowerCase().includes(search.toLowerCase()) || 
    r.partName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Satınalma Talepleri (PR)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Bölüm bazlı malzeme talepleri ve onay süreçleri</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm(createInitialForm()); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
            <Plus size={18} strokeWidth={2.5} /> Yeni Malzeme Talebi
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
         {[ 
           { label: 'Bekleyen Onay', val: activeRequests.filter(r=>r.status==='Taslak').length, color: '#fbbf24', icon: <Clock size={16}/> },
           { label: 'Onaylı Talepler', val: activeRequests.filter(r=>r.status==='Onaylandı').length, color: '#34d399', icon: <CheckCircle2 size={16}/> },
           { label: 'Acil Requisition', val: activeRequests.filter(r=>r.urgency==='Acil').length, color: '#f87171', icon: <AlertTriangle size={16}/> },
           { label: 'Siparişleşen', val: activeRequests.filter(r=>r.status==='Siparişe Dönüştü').length, color: '#60a5fa', icon: <ShoppingCart size={16}/> }
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
          <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Talep no veya parça kodu ile ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-2xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Requisition No</th>
              <th style={TH}>Parça / Ürün</th>
              <th style={{ ...TH, textAlign: 'right' }}>Miktar</th>
              <th style={TH}>Aciliyet</th>
              <th style={TH}>Talep Eden</th>
              <th style={TH}>Termin</th>
              <th style={TH}>Durum</th>
              <th style={{ ...TH, width: 180, textAlign: 'center' }}>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={9} style={{ padding: 48 }}><EmptyState message="Aktif satınalma talebi bulunmuyor." /></td></tr> : filtered.map(r => (
              <tr key={r.id} onClick={() => { setEditId(r.id); setForm({ ...createInitialForm(), ...r }); setModal(true); }} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{r.prNumber}</td>
                <td style={TD}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{r.partNumber}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{r.partName}</span>
                   </div>
                </td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#f1f5f9' }}>{r.requestedQty} <span style={{ fontSize: 11, color: '#64748b' }}>ADET</span></td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                      background: r.urgency === 'Acil' ? '#450a0a' : '#1e293b',
                      color: r.urgency === 'Acil' ? '#ef4444' : '#64748b'
                   }}>{r.urgency?.toUpperCase()}</span>
                </td>
                <td style={TD}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{r.requestedBy?.[0] || 'U'}</div>
                      <span style={{ fontSize: 11 }}>{r.requestedBy || 'Kullanıcı'}</span>
                   </div>
                </td>
                <td style={TD}>{formatDate(r.neededByDate)}</td>
                <td style={TD}>
                   <span style={{ 
                      fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6,
                      background: r.status === 'Onaylandı' ? '#065f46' : (r.status === 'Taslak' ? '#1e293b' : '#1e3a8a'),
                      color: r.status === 'Onaylandı' ? '#34d399' : (r.status === 'Taslak' ? '#94a3b8' : '#60a5fa')
                   }}>{r.status?.toUpperCase()}</span>
                </td>
                <td style={{ ...TD, textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditId(r.id);
                        setForm({ ...createInitialForm(), ...r });
                        setModal(true);
                      }}
                      style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: '#1e40af', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <Pencil size={12} />
                      Düzenle
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          if (!confirm(`${r.prNumber || 'Talep'} kaydını silmek istiyor musunuz?`)) return;
                          try {
                            await updatePurchaseRequest(r.id, {
                              isDeleted: true,
                              status: 'İptal',
                              deletedAt: new Date().toISOString(),
                            });
                            toast.success('Talep arşive alındı');
                            await load();
                          } catch (error) {
                            console.error(error);
                            toast.error('Talep silinemedi');
                          }
                        }}
                        style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: '#7f1d1d', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <Trash2 size={12} />
                        Sil
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? `SAT Detayı: ${form.prNumber}` : 'Talep Oluştur (Purchase Requisition)'} width={800}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                 <label style={LABEL_STYLE}>Talep Edilen Parça</label>
                 <select style={INPUT} value={form.partId} onChange={e => {
                   const p = parts.find(x => x.id === e.target.value);
                   const sp = suppParts.find(x => x.partId === e.target.value && x.isPreferred);
                   setForm({ ...form, partId: e.target.value, estimatedUnitPrice: sp?.unitPrice || 0, currency: sp?.currency || 'TRY', suggestedSupplierId: sp?.supplierId || '' });
                 }} required>
                    <option value="">Parça Seçin...</option>
                    {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
                 </select>
              </div>
              <div>
                 <label style={LABEL_STYLE}>Talep Miktarı</label>
                 <input type="number" style={INPUT} value={form.requestedQty} onChange={e=>setForm({...form, requestedQty: Number(e.target.value)})} required />
              </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                 <label style={LABEL_STYLE}>Aciliyet</label>
                 <select style={INPUT} value={form.urgency} onChange={e=>setForm({...form, urgency: e.target.value})}>
                    <option value="Normal">Normal</option>
                    <option value="Acil">Acil (7 Gün İçinde)</option>
                    <option value="Kritik">KRİTİK (Durma Tehlikesi)</option>
                 </select>
              </div>
              <div><label style={LABEL_STYLE}>İhtiyaç Tarihi</label><input type="date" style={INPUT} value={form.neededByDate} onChange={e=>setForm({...form, neededByDate: e.target.value})} required /></div>
              <div>
                 <label style={LABEL_STYLE}>Status (Admin/Purchasing)</label>
                 <select style={{ ...INPUT, background: '#1e1b4b', color: '#818cf8', fontWeight: 800 }} value={form.status} onChange={e=>setForm({...form, status: e.target.value})} disabled={!canEdit}>
                    {PR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
           </div>

           <div style={{ background: '#0a0f1e', padding: 20, borderRadius: 12, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                 <h4 style={{ margin: 0, fontSize: 13, color: '#60a5fa', fontWeight: 800 }}>Finansal Öngörü & Tedarikçi</h4>
                 <span style={{ fontSize: 11, color: '#475569' }}>Preferred Supplier verisinden çekildi</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                 <div><label style={LABEL_STYLE}>Birim Fiyat (Tahmini)</label><input type="number" style={INPUT} value={form.estimatedUnitPrice} onChange={e=>setForm({...form, estimatedUnitPrice: Number(e.target.value)})} /></div>
                 <div><label style={LABEL_STYLE}>Toplam Tutar</label><div style={{ ...INPUT, background: '#0d1117', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#34d399' }}>{formatNumber(form.requestedQty * (form.estimatedUnitPrice || 0))} {form.currency}</div></div>
              </div>
           </div>

           <div><label style={LABEL_STYLE}>Kullanım Gerekçesi / Notlar</label><textarea style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Bu parça hangi iş emri veya depo eksiği için isteniyor?" /></div>

           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
               {editId && form.status === 'Onaylandı' && canEdit && (
                 <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => convertToPO(form)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#0e7490', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                       <ShoppingCart size={16}/> Sipariş Oluştur
                    </button>
                    <button type="button" onClick={() => navigate('/purchasing/rfq')} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#3b82f6', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                       <Scale size={16}/> Teklif Topla (RFQ)
                    </button>
                 </div>
               )}
               {editId && canEdit && (
                 <button
                   type="button"
                   onClick={handleDelete}
                   style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#7f1d1d', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                 >
                   Talebi Sil
                 </button>
               )}
              <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                 <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 24px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>İptal</button>
                 <button type="submit" style={{ height: 40, padding: '0 32px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
              </div>
           </div>
        </form>
      </Modal>
    </div>
  );
}
