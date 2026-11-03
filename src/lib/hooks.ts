import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { useToast } from '../components/toast';

/** Shared React hooks: running a save action, and debouncing a search box. */

/** Runs async actions with a busy flag (blocks double-submit), success toast and surfaced errors. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const inFlight = useRef(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (success) toast(success);
      return r;
    } catch (e) {
      setError(e as Error);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [toast]);
  return { run, busy, error, setError, fieldErrors: error instanceof ApiError ? error.fieldErrors() : {} };
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
