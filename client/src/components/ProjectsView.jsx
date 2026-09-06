import { useEffect, useMemo, useState } from 'react';
import { risksApi } from '../api/risksApi';
import RiskGrid from './RiskGrid';
import ExportMenu from './ExportMenu';

export default function ProjectsView({ onOpenRisk, onDeleteRisk, canDelete }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());
  const [expandedServices, setExpandedServices] = useState(() => new Set());
  const [selected, setSelected] = useState(null); // { service, timeline }
  const [risks, setRisks] = useState([]);
  const [risksLoading, setRisksLoading] = useState(false);

  useEffect(() => {
    risksApi
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setRisksLoading(true);
    risksApi
      .list(selected)
      .then(setRisks)
      .catch((e) => setError(e.message))
      .finally(() => setRisksLoading(false));
  }, [selected]);

  function toggleProject(name) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleService(key) {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleDelete(id) {
    await onDeleteRisk(id);
    const refreshed = await risksApi.list(selected);
    setRisks(refreshed);
  }

  const filters = useMemo(() => (selected ? { service: selected.service, timeline: selected.timeline } : {}), [selected]);

  if (loading) return <div className="empty-state">Loading projects…</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (projects.length === 0) {
    return <div className="empty-state">No projects have been onboarded yet. Ask an admin to onboard a business unit at /admin.</div>;
  }

  return (
    <div className="projects-view">
      <aside className="projects-tree">
        {projects.map((p) => (
          <div key={p.project_name} className="tree-project">
            <button className="tree-node tree-project-node" onClick={() => toggleProject(p.project_name)}>
              <span className={`tree-caret${expandedProjects.has(p.project_name) ? ' open' : ''}`}>▸</span>
              📁 {p.project_name}
            </button>
            {expandedProjects.has(p.project_name) && p.services.map((s) => {
              const serviceKey = `${p.project_name}::${s.service_name}`;
              return (
                <div key={serviceKey} className="tree-service">
                  <button className="tree-node tree-service-node" onClick={() => toggleService(serviceKey)}>
                    <span className={`tree-caret${expandedServices.has(serviceKey) ? ' open' : ''}`}>▸</span>
                    🧩 {s.service_name}
                  </button>
                  {expandedServices.has(serviceKey) && s.timelines.map((t) => {
                    const isSelected = selected?.service === s.service_name && selected?.timeline === t.timeline;
                    return (
                      <button
                        key={t.timeline}
                        className={`tree-node tree-timeline-node${isSelected ? ' active' : ''}`}
                        onClick={() => setSelected({ service: s.service_name, timeline: t.timeline })}
                      >
                        🕒 {t.timeline} <span className="tree-count">{t.risk_count}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </aside>

      <section className="projects-content">
        {!selected ? (
          <div className="empty-state">Select a timeline on the left to view its reported risks.</div>
        ) : (
          <>
            <div className="content-header">
              <h1>{selected.service} / {selected.timeline}</h1>
              <div className="content-actions">
                <ExportMenu filters={filters} />
              </div>
            </div>
            {risksLoading ? (
              <div className="empty-state">Loading risks…</div>
            ) : (
              <RiskGrid risks={risks} onOpen={onOpenRisk} onDelete={handleDelete} canDelete={canDelete} />
            )}
          </>
        )}
      </section>
    </div>
  );
}
