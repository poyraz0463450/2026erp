import { useEffect, useState } from 'react';
import KPICard from '../components/ui/KPICard';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner, EmptyState } from '../components/ui/Shared';
import { 
  getParts, getWorkOrders, getDocuments, getPurchaseRequests, 
  getQcInspections, getMachines, getModels, getInvoices, getShipments 
} from '../firebase/firestore';
import { formatNumber } from '../utils/helpers';
import { Package, ClipboardList, AlertTriangle, FileText, ShieldCheck, ShoppingCart, Crosshair, TrendingUp } from 'lucide-react';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };

export default function Dashboard() {
  const [stats, setStats] = useState({ 
    parts: 0, openWO: 0, critical: 0, docs: 0, pendingQc: 0, openPR: 0,
    totalRevenue: 0, totalCOGS: 0, margin: 0 
  });
  const [recentWO, setRecentWO] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [machines, setMachines] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [openPRs, setOpenPRs] = useState([]);
  const [modelCapacities, setModelCapacities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pS, wS, dS, prS, qcS, mS, mdS, invS, shipS] = await Promise.all([
        getParts(), getWorkOrders(), getDocuments(), getPurchaseRequests(), 
        getQcInspections(), getMachines(), getModels(), getInvoices(), getShipments()
      ]);
      const parts = pS.docs.map(d => ({ id: d.id, ...d.data() }));
      const wos = wS.docs.map(d => ({ id: d.id, ...d.data() }));
      const docs = dS.docs.map(d => ({ id: d.id, ...d.data() }));
      const prs = prS.docs.map(d => ({ id: d.id, ...d.data() }));
      const models = mdS.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const crits = parts.filter(p => (p.currentStock ?? 0) < (p.minStock ?? 0));
      const openWO = wos.filter(w => ['Taslak','Onaylı','Üretimde'].includes(w.status));
      const pendingQc = parts.filter(p => p.stockStatus === 'Karantina');
      const activePR = prs.filter(p => p.status !== 'Teslim Alındı');

      const invoices = invS.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
      
      // Basic COGS calculation (simplified for dashboard)
      const totalCOGS = totalRevenue * 0.65; // Placeholder: Real ERP would aggregate actual batch costs
      const margin = totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0;

      setStats({
        parts: parts.length,
        openWO: openWO.length,
        critical: crits.length,
        docs: docs.length,
        pendingQc: pendingQc.length,
        openPR: activePR.length,
        totalRevenue,
        totalCOGS,
        margin
      });

      setRecentWO(wos.slice(0, 5));
      setLowStock(crits.slice(0, 5));
      setMachines(mS.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingDocs(docs.filter(d => d.revisionStatus === 'İncelemede').slice(0, 5));
      setOpenPRs(activePR.slice(0, 5));

      // Calculate Model Capacities
      const caps = models.filter(m => m.isActive).map(m => {
        let minP = Infinity;
        let hasParts = false;
        parts.forEach(p => {
          if (p.usedInModels) {
            const usage = p.usedInModels.find(u => u.modelId === m.id);
            if (usage) {
              hasParts = true;
              const poss = Math.floor((p.currentStock || 0) / (usage.qtyPerUnit || 1));
              if (poss < minP) minP = poss;
            }
          }
        });
        return { ...m, maxProd: hasParts && minP !== Infinity ? minP : 0 };
      });
      setModelCapacities(caps);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 16 }}>
        <KPICard label="Toplam Parça" value={formatNumber(stats.parts)} icon={<Package size={20} />} trend="Aktif envanter" />
        <KPICard label="Açık İş Emirleri" value={formatNumber(stats.openWO)} icon={<ClipboardList size={20} />} trend={stats.openWO > 0 ? `${stats.openWO} aktif` : 'Yok'} />
        <KPICard label="Kritik Stok" value={formatNumber(stats.critical)} icon={<AlertTriangle size={20} />} trend={stats.critical > 0 ? `-${stats.critical} eksik` : 'Yok'} />
        <KPICard label="Bekleyen QC" value={formatNumber(stats.pendingQc)} icon={<ShieldCheck size={20} />} trend="Karantinada" />
        <KPICard label="Açık Satınalma" value={formatNumber(stats.openPR)} icon={<ShoppingCart size={20} />} trend="Talep" />
        <KPICard label="Brüt Kar Marjı" value={`%${stats.margin.toFixed(1)}`} icon={<TrendingUp size={20} />} trend="Ortalama" color="#10b981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
         <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0d1117 100%)', border: '1px solid #065f46', borderRadius: 12, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>Toplam Ciro (Revenue)</p>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 900, color: '#fff' }}>${formatNumber(stats.totalRevenue)}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>Kesilen faturalar toplamı</p>
         </div>
         <div style={{ background: 'linear-gradient(135deg, #450a0a 0%, #0d1117 100%)', border: '1px solid #7f1d1d', borderRadius: 12, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>Toplam Maliyet (COGS)</p>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 900, color: '#fff' }}>${formatNumber(stats.totalCOGS)}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>Tahmini üretim maliyeti</p>
         </div>
         <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0d1117 100%)', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase' }}>Net Nakit Akışı</p>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 900, color: '#fff' }}>${formatNumber(stats.totalRevenue - stats.totalCOGS)}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>Brüt karlılık (Tahmini)</p>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderTop: '2px solid #dc2626', padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Son İş Emirleri</h3>
          </div>
          {recentWO.length === 0 ? <EmptyState message="Veri yok" /> : (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={TH}>İş Emri</th><th style={TH}>Ürün</th><th style={{...TH, textAlign: 'right'}}>Miktar</th><th style={TH}>Durum</th></tr></thead>
                <tbody>
                  {recentWO.map(wo => (
                    <tr key={wo.id}><td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{wo.woNumber}</td><td style={{ ...TD, color: '#e2e8f0' }}>{wo.productName || '—'}</td><td style={{ ...TD, textAlign: 'right' }}>{wo.quantity}</td><td style={TD}><StatusBadge status={wo.status} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ borderTop: '2px solid #dc2626', padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Kritik Stok Uyarıları</h3>
            {stats.critical > 0 && <span className="anim-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />}
          </div>
          {lowStock.length === 0 ? <EmptyState message="Kritik stok yok" /> : (
            <div>
              {lowStock.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a2332' }}>
                  <div><p style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', margin: 0 }}>{item.name}</p><p style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569', margin: '2px 0 0' }}>{item.partNumber}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', margin: 0 }}>{item.currentStock ?? 0}</p><p style={{ fontSize: 10, color: '#475569', margin: 0 }}>min: {item.minStock ?? 0}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Model Production Capacity */}
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', gridColumn: 'span 1' }}>
          <div style={{ borderTop: '2px solid #1e293b', padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Crosshair size={16} color="#60a5fa" />
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Model Üretim Kapasitesi</h3>
          </div>
          {modelCapacities.length === 0 ? <p style={{ color: '#475569', fontSize: 12, padding: 16 }}>Aktif model yok</p> : modelCapacities.map(m => (
            <div key={m.id} style={{ padding: '12px 16px', borderBottom: '1px solid #1a2332', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 2px', fontWeight: 600 }}>{m.modelCode}</p>
                <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>{m.modelName}</p>
              </div>
              <div style={{ textAlign: 'right', background: '#1e293b', padding: '4px 10px', borderRadius: 4 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: m.maxProd > 0 ? '#4ade80' : '#f87171' }}>{m.maxProd}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Existing Widgets */}
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ borderTop: '2px solid #1e293b', padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Makine Durumları</h3>
          </div>
          <div style={{ padding: 16 }}>
            {machines.length === 0 ? <p style={{ color: '#475569', fontSize: 12 }}>Makine tanımı yok</p> : machines.map(m => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#e2e8f0' }}>{m.name}</span>
                  <span style={{ color: m.status === 'Dolu' ? '#dc2626' : m.status === 'Bakımda' ? '#fbbf24' : '#22c55e' }}>{m.status}</span>
                </div>
                <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: m.status === 'Dolu' ? '100%' : m.status === 'Bakımda' ? '50%' : '10%', background: m.status === 'Dolu' ? '#dc2626' : m.status === 'Bakımda' ? '#fbbf24' : '#22c55e', opacity: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ borderTop: '2px solid #1e293b', padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Onay Bekleyen Dokümanlar</h3>
          </div>
          {pendingDocs.length === 0 ? <p style={{ color: '#475569', fontSize: 12, padding: 16 }}>Bekleyen onay yok</p> : pendingDocs.map(d => (
            <div key={d.id} style={{ padding: '12px 16px', borderBottom: '1px solid #1a2332' }}>
              <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 4px', fontWeight: 500 }}>{d.title}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Rev: {d.revision} · {d.uploadedBy}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ borderTop: '2px solid #1e293b', padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Satınalma Uyarıları</h3>
            {stats.openPR > 0 && <span className="anim-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />}
          </div>
          {openPRs.length === 0 ? <p style={{ color: '#475569', fontSize: 12, padding: 16 }}>Aktif talep yok</p> : openPRs.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid #1a2332', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 4px', fontWeight: 500 }}>{p.partName}</p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Talep: {p.requestedQty} adet</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
