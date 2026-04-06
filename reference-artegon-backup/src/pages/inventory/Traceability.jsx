import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getInventoryBatches, getStockMovements, getQcInspections, 
  getPurchaseOrders, getPartById 
} from '../../firebase/firestore';
import { formatDate, formatNumber } from '../../utils/helpers';
import { 
  Search, ShieldCheck, Truck, Package, 
  ArrowRight, Factory, FileText, History 
} from 'lucide-react';
import toast from 'react-hot-toast';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 };
const LABEL = { fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'block' };
const VAL = { fontSize: 15, fontWeight: 700, color: '#f1f5f9' };

export default function Traceability() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search) return;
    setLoading(true);
    try {
      // 1. Get Batches
      const bRes = await getInventoryBatches();
      const batch = bRes.docs.find(d => d.data().batchId === search);
      
      if (!batch) {
        setResults(null);
        toast.error('Lot bulunamadı');
        return;
      }

      const bData = { id: batch.id, ...batch.data() };

      // 2. Parallel fetch related data
      const [mRes, iRes, poRes, pData] = await Promise.all([
        getStockMovements(),
        getQcInspections(),
        getPurchaseOrders(),
        getPartById(bData.partId)
      ]);

      const movements = mRes.docs.map(d => d.data()).filter(m => m.lotNumber === search);
      const inspection = iRes.docs.find(d => d.data().batchId === search)?.data();
      const po = poRes.docs.find(d => d.data().poNumber === bData.grnNumber || d.id === bData.poId)?.data();

      setResults({
        batch: bData,
        part: pData.data(),
        movements: movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        inspection,
        po
      });
    } catch (e) {
      toast.error('Arama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-fade" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>Malzeme İzlenebilirlik Gezgini</h1>
        <p style={{ color: '#475569', fontSize: 15 }}>Lot veya Seri Numarası ile parçanın tüm yaşam döngüsünü (Pedigree) izleyin</p>
        
        <form onSubmit={handleSearch} style={{ maxWidth: 600, margin: '32px auto 0', position: 'relative' }}>
           <Search size={20} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
           <input 
             style={{ width: '100%', height: 56, padding: '0 24px 0 56px', background: '#0d1117', border: '2px solid #dc2626', borderRadius: 28, color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none', boxShadow: '0 10px 30px rgba(220, 38, 38, 0.15)' }} 
             placeholder="Lot / Seri No giriniz... (Örn: LOT-2026-XYZ)"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
           <button style={{ position: 'absolute', right: 8, top: 8, bottom: 8, padding: '0 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 24, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>SORGULA</button>
        </form>
      </div>

      {loading && <Spinner />}

      {!loading && results && (
        <div className="anim-up">
           {/* Tier 1: Identity */}
           <div style={{ ...CARD_STYLE, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)' }}>
              <div><label style={LABEL}>Parça Master</label><div style={VAL}>{results.part.partNumber}</div><div style={{ fontSize: 11, color: '#475569' }}>{results.part.name}</div></div>
              <div><label style={LABEL}>Mevcut Durum</label>
                 <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 20, background: results.batch.qcStatus === 'Sağlam' ? '#064e3b' : '#1e3a8a', color: results.batch.qcStatus === 'Sağlam' ? '#34d399' : '#60a5fa' }}>
                    {results.batch.qcStatus?.toUpperCase()}
                 </span>
              </div>
              <div><label style={LABEL}>Kalan Miktar</label><div style={{ ...VAL, color: '#dc2626' }}>{formatNumber(results.batch.remainingQty)} <span style={{ fontSize: 11, color: '#475569' }}>/ {formatNumber(results.batch.quantity)}</span></div></div>
              <div><label style={LABEL}>Depo Adresi</label><div style={VAL}>{results.batch.location || 'Bilinmiyor'}</div></div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Origin Section */}
              <div>
                 <h3 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Truck size={18}/> MENŞEİ ve SATINALMA</h3>
                 <div style={CARD_STYLE}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>Tedarikçi</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{results.batch.supplierName || results.po?.supplierName || '—'}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>Sipariş No (PO)</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{results.po?.poNumber || results.batch.grnNumber || '—'}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>Kabul Tarihi</span>
                          <span style={{ fontSize: 13, color: '#f1f5f9' }}>{formatDate(results.batch.receivedDate)}</span>
                       </div>
                    </div>
                 </div>

                 <h3 style={{ fontSize: 14, fontWeight: 800, color: '#34d399', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, marginTop: 32 }}><ShieldCheck size={18}/> KALİTE ONAYI</h3>
                 <div style={CARD_STYLE}>
                    {results.inspection ? (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ fontSize: 13, color: '#94a3b8' }}>Muayene Rapor No</span>
                             <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{results.inspection.inspectionNo}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ fontSize: 13, color: '#94a3b8' }}>Karar</span>
                             <span style={{ fontSize: 11, fontWeight: 900, color: results.inspection.overallResult === 'Kabul' ? '#34d399' : '#f87171' }}>{results.inspection.overallResult?.toUpperCase()}</span>
                          </div>
                       </div>
                    ) : <p style={{ color: '#475569', fontSize: 13 }}>Henüz kalite kaydı bulunmuyor.</p>}
                 </div>
              </div>

              {/* Lifecycle / Movements Section */}
              <div>
                 <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><History size={18}/> HAREKET GEÇMİŞİ ve KULLANIM</h3>
                 <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
                    {results.movements.length === 0 ? <p style={{ padding: 24, color: '#475569', fontSize: 13 }}>Hareket kaydı bulunmuyor.</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         {results.movements.map((m, idx) => (
                           <div key={idx} style={{ padding: '16px 24px', borderBottom: results.movements.length-1 === idx ? 'none' : '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: idx === 0 ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                              <div>
                                 <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{m.movementType}</div>
                                 <div style={{ fontSize: 11, color: '#475569' }}>{formatDate(m.timestamp)}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                 <div style={{ fontSize: 14, fontWeight: 900, color: m.qty > 0 ? '#34d399' : '#f1f5f9' }}>{m.qty} ADET</div>
                                 <div style={{ fontSize: 10, color: '#475569' }}>{m.toLocation || 'Depo'}</div>
                              </div>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {!loading && !results && search && (
        <EmptyState message="Aranan lot bulunamadı veya sistemde kaydı yok." />
      )}
    </div>
  );
}
