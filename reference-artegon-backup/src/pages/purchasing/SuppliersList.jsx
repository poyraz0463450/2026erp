import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getSuppliers, addSupplier, updateSupplier, 
  getSupplierParts, addSupplierPart, updateSupplierPart, deleteSupplierPart,
  getParts
} from '../../firebase/firestore';
import { formatNumber, formatDate } from '../../utils/helpers';
import { 
  Search, ChevronLeft, Save, Plus, Building2, PackageCheck, 
  History, FileSpreadsheet, FileCheck, Phone, Mail, 
  MapPin, Globe, CreditCard, ShieldCheck, Star, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 52, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const TAB_STYLE = (active) => ({ 
  padding: '12px 24px', fontSize: 13, fontWeight: 600, 
  color: active ? '#f1f5f9' : '#64748b', 
  borderBottom: active ? '2px solid #dc2626' : '2px solid transparent', 
  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 
});

export default function SuppliersList() {
  const { isAdmin, isSatinAlma } = useAuth();
  const canEdit = isAdmin || isSatinAlma;
  
  const [suppliers, setSuppliers] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [currentSup, setCurrentSup] = useState(null);
  const [activeTab, setActiveTab] = useState('Genel');
  const [search, setSearch] = useState('');

  // Sub-data
  const [sParts, setSParts] = useState([]);
  const [sInspections, setSInspections] = useState([]);
  const [sOrders, setSOrders] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([getSuppliers(), getParts()]);
      setSuppliers(sRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (sup) => {
    if (!sup) {
      setCurrentSup({ 
        code: `TED-${Math.floor(Math.random()*9000)+1000}`, 
        name: '', shortName: '', contactPerson: '', contactTitle: '', 
        phone: '', email: '', website: '', address: '', 
        taxNumber: '', taxOffice: '', bankName: '', iban: '', 
        paymentTerms: '30 Gün', currency: 'TRY', isApproved: false, isActive: true 
      });
      setSParts([]);
      setView('detail');
      return;
    }
    setLoading(true);
    try {
      const { getQcInspections, getPurchaseRequests } = await import('../../firebase/firestore'); // Using dynamic or adding to top
      setCurrentSup(sup);
      
      const [spRes, iRes, oRes] = await Promise.all([
        getSupplierParts(),
        getQcInspections(),
        getPurchaseRequests() // Assuming purchase_orders/requests logic for demo
      ]);

      setSParts(spRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.supplierId === sup.id));
      setSInspections(iRes.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.supplierName === sup.name));
      // In a real app, we'd query by supplierId. Using name for now as per current schema.
      setView('detail');
    } catch (e) {
      toast.error('Detaylar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (currentSup.id) await updateSupplier(currentSup.id, currentSup);
      else await addSupplier(currentSup);
      toast.success('Tedarikçi kaydedildi');
      setView('list');
      load();
    } catch (e) {
      toast.error('Kayıt başarısız');
    }
  };

  const filtered = suppliers.filter(s => 
    !search || 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  if (view === 'detail') {
    return (
      <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
         <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <ChevronLeft size={20} />
                  </button>
                  <div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{currentSup.name || 'Yeni Tedarikçi'}</h1>
                        {currentSup.isApproved && <span style={{ padding: '4px 10px', borderRadius: 6, background: '#065f46', color: '#34d399', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={12}/> ONAYLI</span>}
                     </div>
                     <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{currentSup.code} • {currentSup.city || 'Konum Belirtilmedi'}</p>
                  </div>
               </div>
               {canEdit && (
                 <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#dc2626', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
                    <Save size={18} /> Kaydet
                 </button>
               )}
            </div>
         </div>

         <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e293b', display: 'flex', padding: '0 24px' }}>
            <button style={TAB_STYLE(activeTab==='Genel')} onClick={()=>setActiveTab('Genel')}><Building2 size={16}/> Kurumsal Bilgiler</button>
            <button style={TAB_STYLE(activeTab==='Finans')} onClick={()=>setActiveTab('Finans')}><CreditCard size={16}/> Finansal Detaylar</button>
            <button style={TAB_STYLE(activeTab==='Katalog')} onClick={()=>setActiveTab('Katalog')}><PackageCheck size={16}/> Ürün Kataloğu</button>
            <button style={TAB_STYLE(activeTab==='Performans')} onClick={()=>setActiveTab('Performans')}><Star size={16}/> SRM Analizi</button>
         </div>

         <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
               
               {activeTab === 'Genel' && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>İletişim & Kimlik</h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>FİRMA ÜNVANI</label><input style={INPUT} value={currentSup.name} onChange={e=>setCurrentSup({...currentSup, name: e.target.value})} /></div>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>KISA AD</label><input style={INPUT} value={currentSup.shortName} onChange={e=>setCurrentSup({...currentSup, shortName: e.target.value})} /></div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>YETKİLİ KİŞİ</label><input style={INPUT} value={currentSup.contactPerson} onChange={e=>setCurrentSup({...currentSup, contactPerson: e.target.value})} /></div>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>UNVAN</label><input style={INPUT} value={currentSup.contactTitle} onChange={e=>setCurrentSup({...currentSup, contactTitle: e.target.value})} /></div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>TELEFON</label><input style={INPUT} value={currentSup.phone} onChange={e=>setCurrentSup({...currentSup, phone: e.target.value})} /></div>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>E-POSTA</label><input style={INPUT} value={currentSup.email} onChange={e=>setCurrentSup({...currentSup, email: e.target.value})} /></div>
                          </div>
                       </div>
                    </div>
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Adres & Lokasyon</h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>AÇIK ADRES</label><textarea style={{ ...INPUT, height: 100, padding: 12, resize: 'none' }} value={currentSup.address} onChange={e=>setCurrentSup({...currentSup, address: e.target.value})} /></div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>ŞEHİR</label><input style={INPUT} value={currentSup.city} onChange={e=>setCurrentSup({...currentSup, city: e.target.value})} /></div>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>ÜLKE</label><input style={INPUT} value={currentSup.country} onChange={e=>setCurrentSup({...currentSup, country: e.target.value})} /></div>
                          </div>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>WEB SİTESİ</label><input style={INPUT} value={currentSup.website} onChange={e=>setCurrentSup({...currentSup, website: e.target.value})} /></div>
                       </div>
                    </div>
                 </div>
               )}

               {activeTab === 'Finans' && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Vergi & Banka</h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>VERGİ DAİRESİ</label><input style={INPUT} value={currentSup.taxOffice} onChange={e=>setCurrentSup({...currentSup, taxOffice: e.target.value})} /></div>
                             <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>VERGİ NO</label><input style={INPUT} value={currentSup.taxNumber} onChange={e=>setCurrentSup({...currentSup, taxNumber: e.target.value})} /></div>
                          </div>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>BANKA ADI</label><input style={INPUT} value={currentSup.bankName} onChange={e=>setCurrentSup({...currentSup, bankName: e.target.value})} /></div>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>IBAN</label><input style={INPUT} value={currentSup.iban} onChange={e=>setCurrentSup({...currentSup, iban: e.target.value})} placeholder="TR00 0000..." /></div>
                       </div>
                    </div>
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Ödeme Koşulları</h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>VADE (Örn: 30 Gün)</label><input style={INPUT} value={currentSup.paymentTerms} onChange={e=>setCurrentSup({...currentSup, paymentTerms: e.target.value})} /></div>
                          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>PARA BİRİMİ</label>
                             <select style={INPUT} value={currentSup.currency} onChange={e=>setCurrentSup({...currentSup, currency: e.target.value})}>
                                <option value="TRY">TRY - Türk Lirası</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="EUR">EUR - Euro</option>
                             </select>
                          </div>
                          <div style={{ marginTop: 12, padding: 16, background: '#0a0f1e', borderRadius: 8, border: '1px solid #1e293b' }}>
                             <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>
                                <input type="checkbox" checked={currentSup.isApproved} onChange={e=>setCurrentSup({...currentSup, isApproved: e.target.checked})} />
                                Kalite Onaylı Tedarikçi Statüsü
                             </label>
                          </div>
                       </div>
                    </div>
                 </div>
               )}

               {activeTab === 'Katalog' && (
                 <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Tedarik Edilen Parçalar</h3>
                       <button style={{ height: 32, padding: '0 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}><Plus size={14}/> Yeni Parça Ekle</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                       <thead>
                          <tr>
                             <th style={TH}>Parça No</th>
                             <th style={TH}>Parça Adı</th>
                             <th style={TH}>Tedarikçi Ref No</th>
                             <th style={{ ...TH, textAlign: 'right' }}>Son Satın Alma Fiyatı</th>
                             <th style={TH}>L/T (Gün)</th>
                          </tr>
                       </thead>
                       <tbody>
                          {sParts.length === 0 ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Katalog boş.</td></tr> : sParts.map(sp => (
                             <tr key={sp.id}>
                                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{sp.partNumber}</td>
                                <td style={TD}>{sp.partName}</td>
                                <td style={TD}>{sp.supplierPartCode || '—'}</td>
                                <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#60a5fa' }}>{formatNumber(sp.unitPrice)} {sp.currency}</td>
                                <td style={TD}>{sp.leadTimeDays || '7'}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
               )}

               {activeTab === 'Performans' && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Tedarikçi Karnesi (SCM Scorecard)</h3>
                       {(() => {
                         const totalLots = sInspections.length;
                         const acceptedLots = sInspections.filter(i => i.overallResult === 'Kabul').length;
                         const qualityScore = totalLots > 0 ? Math.round((acceptedLots / totalLots) * 100) : 100;
                         
                         const deliveryScore = 95; // Placeholder for order date vs receipt date logic
                         
                         return (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                             <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                   <span style={{ fontSize: 13, color: '#94a3b8' }}>Kalite Performans Skoru (PAS/TOTAL)</span>
                                   <span style={{ fontSize: 14, fontWeight: 900, color: qualityScore > 90 ? '#34d399' : '#fbbf24' }}>%{qualityScore}</span>
                                </div>
                                <div style={{ height: 8, background: '#1e293b', borderRadius: 4 }}><div style={{ width: `${qualityScore}%`, height: '100%', background: qualityScore > 90 ? '#34d399' : '#fbbf24', borderRadius: 4, transition: 'width 1s ease' }}/></div>
                                <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Toplam {totalLots} sevkiyatın {acceptedLots} adedi kalite onayından geçti.</p>
                             </div>
                             
                             <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                   <span style={{ fontSize: 13, color: '#94a3b8' }}>Zamanında Teslimat (OTIF)</span>
                                   <span style={{ fontSize: 14, fontWeight: 900, color: '#34d399' }}>%{deliveryScore}</span>
                                </div>
                                <div style={{ height: 8, background: '#1e293b', borderRadius: 4 }}><div style={{ width: `${deliveryScore}%`, height: '100%', background: '#34d399', borderRadius: 4, transition: 'width 1s ease' }}/></div>
                                <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Sipariş termin tarihine uyum oranı.</p>
                             </div>

                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 10 }}>
                                <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #1e293b' }}>
                                   <span style={{ display: 'block', fontSize: 10, color: '#475569', fontWeight: 800 }}>DÖNEMSEL NCR</span>
                                   <span style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>{sInspections.filter(i => i.overallResult === 'Red').length}</span>
                                </div>
                                <div style={{ background: '#0a0f1e', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #1e293b' }}>
                                   <span style={{ display: 'block', fontSize: 10, color: '#475569', fontWeight: 800 }}>ORT. L/T (GÜN)</span>
                                   <span style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>12</span>
                                </div>
                             </div>
                           </div>
                         );
                       })()}
                    </div>
                    
                    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                       <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Kalite Geçmişi (NCR)</h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {sInspections.length === 0 ? <p style={{ color: '#475569', fontSize: 12 }}>İnceleme kaydı bulunmuyor.</p> : sInspections.slice(0, 5).map(i => (
                            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0a0f1e', borderRadius: 8, border: '1px solid #1e293b' }}>
                               <div>
                                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{i.inspectionNo}</span>
                                  <span style={{ fontSize: 10, color: '#475569' }}>{formatDate(i.createdAt)}</span>
                               </div>
                               <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: i.overallResult === 'Kabul' ? '#064e3b' : '#450a0a', color: i.overallResult === 'Kabul' ? '#34d399' : '#f87171' }}>{i.overallResult?.toUpperCase()}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}

            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Tedarikçi Yönetimi (SRM)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Tedarik zinciri ortakları, performans takibi ve parça katalogları</p>
        </div>
        {canEdit && (
          <button onClick={() => openDetail(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
            <Plus size={18} strokeWidth={2.5} /> Yeni Tedarikçi Tanımla
          </button>
        )}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input 
            type="text" 
            placeholder="Firma adı veya kod ile ara..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden shadow-2xl' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Kod</th>
              <th style={TH}>Firma Ünvanı</th>
              <th style={TH}>Yetkili Kişi</th>
              <th style={TH}>İletişim</th>
              <th style={TH}>Şehir</th>
              <th style={TH}>Onay</th>
              <th style={{ ...TH, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 48 }}><EmptyState message="Tedarikçi kaydı bulunamadı." /></td></tr> : filtered.map(s => (
              <tr key={s.id} onClick={() => openDetail(s)} style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9' }}>{s.code}</td>
                <td style={{ ...TD, fontWeight: 700, color: '#e2e8f0' }}>{s.name}</td>
                <td style={TD}>{s.contactPerson || '—'}</td>
                <td style={TD}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 11, color: '#e2e8f0' }}>{s.phone || '—'}</span>
                      <span style={{ fontSize: 10, color: '#475569' }}>{s.email || '—'}</span>
                   </div>
                </td>
                <td style={TD}>{s.city || '—'}</td>
                <td style={TD}>
                   {s.isApproved ? (
                     <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6, background: '#065f46', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                        <ShieldCheck size={12}/> ONAYLI
                     </span>
                   ) : (
                     <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#64748b' }}>BEKLEMEDE</span>
                   )}
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
