import { useState } from 'react';
import { FiPlus, FiTag } from 'react-icons/fi';
import { RowActions } from '../../../components/RowActions';
import { api, useApi } from '../../../lib/api';
import { gbp } from '../../../lib/format';
import { MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../../components/forms';
import { useAction } from '../../../lib/hooks';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../../components/feedback';
import { Drawer, Empty, Switch } from '../../../components/ui';

/**
 * A car's own prices. Every car has a base hourly rate (on the car itself); these add the other price types the
 * booking engine supports: an hourly rate for one event, packages (fixed hours for a fixed price, e.g. a full day),
 * an extra-hour rate after a package, a per-mile rate for pick-up and drop-off trips, and special-date changes.
 */

export type PriceKind = 'hourly' | 'package' | 'extra_hour' | 'per_mile' | 'special_date' | 'daily';
export type Price = {
  id: string; eventTypeId: string | null; kind: PriceKind; label: string | null; hours: number | null; amountPence: number | null;
  minAmountPence: number | null; multiplierBp: number | null; startsOn: string | null; endsOn: string | null; active: boolean;
};
/** What is sent to the API (the car is added by the caller). */
export type PriceBody = Omit<Price, 'id'>;
type Opt = { id: string; name: string };

export const PRICE_TYPES: { value: PriceKind; label: string; help: string }[] = [
  { value: 'hourly', label: 'Per hour', help: 'A different hourly rate, usually for one event' },
  { value: 'package', label: 'Package (fixed hours)', help: 'A set price for a block of hours, e.g. half day or full day' },
  { value: 'extra_hour', label: 'Extra hour', help: 'Charged for each hour beyond a package' },
  { value: 'daily', label: 'Per day', help: 'Price for each whole day (24 hours) when a customer books by the day. Without it, a day is charged as 24 hours at the hourly rate.' },
  { value: 'per_mile', label: 'Per mile', help: 'For pick-up and drop-off trips priced by distance' },
  { value: 'special_date', label: 'Special dates', help: 'Raise or lower the price between two dates' },
];
export const priceTypeLabel = (k: PriceKind) => PRICE_TYPES.find((t) => t.value === k)?.label ?? k;

export const describePrice = (r: Pick<Price, 'kind' | 'amountPence' | 'minAmountPence' | 'hours' | 'multiplierBp' | 'startsOn' | 'endsOn'>) =>
  r.kind === 'hourly' ? `${gbp(r.amountPence)} per hour`
    : r.kind === 'daily' ? `${gbp(r.amountPence)} per day (24 hours)`
    : r.kind === 'extra_hour' ? `${gbp(r.amountPence)} per extra hour`
    : r.kind === 'per_mile' ? `${gbp(r.amountPence)} per mile${r.minAmountPence ? `, minimum ${gbp(r.minAmountPence)}` : ''}`
    : r.kind === 'package' ? `${r.hours} hours for ${gbp(r.amountPence)}`
    : `${r.multiplierBp! >= 10000 ? '+' : ''}${(r.multiplierBp! - 10000) / 100}% from ${r.startsOn} to ${r.endsOn}`;

/** The table of a car's extra prices, read from the API (an existing car). */
export function VehiclePrices({ vehicleId, events }: { vehicleId: string; events: Opt[] }) {
  const { data, error, loading, reload } = useApi<{ items: Price[] }>(`/pricing-rules?vehicleId=${vehicleId}`);
  const [editing, setEditing] = useState<Price | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Price | null>(null);
  const { run, error: actError } = useAction();
  const save = async (body: PriceBody) => {
    const r = editing && editing !== 'new' ? editing : null;
    const { kind: _kind, ...rest } = body;
    await api(r ? `/pricing-rules/${r.id}` : '/pricing-rules', { method: r ? 'PATCH' : 'POST', body: r ? rest : { ...body, vehicleId } });
    setEditing(null);
    reload();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ErrorBox error={error} retry={reload} /><ErrorBox error={actError} />
      {loading && !data ? <Loading /> : null}
      <PriceTable items={data?.items ?? []} events={events} onEdit={setEditing} onDelete={setDeleting}
        onToggle={(p, v) => run(async () => { await api(`/pricing-rules/${p.id}`, { method: 'PATCH', body: { active: v } }); reload(); })} />
      <div><button className="btn sm" onClick={() => setEditing('new')}><FiPlus /> Add a price</button></div>
      {editing ? <PriceForm price={editing === 'new' ? null : editing} events={events} onClose={() => setEditing(null)} onSubmit={save} /> : null}
      {deleting ? (
        <ConfirmDialog title="Delete this price?" danger confirmLabel="Delete" message={<>{priceTypeLabel(deleting.kind)}: {describePrice(deleting)}. Existing bookings keep the price they were quoted.</>}
          onConfirm={async () => { await api(`/pricing-rules/${deleting.id}`, { method: 'DELETE' }); reload(); }} onClose={() => setDeleting(null)} />
      ) : null}
    </div>
  );
}

/** The list of prices, shared by the vehicle page and the add-vehicle wizard. */
export function PriceTable<T extends PriceBody & { id?: string }>({ items, events, onEdit, onDelete, onToggle }: {
  items: T[]; events: Opt[]; onEdit: (p: T) => void; onDelete: (p: T) => void; onToggle?: (p: T, active: boolean) => void;
}) {
  const eName = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? 'Unknown event' : 'Every event');
  if (!items.length) return <Empty icon={FiTag} title="Only the base hourly rate">Add a package, an event rate or another price type if this car needs one.</Empty>;
  return (
    <div className="table-wrap" style={{ margin: 0 }}>
      <table>
        <thead><tr><th>Price type</th><th>Price</th><th>Applies to</th>{onToggle ? <th>Status</th> : null}<th className="actions-cell" /></tr></thead>
        <tbody>{items.map((p, i) => (
          <tr key={p.id ?? i}>
            <td><div className="cell-title">{priceTypeLabel(p.kind)}</div>{p.label ? <div className="cell-sub">{p.label}</div> : null}</td>
            <td>{describePrice(p)}</td>
            <td>{eName(p.eventTypeId)}</td>
            {onToggle ? <td><Switch text label="Price active" checked={p.active} onChange={(v) => onToggle(p, v)} /></td> : null}
            <td className="actions-cell"><RowActions name="price" onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Add or edit one price. Calls onSubmit with the API body; the caller saves it (to the API or to the wizard's draft). */
export function PriceForm({ price, events, onClose, onSubmit, done = 'Price saved' }: { price: PriceBody | null; events: Opt[]; onClose: () => void; onSubmit: (b: PriceBody) => Promise<void> | void; done?: string }) {
  const [kind, setKind] = useState<PriceKind>(price?.kind ?? 'package');
  const [eventTypeId, setEventTypeId] = useState(price?.eventTypeId ?? '');
  const [label, setLabel] = useState(price?.label ?? '');
  const [amount, setAmount] = useState<number | null>(price?.amountPence ?? null);
  const [hours, setHours] = useState<number | null>(price?.hours ?? null);
  const [change, setChange] = useState<number | null>(price?.multiplierBp ? (price.multiplierBp - 10000) / 100 : null);
  const [startsOn, setStartsOn] = useState(price?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(price?.endsOn ?? '');
  const [minimum, setMinimum] = useState<number | null>(price?.minAmountPence ?? null);
  const [active, setActive] = useState(price?.active ?? true);
  const [tried, setTried] = useState(false);
  const { run, busy, error } = useAction();

  const errors: Record<string, string> = {};
  if (kind === 'special_date') {
    if (change == null) errors.change = 'Enter the % change';
    else if (change <= -100) errors.change = 'Must be more than -100%';
    if (!startsOn) errors.startsOn = 'Choose the first date';
    if (!endsOn) errors.endsOn = 'Choose the last date';
    else if (startsOn && endsOn < startsOn) errors.endsOn = 'Must be on or after the first date';
  } else {
    if (amount == null) errors.amount = 'Enter the price';
    if (kind === 'package' && !hours) errors.hours = 'Enter how many hours the package covers';
  }
  const e = (k: string) => (tried ? errors[k] : undefined);

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const body: PriceBody = {
      kind, eventTypeId: eventTypeId || null, label: label.trim() || null, active,
      amountPence: kind === 'special_date' ? null : amount, hours: kind === 'package' ? hours : null,
      minAmountPence: kind === 'per_mile' ? minimum : null,
      multiplierBp: kind === 'special_date' ? Math.round(10000 + change! * 100) : null,
      startsOn: kind === 'special_date' ? startsOn : null, endsOn: kind === 'special_date' ? endsOn : null,
    };
    if (await run(async () => { await onSubmit(body); return true; }, done)) onClose();
  };

  return (
    <Drawer title={price ? 'Edit price' : 'Add a price'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save price'}</button></>}>
      <SelectField label="Price type" value={kind} onChange={(v) => setKind(v as PriceKind)} disabled={!!price}
        hint={PRICE_TYPES.find((t) => t.value === kind)?.help} options={PRICE_TYPES.map(({ value, label }) => ({ value, label }))} />
      <SelectField label="Applies to" value={eventTypeId} onChange={setEventTypeId} hint="Leave on Every event unless this price is only for one event"
        options={[{ value: '', label: 'Every event' }, ...events.map((ev) => ({ value: ev.id, label: ev.name }))]} />
      <TextField label="Name shown to customers (optional)" value={label} onChange={setLabel} placeholder={kind === 'package' ? 'e.g. Full day' : kind === 'special_date' ? 'e.g. Christmas week' : ''} />
      {kind === 'package' ? <NumberField label="Hours in the package *" value={hours} onChange={setHours} min={1} error={e('hours')} /> : null}
      {kind !== 'special_date' ? <MoneyField label={kind === 'package' ? 'Package price *' : kind === 'per_mile' ? 'Price per mile *' : kind === 'extra_hour' ? 'Price per extra hour *' : kind === 'daily' ? 'Price per day *' : 'Price per hour *'} value={amount} onChange={setAmount} error={e('amount')} /> : null}
      {kind === 'per_mile' ? <MoneyField label="Minimum charge (optional)" value={minimum} onChange={setMinimum} hint="The least a trip costs, however short" /> : null}
      {kind === 'special_date' ? (
        <>
          <NumberField label="Price change (%) *" value={change} onChange={setChange} error={e('change')} hint="20 adds 20%; -10 takes 10% off the hire price" />
          <div className="form-grid">
            <TextField label="From *" type="date" value={startsOn} onChange={setStartsOn} error={e('startsOn')} />
            <TextField label="To *" type="date" value={endsOn} onChange={setEndsOn} error={e('endsOn')} />
          </div>
        </>
      ) : null}
      <ToggleField label="Price status" checked={active} onChange={setActive} hint="Switched-off prices are kept but not charged" />
      <ErrorBox error={error} />
    </Drawer>
  );
}
