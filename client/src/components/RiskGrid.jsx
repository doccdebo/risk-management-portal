const STATE_CLASS = {
  Submitted: 'badge-new',
  Active: 'badge-active',
  Resolved: 'badge-mitigated',
  Closed: 'badge-closed',
};

const LEVEL_CLASS = {
  Low: 'badge-low',
  Medium: 'badge-medium',
  High: 'badge-high',
};

const SEVERITY_CLASS = {
  Low: 'badge-low',
  Medium: 'badge-medium',
  High: 'badge-high',
  Critical: 'badge-critical',
};

export default function RiskGrid({ risks, onOpen, onDelete, canDelete = true }) {
  if (risks.length === 0) {
    return <div className="empty-state">No risks found. Click "New Risk" to create one.</div>;
  }

  return (
    <table className="risk-grid">
      <thead>
        <tr>
          <th className="col-id">ID</th>
          <th>Title</th>
          <th>State</th>
          <th>Assigned To</th>
          <th>Likelihood</th>
          <th>Impact</th>
          <th>Initial Risk</th>
          <th>Threat Score</th>
          <th>Severity</th>
          <th>Risk SubType</th>
          <th>Comments</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {risks.map((r) => (
          <tr key={r.id} onClick={() => onOpen(r.id)}>
            <td className="col-id">{r.uid}</td>
            <td className="col-title">{r.title}</td>
            <td><span className={`badge ${STATE_CLASS[r.state] || ''}`}>{r.state}</span></td>
            <td>{r.assigned_to || '—'}</td>
            <td><span className={`badge ${LEVEL_CLASS[r.likelihood] || ''}`}>{r.likelihood}</span></td>
            <td><span className={`badge ${LEVEL_CLASS[r.impact] || ''}`}>{r.impact}</span></td>
            <td><span className={`badge ${LEVEL_CLASS[r.initial_risk] || ''}`}>{r.initial_risk}</span></td>
            <td>{r.threat_score ?? '—'}</td>
            <td>{r.threat_severity ? <span className={`badge ${SEVERITY_CLASS[r.threat_severity] || ''}`}>{r.threat_severity}</span> : '—'}</td>
            <td>{r.risk_sub_type}</td>
            <td>{r.comment_count}</td>
            <td className="col-actions">
              {canDelete && (
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(r.id);
                  }}
                >
                  🗑
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
