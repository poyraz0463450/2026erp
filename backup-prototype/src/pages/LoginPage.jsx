import { useState } from "react";
import { Navigate } from "react-router-dom";

import { InlineAlert } from "../components/InlineAlert";
import { useAuth } from "../app/providers/AuthProvider";

export function LoginPage() {
  const { signIn, user, isDemoMode } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user || isDemoMode) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(values.email, values.password);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src="/logo.png" alt="Artegon" />
        <p className="brand-block__eyebrow">Artegon ERP</p>
        <h1>Giris Yap</h1>
        <p>Yonetici, muhendis ve operator rolleri Firebase Authentication uzerinden yonetilir.</p>
        <InlineAlert kind="error" message={error} />
        <label className="form-field">
          <span className="form-field__label">E-posta</span>
          <input name="email" type="email" value={values.email} onChange={handleChange} required />
        </label>
        <label className="form-field">
          <span className="form-field__label">Sifre</span>
          <input
            name="password"
            type="password"
            value={values.password}
            onChange={handleChange}
            required
          />
        </label>
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? "Giris yapiliyor..." : "Giris"}
        </button>
      </form>
    </div>
  );
}
