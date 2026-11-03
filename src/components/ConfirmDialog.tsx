import { useEffect, useState, type ReactNode } from 'react';
import { ErrorBox } from './feedback';
import { TextField } from './forms';
import { useAction } from '../lib/hooks';

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
