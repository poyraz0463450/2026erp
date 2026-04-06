import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getParts, getWorkLogs, getInventoryBatches, getFinancialSettings, updateFinancialSettings 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  DollarSign, PieChart, TrendingUp, Settings, 
  Layers, Clock, AlertCircle, Save 
} from 'lucide-react';
import { formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 };

export default function UnitCosting() {
  const { isAdmin } = useAuth();
  
  const [parts, setParts] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [settings, setSettings] = useState({ laborRate: 25, overheadPercent: 15 });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, bRes, sRes] = await Promise.all([
        getParts(), getInventoryBatches(), getFinancialSettings()
      ]);
      setParts(pRes.docs.map(d => ({ id: d.id, ...d.data() })));
      setAllBatches(bRes.docs.map(d => ({ id: d.id, ...d.data() })));
      if (sRes.exists()) setSettings(sRes.data());
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateFinancialSettings(settings);
      toast.success('Maliyet parametreleri güncellendi');
    } catch (e) {
      toast.error('Kayıt başarısız');
    } finally {
      setSavingSettings(false);
    }
  };

  const costBreakdown = useMemo(() => {
    const p = parts.find(x => x.id === selectedPartId);
    if (!p) return null;

    // 1. Material Cost (from BOM)
    let materialCost = 0;
    const bomDetails = (p.components || []).map(comp => {
       const compPart = parts.find(x => x.id === comp.partId);
       // Use average buy price from batches
       const compBatches = allBatches.filter(b => b.partId === comp.partId);
       const avgPrice = compBatches.length > 0 
          ? compBatches.reduce((acc, b) => acc + (b.buyPrice || 0), 0) / compBatches.length 
          : (compPart?.lastPrice || 0);
       
       const lineCost = comp.qty * avgPrice;
       materialCost += lineCost;
       return { name: comp.name, qty: comp.qty, unitPrice: avgPrice, total: lineCost };
    });

    // 2. Labor Cost (Placeholder for now, in a real scenario we'd aggregate work logs for the latest WO)
    const estimatedLaborHours = p.type === 'Product' ? 4.5 : 1.2; // Example static logic for demonstration
    const laborCost = estimatedLaborHours * settings.laborRate;

    // 3. Overhead Cost
    const overheadCost = (materialCost + laborCost) * (settings.overheadPercent / 100);

    const totalCost = materialCost + laborCost + overheadCost;

    return { materialCost, laborCost, overheadCost, totalCost, bomDetails, estimatedLaborHours };
  }, [selectedPartId, parts, allBatches, settings]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
           <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Birim Maliyet Analizi (Unit Costing)</h1>
           <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Ürün bazlı ham madde, işçilik ve genel gider dökümü</p>
        </div>
        {isAdmin && (
           <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#0a0f1e', padding: '8px 16px', borderRadius: 8, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>SAAT ÜCRETİ (USD):</span>
                 <input type="number" style={{ width: 60, height: 28, background: '#0d1117', border: '1px solid #334155', borderRadius: 4, color: '#fff', fontSize: 13, padding: '0 8px' }} value={settings.laborRate} onChange={e=>setSettings({...settings, laborRate: Number(e.target.value)})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>GENEL GİDER (%):</span>
                 <input type="number" style={{ width: 60, height: 28, background: '#0d1117', border: '1px solid #334155', borderRadius: 4, color: '#fff', fontSize: 13, padding: '0 8px' }} value={settings.overheadPercent} onChange={e=>setSettings({...settings, overheadPercent: Number(e.target.value)})} />
              </div>
              <button onClick={handleSaveSettings} disabled={savingSettings} style={{ padding: '6px 12px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                 <Save size={14}/>
              </button>
           </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24 }}>
         <div>
            <div style={CARD_STYLE}>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 12 }}>MALİYETİ HESAPLANACAK PARÇA / ÜRÜN</label>
               <select style={{ width: '100%', height: 44, padding: '0 16px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 15, fontWeight: 600 }} value={selectedPartId} onChange={e=>setSelectedPartId(e.target.value)}>
                  <option value="">Ürün Seçiniz...</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} - {p.name}</option>)}
               </select>
            </div>

            {costBreakdown ? (
               <div className="anim-slide-up">
                  <div style={CARD_STYLE}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>BOM (Malzeme) Maliyet Detayı</h3>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr>
                              <th style={{ textAlign: 'left', fontSize: 11, color: '#475569', paddingBottom: 12 }}>BİLEŞEN ADI</th>
                              <th style={{ textAlign: 'center', fontSize: 11, color: '#475569', paddingBottom: 12 }}>MİKTAR</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#475569', paddingBottom: 12 }}>BİRİM MİYET (AVG)</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#475569', paddingBottom: 12 }}>TOPLAM</th>
                           </tr>
                        </thead>
                        <tbody>
                           {costBreakdown.bomDetails.map((line, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #1a2332' }}>
                                 <td style={{ padding: '12px 0', color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{line.name}</td>
                                 <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{line.qty}</td>
                                 <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: 13 }}>${line.unitPrice.toFixed(2)}</td>
                                 <td style={{ textAlign: 'right', color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>${line.total.toFixed(2)}</td>
                              </tr>
                           ))}
                           <tr style={{ background: '#0a0f1e' }}>
                              <td colSpan={3} style={{ padding: '16px', color: '#64748b', fontSize: 12, fontWeight: 800 }}>TOPLAM MALZEME MALİYETİ</td>
                              <td style={{ textAlign: 'right', padding: '16px', color: '#fff', fontSize: 16, fontWeight: 900 }}>${costBreakdown.materialCost.toFixed(2)}</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                     <div style={CARD_STYLE}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>İşçilik Maliyeti</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                              <Clock size={24} />
                           </div>
                           <div>
                              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>{costBreakdown.estimatedLaborHours} Saat</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700 }}>Tahmini Üretim Süresi</p>
                           </div>
                        </div>
                        <div style={{ marginTop: 20, borderTop: '1px solid #1e293b', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ fontSize: 13, color: '#94a3b8' }}>İşçilik Tutarı ({settings.laborRate}$/sa):</span>
                           <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>${costBreakdown.laborCost.toFixed(2)}</span>
                        </div>
                     </div>
                     <div style={CARD_STYLE}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', margin: '0 0 20px', textTransform: 'uppercase' }}>Genel Giderler</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ width: 48, height: 48, borderRadius: 12, background: '#312e16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                              <TrendingUp size={24} />
                           </div>
                           <div>
                              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>%{settings.overheadPercent}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700 }}>Endirekt Gider Payı</p>
                           </div>
                        </div>
                        <div style={{ marginTop: 20, borderTop: '1px solid #1e293b', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ fontSize: 13, color: '#94a3b8' }}>Genel Gider Tutarı:</span>
                           <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>${costBreakdown.overheadCost.toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
               </div>
            ) : <EmptyState message="Analiz için bir parça seçiniz." />}
         </div>

         <div className="sidebar">
            <div style={{ ...CARD_STYLE, background: '#0a0f1e', textAlign: 'center' }}>
               <DollarSign size={48} color="#22c55e" style={{ margin: '0 auto 16px' }} />
               <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Toplam Birim Maliyet</h2>
               <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', margin: '8px 0' }}>
                  ${costBreakdown ? costBreakdown.totalCost.toFixed(2) : '0.00'}
               </div>
               <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Tahmini Fabrika Çıkış Maliyeti</p>
            </div>

            <div style={CARD_STYLE}>
               <h4 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>MALİYET DAĞILIMI</h4>
               {costBreakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                           <span style={{ fontSize: 12, color: '#94a3b8' }}>Malzeme</span>
                           <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>%{(costBreakdown.materialCost / costBreakdown.totalCost * 100).toFixed(0)}</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: '#111827', borderRadius: 4 }}><div style={{ width: `${(costBreakdown.materialCost/costBreakdown.totalCost*100)}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} /></div>
                     </div>
                     <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                           <span style={{ fontSize: 12, color: '#94a3b8' }}>İşçilik</span>
                           <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>%{(costBreakdown.laborCost / costBreakdown.totalCost * 100).toFixed(0)}</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: '#111827', borderRadius: 4 }}><div style={{ width: `${(costBreakdown.laborCost/costBreakdown.totalCost*100)}%`, height: '100%', background: '#818cf8', borderRadius: 4 }} /></div>
                     </div>
                     <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                           <span style={{ fontSize: 12, color: '#94a3b8' }}>Genel Gider</span>
                           <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>%{(costBreakdown.overheadCost / costBreakdown.totalCost * 100).toFixed(0)}</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: '#111827', borderRadius: 4 }}><div style={{ width: `${(costBreakdown.overheadCost/costBreakdown.totalCost*100)}%`, height: '100%', background: '#fbbf24', borderRadius: 4 }} /></div>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
