import { useState } from 'react';
import { FiPercent, FiPlus } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import ImageUpload from '../../components/ImageUpload';
import { CheckField, MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { DeleteDialog, RowActions } from '../../components/RowActions';
import { Badge, Drawer, Empty, Panel, Switch } from '../../components/ui';
import { fmtDate, gbp } from '../../lib/format';

type Offer = {
  id: string; code: string | null; title: string; description: string | null; image_url: string | null; discount_type: 'percent' | 'fixed'; discount_value: number;
  starts_at: string | null; ends_at: string | null; usage_limit: number | null; per_customer_limit: number | null; min_booking_pence: number;
  vehicle_ids: string[] | null; event_type_ids: string[] | null; active: boolean; uses: number; discountGivenPence: number;
  auto_apply: boolean; min_vehicles: number; max_vehicles: number | null; vehicle_categories: string[] | null; required_vehicle_ids: string[] | null;
  required_categories: string[] | null; max_discount_pence: number | null; applies_to: 'rental' | 'subtotal'; priority: number; stackable: boolean;
};

const CATEGORIES = ['Supercar', 'Convertible', 'SUV', 'Luxury'];

/** The conditions in words, for the list. */
const conditions = (o: Offer) => [
  o.min_vehicles > 1 || o.max_vehicles ? `${o.min_vehicles}${o.max_vehicles ? `–${o.max_vehicles}` : '+'} vehicles` : null,
  o.vehicle_categories?.length ? o.vehicle_categories.join(', ') : null,
  o.required_categories?.length ? `needs ${o.required_categories.join(' + ')}` : null,
  o.required_vehicle_ids?.length ? `needs ${o.required_vehicle_ids.length} set car${o.required_vehicle_ids.length === 1 ? '' : 's'}` : null,
  o.min_booking_pence ? `over ${gbp(o.min_booking_pence)}` : null,
  o.applies_to === 'rental' ? 'rental only' : null,
  o.max_discount_pence ? `max ${gbp(o.max_discount_pence)}` : null,
  o.stackable ? 'combinable' : null,
].filter(Boolean).join(' · ') || 'Any booking';

const localInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Offers() {
  const { data, error, loading, reload } = useApi<{ items: Offer[] }>('/offers');
  const [editing, setEditing] = useState<Offer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const { run, error: actError } = useAction();
  const state = (o: Offer) => {
    const now = Date.now();
    if (!o.active) return 'inactive';
    if (o.ends_at && new Date(o.ends_at).getTime() < now) return 'archived';
    if (o.starts_at && new Date(o.starts_at).getTime() > now) return 'pending';
    if (o.usage_limit != null && o.uses >= o.usage_limit) return 'archived';
    return 'active';
  };
  const label: Record<string, string> = { active: 'Live', inactive: 'Off', archived: 'Ended', pending: 'Scheduled' };
  return (
    <>
      <Panel title="Offers and discounts" hint="Automatic multi-vehicle discounts and coupon codes. Every offer is checked and calculated on the server when a booking is priced; when several qualify, the highest priority (then the biggest discount) wins, and offers only combine if all of them allow it."
        action={<button className="btn gold" onClick={() => setEditing('new')}><FiPlus /> New offer</button>}>
        <ErrorBox error={error} retry={reload} /><ErrorBox error={actError} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiPercent} title="No offers yet" /> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Offer</th><th>How</th><th>Discount</th><th>Conditions</th><th>Runs</th><th className="num">Uses</th><th className="num">Given away</th><th>Active</th><th>Status</th><th className="actions-cell" /></tr></thead>
            <tbody>{data.items.map((o) => (
              <tr key={o.id}>
                <td className="cell-title"><button className="link-btn" onClick={() => setEditing(o)}>{o.title}</button>{o.priority ? <div className="cell-sub">Priority {o.priority}</div> : null}</td>
                <td>{o.code ? <code>{o.code}</code> : o.auto_apply ? 'Automatic' : <span className="muted">Shown only</span>}</td>
                <td>{o.discount_type === 'percent' ? `${o.discount_value}%` : gbp(o.discount_value)}</td>
                <td className="cell-sub wrap">{conditions(o)}</td>
                <td>{o.starts_at ? fmtDate(o.starts_at) : 'Now'} – {o.ends_at ? fmtDate(o.ends_at) : 'no end'}</td>
                <td className="num">{o.uses}{o.usage_limit != null ? ` / ${o.usage_limit}` : ''}</td><td className="num">{gbp(o.discountGivenPence)}</td>
                <td><Switch text label={`${o.title} active`} checked={o.active} onChange={(v) => run(async () => { await api(`/offers/${o.id}`, { method: 'PATCH', body: { active: v } }); reload(); })} /></td>
                <td><Badge status={state(o)} label={label[state(o)]} /></td>
                <td className="actions-cell"><RowActions name={o.title} onEdit={() => setEditing(o)} onDelete={() => setDeleting(o)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : null}
      </Panel>
      {deleting ? <DeleteDialog what={`"${deleting.title}"`} path={`/offers/${deleting.id}`} note="Offers already used on a booking cannot be deleted; turn them off instead so the history is kept." onClose={() => setDeleting(null)} onDone={reload} /> : null}
      {editing ? <OfferForm offer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </>
  );
}

function OfferForm({ offer, onClose, onSaved }: { offer: Offer | null; onClose: () => void; onSaved: () => void }) {
  const { data: fleet } = useApi<{ items: { id: string; make: string; model: string }[] }>('/vehicles?limit=200');
  const { data: ev } = useApi<{ items: { id: string; title: string }[] }>('/event-types');
  const [title, setTitle] = useState(offer?.title ?? '');
  const [code, setCode] = useState(offer?.code ?? '');
  const [description, setDescription] = useState(offer?.description ?? '');
  const [imageUrl, setImageUrl] = useState(offer?.image_url ?? '');
  const [type, setType] = useState<'percent' | 'fixed'>(offer?.discount_type ?? 'percent');
  const [percent, setPercent] = useState<number | null>(offer?.discount_type === 'percent' ? offer.discount_value : 10);
  const [fixed, setFixed] = useState<number | null>(offer?.discount_type === 'fixed' ? offer.discount_value : null);
  const [startsAt, setStartsAt] = useState(localInput(offer?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(localInput(offer?.ends_at ?? null));
  const [usageLimit, setUsageLimit] = useState<number | null>(offer?.usage_limit ?? null);
  const [perCustomer, setPerCustomer] = useState<number | null>(offer?.per_customer_limit ?? null);
  const [minBooking, setMinBooking] = useState<number | null>(offer?.min_booking_pence ?? 0);
  const [allCars, setAllCars] = useState(!offer?.vehicle_ids);
  const [vehicleIds, setVehicleIds] = useState<string[]>(offer?.vehicle_ids ?? []);
  const [allEvents, setAllEvents] = useState(!offer?.event_type_ids);
  const [eventIds, setEventIds] = useState<string[]>(offer?.event_type_ids ?? []);
  const [active, setActive] = useState(offer?.active ?? true);
  const [mode, setMode] = useState<'auto' | 'code' | 'shown'>(offer ? (offer.auto_apply ? 'auto' : offer.code ? 'code' : 'shown') : 'auto');
  const [minVehicles, setMinVehicles] = useState<number | null>(offer?.min_vehicles ?? 1);
  const [maxVehicles, setMaxVehicles] = useState<number | null>(offer?.max_vehicles ?? null);
  const [categories, setCategories] = useState<string[]>(offer?.vehicle_categories ?? []);
  const [requiredCategories, setRequiredCategories] = useState<string[]>(offer?.required_categories ?? []);
  const [requiredCars, setRequiredCars] = useState<string[]>(offer?.required_vehicle_ids ?? []);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(offer?.max_discount_pence ?? null);
  const [appliesTo, setAppliesTo] = useState<string>(offer?.applies_to ?? 'rental');
  const [priority, setPriority] = useState<number | null>(offer?.priority ?? 0);
  const [stackable, setStackable] = useState(offer?.stackable ?? false);
  const { run, busy, error, fieldErrors } = useAction();
  const value = type === 'percent' ? percent : fixed;
  const badRange = maxVehicles != null && minVehicles != null && maxVehicles < minVehicles;
  const invalid = !title.trim() || !value || (type === 'percent' && value > 100) || (endsAt && startsAt && endsAt < startsAt) || badRange || !minVehicles || (mode === 'code' && !code.trim());
  const toggle = (list: string[], set: (v: string[]) => void, v: string, on: boolean) => set(on ? [...list, v] : list.filter((x) => x !== v));

  const save = async () => {
    const body = {
      title: title.trim(), code: mode === 'code' ? code.trim() : null, autoApply: mode === 'auto', description: description.trim() || null, imageUrl: imageUrl || null, discountType: type, discountValue: value,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null, usageLimit, perCustomerLimit: perCustomer,
      minBookingPence: minBooking ?? 0, vehicleIds: allCars ? null : vehicleIds, eventTypeIds: allEvents ? null : eventIds, active,
      minVehicles: minVehicles ?? 1, maxVehicles, vehicleCategories: categories.length ? categories : null, requiredCategories: requiredCategories.length ? requiredCategories : null,
      requiredVehicleIds: requiredCars.length ? requiredCars : null, maxDiscountPence: maxDiscount || null, appliesTo, priority: priority ?? 0, stackable,
    };
    const ok = await run(() => api(offer ? `/offers/${offer.id}` : '/offers', { method: offer ? 'PATCH' : 'POST', body }), 'Offer saved');
    if (ok) onSaved();
  };

  return (
    <Drawer title={offer ? 'Edit offer' : 'New offer'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || !!invalid} onClick={save}>{busy ? 'Saving…' : 'Save offer'}</button></>}>
      <TextField label="Name *" value={title} onChange={setTitle} error={fieldErrors['title']} placeholder="e.g. Book 3 cars, save 10%" />
      <SelectField label="How it applies" value={mode} onChange={(v) => setMode(v as 'auto' | 'code' | 'shown')} options={[
        { value: 'auto', label: 'Automatically, when the booking meets the conditions' },
        { value: 'code', label: 'With a coupon code the customer enters' },
        { value: 'shown', label: 'Shown as a promotion only (no discount applied)' },
      ]} />
      {mode === 'code' ? <TextField label="Coupon code *" value={code} onChange={setCode} hint="Letters, numbers, - and _" error={fieldErrors['code']} /> : null}
      <TextField label="Description" value={description} onChange={setDescription} multiline />
      <ImageUpload kind="offers" value={imageUrl} onChange={setImageUrl} label="Promotional image" />
      <div className="form-grid">
        <SelectField label="Discount type" value={type} onChange={(v) => setType(v as 'percent' | 'fixed')} options={[{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }]} />
        {type === 'percent' ? <NumberField label="Percent off *" value={percent} onChange={setPercent} min={1} max={100} error={fieldErrors['discountValue']} /> : <MoneyField label="Amount off *" value={fixed} onChange={setFixed} error={fieldErrors['discountValue']} />}
        <TextField label="Starts" type="datetime-local" value={startsAt} onChange={setStartsAt} />
        <TextField label="Ends" type="datetime-local" value={endsAt} onChange={setEndsAt} error={endsAt && startsAt && endsAt < startsAt ? 'Must be after the start' : undefined} />
        <NumberField label="Total uses allowed" value={usageLimit} onChange={setUsageLimit} min={1} hint="Blank = unlimited" />
        <NumberField label="Uses per customer" value={perCustomer} onChange={setPerCustomer} min={1} hint="Blank = unlimited" />
        <MoneyField label="Minimum eligible subtotal" value={minBooking} onChange={setMinBooking} />
        <MoneyField label="Maximum discount" value={maxDiscount} onChange={setMaxDiscount} hint="Blank = no cap. Never more than the eligible amount." />
      </div>
      <h3 className="display" style={{ margin: '8px 0 0', fontSize: 16 }}>Vehicles in the booking</h3>
      <div className="form-grid">
        <NumberField label="At least (vehicles) *" value={minVehicles} onChange={setMinVehicles} min={1} max={50} hint="Counted among the eligible cars below" />
        <NumberField label="At most (vehicles)" value={maxVehicles} onChange={setMaxVehicles} min={1} max={50} hint="Blank = no limit" error={badRange ? 'Must be at least the minimum' : undefined} />
        <SelectField label="Discount applies to" value={appliesTo} onChange={setAppliesTo} options={[{ value: 'rental', label: 'Vehicle rental charges only' }, { value: 'subtotal', label: 'Everything (rental, driver, add-ons)' }]} />
        <NumberField label="Priority" value={priority} onChange={setPriority} min={-100} max={100} hint="Higher wins when several offers qualify" />
      </div>
      <div className="field"><label>Eligible categories</label><div className="row wrap">{CATEGORIES.map((cat) => <CheckField key={cat} label={cat} checked={categories.includes(cat)} onChange={(on) => toggle(categories, setCategories, cat, on)} />)}</div>
        <span className="muted small">None ticked = every category.</span></div>
      <div className="field"><label>Must be booked together</label><div className="row wrap">{CATEGORIES.map((cat) => <CheckField key={cat} label={`a ${cat}`} checked={requiredCategories.includes(cat)} onChange={(on) => toggle(requiredCategories, setRequiredCategories, cat, on)} />)}</div>
        <span className="muted small">For combination offers, e.g. a Supercar with an SUV.</span></div>
      {fleet?.items.length ? (
        <div className="field"><label>Must include these cars</label><div className="form-grid">{fleet.items.map((v) => <CheckField key={v.id} label={`${v.make} ${v.model}`} checked={requiredCars.includes(v.id)} onChange={(on) => toggle(requiredCars, setRequiredCars, v.id, on)} />)}</div></div>
      ) : null}
      <ToggleField label="Can be combined with other offers" checked={stackable} onChange={setStackable} onText="Yes" offText="No" hint="Offers only stack when every applied offer allows it" />
      <CheckField label="Eligible: all cars" checked={allCars} onChange={setAllCars} />
      {!allCars ? (fleet?.items ?? []).map((v) => <CheckField key={v.id} label={`${v.make} ${v.model}`} checked={vehicleIds.includes(v.id)} onChange={(c) => setVehicleIds((p) => (c ? [...p, v.id] : p.filter((x) => x !== v.id)))} />) : null}
      <CheckField label="Applies to all events" checked={allEvents} onChange={setAllEvents} />
      {!allEvents ? (ev?.items ?? []).map((e) => <CheckField key={e.id} label={e.title} checked={eventIds.includes(e.id)} onChange={(c) => setEventIds((p) => (c ? [...p, e.id] : p.filter((x) => x !== e.id)))} />) : null}
      <ToggleField label="Offer status" checked={active} onChange={setActive} />
      <ErrorBox error={error} />
    </Drawer>
  );
}
