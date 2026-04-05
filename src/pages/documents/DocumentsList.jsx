import { useEffect, useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getDocuments, addDocument, updateDocument, deleteDocument, getParts } from '../../firebase/firestore';
import { DOC_CATEGORIES, DOC_REV_STATUSES, formatDateOnly } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Search, Pencil, Trash2, FileText, 
  CheckCircle2, AlertCircle, Filter, 
  Download, Clock, ShieldCheck, ExternalLink, Box
} from 'lucide-react';
import toast from 'react-hot-toast';

const CARD_STYLE = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s ease' };
const INPUT = { width: '100%', height: 40, padding: '0 12px', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };
const emptyForm = { title: '', category: 'Teknik Resim', linkedPartId: '', linkedWO: '', revision: 'A', fileName: '', description: '', revisionStatus: 'Taslak', isDownloadable: true, docNumber: '' };

const STATUS_MAP = {
  'Taslak': { color: '#64748b', bg: '#1e293b', icon: <Clock size={12} /> },
  'İncelemede': { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', icon: <AlertCircle size={12} /> },
  'Onaylandı': { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', icon: <CheckCircle2 size={12} /> },
  'Pasif': { color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', icon: <Trash2 size={12} /> }
};

export default function DocumentsList() {
  const { isAdmin, isEngineer, userDoc } = useAuth();
  const canEdit = isAdmin || isEngineer;
  
  const [docs, setDocs] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [dS, pS] = await Promise.all([getDocuments(), getParts()]);
      setDocs(dS.docs.map(d => ({ id: d.id, ...d.data() })));
      setParts(pS.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Dökümanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    if (e) e.preventDefault();
    try {
      let toSave = { 
        ...form, 
        updatedAt: new Date().toISOString(),
        updatedBy: userDoc?.displayName || 'Sistem'
      };
      
      if (!editId) {
        toSave.createdAt = new Date().toISOString();
        toSave.uploadedBy = userDoc?.displayName || 'Sistem';
      }

      if (editId) await updateDocument(editId, toSave); 
      else await addDocument(toSave); 

      toast.success(editId ? 'Güncellendi' : 'Eklendi');
      setModal(false); 
      load();
    } catch (err) {
      toast.error('Hata oluştu');
    }
  };
  
  const del = async id => { 
    if (!confirm('Bu dökümanı silmek istediğinizden emin misiniz?')) return; 
    try {
      await deleteDocument(id); 
      toast.success('Silindi');
      load(); 
    } catch (e) { toast.error('Hata'); }
  };

  const approve = async doc => {
    try {
      await updateDocument(doc.id, { 
        revisionStatus: 'Onaylandı', 
        approvedBy: userDoc?.displayName || 'Sistem', 
        approvedAt: new Date().toISOString() 
      });
      toast.success('Döküman onaylandı');
      load();
    } catch (e) { toast.error('Onay hatası'); }
  };

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const s = search.toLowerCase();
      const matchSearch = !search || d.title?.toLowerCase().includes(s) || d.fileName?.toLowerCase().includes(s) || d.docNumber?.toLowerCase().includes(s);
      const matchCat = filterCat === 'all' || d.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [docs, search, filterCat]);

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Doküman Yönetimi (PDM)</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Merkezi teknik dökümantasyon ve revizyon kontrol sistemi</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditId(null); setForm(emptyForm); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', background: '#3b82f6', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <Plus size={18} /> Yeni Doküman Yükle
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div style={CARD_STYLE}>
              <h4 style={{ margin: '0 0 16px', padding: '16px 16px 0', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Kategoriler</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 16px' }}>
                 <button 
                   onClick={() => setFilterCat('all')}
                   style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 6, background: filterCat === 'all' ? '#1e293b' : 'transparent', border: 'none', color: filterCat === 'all' ? '#fff' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                 >Tüm Dökümanlar</button>
                 {DOC_CATEGORIES.map(c => (
                   <button 
                     key={c}
                     onClick={() => setFilterCat(c)}
                     style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 6, background: filterCat === c ? '#1e293b' : 'transparent', border: 'none', color: filterCat === c ? '#fff' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                   >{c}</button>
                 ))}
              </div>
           </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div style={{ ...CARD_STYLE, padding: 12, display: 'flex', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                 <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#475569' }} />
                 <input 
                    style={{ ...INPUT, paddingLeft: 40 }} 
                    placeholder="Başlık, numara veya dosya adı ile ara..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                 />
              </div>
              <button style={{ height: 40, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8, color: '#475569', cursor: 'pointer' }}>
                 <Filter size={18} />
              </button>
           </div>

           {filtered.length === 0 ? (
             <EmptyState message="Aradığınız kriterlere uygun döküman bulunamadı." />
           ) : (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {filtered.map(doc => {
                  const status = STATUS_MAP[doc.revisionStatus] || STATUS_MAP['Taslak'];
                  return (
                    <div key={doc.id} style={CARD_STYLE}>
                       <div style={{ padding: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                             <div style={{ width: 44, height: 44, borderRadius: 10, background: '#0a0f1e', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                <FileText size={24} />
                             </div>
                             <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: status.bg, color: status.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                                   {status.icon} {doc.revisionStatus.toUpperCase()}
                                </span>
                             </div>
                          </div>
                          
                          <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{doc.title}</h4>
                          <p style={{ margin: 0, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{doc.docNumber || 'NO-REF'}</p>
                          
                          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                                <ShieldCheck size={14} color="#64748b" />
                                <span>Revizyon: <strong>{doc.revision}</strong></span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                                <Box size={14} color="#64748b" />
                                <span>{doc.linkedPartNumber || 'Genel Doküman'}</span>
                             </div>
                          </div>

                          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                             <button style={{ flex: 1, height: 36, background: '#1e1b4b', border: 'none', borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Download size={14} /> İndir
                             </button>
                          </div>
                       </div>

                       <div style={{ background: '#0a0f1e', padding: '12px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#475569' }}>{formatDateOnly(doc.createdAt)}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                             {doc.revisionStatus === 'İncelemede' && canEdit && (
                               <button onClick={() => approve(doc)} style={{ height: 28, padding: '0 12px', background: '#065f46', border: 'none', borderRadius: 6, color: '#34d399', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Onayla</button>
                             )}
                             <button onClick={() => { setEditId(doc.id); setForm(doc); setModal(true); }} style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                                <Pencil size={14} />
                             </button>
                             {isAdmin && (
                               <button onClick={() => del(doc.id)} style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#450a0a', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                                  <Trash2 size={14} />
                               </button>
                             )}
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Doküman Düzenle' : 'Yeni Doküman Yükle'}>
         <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>DOKÜMAN BAŞLIĞI</label>
               <input style={INPUT} value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="Örn: Gövde Teknik Resmi" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
               <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>KATEGORİ</label>
                  <select style={INPUT} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                     {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>REVİZYON</label>
                  <input style={INPUT} value={form.revision} onChange={e => setForm({...form, revision: e.target.value})} />
               </div>
            </div>

            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>DOKÜMAN NUMARASI</label>
               <input style={INPUT} value={form.docNumber} onChange={e => setForm({...form, docNumber: e.target.value})} placeholder="Örn: TR-100-01" />
            </div>

            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>BAĞLI PARÇA</label>
               <select style={INPUT} value={form.linkedPartId} onChange={e => {
                 const p = parts.find(x => x.id === e.target.value);
                 setForm({...form, linkedPartId: e.target.value, linkedPartNumber: p?.partNumber || ''});
               }}>
                  <option value="">Genel (Parçaya bağlı değil)</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} — {p.name}</option>)}
               </select>
            </div>

            <div>
               <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>AÇIKLAMA</label>
               <textarea style={{ ...INPUT, height: 80, padding: 12, resize: 'none' }} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
               <button type="button" onClick={() => setModal(false)} style={{ height: 40, padding: '0 20px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
               <button type="submit" style={{ height: 40, padding: '0 32px', background: '#3b82f6', border: 'none', borderRadius: 8, color: 'white', fontWeight: 800, cursor: 'pointer' }}>Kaydet</button>
            </div>
         </form>
      </Modal>
    </div>
  );
}
