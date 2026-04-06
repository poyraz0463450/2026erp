import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getParts, addPurchaseRequest } from '../../firebase/firestore';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { formatNumber, formatDateOnly } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Calculator, AlertTriangle, ArrowRight, ShoppingCart, 
  Search, Filter, Download, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 };
const TH = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #1e293b' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1e293b' };

export default function MRPDashboard() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, critical, warning

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getParts();
      setParts(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = p.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isCritical = p.reorderPoint > 0 && p.currentStock <= p.reorderPoint;
      const isWarning = p.reorderPoint > 0 && p.currentStock <= p.reorderPoint * 1.5 && p.currentStock > p.reorderPoint;

      if (filterType === 'critical') return matchesSearch && isCritical;
      if (filterType === 'warning') return matchesSearch && isWarning;
      return matchesSearch;
    });
  }, [parts, searchTerm, filterType]);

  const handleCreatePR = async (part) => {
    try {
      const prData = {
        requesterId: userDoc.uid,
        requesterName: userDoc.displayName,
        partId: part.id,
        partNumber: part.partNumber,
        partName: part.name,
        requestedQty: part.reorderQty || (part.reorderPoint - part.currentStock) || 1,
        status: 'Taslak',
        priority: 'Yüksek',
        notes: 'MRP Otomatik oluşturuldu (Stok Kritik)',
      };
      await addPurchaseRequest(prData);
      toast.success(`${part.partNumber} için satınalma talebi oluşturuldu`);
    } catch (err) {
      toast.error('Hata oluştu');
    }
  };

  const exportCSV = () => {
    if (filteredParts.length === 0) return toast.error('Dışa aktarılacak veri bulunamadı');
    
    const headers = [
      'Parça No', 'Parça Adı', 'Mevcut Stok', 'Birim', 'Reorder Point (RP)', 
      'Lead Time (Gün)', 'Günlük Tüketim', 'Kalan Gün (Tahmin)', 'Durum'
    ];
    
    const rows = filteredParts.map(p => {
      const isCritical = p.reorderPoint > 0 && p.currentStock <= p.reorderPoint;
      const daysRemaining = p.avgDailyConsumption > 0 ? Math.floor(p.currentStock / p.avgDailyConsumption) : '∞';
      return [
        p.partNumber, p.name, p.currentStock || 0, p.unit || 'Adet', p.reorderPoint || 0,
        p.leadTimeDays || 0, p.avgDailyConsumption || 0, daysRemaining,
        isCritical ? 'KRİTİK' : 'NORMAL'
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Artegon_MRP_Raporu_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('MRP Raporu indirildi');
  };

  const stats = useMemo(() => {
    const critical = parts.filter(p => p.reorderPoint > 0 && p.currentStock <= p.reorderPoint).length;
    const warning = parts.filter(p => p.reorderPoint > 0 && p.currentStock <= p.reorderPoint * 1.5 && p.currentStock > p.reorderPoint).length;
    return { critical, warning };
  }, [parts]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>MRP Planlaması</h1>
          <p style={{ color: '#475569', fontSize: 14, margin: '4px 0 0' }}>Stok seviyeleri ve otomatik sipariş yönetimi</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={load} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ ...CARD_STYLE, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>KRİTİK STOKLAR</span>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', margin: '8px 0 0' }}>{stats.critical}</p>
        </div>
        <div style={{ ...CARD_STYLE, borderLeft: '4px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>RİSKLİ STOKLAR (1.5x RP)</span>
            <AlertTriangle size={16} color="#fbbf24" />
          </div>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24', margin: '8px 0 0' }}>{stats.warning}</p>
        </div>
        <div style={{ ...CARD_STYLE, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>TOPLAM PARÇA</span>
            <Calculator size={16} color="#3b82f6" />
          </div>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#3b82f6', margin: '8px 0 0' }}>{parts.length}</p>
        </div>
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#475569' }} />
              <input 
                placeholder="Parça no veya ad ile ara..." 
                style={{ width: '100%', height: 38, background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, padding: '0 12px 0 38px', color: '#fff', fontSize: 13 }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              style={{ height: 38, background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, padding: '0 12px', color: '#fff', fontSize: 13 }}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">Tüm Durumlar</option>
              <option value="critical">Sadece Kritik</option>
              <option value="warning">Sadece Riskli</option>
            </select>
          </div>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', background: '#0d1117', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={16} /> Excel İndir
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Parça No / Ad</th>
              <th style={TH}>Mevcut Stok</th>
              <th style={TH}>Sipariş Noktası (RP)</th>
              <th style={TH}>LT (Gün)</th>
              <th style={TH}>Günlük Tüketim</th>
              <th style={TH}>Kalan Gün (Tahmin)</th>
              <th style={{ ...TH, textAlign: 'right' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>
                  <EmptyState message="Kriterlere uygun parça bulunamadı." />
                </td>
              </tr>
            ) : (
              filteredParts.map(p => {
                const isCritical = p.reorderPoint > 0 && p.currentStock <= p.reorderPoint;
                const daysRemaining = p.avgDailyConsumption > 0 ? Math.floor(p.currentStock / p.avgDailyConsumption) : '∞';
                
                return (
                  <tr key={p.id} style={{ background: isCritical ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td style={TD}>
                      <div>
                        <p style={{ fontWeight: 800, color: '#f1f5f9', margin: 0 }}>{p.partNumber}</p>
                        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{p.name}</p>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isCritical ? '#ef4444' : '#f1f5f9' }}>
                        {formatNumber(p.currentStock)} {p.unit}
                      </span>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{p.reorderPoint || 0}</span>
                    </td>
                    <td style={TD}>{p.leadTimeDays || 0} G</td>
                    <td style={TD}>{p.avgDailyConsumption || 0} / gün</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ 
                          fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                          background: daysRemaining <= (p.leadTimeDays || 0) ? '#450a0a' : '#1e1b4b',
                          color: daysRemaining <= (p.leadTimeDays || 0) ? '#f87171' : '#818cf8'
                        }}>
                          {daysRemaining} Gün
                        </span>
                        {daysRemaining <= (p.leadTimeDays || 0) && (
                          <AlertTriangle size={14} color="#f87171" />
                        )}
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => navigate(`/parts/${p.id}`)}
                          style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', borderRadius: 6, cursor: 'pointer' }}
                        >
                          <ArrowRight size={14} />
                        </button>
                        <button 
                          onClick={() => handleCreatePR(p)}
                          style={{ 
                            height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, 
                            background: isCritical ? '#dc2626' : '#1e293b', border: 'none', 
                            color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' 
                          }}
                        >
                          <ShoppingCart size={14} /> PR Aç
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
