const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('riskDashboard.token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore parse errors */
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const risksApi = {
  login: (username, password) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handle),
  chooseRole: (role) =>
    fetch(`${BASE}/auth/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ role }),
    }).then(handle),
  me: () => fetch(`${BASE}/auth/me`, { headers: authHeaders() }).then(handle),
  logout: () => fetch(`${BASE}/auth/logout`, { method: 'POST', headers: authHeaders() }).then(handle),

  getFields: () => fetch(`${BASE}/meta/fields`, { headers: authHeaders() }).then(handle),
  getProjects: () => fetch(`${BASE}/projects`, { headers: authHeaders() }).then(handle),
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.service) params.set('service', filters.service);
    if (filters.timeline) params.set('timeline', filters.timeline);
    const qs = params.toString();
    return fetch(`${BASE}/risks${qs ? `?${qs}` : ''}`, { headers: authHeaders() }).then(handle);
  },
  get: (id) => fetch(`${BASE}/risks/${id}`, { headers: authHeaders() }).then(handle),
  create: (data) =>
    fetch(`${BASE}/risks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle),
  update: (id, data) =>
    fetch(`${BASE}/risks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle),
  remove: (id) => fetch(`${BASE}/risks/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle),
  addComment: (id, comment, by) =>
    fetch(`${BASE}/risks/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ comment, by }),
    }).then(handle),
  uploadAttachments: (id, files) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    return fetch(`${BASE}/risks/${id}/attachments`, { method: 'POST', headers: authHeaders(), body: form }).then(handle);
  },
  deleteAttachment: (riskId, attachmentId) =>
    fetch(`${BASE}/risks/${riskId}/attachments/${attachmentId}`, { method: 'DELETE', headers: authHeaders() }).then(handle),
  attachmentDownloadUrl: (riskId, attachmentId) => `${BASE}/risks/${riskId}/attachments/${attachmentId}/download`,
  attachmentPreviewUrl: (riskId, attachmentId) => `${BASE}/risks/${riskId}/attachments/${attachmentId}/download?inline=true`,
  exportUrl: (format) => `${BASE}/risks/export/${format}`,
  downloadExport: async (format, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.service) params.set('service', filters.service);
    if (filters.timeline) params.set('timeline', filters.timeline);
    const qs = params.toString();
    const res = await fetch(`${BASE}/risks/export/${format}${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `Risks_export.${format}`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
