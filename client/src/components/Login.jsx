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
    } catch {
      setError('Nieprawidłowe hasło');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Filip's CRM" className="login-logo" />
        <h1>Filip's CRM</h1>
        <p>Pipeline sprzedażowy</p>
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
