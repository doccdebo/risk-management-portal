import { useState } from 'react';

const ROLE_LABELS = {
  developer: 'Developer',
  security_engineer: 'Security Engineer',
};

function initials(name) {
  return (name || '?')
    .split(/[\s\\.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function TopBar({ query, onQueryChange, username, role, onLogout }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">⛨</span>
        <span className="topbar-org">Philips Internal</span>
      </div>
      <div className="topbar-search">
        <input
          type="text"
          placeholder="Search risks..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className="topbar-right">
        <button className="topbar-icon" title="Help" onClick={() => setShowHelp(true)}>❓</button>
        {username && (
          <span className="topbar-role-badge" title={username}>{ROLE_LABELS[role] || role}</span>
        )}
        <span className="topbar-avatar" title={username}>{initials(username)}</span>
        {onLogout && (
          <button className="topbar-logout" onClick={onLogout} title="Sign out">Sign out</button>
        )}
      </div>

      {showHelp && (
        <div className="help-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowHelp(false)}>
          <div className="help-panel">
            <div className="help-panel-header">
              <h2>How to use the Risk Dashboard</h2>
              <button className="btn-close" onClick={() => setShowHelp(false)} title="Close">✕</button>
            </div>
            <div className="help-panel-body">
              <section>
                <h3>1. Creating a risk</h3>
                <p>Security Engineers click <strong>+ New Risk</strong>, fill in a Title (required) and the Summary
                  tab fields — Detection, Vulnerability, Threat and Quantitative Impact. Likelihood, Impact,
                  Initial Risk, Vulnerability Score and Threat Score are calculated automatically as you fill in
                  the scoring dropdowns.</p>
              </section>
              <section>
                <h3>2. Roles</h3>
                <p><strong>Security Engineer</strong> has full access: create, edit, delete risks, manage
                  attachments, and comment.</p>
                <p><strong>Developer</strong> has read-only access to all risk fields. You can still change the
                  risk <strong>State</strong> and post <strong>Comments</strong>.</p>
              </section>
              <section>
                <h3>3. Comments</h3>
                <p>Use the Comments tab to discuss a risk with the team. Enter your name and role once — it's
                  remembered for next time — then post your comment. All comments are timestamped and kept as
                  part of the risk's history.</p>
              </section>
              <section>
                <h3>4. Attachments</h3>
                <p>Attach images, videos or documents as evidence from the Attachments tab. Images and videos get
                  inline previews; other files show a document icon. Max 200MB per file.</p>
              </section>
              <section>
                <h3>5. Exporting</h3>
                <p>Use the <strong>Export</strong> button on the Risks list to download all risks as HTML, PDF,
                  CSV or Excel.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
