import { useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';

export type S = Record<string, number | string | boolean>;
export type Secrets = Record<string, { configured: boolean; hint: string | null }>;
export type Payload = { settings: S; secrets: Secrets; mail: { source: 'dashboard' | 'environment' | 'none' } };

export function useSettingsForm(initial: S, onSaved: () => void) {
  const [v, setV] = useState<S>(initial);
  const { run, busy, error } = useAction();
  const set = (k: string, val: number | string | boolean | null) => setV((p) => ({ ...p, [k]: val as never }));
  const changed = Object.keys(v).filter((k) => v[k] !== initial[k]);
  /** Sends the changed keys among `keys`, plus `always` whenever anything is sent. */
  const save = (keys: string[], extra?: () => Promise<unknown>, always: string[] = []) => run(async () => {
    const send = keys.filter((k) => changed.includes(k));
    const settings = Object.fromEntries([...new Set(send.length ? [...send, ...always] : [])].map((k) => [k, v[k]]));
    await api('/settings', { method: 'PUT', body: { settings } });
    if (extra) await extra();
    onSaved();
  }, 'Settings saved');
  const reset = () => setV(initial);
  return { v, set, changed, save, reset, busy, error };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
