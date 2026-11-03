import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { fromPence, toPence } from '../lib/format';
import { Switch } from './ui';

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
