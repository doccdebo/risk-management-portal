import { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import SideNav from './components/SideNav';
import RiskGrid from './components/RiskGrid';
import RiskForm from './components/RiskForm';
import ExportMenu from './components/ExportMenu';
import ProjectsView from './components/ProjectsView';
import LoginPage from './components/LoginPage';
import RoleSelect from './components/RoleSelect';
import { risksApi } from './api/risksApi';
import './App.css';

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('riskDashboard.username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('riskDashboard.role') || '');
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState('risks');

  const [risks, setRisks] = useState([]);
  const [fields, setFields] = useState(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(undefined); // undefined = closed, null = new, number = existing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Validate any stored session with the server before trusting localStorage.
    const token = localStorage.getItem('riskDashboard.token');
    if (!token) {
      setAuthChecked(true);
      return;
    }
    risksApi
      .me()
      .then((me) => {
        setUsername(me.username);
        setRole(me.role || '');
      })
      .catch(() => {
        localStorage.removeItem('riskDashboard.token');
        localStorage.removeItem('riskDashboard.username');
        localStorage.removeItem('riskDashboard.role');
        setUsername('');
        setRole('');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  function handleLogout() {
    risksApi.logout().catch(() => {});
    localStorage.removeItem('riskDashboard.token');
    localStorage.removeItem('riskDashboard.username');
    localStorage.removeItem('riskDashboard.role');
    setUsername('');
    setRole('');
  }

  async function refresh() {
    try {
      const list = await risksApi.list();
      setRisks(list);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!username || !role) return;
    (async () => {
      try {
        const [list, meta] = await Promise.all([risksApi.list(), risksApi.getFields()]);
        setRisks(list);
        setFields(meta);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [username, role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return risks;
    return risks.filter(
      (r) =>
        String(r.uid).toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.assigned_to || '').toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q)
    );
  }, [risks, query]);

  const activeRisk = activeId ? risks.find((r) => r.id === activeId) : null;
  const isDeveloper = role === 'developer';

  async function handleSave(data, close) {
    try {
      if (activeId === null) {
        const created = await risksApi.create(data);
        await refresh();
        setActiveId(close ? undefined : created.id);
        return created;
      } else {
        const updated = await risksApi.update(activeId, data);
        await refresh();
        if (close) setActiveId(undefined);
        return updated;
      }
    } catch (e) {
      alert(`Save failed: ${e.message}`);
      throw e;
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this risk? This cannot be undone.')) return;
    try {
      await risksApi.remove(id);
      await refresh();
      if (activeId === id) setActiveId(undefined);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  async function handleAddComment(id, comment, by) {
    try {
      await risksApi.addComment(id, comment, by);
      await refresh();
    } catch (e) {
      alert(`Failed to add comment: ${e.message}`);
    }
  }

  if (!authChecked) return null;

  if (!username) {
    return <LoginPage onLoggedIn={setUsername} />;
  }

  if (!role) {
    return <RoleSelect username={username} onRoleChosen={setRole} />;
  }

  return (
    <div className="app-shell">
      <TopBar query={query} onQueryChange={setQuery} username={username} role={role} onLogout={handleLogout} />
      <div className="app-body">
        <SideNav view={view} onSelect={setView} />
        {view === 'projects' ? (
          <main className="main-content">
            <div className="breadcrumb">Project / <strong>Projects</strong></div>
            <ProjectsView
              onOpenRisk={setActiveId}
              onDeleteRisk={handleDelete}
              canDelete={!isDeveloper}
            />
          </main>
        ) : (
          <main className="main-content">
            <div className="breadcrumb">Project / Boards / Work Items / <strong>Risks</strong></div>
            <div className="content-header">
              <h1>Risks</h1>
              <div className="content-actions">
                {!isDeveloper && (
                  <button className="btn btn-primary" onClick={() => setActiveId(null)}>+ New Risk</button>
                )}
                <ExportMenu />
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}
            {loading ? (
              <div className="empty-state">Loading risks…</div>
            ) : (
              <RiskGrid risks={filtered} onOpen={setActiveId} onDelete={handleDelete} canDelete={!isDeveloper} />
            )}
          </main>
        )}
      </div>

      {activeId !== undefined && (
        <RiskForm
          risk={activeId === null ? null : activeRisk}
          fields={fields}
          role={role}
          onSave={handleSave}
          onClose={() => setActiveId(undefined)}
          onDelete={handleDelete}
          onAddComment={handleAddComment}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

