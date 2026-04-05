import { useEffect, useState } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { 
  getCustomers, addCustomer, updateCustomer, deleteCustomer 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Plus, Search, Mail, Phone, 
  MapPin, Building2, MoreVertical, Pencil, Trash2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

const TH = { background: '#0d1117', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #1e3a5f' };
const TD = { padding: '16px', fontSize: 13, color: '#94a3b8', borderBottom: '1px solid #1a2332' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };

export default function CustomersList() {
  const { isAdmin, isEngineer } = useAuth();
  const canEdit = isAdmin || isEngineer;

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', email: '', phone: '', address: '', taxOffice: '', taxNumber: '', contactPerson: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCustomers();
      setCustomers(res.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Müşteri listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateCustomer(editId, form);
        toast.success('Müşteri güncellendi');
      } else {
        await addCustomer(form);
        toast.success('Müşteri başarıyla eklendi');
      }
      setModal(false);
      load();
    } catch (e) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteCustomer(id);
      toast.success('Müşteri silindi');
      load();
    } catch (e) {
       toast.error('Silme işlemi başarısız');
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>Müşteri Yönetimi (CRM)</h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Küresel savunma sanayii ve ticari müşteri portföyü</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm({ name: '', code: '', email: '', phone: '', address: '', taxOffice: '', taxNumber: '', contactPerson: '' }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <Plus size={20}/> Yeni Müşteri Ekle
          </button>
        )}
      </div>

      <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
         <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input style={{ ...INPUT, paddingLeft: 36 }} placeholder="Müşteri adı veya kodu ile ara..." value={search} onChange={e=>setSearch(e.target.value)} />
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
        {filtered.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Müşteri bulunamadı." /></div> : filtered.map(c => (
           <div key={c.id} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 20 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                       <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1e3a8a20', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={24} />
                       </div>
                       <div>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{c.name}</h3>
                          <p style={{ margin: 0, fontSize: 11, color: '#475569', fontWeight: 700 }}>{c.code}</p>
                       </div>
                    </div>
                    {canEdit && (
                       <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setEditId(c.id); setForm(c); setModal(true); }} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1e', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={14}/></button>
                          <button onClick={() => handleDelete(c.id)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #450a0a', background: '#0a0f1e', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14}/></button>
                       </div>
                    )}
                 </div>
                 
                 <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}><Mail size={14}/> {c.email || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}><Phone size={14}/> {c.phone || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}><Users size={14}/> {c.contactPerson || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#475569', marginTop: 4 }}><MapPin size={14}/> {c.address || '—'}</div>
                 </div>
              </div>
              <div style={{ background: '#0a0f1e', padding: '12px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                 <span style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>V.N: {c.taxNumber || '—'}</span>
                 <span style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>{c.taxOffice || '—'}</span>
              </div>
           </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'} width={600}>
         <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MÜŞTERİ ADI</label><input style={INPUT} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required placeholder="Örn: ASELSAN A.Ş." /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>MÜŞTERİ KODU</label><input style={INPUT} value={form.code} onChange={e=>setForm({...form, code: e.target.value})} required placeholder="ASEL-001" /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>E-POSTA</label><input type="email" style={INPUT} value={form.email} onChange={e=>setForm({...form, email: e.target.value})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>TELEFON</label><input style={INPUT} value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>İLGİLİ KİŞİ</label><input style={INPUT} value={form.contactPerson} onChange={e=>setForm({...form, contactPerson: e.target.value})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>VERGİ DAİRESİ</label><input style={INPUT} value={form.taxOffice} onChange={e=>setForm({...form, taxOffice: e.target.value})} /></div>
               <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>VERGİ NUMARASI</label><input style={INPUT} value={form.taxNumber} onChange={e=>setForm({...form, taxNumber: e.target.value})} /></div>
            </div>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>ADRES</label>
               <textarea style={{ ...INPUT, height: 60, padding: 12, resize: 'none' }} value={form.address} onChange={e=>setForm({...form, address: e.target.value})} />
            </div>
            <button type="submit" style={{ height: 44, background: '#dc2626', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, borderRadius: 8, cursor: 'pointer', marginTop: 10 }}>MÜŞTERİ KAYDINI TAMAMLA</button>
         </form>
      </Modal>
    </div>
  );
}
