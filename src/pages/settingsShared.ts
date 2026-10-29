import { useState } from 'react';
import { api } from '../api';
import { useAction } from '../components/forms';

export type S = Record<string, number | string | boolean>;
export type Secrets = Record<string, { configured: boolean; hint: string | null }>;
export type Payload = { settings: S; secrets: Secrets; mail: { source: 'dashboard' | 'environment' | 'none' } };

export function useSettingsForm(initial: S, onSaved: () => void) {
  const [v, setV] = useState<S>(initial);
  const { run, busy, error } = useAction();
  const set = (k: string, val: number | string | boolean | null) => setV((p) => ({ ...p, [k]: val as never }));
  const changed = Object.keys(v).filter((k) => v[k] !== initial[k]);
  const save = (keys: string[], extra?: () => Promise<unknown>) => run(async () => {
    const settings = Object.fromEntries(keys.filter((k) => changed.includes(k)).map((k) => [k, v[k]]));
    await api('/settings', { method: 'PUT', body: { settings } });
    if (extra) await extra();
    onSaved();
  }, 'Settings saved');
  return { v, set, changed, save, busy, error };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
