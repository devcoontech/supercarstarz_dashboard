import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { ApiError } from '../api';
import { fromPence, toPence } from '../format';
import { Switch, useToast } from './ui';

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error ? <span className="muted small">{hint}</span> : null}
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}

type InputProps = { label: string; error?: string; hint?: string; disabled?: boolean; placeholder?: string };

export function TextField({ label, value, onChange, error, hint, type = 'text', multiline, min, max, ...rest }: InputProps & { value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; min?: string; max?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      {multiline
        ? <textarea id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />
        : <input id={id} className="input" type={type} min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

export function NumberField({ label, value, onChange, error, hint, min, max, ...rest }: InputProps & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <input id={id} className="input" type="number" inputMode="numeric" min={min} max={max} value={value ?? ''} aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.trunc(Number(e.target.value)))} {...rest} />
    </Field>
  );
}

/** Pounds in the box, integer pence in the state. Keeps the typed text so "12." isn't rewritten while typing. */
export function MoneyField({ label, value, onChange, error, hint, ...rest }: InputProps & { value: number | null; onChange: (pence: number | null) => void }) {
  const id = useId();
  const [text, setText] = useState(fromPence(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(fromPence(value)); }
  }, [value]);
  const bad = text.trim() !== '' && toPence(text) === null;
  return (
    <Field label={label} error={error ?? (bad ? 'Enter an amount like 120 or 120.50' : undefined)} hint={hint} htmlFor={id}>
      <div className="money">
        <span>£</span>
        <input id={id} className="input" inputMode="decimal" value={text} aria-invalid={!!error || bad}
          onChange={(e) => { setText(e.target.value); const p = e.target.value.trim() === '' ? null : toPence(e.target.value); last.current = p; onChange(p); }} {...rest} />
      </div>
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, error, hint, disabled }: InputProps & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint ? <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>{hint}</span> : null}</span>
    </label>
  );
}

/** A labelled on/off row with the green/red switch. Use for Active, Visible, Published and similar. */
export function ToggleField({ label, checked, onChange, hint, onText, offText }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; onText?: string; offText?: string }) {
  return (
    <div className="toggle-field">
      <div><div className="strong">{label}</div>{hint ? <div className="muted small">{hint}</div> : null}</div>
      <Switch label={label} checked={checked} onChange={onChange} text onText={onText} offText={offText} />
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="empty" role="status"><FiLoader className="spin" size={26} /><div>{label}…</div></div>;
}

export function ErrorBox({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <FiAlertTriangle size={18} />
      <div style={{ flex: 1 }}>{error.message}</div>
      {retry ? <button className="btn sm" onClick={retry}>Try again</button> : null}
    </div>
  );
}

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

/** Confirmation for destructive or sensitive actions, optionally collecting a reason. */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', danger, requireReason, reasonLabel = 'Reason', onConfirm, onClose, extra,
}: {
  title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; requireReason?: boolean; reasonLabel?: string;
  onConfirm: (reason: string) => Promise<unknown>; onClose: () => void; extra?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, busy]);
  const submit = async () => {
    const ok = await run(async () => { await onConfirm(reason.trim()); return true; });
    if (ok) onClose();
  };
  return (
    <>
      <div className="scrim" style={{ zIndex: 40 }} onClick={() => !busy && onClose()} />
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {message ? <div className="dim">{message}</div> : null}
        {extra}
        {requireReason ? <TextField label={reasonLabel} value={reason} onChange={setReason} multiline /> : null}
        <ErrorBox error={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={'btn ' + (danger ? 'danger' : 'gold')} onClick={submit} disabled={busy || (requireReason && !reason.trim())}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="row between" style={{ paddingTop: 18 }}>
      <span className="muted small">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div className="row">
        <button className="btn sm" disabled={page <= 1} onClick={() => onChange(offset - limit)}>Previous</button>
        <span className="muted small">Page {page} of {pages}</span>
        <button className="btn sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </div>
  );
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
