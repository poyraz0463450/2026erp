import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/ui/Shared';
import { 
  getNcrRecordById, updateNcrRecord, getParts, getQcInspectionById 
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, Save, Users, AlertCircle, 
  Search, ShieldAlert, CheckCircle2, 
  Clock, ClipboardList, Zap, Target, 
  BarChart3, Award
} from 'lucide-react';
import toast from 'react-hot-toast';

const CARD = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 };
const SECTION_TITLE = { fontSize: 14, fontWeight: 800, color: '#60a5fa', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase' };
const INPUT = { width: '100%', height: 38, padding: '0 12px', background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 };
const TEXTAREA = { ...INPUT, height: 80, padding: 12, resize: 'none' };
const LABEL = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' };

export default function NCRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userDoc, isAdmin, isKalite } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ncr, setNcr] = useState(null);
  const [part, setPart] = useState(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const res = await getNcrRecordById(id);
      if (!res.exists()) {
        toast.error('NCR bulunamadı');
        navigate('/qc/ncr');
        return;
      }
      const data = { id: res.id, ...res.data() };
      setNcr(data);
      
      const pRes = await getParts();
      const pData = pRes.docs.find(d => d.id === data.partId);
      if (pData) setPart({ id: pData.id, ...pData.data() });
      
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateNcrRecord(id, ncr);
      toast.success('8D Raporu güncellendi');
    } catch (e) {
      toast.error('Kaydedilemedi');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #ef4444', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/qc/ncr')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #1e293b', background: '#0d1117', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>NCR / 8D Raporu: {ncr.id.slice(0,8).toUpperCase()}</h1>
              <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{part?.partNumber} — {part?.name} (Lot: {ncr.lotNumber})</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
             <select style={{ ...INPUT, width: 150, borderColor: '#ef4444' }} value={ncr.status} onChange={e=>setNcr({...ncr, status: e.target.value})}>
                <option value="Yeni">Yeni</option>
                <option value="Analizde">Analizde</option>
                <option value="Düzeltme Aşamasında">Düzeltme</option>
                <option value="Doğrulama">Doğrulama</option>
                <option value="Kapalı">Kapalı (Closed)</option>
             </select>
             <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 24px', background: '#ef4444', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8 }}>
                <Save size={18} /> Raporu Kaydet
             </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#05070a', padding: 24 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          
          {/* D1 & D2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={CARD}>
              <h3 style={SECTION_TITLE}><Users size={18}/> D1 - Ekip Oluşturma</h3>
              <label style={LABEL}>Ekip Üyeleri (Virgülle ayırın)</label>
              <textarea style={TEXTAREA} value={ncr.d1_team?.join(', ')} onChange={e=>setNcr({...ncr, d1_team: e.target.value.split(',').map(s=>s.trim())})} placeholder="Örn: Ahmet (Kalite), Mehmet (Üretim)..." />
            </div>
            <div style={CARD}>
              <h3 style={SECTION_TITLE}><AlertCircle size={18}/> D2 - Problemin Tanımı</h3>
              <label style={LABEL}>5N1K Analizi / Hata Detayı</label>
              <textarea style={TEXTAREA} value={ncr.d2_problem} onChange={e=>setNcr({...ncr, d2_problem: e.target.value})} placeholder="Ne oldu? Nerede oldu? Ne zaman tespit edildi?..." />
            </div>
          </div>

          {/* D3 & D4 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={CARD}>
              <h3 style={SECTION_TITLE}><ShieldAlert size={18}/> D3 - Geçici Koruma Önlemleri</h3>
              <label style={LABEL}>Karantina / Stok Kontrol / Ayıklama</label>
              <textarea style={TEXTAREA} value={ncr.d3_containment} onChange={e=>setNcr({...ncr, d3_containment: e.target.value})} placeholder="Mevcut hatalı parçalar için alınan acil önlem..." />
            </div>
            <div style={CARD}>
               <h3 style={SECTION_TITLE}><Search size={18}/> D4 - Kök Neden Analizi</h3>
               <label style={LABEL}>Neden Oldu? (5 Neden Analizi)</label>
               <textarea style={TEXTAREA} value={ncr.d4_root_cause} onChange={e=>setNcr({...ncr, d4_root_cause: e.target.value})} placeholder="Süreçteki hangi aksaklık bu hataya yol açtı?..." />
            </div>
          </div>

          {/* D5 & D6 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={CARD}>
              <h3 style={SECTION_TITLE}><Zap size={18}/> D5 - Düzeltici Faaliyet Belirleme</h3>
              <label style={LABEL}>Planlanan Faaliyet</label>
              <textarea style={TEXTAREA} value={ncr.d5_corrective_action} onChange={e=>setNcr({...ncr, d5_corrective_action: e.target.value})} />
            </div>
            <div style={CARD}>
               <h3 style={SECTION_TITLE}><Target size={18}/> D6 - Faaliyetin Uygulanması</h3>
               <label style={LABEL}>Uygulama Notları & Doğrulama</label>
               <textarea style={TEXTAREA} value={ncr.d6_implementation} onChange={e=>setNcr({...ncr, d6_implementation: e.target.value})} />
            </div>
          </div>

          {/* D7 & D8 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={CARD}>
              <h3 style={SECTION_TITLE}><BarChart3 size={18}/> D7 - Önleyici Faaliyetler</h3>
              <label style={LABEL}>Tekrarı Engelleme (Süreç Güncelleme)</label>
              <textarea style={TEXTAREA} value={ncr.d7_prevention} onChange={e=>setNcr({...ncr, d7_prevention: e.target.value})} placeholder="FMEA / Talimat güncellemesi yapıldı mı?..." />
            </div>
            <div style={CARD}>
               <h3 style={SECTION_TITLE}><Award size={18}/> D8 - Ekip Onayı & Kapatma</h3>
               <label style={LABEL}>Kapanış Notları</label>
               <textarea style={TEXTAREA} value={ncr.d8_closure} onChange={e=>setNcr({...ncr, d8_closure: e.target.value})} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
