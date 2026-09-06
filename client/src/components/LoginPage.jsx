import { useState } from 'react';
import { risksApi } from '../api/risksApi';

export default function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your TFS username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await risksApi.login(username.trim(), password);
      localStorage.setItem('riskDashboard.token', result.token);
      localStorage.setItem('riskDashboard.username', result.username);
      onLoggedIn(result.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="philips-login">
      <div className="philips-login-panel">
        <div className="philips-brand">
          <img className="philips-logo-img" src="/Phillips-Logo.jpg" alt="Philips" />
        </div>

        <form className="philips-login-form" onSubmit={handleSubmit}>
          <h1>Risk Management Portal</h1>
          <p className="muted">Sign in with your IAM/DOMAIN credentials to continue.</p>

          <label className="philips-field">
            Username
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="DOMAIN\username"
              autoComplete="username"
            />
          </label>
          <label className="philips-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="field-error">{error}</div>}

          <button className="philips-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <footer className="philips-login-footer">
          © Koninklijke Philips N.V., 2004 – {new Date().getFullYear()}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
