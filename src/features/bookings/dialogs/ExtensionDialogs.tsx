import { Fragment, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { NumberField, TextField } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBox } from '../../../components/feedback';
import { fmtTime, gbp } from '../../../lib/format';
import type { Detail, Extension, ExtQuote } from '../bookingDetail.types';

/** Extending a booking, and approving or rejecting a customer's extension request. */

/**
 * Extend this booking. The server checks the time is free (other bookings, the preparation buffer, the driver) and
 * shows the price change first; staff may go past opening hours or the car's maximum, never into another booking.
 */
export function Extend({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const [hours, setHours] = useState<number | null>(1);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState<ExtQuote | null>(null);
  const [qErr, setQErr] = useState<Error | null>(null);
  useEffect(() => {
    if (!hours || hours < 1 || hours > 12) { setQ(null); return; }
    let live = true;
    api<ExtQuote>(`/bookings/${b.id}/extension-quote`, { body: { hours } }).then((r) => { if (live) { setQ(r); setQErr(null); } }, (e) => { if (live) { setQ(null); setQErr(e); } });
    return () => { live = false; };
  }, [b.id, hours]);
  return (
    <ConfirmDialog title="Extend booking" confirmLabel={q?.available ? 'Extend' : 'Not available'} onClose={onClose}
      message={`Currently ends at ${fmtTime(b.endAt)}. The extra time is added to this booking and the order's offers and tax are worked out again.`}
      extra={<>
        <NumberField label="Extra hours" value={hours} onChange={setHours} min={1} max={12} />
        <ErrorBox error={qErr} />
        {q ? (q.available ? (
          <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt className="dim">New end time</dt><dd style={{ textAlign: 'right' }}>{fmtTime(q.newEndAt)}</dd>
            {q.lines.map((l) => <Fragment key={l.key}><dt className="dim">{l.label}</dt><dd style={{ textAlign: 'right' }}>{gbp(l.amountPence)}</dd></Fragment>)}
            {q.taxDifferencePence ? <><dt className="dim">{q.taxLabel} on the extra</dt><dd style={{ textAlign: 'right' }}>{gbp(q.taxDifferencePence)}</dd></> : null}
            <dt className="dim">Order total</dt><dd style={{ textAlign: 'right' }}>{gbp(q.previousTotalPence)} → {gbp(q.newTotalPence)}</dd>
            <dt className="dim">Already paid</dt><dd style={{ textAlign: 'right' }}>{gbp(q.paidPence)}</dd>
            <dt className="strong">Balance after</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(q.balanceAfterPence)}</dd>
          </dl>
        ) : <div className="error-box">{q.reason}</div>) : null}
        <TextField label="Reason (for the history)" value={reason} onChange={setReason} />
      </>}
      onConfirm={async () => {
        if (!q?.available || !hours) throw new Error(q?.reason ?? 'Choose how long to extend by.');
        await api(`/bookings/${b.id}/extend`, { body: { hours, reason: reason || null, expectedEndAt: b.endAt } });
        onDone();
      }} />
  );
}

/**
 * Approve or decline a customer's request for more time. When approving, staff can grant fewer (or more) hours than
 * asked, e.g. the most the car is free for, and see the price change first.
 */
export function DecideExtension({ b, ext, approve, onClose, onDone }: { b: Detail; ext: Extension; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState<number | null>(ext.additionalHours);
  const [q, setQ] = useState<ExtQuote | null>(null);
  const [qErr, setQErr] = useState<Error | null>(null);
  useEffect(() => {
    if (!approve || !hours || hours < 1 || hours > 12) { setQ(null); return; }
    let live = true;
    api<ExtQuote>(`/bookings/${b.id}/extension-quote`, { body: { hours } }).then((r) => { if (live) { setQ(r); setQErr(null); } }, (e) => { if (live) { setQ(null); setQErr(e); } });
    return () => { live = false; };
  }, [approve, b.id, hours]);
  return (
    <ConfirmDialog title={approve ? 'Approve extension' : 'Decline extension'} confirmLabel={approve ? 'Approve and extend' : 'Decline'} danger={!approve} onClose={onClose}
      message={approve ? `The customer asked for ${ext.additionalHours} more hour${ext.additionalHours === 1 ? '' : 's'}${ext.customerMessage ? `: "${ext.customerMessage}"` : ''}. Availability is checked again when you approve; if the time is taken, nothing changes and you will see why.`
        : 'The customer is told, with your reason. The booking does not change.'}
      extra={<>
        {approve ? <>
          <NumberField label="Hours to add" value={hours} onChange={setHours} min={1} max={12} hint="Defaults to what the customer asked for" />
          <ErrorBox error={qErr} />
          {q ? (q.available ? (
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt className="dim">New end time</dt><dd style={{ textAlign: 'right' }}>{fmtTime(q.newEndAt)}</dd>
              <dt className="dim">Order total</dt><dd style={{ textAlign: 'right' }}>{gbp(q.previousTotalPence)} → {gbp(q.newTotalPence)}</dd>
              <dt className="strong">Balance after</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(q.balanceAfterPence)}</dd>
            </dl>
          ) : <div className="error-box">{q.reason}{q.maxAvailableHours ? <> <button className="btn sm" onClick={() => setHours(q.maxAvailableHours)}>Use {q.maxAvailableHours}h</button></> : null}</div>) : null}
        </> : null}
        <TextField label={approve ? 'Note (optional)' : 'Reason for the customer *'} value={reason} onChange={setReason} multiline />
      </>}
      onConfirm={async () => {
        if (!approve && !reason.trim()) throw new Error('Give the customer a reason.');
        if (approve && (!hours || q?.available === false)) throw new Error(q?.reason ?? 'Choose how many hours to add.');
        await api(`/extensions/${ext.id}/${approve ? 'approve' : 'reject'}`, { body: approve ? { reason: reason || null, hours } : { reason } });
        onDone();
      }} />
  );
}
