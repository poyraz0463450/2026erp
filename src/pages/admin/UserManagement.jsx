import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import { createAuthUser } from '../../firebase/auth';
import { seedDemoData } from '../../firebase/demoData';
import { seedLocalDepartmentDemos } from '../../firebase/localDemo';
import { deleteUserDoc, getAllUsers, setUserDoc } from '../../firebase/firestore';
import { ROLE_LABELS } from '../../utils/helpers';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f', whiteSpace: 'nowrap' };
const TD = { padding: '0 16px', height: 48, fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332', verticalAlign: 'middle' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' };

const roleBadge = {
  admin: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' },
  engineer: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
  warehouse: { bg: 'rgba(250,204,21,0.1)', color: '#fbbf24' },
  kalite: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80' },
  satin_alma: { bg: 'rgba(14,165,233,0.1)', color: '#38bdf8' },
  sales: { bg: 'rgba(168,85,247,0.1)', color: '#c084fc' },
  finance: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  viewer: { bg: '#1e293b', color: '#94a3b8' },
};

const emptyForm = { email: '', password: '', displayName: '', role: 'viewer' };

export default function UserManagement() {
  const { isAdmin, user, userDoc } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSummary, setSeedSummary] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const snapshot = await getAllUsers();
      const rows = snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }))
        .filter((item) => {
          const email = String(item.email || '').toLowerCase();
          return !email.startsWith('probe.') && !email.startsWith('demo.seed.');
        });
      setUsers(rows);
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setError('');
    if (!form.email || !form.password) {
      setError('E-posta ve şifre zorunludur.');
      return;
    }
    if (form.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setSaving(true);
    try {
      const credential = await createAuthUser(form.email, form.password);
      await setUserDoc(credential.user.uid, {
        email: form.email,
        displayName: form.displayName || form.email,
        full_name: form.displayName || form.email,
        role: form.role,
      });
      toast.success('Kullanıcı oluşturuldu');
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'Bu e-posta zaten kullanılıyor.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (uid) => {
    if (!confirm('Bu kullanıcı kaydını silmek istediğinize emin misiniz?')) return;
    await deleteUserDoc(uid);
    load();
  };

  const loadDemoData = async () => {
    if (!confirm('Tüm departmanlar için demo veri yeniden kurulacak. Devam edilsin mi?')) return;

    setSeeding(true);
    try {
      const localSummary = seedLocalDepartmentDemos({ forceReset: true });
      const summary = await seedDemoData({
        currentUserName: userDoc?.displayName || userDoc?.full_name || user?.email || 'Sistem Yöneticisi',
        currentUserEmail: user?.email || 'admin@artegon.local',
      });

      setSeedSummary({ ...summary, localSummary });
      toast.success(`Demo hazır: ${summary.models} model, ${summary.parts} parça, ${summary.workOrders} iş emri`);
    } catch (error) {
      console.error(error);
      toast.error('Demo veri yüklenemedi');
    } finally {
      setSeeding(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '80px 28px', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: 13 }}>Yalnızca yöneticiler erişebilir.</p>
      </div>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, padding: 20, background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 18, fontWeight: 800 }}>Departman Demo Merkezi</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: '1.5' }}>
              Mühendislik, satın alma, kalite, depo, üretim, satış ve finans modülleri için örnek veri yükler. Firestore destekli ana akışlar ile yerel demo koleksiyonları birlikte hazırlanır.
            </p>
          </div>
          <button
            onClick={loadDemoData}
            disabled={seeding}
            style={{ height: 40, padding: '0 18px', background: '#0e7490', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.7 : 1 }}
          >
            {seeding ? 'Demo hazırlanıyor...' : 'Departman Demolarını Kur'}
          </button>
        </div>

        {seedSummary ? (
          <>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {[
                `Parça: ${seedSummary.parts}`,
                `Model: ${seedSummary.models}`,
                `İş Emri: ${seedSummary.workOrders}`,
                `Satış Siparişi: ${seedSummary.salesOrders}`,
                `Lot: ${seedSummary.inventoryBatches}`,
                `QC Kaydı: ${seedSummary.qcInspections}`,
                `PO: ${seedSummary.purchaseOrders}`,
                `Yerel Demo: ${seedSummary.localSummary?.records || 0}`,
              ].map((item) => (
                <div key={item} style={{ padding: '12px 14px', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>
                  {item}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 12, lineHeight: '1.7' }}>
              Örnek sorgular:
              <br />
              Lotlar: {seedSummary.sampleLotNumbers?.join(', ')}
              <br />
              Satınalma Siparişi: {seedSummary.samplePurchaseOrder}
              <br />
              İş Emri: {seedSummary.sampleWorkOrder}
              <br />
              Satış Siparişi: {seedSummary.sampleSalesOrder}
            </div>
          </>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>{users.length} kullanıcı</span>
        <button onClick={() => { setForm(emptyForm); setError(''); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} />
          Yeni Kullanıcı
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState message="Kullanıcı yok" />
      ) : (
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Kullanıcı</th>
                <th style={TH}>E-posta</th>
                <th style={TH}>Rol</th>
                <th style={{ ...TH, textAlign: 'right', width: 60 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((userRow) => {
                const badge = roleBadge[userRow.role] || roleBadge.viewer;
                const displayName = userRow.full_name || userRow.displayName || userRow.email || '-';

                return (
                  <tr key={userRow.uid}>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                          {displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{displayName}</span>
                      </div>
                    </td>
                    <td style={TD}>{userRow.email}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                        {ROLE_LABELS[userRow.role] || userRow.role}
                      </span>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <button onClick={() => removeUser(userRow.uid)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                        <Trash2 size={13} strokeWidth={1.7} />
                      </button>
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
          {error ? (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: 12 }}>
              {error}
            </div>
          ) : null}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Ad Soyad</label>
            <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} style={INPUT} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>E-posta</label>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} style={INPUT} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Şifre</label>
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} style={INPUT} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Rol</label>
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} style={{ ...INPUT, cursor: 'pointer' }}>
              {Object.entries(ROLE_LABELS).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setModal(false)} style={{ height: 36, padding: '0 18px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              İptal
            </button>
            <button onClick={create} disabled={saving} style={{ height: 36, padding: '0 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
