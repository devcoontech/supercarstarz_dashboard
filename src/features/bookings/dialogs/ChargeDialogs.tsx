import { useState } from 'react';
import { api } from '../../../lib/api';
import { MoneyField, SelectField, TextField } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { gbp } from '../../../lib/format';
import type { Charge, Detail } from '../bookingDetail.types';

/** The delivery charge and one-off adjustments or credits. */

/** The delivery charge staff work out for this address (they measure the distance themselves). */
export function DeliveryCharge({ b, current, onClose, onDone }: { b: Detail; current: Charge | null; onClose: () => void; onDone: () => void }) {
  const confirmed = current?.status === 'confirmed';
  const [final, setFinal] = useState<number | null>(confirmed ? current!.amountPence : null);
  const [address, setAddress] = useState(current?.address ?? b.address ?? '');
  const [reason, setReason] = useState('');
  const newTotal = b.finance.finalTotalPence - (confirmed ? current!.amountPence : 0) + (final ?? 0);
  const newBalance = Math.max(0, newTotal - b.finance.netPaidPence);
  return (
    <ConfirmDialog title={confirmed ? 'Change delivery charge' : 'Add delivery charge'} confirmLabel={confirmed ? 'Save change' : 'Add to booking'} onClose={onClose}
      message="The charge replaces any earlier delivery charge, so it is never counted twice. The customer is emailed the new total."
      extra={<>
        <TextField label="Delivery address" value={address} onChange={setAddress} />
        <MoneyField label="Delivery charge" value={final} onChange={setFinal} hint="The amount you've worked out for this delivery" />
        <div className="muted small">New booking total {gbp(newTotal)} · paid {gbp(b.finance.netPaidPence)} · outstanding {gbp(newBalance)}</div>
        {confirmed ? <TextField label="Reason for the change" value={reason} onChange={setReason} /> : null}
      </>}
      onConfirm={async () => {
        if (final == null) throw new Error('Enter the delivery charge.');
        await api(`/bookings/${b.id}/delivery-charge`, { body: { distanceMiles: null, ratePerMilePence: 0, finalPence: final, address: address || null, reason: reason || null } });
        onDone();
      }} />
  );
}

export function Adjustment({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState('charge');
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const signed = amount == null ? 0 : kind === 'credit' ? -amount : amount;
  return (
    <ConfirmDialog title="Add a charge or credit" confirmLabel="Add to booking" onClose={onClose}
      message="Confirmed straight away and shown to the customer with an adjustment note. To change it later, remove it and add a new one."
      extra={<>
        <SelectField label="Type" value={kind} onChange={setKind} options={[{ value: 'charge', label: 'Extra charge' }, { value: 'credit', label: 'Credit (reduces the total)' }]} />
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
        <TextField label="Description (shown to the customer) *" value={description} onChange={setDescription} />
        <div className="muted small">New booking total {gbp(b.finance.finalTotalPence + signed)}</div>
      </>}
      onConfirm={async () => {
        if (!amount || !description.trim()) throw new Error('Enter an amount and a description.');
        await api(`/bookings/${b.id}/adjustments`, { body: { amountPence: signed, description } });
        onDone();
      }} />
  );
}
