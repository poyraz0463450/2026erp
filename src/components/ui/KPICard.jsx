export default function KPICard({ label, value, icon, trend }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8,
      padding: 24, flex: 1, minWidth: 0,
    }}>
      {/* Top: label + icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b' }}>
          {label}
        </span>
        <span style={{ color: '#334155' }}>{icon}</span>
      </div>
      {/* Number */}
      <p style={{ fontSize: 36, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {/* Trend */}
      {trend && (
        <p style={{ fontSize: 11, color: trend.startsWith('+') || trend.startsWith('Yok') ? '#22c55e' : trend.startsWith('-') ? '#dc2626' : '#64748b', marginTop: 8, fontWeight: 500 }}>
          {trend}
        </p>
      )}
    </div>
  );
}
