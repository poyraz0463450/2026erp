const cfg = {
  Taslak:     { bg: '#1e293b', color: '#94a3b8' },
  Onaylı:     { bg: '#172554', color: '#60a5fa' },
  Üretimde:   { bg: '#422006', color: '#fbbf24' },
  Tamamlandı: { bg: '#14532d', color: '#4ade80' },
  İptal:      { bg: '#450a0a', color: '#f87171' },
};

export default function StatusBadge({ status }) {
  const s = cfg[status] || cfg.Taslak;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, lineHeight: '18px',
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}
