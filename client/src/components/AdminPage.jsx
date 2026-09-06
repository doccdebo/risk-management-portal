import { useEffect, useState } from 'react';
import { adminApi } from '../api/adminApi';

function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.login(username.trim(), password);
      localStorage.setItem('riskDashboard.adminToken', result.token);
      onLoggedIn();
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
          <h1>Admin Console</h1>
          <p className="muted">Sign in to onboard business units.</p>

          <label className="philips-field">
            Username
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

const emptyForm = { project_name: '', service_name: '', timeline: '', users: [] };

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem('riskDashboard.adminToken'));
  const [bus, setBus] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [userInput, setUserInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const list = await adminApi.listBusinessUnits();
      setBus(list);
    } catch (err) {
      if (err.message.includes('401')) {
        localStorage.removeItem('riskDashboard.adminToken');
        setLoggedIn(false);
      } else {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    if (loggedIn) refresh();
  }, [loggedIn]);

  function addUser() {
    const v = userInput.trim();
    if (!v) return;
    if (!form.users.includes(v)) setForm((f) => ({ ...f, users: [...f.users, v] }));
    setUserInput('');
  }

  function removeUser(u) {
    setForm((f) => ({ ...f, users: f.users.filter((x) => x !== u) }));
  }

  async function handleOnboard(e) {
    e.preventDefault();
    setError('');
    if (!form.project_name.trim() || !form.service_name.trim() || !form.timeline.trim()) {
      setError('Project name, service name and timeline are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateBusinessUnit(editingId, form);
      } else {
        await adminApi.createBusinessUnit(form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this business unit onboarding?')) return;
    try {
      await adminApi.deleteBusinessUnit(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleEdit(businessUnit) {
    setForm({
      project_name: businessUnit.project_name,
      service_name: businessUnit.service_name,
      timeline: businessUnit.timeline,
      users: businessUnit.users,
    });
    setEditingId(businessUnit.id);
    setError('');
  }

  function cancelEdit() {
    setForm(emptyForm);
    setEditingId(null);
    setUserInput('');
  }

  function handleLogout() {
    adminApi.logout().catch(() => {});
    localStorage.removeItem('riskDashboard.adminToken');
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <AdminLogin onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>⚙️ Admin Console — Business Unit Onboarding</h1>
        <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-body">
        <form className="admin-form" onSubmit={handleOnboard}>
          <h2>{editingId ? 'Edit Business Unit' : 'Onboard a Business Unit'}</h2>
          <label>
            Project Name
            <input
              type="text"
              value={form.project_name}
              onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
              placeholder="e.g. DHP Patient Monitoring"
            />
          </label>
          <label>
            Service Name
            <input
              type="text"
              value={form.service_name}
              onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
              placeholder="e.g. DHP\Recycle Bin"
            />
          </label>
          <label>
            Time Line
            <input
              type="text"
              value={form.timeline}
              onChange={(e) => setForm((f) => ({ ...f, timeline: e.target.value }))}
              placeholder="e.g. DHP\Release 3.1"
            />
          </label>
          <label>Users</label>
          <div className="tag-list">
            {form.users.map((u) => (
              <span className="tag" key={u}>{u} <button type="button" onClick={() => removeUser(u)}>✕</button></span>
            ))}
          </div>
          <div className="admin-user-input">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUser(); } }}
              placeholder="Add a username and press Enter"
            />
            <button type="button" className="btn btn-secondary" onClick={addUser}>Add</button>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Onboard'}
            </button>
            {editingId && <button className="btn btn-secondary" type="button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>

        <div className="admin-list">
          <h2>Onboarded Business Units</h2>
          {bus.length === 0 ? (
            <p className="muted">No business units onboarded yet.</p>
          ) : (
            <table className="mini-table">
              <thead><tr><th>Project</th><th>Service</th><th>Time Line</th><th>Users</th><th></th></tr></thead>
              <tbody>
                {bus.map((b) => (
                  <tr key={b.id}>
                    <td>{b.project_name}</td>
                    <td>{b.service_name}</td>
                    <td>{b.timeline}</td>
                    <td>{b.users.join(', ') || '—'}</td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => handleEdit(b)}>Edit</button>
                      <button className="icon-btn" onClick={() => handleDelete(b.id)} title="Delete business unit">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
