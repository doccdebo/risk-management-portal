const BASE = '/api';

function adminAuthHeaders() {
  const token = localStorage.getItem('riskDashboard.adminToken');
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
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const adminApi = {
  login: (username, password) =>
    fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handle),
  logout: () => fetch(`${BASE}/admin/logout`, { method: 'POST', headers: adminAuthHeaders() }).then(handle),
  listBusinessUnits: () => fetch(`${BASE}/admin/business-units`, { headers: adminAuthHeaders() }).then(handle),
  createBusinessUnit: (data) =>
    fetch(`${BASE}/admin/business-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
      body: JSON.stringify(data),
    }).then(handle),
  updateBusinessUnit: (id, data) =>
    fetch(`${BASE}/admin/business-units/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
      body: JSON.stringify(data),
    }).then(handle),
  deleteBusinessUnit: (id) =>
    fetch(`${BASE}/admin/business-units/${id}`, { method: 'DELETE', headers: adminAuthHeaders() }).then(handle),
};
