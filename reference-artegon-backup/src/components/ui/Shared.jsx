import { Inbox } from 'lucide-react';

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
      <div className="anim-spin" style={{
        width: 28, height: 28, border: '2px solid #1e293b', borderTopColor: '#dc2626', borderRadius: '50%',
      }} />
    </div>
  );
}

export function EmptyState({ message = 'Veri bulunamadı' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', color: '#475569' }}>
      <Inbox size={36} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.5 }} />
      <p style={{ fontSize: 13, fontWeight: 500 }}>{message}</p>
    </div>
  );
}
