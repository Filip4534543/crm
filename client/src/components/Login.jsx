import { useState } from 'react';
import { api, setToken } from '../api';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(password);
      setToken(token);
      onSuccess();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Cannot POST') || msg.includes('404')) {
        setError('API niedostępne — poczekaj na deploy Netlify lub sprawdź zakładkę API.');
      } else if (msg === 'Unauthorized' || msg.includes('401')) {
        setError('Nieprawidłowe hasło');
      } else {
        setError(msg || 'Nieprawidłowe hasło');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Filip's CRM" className="login-logo" />
        <h1>Filip's CRM</h1>
        <p>Websites · SEO · Nowe leady</p>
        {error && <p className="login-error">{error}</p>}
        <input
          type="password"
          placeholder="Hasło"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logowanie…' : 'Zaloguj'}
        </button>
      </form>
    </div>
  );
}
