import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { RowActions } from './RowActions';
import { api, qs, useApi } from '../api';
import { gbp } from '../format';
import { ConfirmDialog, ErrorBox, Loading, MoneyField, NumberField, SelectField, TextField, ToggleField, useAction } from './forms';
import { Drawer, Empty, Switch } from './ui';

export type Rule = {
  id: string; vehicleId: string | null; eventTypeId: string | null; kind: 'hourly' | 'package' | 'extra_hour' | 'special_date' | 'per_mile'; minAmountPence: number | null;
  label: string | null; hours: number | null; amountPence: number | null; multiplierBp: number | null; startsOn: string | null; endsOn: string | null; active: boolean;
};
type Opt = { id: string; name: string };

const KIND_LABEL = { hourly: 'Hourly rate', package: 'Package', extra_hour: 'Extra-hour rate', special_date: 'Special-date uplift', per_mile: 'Per-mile rate' } as const;

export const describeRule = (r: Rule) =>
  r.kind === 'hourly' ? `${gbp(r.amountPence)} per hour`
    : r.kind === 'extra_hour' ? `${gbp(r.amountPence)} per extra hour`
    : r.kind === 'per_mile' ? `${gbp(r.amountPence)} per mile${r.minAmountPence ? `, minimum ${gbp(r.minAmountPence)}` : ''}`
    : r.kind === 'package' ? `${r.hours}h for ${gbp(r.amountPence)}`
    : `${r.multiplierBp! >= 10000 ? '+' : ''}${(r.multiplierBp! - 10000) / 100}% from ${r.startsOn} to ${r.endsOn}`;

