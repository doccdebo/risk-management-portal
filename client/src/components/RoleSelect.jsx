import { useState } from 'react';
import { risksApi } from '../api/risksApi';

const ROLES = [
  {
    key: 'security_engineer',
    title: 'Security Engineer',
    icon: '🛡️',
    description: 'Full access: create, edit and delete risks, manage attachments, and post comments.',
  },
  {
    key: 'developer',
    title: 'Developer',
    icon: '💻',
    description: 'Read-only access to all risk fields. You can change the risk State and post comments.',
  },
];

export default function RoleSelect({ username, onRoleChosen }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  async function pickRole(role) {
    setLoading(role);
    setError('');
    try {
      const result = await risksApi.chooseRole(role);
      localStorage.setItem('riskDashboard.role', result.role);
      onRoleChosen(result.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="philips-login">
      <div className="philips-login-panel philips-role-panel">
        <div className="philips-brand">
          <img className="philips-logo-img" src="/Phillips-Logo.jpg" alt="Philips" />
        </div>

        <div className="philips-login-form">
          <h1>Welcome, {username}</h1>
          <p className="muted">Choose how you'll be working with risks in this session.</p>

          {error && <div className="field-error">{error}</div>}

          <div className="role-options">
            {ROLES.map((r) => (
              <button
                key={r.key}
                className="role-option"
                onClick={() => pickRole(r.key)}
                disabled={!!loading}
              >
                <span className="role-icon">{r.icon}</span>
                <span className="role-title">{r.title}</span>
                <span className="role-desc">{r.description}</span>
                {loading === r.key && <span className="muted small">Loading…</span>}
              </button>
            ))}
          </div>
        </div>

        <footer className="philips-login-footer">
          © Koninklijke Philips N.V., 2004 – {new Date().getFullYear()}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
