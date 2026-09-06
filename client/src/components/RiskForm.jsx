import { useEffect, useMemo, useState } from 'react';
import { risksApi } from '../api/risksApi';

function parseScore(value) {
  if (!value) return null;
  const match = String(value).match(/\(([\d.]+)\)\s*$/);
  if (match) return parseFloat(match[1]);
  const asNum = parseFloat(value);
  return Number.isNaN(asNum) ? null : asNum;
}

function average(values) {
  const nums = values.filter((v) => v !== null && v !== undefined);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function levelFromVulnerabilityScore(score) {
  if (score === null) return 'Low';
  if (score < 3) return 'Low';
  if (score < 6) return 'Medium';
  return 'High';
}

function levelFromTechnicalImpactScore(score) {
  if (score === null) return 'Low';
  if (score < 3) return 'Low';
  if (score < 5) return 'Medium';
  return 'High';
}

const MATRIX_SCORE = { Low: 1, Medium: 2, High: 3 };
const SCORE_TO_LEVEL = { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'Medium', 6: 'High', 9: 'High' };

function computeInitialRisk(likelihood, impact) {
  const p = MATRIX_SCORE[likelihood] || 1;
  const i = MATRIX_SCORE[impact] || 1;
  return SCORE_TO_LEVEL[p * i] || 'Low';
}

const emptyRisk = {
  title: '',
  state: 'Submitted',
  assigned_to: 'Unassigned',
  service: '',
  timeline: '',
  tags: [],
  risk_date: '',
  risk_sub_type: '',
  potential_impact_on_safety: '',
  code_security_risk_category: '',
  build_number: '',
  deployment_target: [],
  cloning_rule_apply: false,
  vulnerability_id: '',
  ease_of_exploit: '',
  ease_of_discovery: '',
  awareness: '',
  detectability: '',
  vulnerability_description: '',
  vulnerability_cause: '',
  threat_type: '',
  threat_agents: [],
  threat_description: '',
  technical_assets: [],
  technical_impact_c: '0',
  technical_impact_i: '0',
  technical_impact_a: '0',
  risk_statement: '',
  rationale_for_postponement: '',
  fix_notes: '',
  fix_target_date: '',
  postpone_until_date: '',
  no_fix_justification: '',
  mitigation_plan: '',
  contingency_plan: '',
  test_cases: [],
};

const ASSIGNEES = ['Unassigned', 'Contoso\\Administrator', 'Jamie Chen', 'Priya Nair', 'Alex Rivera', 'Morgan Lee'];
const COMMENTER_ROLES = ['Developer', 'Security Engineer', 'Reviewer', 'Risk Owner', 'Other'];

const TABS = [
  ['summary', 'Summary'],
  ['comments', 'Comments'],
  ['attachments', 'Attachments'],
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_UPLOAD_MB = 200;

function attachmentKind(contentType, filename) {
  const type = (contentType || '').toLowerCase();
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
  return 'document';
}

function Locked({ label, value }) {
  return (
    <label className="locked-field">
      <span>{label} <span className="lock-icon" title="Auto-calculated">🔒</span></span>
      <input type="text" value={value ?? '—'} readOnly disabled />
    </label>
  );
}

function TagInput({ values, onAdd, onRemove, placeholder, suggestions }) {
  const [text, setText] = useState('');
  return (
    <div>
      <div className="tag-list">
        {values.map((v) => (
          <span className="tag" key={v}>
            {v} <button onClick={() => onRemove(v)}>✕</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        list={suggestions ? `${placeholder}-list` : undefined}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd(text);
            setText('');
          }
        }}
      />
      {suggestions && (
        <datalist id={`${placeholder}-list`}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

export default function RiskForm({ risk, fields, role, onSave, onClose, onDelete, onAddComment, onRefresh }) {
  const [form, setForm] = useState(risk ? { ...risk } : { ...emptyRisk });
  const [tab, setTab] = useState('summary');
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commenterName, setCommenterName] = useState(() => localStorage.getItem('riskDashboard.commenterName') || '');
  const [commenterRole, setCommenterRole] = useState(() => localStorage.getItem('riskDashboard.commenterRole') || 'Developer');
  const [commentError, setCommentError] = useState('');

  const isReadOnly = role === 'developer';

  useEffect(() => {
    setForm(risk ? { ...risk } : { ...emptyRisk });
  }, [risk]);

  useEffect(() => {
    setTitleTouched(false);
    setTab('summary');
    setPendingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk?.id]);

  const isNew = !risk;
  const titleError = titleTouched && !form.title.trim() ? "Field 'Title' cannot be empty." : '';
  const postponementError = form.state === 'Postponed' && !form.rationale_for_postponement.trim()
    ? 'Rationale and Actions is required before postponing a risk.'
    : '';
  const stateOptions = isReadOnly
    ? ['Postponed']
    : (fields?.STATES || ['Submitted']).filter((state) => state !== 'Postponed');

  const vulnerabilityScore = useMemo(
    () => average([form.ease_of_exploit, form.ease_of_discovery, form.awareness, form.detectability].map(parseScore)),
    [form.ease_of_exploit, form.ease_of_discovery, form.awareness, form.detectability]
  );
  const threatScore = useMemo(
    () => average(form.threat_agents.map(parseScore)),
    [form.threat_agents]
  );
  const technicalImpactScore = useMemo(
    () => average([form.technical_impact_c, form.technical_impact_i, form.technical_impact_a].map(parseScore)),
    [form.technical_impact_c, form.technical_impact_i, form.technical_impact_a]
  );
  const likelihood = levelFromVulnerabilityScore(vulnerabilityScore);
  const impact = levelFromTechnicalImpactScore(technicalImpactScore);
  const initialRisk = computeInitialRisk(likelihood, impact);

  const usersByService = fields?.USERS_BY_SERVICE || {};
  const timelineByService = fields?.TIMELINE_BY_SERVICE || {};
  const assignableUsers = form.service && usersByService[form.service]?.length
    ? usersByService[form.service]
    : ASSIGNEES.filter((a) => a !== 'Unassigned');
  const availableTimelines = form.service && timelineByService[form.service]?.length
    ? timelineByService[form.service]
    : (fields?.TIMELINE_OPTIONS || []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleServiceChange(service) {
    const usersForService = usersByService[service] || [];
    const timelinesForService = timelineByService[service] || [];
    setForm((f) => ({
      ...f,
      service,
      assigned_to: usersForService.includes(f.assigned_to) ? f.assigned_to : 'Unassigned',
      timeline: timelinesForService.includes(f.timeline) ? f.timeline : (timelinesForService[0] || ''),
    }));
  }

  function toggleMulti(field, value) {
    setForm((f) => {
      const has = f[field].includes(value);
      return { ...f, [field]: has ? f[field].filter((a) => a !== value) : [...f[field], value] };
    });
  }

  function addToList(field, value) {
    const v = value.trim();
    if (!v) return;
    setForm((f) => (f[field].includes(v) ? f : { ...f, [field]: [...f[field], v] }));
  }

  function removeFromList(field, value) {
    setForm((f) => ({ ...f, [field]: f[field].filter((a) => a !== value) }));
  }

  async function handleSave(close) {
    setTitleTouched(true);
    if (!form.title.trim() || postponementError) return;
    let result;
    try {
      result = await onSave(form, close);
    } catch {
      return; // App already surfaced the error
    }
    if (isNew && result?.id && pendingFiles.length > 0) {
      try {
        await risksApi.uploadAttachments(result.id, pendingFiles);
        setPendingFiles([]);
        const refreshed = await risksApi.get(result.id);
        setForm(refreshed);
        await onRefresh?.();
      } catch (err) {
        alert(`Risk saved, but attaching files failed: ${err.message}`);
      }
    }
  }

  async function handlePostComment() {
    if (!commentText.trim()) return;
    if (!commenterName.trim()) {
      setCommentError('Enter your name before posting a comment.');
      return;
    }
    setCommentError('');
    localStorage.setItem('riskDashboard.commenterName', commenterName.trim());
    localStorage.setItem('riskDashboard.commenterRole', commenterRole);
    const author = `${commenterName.trim()} (${commenterRole})`;
    await risksApi.addComment(risk.id, commentText.trim(), author);
    const refreshed = await risksApi.get(risk.id);
    setForm(refreshed);
    await onRefresh?.();
    setCommentText('');
  }

  async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    if (isNew) {
      // No risk id yet — stage the files locally and upload them right after creation.
      setPendingFiles((prev) => [...prev, ...fileList]);
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      await risksApi.uploadAttachments(risk.id, fileList);
      const refreshed = await risksApi.get(risk.id);
      setForm(refreshed);
      await onRefresh?.();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removePendingFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFileInput(e) {
    await uploadFiles(e.target.files);
    e.target.value = '';
  }

  async function handleFileDrop(e) {
    e.preventDefault();
    await uploadFiles(e.dataTransfer.files);
  }

  async function handleDeleteAttachment(attachmentId) {
    await risksApi.deleteAttachment(risk.id, attachmentId);
    const refreshed = await risksApi.get(risk.id);
    setForm(refreshed);
    await onRefresh?.();
  }

  const attachmentGroups = useMemo(() => {
    const images = [];
    const videos = [];
    const documents = [];
    (form.attachments || []).forEach((a) => {
      const kind = attachmentKind(a.content_type, a.filename);
      if (kind === 'image') images.push(a);
      else if (kind === 'video') videos.push(a);
      else documents.push(a);
    });
    return [['Images', images], ['Videos', videos], ['Documents', documents]];
  }, [form.attachments]);

  const pendingPreviews = useMemo(
    () => pendingFiles.map((f) => ({ file: f, url: URL.createObjectURL(f), kind: attachmentKind(f.type, f.name) })),
    [pendingFiles]
  );
  useEffect(() => {
    return () => pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [pendingPreviews]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="workitem-panel">
        <div className="workitem-toolbar">
          <div className="workitem-toolbar-left">
            <button className="btn btn-primary" onClick={() => handleSave(false)}>💾 Save</button>
            <button className="btn btn-secondary" onClick={() => handleSave(true)}>Save &amp; Close</button>
            {!isNew && !isReadOnly && (
              <button className="btn btn-danger" onClick={() => onDelete(risk.id)}>🗑 Delete</button>
            )}
          </div>
          <button className="btn-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="workitem-header">
          <div className="workitem-header-top">
            <span className="risk-type-icon large" title="Risk">⚠</span>
            <span className="workitem-type-label">{isNew ? 'NEW RISK' : `RISK ${risk.uid}`} *</span>
            {titleError && <span className="field-error inline">{titleError}</span>}
          </div>
          <input
            className="workitem-title-input"
            value={form.title}
            placeholder="<Enter title here>"
            onBlur={() => setTitleTouched(true)}
            onChange={(e) => set('title', e.target.value)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
          />

          <div className="header-controls">
            <label className="header-control">
              Assigned To
              <select value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} disabled={isReadOnly}>
                <option value="Unassigned">Unassigned</option>
                {assignableUsers.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="comment-count-badge"
              onClick={() => setTab('comments')}
              title="View comments"
              disabled={isNew}
            >
              💬 {isNew ? 0 : form.comment_count} comments
            </button>
          </div>

          <div className="header-meta-grid">
            <label className="header-control">
              State
              <select value={form.state} onChange={(e) => set('state', e.target.value)}>
                {!stateOptions.includes(form.state) && <option value={form.state} disabled>{form.state}</option>}
                {stateOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {postponementError && <span className="field-error">{postponementError}</span>}
            </label>
            <label className="header-control">
              Service
              <select value={form.service} onChange={(e) => handleServiceChange(e.target.value)} disabled={isReadOnly}>
                <option value="">— Select onboarded service —</option>
                {(fields?.SERVICE_OPTIONS || []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="header-control">
              UID
              <input type="text" value={isNew ? '(assigned on save)' : form.uid} readOnly disabled />
            </label>
            <label className="header-control">
              Time Line
              <select value={form.timeline} onChange={(e) => set('timeline', e.target.value)} disabled={isReadOnly}>
                <option value="">— Select time line —</option>
                {availableTimelines.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="workitem-body">
          <div className="workitem-main full">
            <div className="tabs">
              {TABS.map(([key, label]) => (
                <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                  {label.toUpperCase()}
                </button>
              ))}
            </div>

            {tab === 'summary' && (
              <>
              <fieldset className="tab-content summary-grid" disabled={isReadOnly}>
                <section className="summary-col">
                  <h4>Detection</h4>
                  <label>Risk Date<input type="date" value={form.risk_date ? form.risk_date.slice(0, 10) : ''} onChange={(e) => set('risk_date', e.target.value)} /></label>
                  <label>
                    Risk SubType
                    <select value={form.risk_sub_type} onChange={(e) => set('risk_sub_type', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.RISK_SUB_TYPES || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Potential Impact on Safety
                    <select value={form.potential_impact_on_safety} onChange={(e) => set('potential_impact_on_safety', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.POTENTIAL_IMPACT_ON_SAFETY || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Code Security Risk Category
                    <select value={form.code_security_risk_category} onChange={(e) => set('code_security_risk_category', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.CODE_SECURITY_RISK_CATEGORY || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={form.cloning_rule_apply} onChange={(e) => set('cloning_rule_apply', e.target.checked)} />
                    Cloning Rule Apply
                  </label>

                  <h4>Scoring</h4>
                  <Locked label="Likelihood" value={likelihood} />
                  <Locked label="Impact" value={impact} />
                  <Locked label="Initial Risk" value={initialRisk} />
                </section>

                <section className="summary-col">
                  <h4>Vulnerability</h4>
                  <label>Vulnerability ID<input type="text" value={form.vulnerability_id} onChange={(e) => set('vulnerability_id', e.target.value)} /></label>
                  <label>
                    EaseOfExploit
                    <select value={form.ease_of_exploit} onChange={(e) => set('ease_of_exploit', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.EASE_OF_EXPLOIT || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    EaseOfDiscovery
                    <select value={form.ease_of_discovery} onChange={(e) => set('ease_of_discovery', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.EASE_OF_DISCOVERY || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Awareness
                    <select value={form.awareness} onChange={(e) => set('awareness', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.AWARENESS || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Detectability
                    <select value={form.detectability} onChange={(e) => set('detectability', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.DETECTABILITY || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <Locked label="Vulnerability Score" value={vulnerabilityScore} />
                  <h5>Vulnerability Description</h5>
                  <textarea rows={3} value={form.vulnerability_description} onChange={(e) => set('vulnerability_description', e.target.value)} />
                  <h5>Vulnerability Cause</h5>
                  <textarea rows={3} value={form.vulnerability_cause} onChange={(e) => set('vulnerability_cause', e.target.value)} />
                </section>

                <section className="summary-col">
                  <h4>Threat</h4>
                  <label>
                    Threat Type
                    <select value={form.threat_type} onChange={(e) => set('threat_type', e.target.value)}>
                      <option value="">—</option>
                      {(fields?.THREAT_TYPES || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="full">Threat Agents</label>
                  <div className="checkbox-grid">
                    {(fields?.THREAT_AGENTS || []).map((agent) => (
                      <label key={agent} className="checkbox-label">
                        <input type="checkbox" checked={form.threat_agents.includes(agent)} onChange={() => toggleMulti('threat_agents', agent)} />
                        {agent}
                      </label>
                    ))}
                  </div>
                  <Locked label="Threat Score" value={threatScore} />
                  <h5>Threat Description</h5>
                  <textarea rows={3} value={form.threat_description} onChange={(e) => set('threat_description', e.target.value)} />
                </section>

                <section className="summary-col">
                  <h4>Quantitative Impact</h4>
                  <label className="full">Technical Assets</label>
                  <TagInput
                    values={form.technical_assets}
                    onAdd={(v) => addToList('technical_assets', v)}
                    onRemove={(v) => removeFromList('technical_assets', v)}
                    placeholder="Add asset"
                    suggestions={fields?.TECHNICAL_ASSETS}
                  />
                  <label>
                    Technical Impact : C
                    <select value={form.technical_impact_c} onChange={(e) => set('technical_impact_c', e.target.value)}>
                      {(fields?.TECHNICAL_IMPACT_SCALE || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Technical Impact : I
                    <select value={form.technical_impact_i} onChange={(e) => set('technical_impact_i', e.target.value)}>
                      {(fields?.TECHNICAL_IMPACT_SCALE || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label>
                    Technical Impact : A
                    <select value={form.technical_impact_a} onChange={(e) => set('technical_impact_a', e.target.value)}>
                      {(fields?.TECHNICAL_IMPACT_SCALE || []).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <h5>Risk Statement</h5>
                  <textarea rows={3} value={form.risk_statement} onChange={(e) => set('risk_statement', e.target.value)} />
                  {!isReadOnly && (
                    <>
                      <h4>Rationale and Actions</h4>
                      <label>Refer to Rationale for Postponement<textarea rows={3} value={form.rationale_for_postponement} onChange={(e) => set('rationale_for_postponement', e.target.value)} /></label>
                    </>
                  )}
                </section>
              </fieldset>
              {isReadOnly && (
                <section className="tab-content developer-postponement">
                  <h4>Rationale and Actions</h4>
                  <label>
                    Refer to Rationale for Postponement
                    <textarea rows={3} value={form.rationale_for_postponement} onChange={(e) => set('rationale_for_postponement', e.target.value)} />
                  </label>
                </section>
              )}
              </>
            )}

            {tab === 'comments' && (
              <div className="tab-content">
                {isNew ? (
                  <p className="muted">Save the risk before adding comments.</p>
                ) : (
                  <section className="field-section">
                    <h4>Comments</h4>
                    <p className="muted small">
                      Developers and security reviewers can discuss this risk here. Comments are visible to
                      everyone with access to this risk and are included in the CSV/Excel/HTML/PDF exports.
                    </p>

                    <div className="discussion-list">
                      {(form.comments || []).length === 0 && <p className="muted">No comments yet — be the first to weigh in.</p>}
                      {(form.comments || []).slice().reverse().map((c) => (
                        <div className="discussion-item" key={c.id}>
                          <div className="discussion-meta"><strong>{c.by}</strong> <span className="muted">{fmtDate(c.date)}</span></div>
                          <div className="discussion-text">{c.comment}</div>
                        </div>
                      ))}
                    </div>

                    <div className="discussion-input">
                      <div className="field-grid">
                        <label>Your Name<input type="text" value={commenterName} onChange={(e) => setCommenterName(e.target.value)} placeholder="e.g. Jamie Chen" /></label>
                        <label>
                          Role
                          <select value={commenterRole} onChange={(e) => setCommenterRole(e.target.value)}>
                            {COMMENTER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Add a comment for the dev/security team..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                      {commentError && <div className="field-error">{commentError}</div>}
                      <button className="btn btn-secondary" onClick={handlePostComment}>Post comment</button>
                    </div>
                  </section>
                )}
              </div>
            )}

            {tab === 'attachments' && (
              <div className="tab-content">
                <section className="field-section">
                  <h4>Attachments &amp; Evidence</h4>
                  {isNew ? (
                    <>
                      <p className="muted small">
                        Files added here will be uploaded automatically once you save this risk.
                      </p>
                      {!isReadOnly && (
                        <label
                          className="dropzone"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleFileDrop}
                        >
                          Drag &amp; drop images, videos or documents here, or click to browse
                          (max {MAX_UPLOAD_MB}MB each)
                          <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={handleFileInput} />
                        </label>
                      )}
                      {pendingPreviews.length > 0 ? (
                        <div className="attachment-group">
                          <h5>Pending upload ({pendingPreviews.length})</h5>
                          <div className="attachment-gallery">
                            {pendingPreviews.map((p, idx) => (
                              <div className="attachment-card" key={`${p.file.name}-${idx}`}>
                                <div className="attachment-preview">
                                  {p.kind === 'image' && <img src={p.url} alt={p.file.name} />}
                                  {p.kind === 'video' && <video src={p.url} muted />}
                                  {p.kind === 'document' && <span className="attachment-icon">📄</span>}
                                </div>
                                <div className="attachment-meta">
                                  <span className="attachment-name" title={p.file.name}>{p.file.name}</span>
                                  <span className="muted small">{fmtSize(p.file.size)}</span>
                                </div>
                                {!isReadOnly && (
                                  <button className="icon-btn attachment-delete" title="Remove" onClick={() => removePendingFile(idx)}>🗑</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="muted">No attachments added yet.</p>
                      )}
                    </>
                  ) : (
                    <>
                      {!isReadOnly && (
                        <label
                          className="dropzone"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleFileDrop}
                        >
                          Drag &amp; drop images, videos or documents here, or click to browse
                          (max {MAX_UPLOAD_MB}MB each)
                          <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={handleFileInput} disabled={uploading} />
                        </label>
                      )}
                      {uploading && <div className="muted small">Uploading…</div>}
                      {uploadError && <div className="field-error">{uploadError}</div>}

                      {attachmentGroups.map(([groupLabel, items]) => (
                        items.length > 0 && (
                          <div key={groupLabel} className="attachment-group">
                            <h5>{groupLabel} ({items.length})</h5>
                            <div className="attachment-gallery">
                              {items.map((a) => (
                                <div className="attachment-card" key={a.id}>
                                  <a
                                    className="attachment-preview"
                                    href={risksApi.attachmentDownloadUrl(risk.id, a.id)}
                                    target="_blank" rel="noreferrer"
                                    title={a.filename}
                                  >
                                    {attachmentKind(a.content_type, a.filename) === 'image' && (
                                      <img src={risksApi.attachmentPreviewUrl(risk.id, a.id)} alt={a.filename} />
                                    )}
                                    {attachmentKind(a.content_type, a.filename) === 'video' && (
                                      <video src={risksApi.attachmentPreviewUrl(risk.id, a.id)} muted />
                                    )}
                                    {attachmentKind(a.content_type, a.filename) === 'document' && (
                                      <span className="attachment-icon">📄</span>
                                    )}
                                  </a>
                                  <div className="attachment-meta">
                                    <a href={risksApi.attachmentDownloadUrl(risk.id, a.id)} className="attachment-name" title={a.filename}>{a.filename}</a>
                                    <span className="muted small">{fmtSize(a.size)} · {fmtDate(a.uploaded_at)}</span>
                                  </div>
                                  <button className="icon-btn attachment-delete" title="Delete" onClick={() => handleDeleteAttachment(a.id)} style={{ display: isReadOnly ? 'none' : undefined }}>🗑</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                      {(form.attachments || []).length === 0 && (
                        <p className="muted">No attachments yet.</p>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
