import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getAllUsers, setUserDoc, deleteUserDoc } from '../../firebase/firestore';
import { createAuthUser } from '../../firebase/auth';
import { ROLE_LABELS } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2 } from 'lucide-react';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

const roleBadge = {
  admin:     { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' },
  engineer:  { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
  warehouse: { bg: 'rgba(250,204,21,0.1)', color: '#fbbf24' },
  viewer:    { bg: '#1e293b',               color: '#94a3b8' },
};

const emptyForm = { email: '', password: '', displayName: '', role: 'viewer' };

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => { const s = await getAllUsers(); setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() }))); setLoading(false); };

  const create = async () => {
    setError('');
    if (!form.email || !form.password) { setError('E-posta ve şifre gerekli.'); return; }
    if (form.password.length < 6) { setError('Şifre en az 6 karakter.'); return; }
    setSaving(true);
    try {
      const c = await createAuthUser(form.email, form.password);
      await setUserDoc(c.user.uid, { email: form.email, displayName: form.displayName || form.email, role: form.role });
      setModal(false); setForm(emptyForm); load();
    } catch (e) {
      setError(e.code === 'auth/email-already-in-use' ? 'E-posta zaten kullanılıyor.' : e.message);
    } finally { setSaving(false); }
  };

  const del = async uid => { if (!confirm('Silmek istediğinizden emin misiniz?')) return; await deleteUserDoc(uid); load(); };

  if (!isAdmin) return <div style={{ padding: '80px 28px', textAlign: 'center' }}><p style={{ color: '#dc2626', fontSize: 13 }}>Yalnızca yöneticiler erişebilir.</p></div>;
  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>{users.length} kullanıcı</span>
        <button onClick={() => { setForm(emptyForm); setError(''); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Yeni Kullanıcı
        </button>
      </div>

      {users.length === 0 ? <EmptyState message="Kullanıcı yok" /> : (
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>Kullanıcı</th><th style={TH}>E-posta</th><th style={TH}>Rol</th>
              <th style={{ ...TH, textAlign: 'right', width: 60 }}>İşlem</th>
            </tr></thead>
            <tbody>
              {users.map(u => {
                const rb = roleBadge[u.role] || roleBadge.viewer;
                return (
                  <tr key={u.uid} onMouseEnter={e=>{e.currentTarget.style.background='#111827'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                          {(u.displayName || u.email || '?')[0].toUpperCase()}
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{u.displayName || '—'}</span>
                      </div>
                    </td>
                    <td style={TD}>{u.email}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, background: rb.bg, color: rb.color }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <button onClick={() => del(u.uid)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,38,38,0.1)';e.currentTarget.style.color='#dc2626'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#475569'}}
                      ><Trash2 size={13} strokeWidth={1.7} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Kullanıcı">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: 12 }}>{error}</div>}
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Ad Soyad</label><input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} style={INPUT} onFocus={e=>{e.target.style.borderColor='#dc2626'}} onBlur={e=>{e.target.style.borderColor='#334155'}} /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>E-posta</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={INPUT} onFocus={e=>{e.target.style.borderColor='#dc2626'}} onBlur={e=>{e.target.style.borderColor='#334155'}} /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Şifre</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="En az 6 karakter" style={INPUT} onFocus={e=>{e.target.style.borderColor='#dc2626'}} onBlur={e=>{e.target.style.borderColor='#334155'}} /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Rol</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{ ...INPUT, cursor: 'pointer' }}>{Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setModal(false)} style={{ height: 36, padding: '0 18px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>İptal</button>
            <button onClick={create} disabled={saving} style={{ height: 36, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Oluşturuluyor...' : 'Oluştur'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
