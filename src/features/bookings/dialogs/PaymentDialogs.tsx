import { useRef, useState } from 'react';
import { api, newIdempotencyKey } from '../../../lib/api';
import { MoneyField, SelectField, TextField } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { gbp } from '../../../lib/format';
import type { Payment, Detail } from '../bookingDetail.types';

/** Recording a manual payment, updating its status, and refunds. */

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function ManualPay({ b, outstanding, onClose, onDone }: { b: Detail; outstanding: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>((b.finance.depositMode && b.finance.dueNowPence) || outstanding);
  const [method, setMethod] = useState('cash');
  const [paidAt, setPaidAt] = useState(localInput(new Date()));
  const [status, setStatus] = useState('succeeded');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const key = useRef(newIdempotencyKey()); // one key for this form, so a double click records it once
  const purpose = b.finance.netPaidPence === 0 && b.finance.depositMode && amount != null && amount < outstanding ? 'deposit' : b.finance.netPaidPence > 0 ? 'balance' : 'payment';
  return (
    <ConfirmDialog title="Record a payment" confirmLabel="Record payment" onClose={onClose}
      message="For money taken outside the app. It is saved under your name and labelled as recorded by staff, never as a verified online card payment."
      extra={<>
        <MoneyField label="Amount received" value={amount} onChange={setAmount} hint={`Outstanding ${gbp(outstanding)}${b.finance.depositMode && b.finance.dueNowPence ? ` · deposit still due ${gbp(b.finance.dueNowPence)}` : ''}`} />
        <div className="form-grid">
          <SelectField label="Method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card_terminal', label: 'Card' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'other', label: 'Other' }]} />
          <SelectField label="Status" value={status} onChange={setStatus} options={[{ value: 'succeeded', label: 'Received' }, { value: 'pending', label: 'Pending (not counted yet)' }]} />
        </div>
        <TextField label="Payment date and time" type="datetime-local" value={paidAt} onChange={setPaidAt} max={localInput(new Date())} />
        <TextField label="Transaction or receipt reference" value={reference} onChange={setReference} hint="Printed on the customer's receipt" />
        <TextField label="Note (staff only)" value={note} onChange={setNote} multiline />
      </>}
      onConfirm={async () => {
        if (!amount) throw new Error('Enter the amount received.');
        await api(`/bookings/${b.id}/payments/manual`, {
          headers: { 'idempotency-key': key.current },
          body: { amountPence: amount, method, status, purpose, paidAt: paidAt ? new Date(paidAt).toISOString() : null, reference: reference || undefined, note: note || null },
        });
        onDone();
      }} />
  );
}

export function PaymentStatus({ p, onClose, onDone }: { p: Payment; onClose: () => void; onDone: () => void }) {
  const [to, setTo] = useState('succeeded');
  const [paidAt, setPaidAt] = useState(localInput(new Date()));
  return (
    <ConfirmDialog title={`Update ${gbp(p.amountPence)} payment`} confirmLabel="Save" onClose={onClose}
      message="Marking it received counts it towards the amount paid and issues a receipt. Failed or cancelled payments are never counted."
      extra={<>
        <SelectField label="Status" value={to} onChange={setTo} options={[{ value: 'succeeded', label: 'Received' }, { value: 'failed', label: 'Failed' }, { value: 'canceled', label: 'Cancelled' }]} />
        {to === 'succeeded' ? <TextField label="Received on" type="datetime-local" value={paidAt} onChange={setPaidAt} max={localInput(new Date())} /> : null}
      </>}
      onConfirm={async () => { await api(`/payments/${p.id}/status`, { body: { status: to, paidAt: to === 'succeeded' && paidAt ? new Date(paidAt).toISOString() : null } }); onDone(); }} />
  );
}

export function Refund({ paymentId, max, suggested, onClose, onDone }: { paymentId: string; max: number; suggested: number | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>(suggested != null ? Math.min(suggested, max) : max);
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title="Refund" confirmLabel="Issue refund" danger onClose={onClose}
      message={`Up to ${gbp(max)} can be refunded on this payment. Card refunds are sent to Stripe.${suggested != null ? ` The cancellation policy suggests ${gbp(suggested)}.` : ''}`}
      extra={<><MoneyField label="Refund amount" value={amount} onChange={setAmount} /><TextField label="Reason *" value={reason} onChange={setReason} multiline /></>}
      onConfirm={async () => {
        if (!amount || !reason.trim()) throw new Error('Enter an amount and a reason.');
        await api(`/payments/${paymentId}/refund`, { body: { amountPence: amount, reason } });
        onDone();
      }} />
  );
}
