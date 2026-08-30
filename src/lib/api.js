/**
 * src/lib/api.js
 * ---------------------------------------------------------------------------
 * The single door to the MastiPe back-end.
 *
 * Every request carries the session token; every 401 clears it and bounces to
 * login, so an expired session can never leave the panel showing data it is no
 * longer entitled to.
 *
 * The token lives in sessionStorage, not localStorage: closing the tab ends the
 * session. This panel shows players' phone numbers and their entire message
 * history, so it should not survive a closed browser.
 *
 * Note the token here is a SESSION token, exchanged for the passcode at login —
 * the back-end's long-lived API key is never sent to the browser at all.
 */

const KEY = 'mastipe.admin.token';

// Empty in development, where Vite proxies /serverpe to the local back-end. In
// production the panel and the API are on different origins, so this is set at
// build time via VITE_API_BASE.
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

// Must match API_BASE_PATH + ADMIN_BASE_PATH in the back-end's .env.
const ADMIN_PATH = '/serverpe/platform/mastipe/v1/admin';
export const PUBLIC_PATH = '/serverpe/platform/mastipe/v1/public';

export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

let onToast = () => {};
export const setToastHandler = (fn) => {
  onToast = fn;
};

async function request(path, { method = 'GET', body, signal, quiet = false } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${ADMIN_PATH}${path}`, {
      method,
      headers,
      signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // A network failure is not the same as a rejection; say so plainly rather
    // than showing "undefined" in a red box.
    if (err.name === 'AbortError') throw err;
    throw new Error('Could not reach the server. Is the back-end running?');
  }

  if (res.status === 401) {
    clearToken();
    onUnauthorized();
    throw new Error('Your session has expired. Please sign in again.');
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = payload.error || `Request failed (${res.status})`;
    if (!quiet) onToast({ tone: 'bad', message });
    const error = new Error(message);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  // Writes get an automatic confirmation so no page has to wire one up.
  if (method !== 'GET' && !quiet) onToast({ tone: 'good', message: 'Saved' });

  return payload.data ?? payload;
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body }),
};

/**
 * Logs in with the passcode.
 *
 * Kept out of `request` because it is the one call that must not send a token,
 * and because its errors (wrong passcode, lockout) are shown inline on the
 * login screen rather than as a toast.
 */
export async function login(passcode, label) {
  const res = await fetch(`${API_BASE}${ADMIN_PATH}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ passcode, label }),
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(payload.error || 'Could not sign in');
    error.status = res.status;
    error.attemptsRemaining = payload.attemptsRemaining;
    error.retryAfterSeconds = payload.retryAfterSeconds;
    throw error;
  }

  setToken(payload.data.token);
  return payload.data;
}

export async function logout() {
  try {
    await request('/session/logout', { method: 'POST', quiet: true });
  } catch {
    // Already invalid server-side; clearing locally is what matters.
  }
  clearToken();
}

/* ------------------------------------------------------------- formatting */

export const inr = (paise) =>
  '₹' + Number((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const num = (n) => Number(n || 0).toLocaleString('en-IN');

/**
 * Phone numbers in full.
 *
 * This panel is the operator's own tool, behind a passcode, and the whole point
 * of it is to be able to contact a player, run a utility message, or block a
 * number. Masking here would only get in the operator's way.
 *
 * Players never see another player's number anywhere — that is enforced in the
 * back-end, which sends anonymous tags rather than digits.
 */
export const maskWa = (waId) => (waId ? `+${waId}` : '—');

export const fullWa = (waId) => (waId ? `+${waId}` : '—');

export const when = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const timeOnly = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/** "3 min ago" — for live views where the absolute time is noise. */
export const ago = (value) => {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
