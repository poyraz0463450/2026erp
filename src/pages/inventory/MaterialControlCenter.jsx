import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Factory, Package, RefreshCw, ShoppingCart } from 'lucide-react';
import { EmptyState, Spinner } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import { formatNumber } from '../../utils/helpers';
import { loadMaterialPlanningSnapshot, syncMaterialPlanning } from '../../services/materialPlanningService';

const CARD = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 20 };
const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 64, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 40, padding: '0 14px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };

const severityStyle = {
  critical: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Kritik' },
  warning: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: 'Riskli' },
  normal: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', label: 'Normal' },
};

const channelStyle = {
  purchase: { color: '#60a5fa', label: 'Satınalma Tedarik' },
  production: { color: '#c084fc', label: 'İç Üretim Talebi' },
};

const getActionStatus = (row) => {
  if (row.severity === 'normal') return 'Stok dengede';
  if (row.actionStarted) return 'Aksiyon başlatıldı';
  if (row.netNeed > 0) return 'Yeni aksiyon gerekli';
  return 'Takipte';
};

const getReferenceText = (row) => {
  if (row.supplyChannel === 'purchase') {
    const refs = [
      ...(row.relatedRequests || []).map((item) => item.prNumber || item.id),
      ...(row.relatedOrders || []).map((item) => item.poNumber || item.id),
    ];
    return refs.length ? refs.join(', ') : 'Henüz kayıt yok';
  }

  const refs = (row.relatedOrders || []).map((item) => item.woNumber || item.id);
  return refs.length ? refs.join(', ') : 'Henüz kayıt yok';
};

