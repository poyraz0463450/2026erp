import { useEffect, useState } from 'react';
import { Spinner } from '../../components/ui/Shared';
import { 
  getPurchaseOrders, getPurchaseRequests, getSuppliers, getInvoices 
} from '../../firebase/firestore';
import { formatNumber } from '../../utils/helpers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, ShoppingCart, Users, AlertCircle, 
  ArrowUpRight, ArrowDownRight, DollarSign, Package
} from 'lucide-react';

const COLORS = ['#dc2626', '#2563eb', '#059669', '#ca8a04', '#7c3aed'];

export default function PurchasingDashboard() {
  const [data, setData] = useState({ pos: [], prs: [], sups: [], invs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [pos, prs, sups, invs] = await Promise.all([
        getPurchaseOrders(), getPurchaseRequests(), 
        getSuppliers(), getInvoices()
      ]);
      setData({
        pos: pos.docs.map(d => d.data()),
        prs: prs.docs.map(d => d.data()),
        sups: sups.docs.map(d => d.data()),
        invs: invs.docs.map(d => d.data())
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalSpend = data.pos.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const openPrs = data.prs.filter(p => p.status === 'Taslak' || p.status === 'Pending').length;
  
  const spendBySupplier = data.pos.reduce((acc, curr) => {
    acc[curr.supplierName] = (acc[curr.supplierName] || 0) + (curr.totalAmount || 0);
    return acc;
  }, {});

  const supplierChartData = Object.entries(spendBySupplier)
    .map(([name, value]) => ({ name, value }))
    .sort((a,b) => b.value - a.value)
    .slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Satınalma Analitiği</h1>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Harcama yönetimi, tedarikçi performansı ve bütçe takibi</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
         <StatCard label="Toplam Harcama (YTD)" val={`₺${formatNumber(totalSpend)}`} sub="+12.5% geçen aya göre" icon={<TrendingUp size={20}/>} color="#dc2626" />
         <StatCard label="Onaylı Tedarikçi" val={data.sups.filter(s=>s.isApproved).length} sub={`${data.sups.length} toplam firma`} icon={<Users size={20}/>} color="#2563eb" />
         <StatCard label="Bekleyen Talepler" val={openPrs} sub="Ortalama 2.4 gün onay süresi" icon={<AlertCircle size={20}/>} color="#ca8a04" />
         <StatCard label="Net Borç (AP)" val="₺420K" sub="15 gün içinde ödenecek" icon={<DollarSign size={20}/>} color="#059669" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
         <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aylık Satınalma Trendi</h3>
            <div style={{ height: 350 }}>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{m:'Oca', v:210}, {m:'Şub', v:450}, {m:'Mar', v:300}, {m:'Nis', v:600}]}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                     <XAxis dataKey="m" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                     <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                     <Tooltip contentStyle={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                     <Line type="monotone" dataKey="v" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', margin: '0 0 24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tedarikçi Dağılımı</h3>
            <div style={{ height: 300 }}>
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={supplierChartData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {supplierChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                     </Pie>
                     <Tooltip contentStyle={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 20 }}>
               {supplierChartData.map((s, i) => (
                 <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                       <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.name || 'Bilinmeyen'}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>₺{formatNumber(s.value)}</span>
                 </div>
               ))}
               {supplierChartData.length === 0 && (
                 <p style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 40 }}>Henüz harcama verisi yok.</p>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

function StatCard({ label, val, sub, icon, color }) {
  return (
    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
         <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      </div>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <h2 style={{ margin: '4px 0', fontSize: 24, fontWeight: 900, color: '#f1f5f9' }}>{val}</h2>
      <p style={{ margin: 0, fontSize: 11, color: '#34d399', fontWeight: 600 }}>{sub}</p>
    </div>
  );
}
