const STORAGE_KEY = 'filips_crm_endpoints';

function defaultHost() {
  if (typeof window === 'undefined') return 'http://localhost:3847';
  if (window.location.port === '5173') return 'http://localhost:3847';
  return window.location.origin;
}

export function getDefaultEndpoints() {
  const host = defaultHost();
  return {
    apiBase: host,
    testWebhook: `${host}/api/webhook/test`,
    leadsWebhook: `${host}/api/webhook/leads`,
    tasksWebhook: `${host}/api/webhook/tasks`,
    tasksApi: `${host}/api/tasks`,
    loginApi: `${host}/api/auth/login`,
    webhookSecret: '',
  };
}

export function getEndpoints() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultEndpoints();
    return { ...getDefaultEndpoints(), ...JSON.parse(raw) };
  } catch {
    return getDefaultEndpoints();
  }
}

export function saveEndpoints(partial) {
  const next = { ...getEndpoints(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('crm-endpoints-changed'));
  return next;
}

export function resetEndpoints() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('crm-endpoints-changed'));
  return getDefaultEndpoints();
}

/** Pełny URL lub ścieżka względna do apiBase */
export function resolveApiUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = (getEndpoints().apiBase || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
