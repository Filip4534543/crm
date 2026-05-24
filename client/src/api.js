import { resolveApiUrl } from './endpoints';

const TOKEN_KEY = 'filips_crm_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = resolveApiUrl(path);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (text.includes('Cannot POST') || text.includes('Cannot GET')) {
        data = {
          error: 'API niedostępne (404) — wdróż ponownie projekt na Netlify',
        };
      }
    }
  }

  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Błąd serwera');
  }
  return data;
}

export const api = {
  login: (password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  checkAuth: () => request('/api/auth/check'),
  getLeads: () => request('/api/leads'),
  getStats: () => request('/api/stats'),
  moveStage: (id, body) =>
    request(`/api/leads/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateLead: (id, body) =>
    request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteLead: (id) => request(`/api/leads/${id}`, { method: 'DELETE' }),
  deleteAllNotContacted: () =>
    request('/api/leads/stage/not_contacted_yet', { method: 'DELETE' }),
  removeDuplicatesNotContacted: () =>
    request('/api/leads/stage/not_contacted_yet/dedupe', { method: 'POST' }),
  getTasks: () => request('/api/tasks'),
  createTask: (body) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id, body) =>
    request(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTask: (id) =>
    request(`/api/tasks/${id}`, { method: 'DELETE' }),
};
