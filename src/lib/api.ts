import { useCallback, useEffect, useRef, useState } from 'react';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
const TOKEN_KEY = 'scs_admin_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: { path: string; message: string }[] | unknown) {
    super(message);
  }
  /** Field-level messages from server validation, keyed by field path. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code === 'validation_error' && Array.isArray(this.details)) {
      for (const d of this.details as { path: string; message: string }[]) out[d.path] = d.message;
    }
    return out;
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const t = tokenStore.get();
  if (t) headers.authorization = 'Bearer ' + t;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(API_URL + '/api/admin' + path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${API_URL}. Check that the API is running.`, 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/me') onUnauthorized();
    const e = data?.error;
    // Server-side validation: show which field failed and why, not just "Invalid input".
    const message = e?.code === 'validation_error' && Array.isArray(e.details) && e.details.length
      ? e.details.map((d: { path: string; message: string }) => (d.path ? `${d.path}: ${d.message}` : d.message)).join('; ')
      : e?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, e?.code, e?.details);
  }
  return data as T;
}

export async function login(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(API_URL + '/api/auth/staff/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${API_URL}. Check that the API is running.`, 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Sign in failed', data?.error?.code);
  return data as { token: string; staff: { id: string; email: string; name: string; role: string } };
}

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    api<T>(path)
      .then((d) => { if (n === seq.current) { setData(d); setError(null); } })
      .catch((e) => { if (n === seq.current) setError(e); })
      .finally(() => { if (n === seq.current) setLoading(false); });
  }, [path]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load };
}

export const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
};

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A fresh key per form submission, so a double click or a retry records a payment once. */
export const newIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Opens a receipt or statement (server-rendered HTML) in a new tab, where it can be printed or saved as PDF.
 * The tab is opened first so pop-up blockers allow it, then filled once the authenticated request returns.
 */
export async function openDocument(path: string) {
  const win = window.open('', '_blank');
  const t = tokenStore.get();
  try {
    const res = await fetch(API_URL + '/api/admin' + path, { headers: t ? { authorization: 'Bearer ' + t } : {} });
    if (!res.ok) {
      const e = (await res.json().catch(() => null))?.error;
      throw new ApiError(res.status, e?.message ?? `Could not open the document (${res.status})`, e?.code);
    }
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}

/** An authenticated image (e.g. a licence photo) as an object URL; revoke it when done. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const t = tokenStore.get();
  const res = await fetch(API_URL + '/api/admin' + path, { headers: t ? { authorization: 'Bearer ' + t } : {} });
  if (!res.ok) {
    const e = (await res.json().catch(() => null))?.error;
    throw new ApiError(res.status, e?.message ?? `Could not load the image (${res.status})`, e?.code);
  }
  return URL.createObjectURL(await res.blob());
}
