import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../firebase/auth';
import { Mail, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password);
      navigate('/');
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'E-posta veya şifre hatalı.',
        'auth/user-not-found': 'E-posta veya şifre hatalı.',
        'auth/wrong-password': 'E-posta veya şifre hatalı.',
        'auth/too-many-requests': 'Çok fazla deneme. Lütfen bekleyin.',
      };
      setError(msgs[err.code] || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', height: 42, padding: '0 14px 0 40px',
    background: '#0a0f1e', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e' }}>
      <div className="anim-fade" style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/logo.png" alt="ARTEGON" style={{ width: 180, height: 'auto', objectFit: 'contain', display: 'inline-block' }} />
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3, color: '#475569', marginTop: 10, textTransform: 'uppercase' }}>
            Savunma Sanayi A.Ş.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '32px 28px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' }}>Giriş Yap</h2>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 24px' }}>ERP sistemine erişim</p>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 6, marginBottom: 16, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: 12 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>E-posta</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} strokeWidth={1.7} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="ornek@artegon.com.tr" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#dc2626'; }}
                  onBlur={e => { e.target.style.borderColor = '#334155'; }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} strokeWidth={1.7} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#dc2626'; }}
                  onBlur={e => { e.target.style.borderColor = '#334155'; }}
                />
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', height: 42, background: '#dc2626', border: 'none', borderRadius: 6,
                color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="anim-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  Giriş yapılıyor...
                </span>
              ) : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#334155', marginTop: 28 }}>
          © 2025 ARTEGON Savunma Sanayi A.Ş.
        </p>
      </div>
    </div>
  );
}