export default function MaterialControlCenter() {
  const { isAdmin, isEngineer, user, userDoc } = useAuth();
  const canRunPlanner = isAdmin || isEngineer;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastSummary, setLastSummary] = useState(null);

  const loadSnapshot = async () => {
    const snapshot = await loadMaterialPlanningSnapshot();
    setRows(snapshot);
  };

  const runPlanner = async (showToast = false) => {
    setSyncing(true);
    try {
      const result = await syncMaterialPlanning({
        actorName: userDoc?.full_name || userDoc?.displayName || user?.email || 'Sistem',
        actorEmail: user?.email || 'system@artegon.local',
      });
      setLastSummary(result);
      await loadSnapshot();
      if (showToast) {
        toast.success(
          `Planlama tamamlandı: ${result.createdPurchaseRequests.length} satınalma, ${result.createdWorkOrders.length} iç üretim talebi açıldı`
        );
      }
    } catch (error) {
      console.error(error);
      toast.error('Malzeme planlama motoru çalıştırılamadı');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setLoading(true);
      try {
        if (canRunPlanner) {
          await runPlanner(false);
        } else {
          await loadSnapshot();
          if (active) setLoading(false);
        }
      } catch (error) {
        console.error(error);
        if (active) setLoading(false);
      }
    };

    initialize();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRunPlanner]);

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => row.severity !== 'normal')
        .filter((row) => {
          if (!search) return true;
          const target = `${row.part.partNumber || ''} ${row.part.name || ''}`.toLowerCase();
          return target.includes(search.toLowerCase());
        }),
    [rows, search]
  );

  const stats = useMemo(() => {
    const critical = rows.filter((row) => row.severity === 'critical');
    const warnings = rows.filter((row) => row.severity === 'warning');
    return {
      totalTracked: rows.length,
      critical: critical.length,
      warning: warnings.length,
      purchase: critical.filter((row) => row.supplyChannel === 'purchase').length,
      production: critical.filter((row) => row.supplyChannel === 'production').length,
      actionStarted: critical.filter((row) => row.actionStarted).length,
    };
  }, [rows]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Malzeme Kontrol Merkezi</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            Depo yalnızca malzeme adetlerini ve lot izlenebilirliğini yönetir. Eksik stok oluştuğunda sistem otomatik olarak satınalma tedarikini veya iç üretim talebini başlatır.
          </p>
        </div>
        <button
          onClick={() => runPlanner(true)}
          disabled={!canRunPlanner || syncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 18px',
            background: '#dc2626',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: !canRunPlanner || syncing ? 'not-allowed' : 'pointer',
            opacity: !canRunPlanner || syncing ? 0.65 : 1,
          }}
        >
          <RefreshCw size={16} />
          {syncing ? 'Planlama Çalışıyor...' : 'Planlama Motorunu Çalıştır'}
        </button>
      </div>

      <div style={{ ...CARD, marginBottom: 20, borderLeft: '4px solid #dc2626' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>Departman Sorumluluğu</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          Depo: stok miktarı, lot, sayım ve izlenebilirlik
          <br />
          Satınalma: eksik hammadde / tedarik edilen parça için PR ve PO süreci
          <br />
          Üretim Planlama: iç üretilecek kalemler için iş emri ve kapasite planı
        </div>
        {lastSummary ? (
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
            Son çalıştırma sonucu:
            {' '}
            {lastSummary.createdPurchaseRequests.length} satınalma talebi,
            {' '}
            {lastSummary.createdWorkOrders.length} iç üretim talebi açıldı.
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'İzlenen Malzeme', value: stats.totalTracked, color: '#60a5fa', icon: <Package size={18} /> },
          { label: 'Kritik Alarm', value: stats.critical, color: '#f87171', icon: <AlertTriangle size={18} /> },
          { label: 'Riskli Seviye', value: stats.warning, color: '#fbbf24', icon: <AlertTriangle size={18} /> },
          { label: 'Satınalma Açılacak', value: stats.purchase, color: '#38bdf8', icon: <ShoppingCart size={18} /> },
          { label: 'İç Üretim Açılacak', value: stats.production, color: '#c084fc', icon: <Factory size={18} /> },
          { label: 'Aksiyon Başladı', value: stats.actionStarted, color: '#34d399', icon: <RefreshCw size={18} /> },
        ].map((item) => (
          <div key={item.label} style={{ ...CARD, borderTop: `3px solid ${item.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{item.label}</span>
              <span style={{ color: item.color }}>{item.icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>{formatNumber(item.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, padding: 16, marginBottom: 18 }}>
        <input
          style={INPUT}
          placeholder="Parça numarası veya ad ile ara..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Parça</th>
              <th style={TH}>Sınıf</th>
              <th style={TH}>Aksiyon Yönü</th>
              <th style={{ ...TH, textAlign: 'right' }}>Mevcut / Min</th>
              <th style={{ ...TH, textAlign: 'right' }}>Net İhtiyaç</th>
              <th style={TH}>Sistem Durumu</th>
              <th style={TH}>Açılan Kayıtlar</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 60 }}>
                  <EmptyState message="Açık stok alarmı bulunmuyor." />
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const severity = severityStyle[row.severity];
                const channel = channelStyle[row.supplyChannel];
                return (
                  <tr key={row.part.id}>
                    <td style={TD}>
                      <div style={{ fontWeight: 800, color: '#f8fafc' }}>{row.part.partNumber}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{row.part.name}</div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6, background: severity.bg, color: severity.color }}>
                        {severity.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: channel.color }}>{channel.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {row.part.category} / {row.part.subCategory || '-'}
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: row.severity === 'critical' ? '#f87171' : '#fbbf24' }}>
                        {formatNumber(row.currentStock)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Min: {formatNumber(row.threshold)}</div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#f8fafc' }}>{formatNumber(row.netNeed || 0)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Açık kapsam: {formatNumber(row.openCoverageQty)}</div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: row.actionStarted ? '#34d399' : '#fbbf24' }}>
                        {getActionStatus(row)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {row.preferredSupplier?.supplierName || row.model?.modelCode || 'Planlama bekliyor'}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', lineHeight: 1.6 }}>
                        {getReferenceText(row)}
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