export default function PricingRules({ vehicleId, vehicles, events }: { vehicleId?: string; vehicles: Opt[]; events: Opt[] }) {
  const { data, error, loading, reload } = useApi<{ items: Rule[] }>('/pricing-rules' + qs({ vehicleId }));
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const { run } = useAction();
  const vName = (id: string | null) => (id ? vehicles.find((v) => v.id === id)?.name ?? 'Unknown car' : 'All cars');
  const eName = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? 'Unknown event' : 'All events');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row between">
        <span className="muted small">Most specific rule wins: car + event, then car, then event, then the car's base rate. Existing bookings keep the price they were quoted.</span>
        <button className="btn gold sm" onClick={() => setEditing('new')}><FiPlus /> Add rule</button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiPlus} title="No custom rules">The car's base hourly rate applies.</Empty> : null}
      {data?.items.length ? (
        <div className="table-wrap" style={{ margin: 0 }}>
          <table>
            <thead><tr><th>Rule</th><th>Applies to</th><th>Status</th><th className="actions-cell" /></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td><div className="cell-title">{KIND_LABEL[r.kind]}{r.label ? ` · ${r.label}` : ''}</div><div className="cell-sub">{describeRule(r)}</div></td>
                  <td>{vName(r.vehicleId)} · {eName(r.eventTypeId)}</td>
                  <td><Switch text label={`Rule active`} checked={r.active} onChange={(v) => run(async () => { await api(`/pricing-rules/${r.id}`, { method: 'PATCH', body: { active: v } }); reload(); })} /></td>
                  <td className="actions-cell"><RowActions name="rule" onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {editing ? <RuleForm rule={editing === 'new' ? null : editing} lockVehicle={vehicleId} vehicles={vehicles} events={events} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
      {deleting ? (
        <ConfirmDialog title="Delete this rule?" danger confirmLabel="Delete" message={<>{KIND_LABEL[deleting.kind]}: {describeRule(deleting)}. Existing bookings are not affected.</>}
          onConfirm={async () => { await api(`/pricing-rules/${deleting.id}`, { method: 'DELETE' }); reload(); }} onClose={() => setDeleting(null)} />
      ) : null}
    </div>
  );
}

function RuleForm({ rule, lockVehicle, vehicles, events, onClose, onSaved }: { rule: Rule | null; lockVehicle?: string; vehicles: Opt[]; events: Opt[]; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<Rule['kind']>(rule?.kind ?? 'hourly');
  const [vehicleId, setVehicleId] = useState(rule?.vehicleId ?? lockVehicle ?? '');
  const [eventTypeId, setEventTypeId] = useState(rule?.eventTypeId ?? '');
  const [label, setLabel] = useState(rule?.label ?? '');
  const [amount, setAmount] = useState<number | null>(rule?.amountPence ?? null);
  const [hours, setHours] = useState<number | null>(rule?.hours ?? null);
  const [uplift, setUplift] = useState<number | null>(rule?.multiplierBp ? (rule.multiplierBp - 10000) / 100 : null);
  const [startsOn, setStartsOn] = useState(rule?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(rule?.endsOn ?? '');
  const [minimum, setMinimum] = useState<number | null>(rule?.minAmountPence ?? null);
  const [active, setActive] = useState(rule?.active ?? true);
  const { run, busy, error } = useAction();

  const missing =
    kind === 'special_date' ? uplift == null || uplift <= -100 || !startsOn || !endsOn
    : kind === 'package' ? amount == null || !hours
    : amount == null;

  const save = async () => {
    const body: Record<string, unknown> = { kind, vehicleId: vehicleId || null, eventTypeId: eventTypeId || null, label: label.trim() || null, active };
    if (kind === 'special_date') Object.assign(body, { multiplierBp: Math.round(10000 + uplift! * 100), startsOn, endsOn, amountPence: null, hours: null });
    else if (kind === 'package') Object.assign(body, { amountPence: amount, hours });
    else if (kind === 'per_mile') Object.assign(body, { amountPence: amount, minAmountPence: minimum });
    else Object.assign(body, { amountPence: amount });
    const ok = await run(() => api(rule ? `/pricing-rules/${rule.id}` : '/pricing-rules', { method: rule ? 'PATCH' : 'POST', body }), 'Rule saved');
    if (ok) onSaved();
  };

  return (
    <Drawer title={rule ? 'Edit pricing rule' : 'New pricing rule'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || missing} onClick={save}>{busy ? 'Saving…' : 'Save rule'}</button></>}>
      <SelectField label="Type" value={kind} onChange={(v) => setKind(v as Rule['kind'])} disabled={!!rule}
        options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
      <SelectField label="Car" value={vehicleId} onChange={setVehicleId} disabled={!!lockVehicle}
        options={[{ value: '', label: 'All cars' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]} />
      <SelectField label="Event" value={eventTypeId} onChange={setEventTypeId} options={[{ value: '', label: 'All events' }, ...events.map((e) => ({ value: e.id, label: e.name }))]} />
      <TextField label="Label (optional)" value={label} onChange={setLabel} placeholder={kind === 'package' ? 'Half day' : kind === 'special_date' ? 'Christmas week' : ''} />
      {kind === 'package' ? <NumberField label="Package length (hours)" value={hours} onChange={setHours} min={1} /> : null}
      {kind !== 'special_date' ? <MoneyField label={kind === 'package' ? 'Package price' : kind === 'per_mile' ? 'Price per mile' : 'Rate'} value={amount} onChange={setAmount} /> : null}
      {kind === 'per_mile' ? <MoneyField label="Minimum charge (optional)" value={minimum} onChange={setMinimum} hint="The least a distance-priced trip costs. Used for pick-up and drop-off events." /> : null}
      {kind === 'special_date' ? (
        <>
          <NumberField label="Price change (%)" value={uplift} onChange={setUplift} hint="20 adds 20%; -10 gives 10% off. Applied to the duration charge." />
          <div className="form-grid">
            <TextField label="From" type="date" value={startsOn} onChange={setStartsOn} />
            <TextField label="To" type="date" value={endsOn} onChange={setEndsOn} />
          </div>
        </>
      ) : null}
      <ToggleField label="Rule status" checked={active} onChange={setActive} />
      <ErrorBox error={error} />
    </Drawer>
  );
}
