const STORAGE_KEY = 'filips_crm_endpoints';
export const PRODUCTION_HOST = 'https://filipscrm.netlify.app';

function defaultHost() {
  if (typeof window === 'undefined') return PRODUCTION_HOST;
  const { hostname, origin, port } = window.location;
  if (
    hostname === 'filipscrm.netlify.app' ||
    hostname.endsWith('.netlify.app')
  ) {
    return origin;
  }
  if (port === '5173') return 'http://localhost:3847';
  return origin;
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
  const defaults = getDefaultEndpoints();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    if (isNetlifyHost()) {
      return {
        ...saved,
        ...defaults,
        webhookSecret: saved.webhookSecret ?? defaults.webhookSecret,
      };
    }
    return { ...defaults, ...saved };
  } catch {
    return defaults;
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
  if (!base) return p;
  return `${base}${p}`;
}

export function isNetlifyHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.netlify.app');
}
