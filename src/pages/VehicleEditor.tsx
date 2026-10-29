import { useEffect, useRef, useState, type DragEvent } from 'react';
import { FiArrowLeft, FiArrowRight, FiEye, FiStar, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { api, useApi } from '../api';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import PricingRules from '../components/PricingRules';
import { CheckField, ConfirmDialog, ErrorBox, Loading, MoneyField, NumberField, SelectField, TextField, ToggleField, useAction } from '../components/forms';
import { Badge, Drawer, Empty, Panel, Tabs } from '../components/ui';
import { fmtDateTime, gbp } from '../format';
import { go } from '../nav';

type Img = { id: string; url: string; isCover: boolean; sortOrder: number };
type Row = Record<string, any> & { id: string; images: Img[]; event_type_ids: string[]; addon_ids: string[] };

const blank = {
  fleetRef: '', make: '', model: '', year: new Date().getFullYear() as number | null, category: 'Supercar', colour: '', transmission: '', seats: 2 as number | null,
  power: '', topSpeed: '', city: '', area: '', description: '', amenities: '', pricePerHourPence: null as number | null,
  deliveryAvailable: false, deliveryFeePence: 0 as number | null, deliveryRadiusMiles: 0 as number | null, stationaryAvailable: true,
  baseAddress: '', deliveryPricing: 'flat', deliveryPerMilePence: 0 as number | null, deliveryFreeMiles: 0 as number | null, deliveryMinPence: 0 as number | null, deliveryRoundTrip: false, chauffeurChargeType: 'fixed',
  minHours: 1 as number | null, maxHours: 6 as number | null, bufferMinutes: 0 as number | null, chauffeurAvailable: false, chauffeurFeePence: 0 as number | null, selfDriveAvailable: true,
  depositPence: 0 as number | null, operationalStatus: 'active',
};
type Form = typeof blank;

const fromRow = (r: Row): Form => ({
  fleetRef: r.fleet_ref ?? '', make: r.make, model: r.model, year: r.year, category: r.category, colour: r.colour ?? '', transmission: r.transmission ?? '', seats: r.seats,
  power: r.power ?? '', topSpeed: r.top_speed ?? '', city: r.city, area: r.area ?? '', description: r.description, amenities: (r.amenities ?? []).join(', '),
  pricePerHourPence: r.price_per_hour_pence, deliveryAvailable: r.delivery_available, deliveryFeePence: r.delivery_fee_pence, deliveryRadiusMiles: r.delivery_radius_miles,
  baseAddress: r.base_address ?? '', deliveryPricing: r.delivery_pricing, deliveryPerMilePence: r.delivery_per_mile_pence, deliveryFreeMiles: r.delivery_free_miles, deliveryMinPence: r.delivery_min_pence, deliveryRoundTrip: r.delivery_round_trip, chauffeurChargeType: r.chauffeur_charge_type,
  stationaryAvailable: r.stationary_available, minHours: r.min_hours, maxHours: r.max_hours, bufferMinutes: r.buffer_minutes, chauffeurAvailable: r.chauffeur_available,
  chauffeurFeePence: r.chauffeur_fee_pence, depositPence: r.deposit_pence, operationalStatus: r.operational_status, selfDriveAvailable: r.self_drive_available,
});

const toBody = (f: Form) => ({
  fleetRef: f.fleetRef.trim() || null, make: f.make.trim(), model: f.model.trim(), year: f.year, category: f.category, colour: f.colour.trim() || null,
  transmission: f.transmission.trim() || null, seats: f.seats, power: f.power.trim() || null, topSpeed: f.topSpeed.trim() || null, city: f.city.trim(), area: f.area.trim() || null,
  description: f.description, amenities: f.amenities.split(',').map((s) => s.trim()).filter(Boolean), pricePerHourPence: f.pricePerHourPence,
  deliveryAvailable: f.deliveryAvailable, deliveryFeePence: f.deliveryFeePence ?? 0, deliveryRadiusMiles: f.deliveryRadiusMiles ?? 0,
  baseAddress: f.baseAddress.trim() || null, deliveryPricing: f.deliveryPricing, deliveryPerMilePence: f.deliveryPerMilePence ?? 0, deliveryFreeMiles: f.deliveryFreeMiles ?? 0, deliveryMinPence: f.deliveryMinPence ?? 0, deliveryRoundTrip: f.deliveryRoundTrip, chauffeurChargeType: f.chauffeurChargeType, stationaryAvailable: f.stationaryAvailable,
  minHours: f.minHours, maxHours: f.maxHours, bufferMinutes: f.bufferMinutes ?? 0, chauffeurAvailable: f.chauffeurAvailable, chauffeurFeePence: f.chauffeurFeePence ?? 0,
  depositPence: f.depositPence ?? 0, operationalStatus: f.operationalStatus, selfDriveAvailable: f.selfDriveAvailable,
});

export default function VehicleEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const { data, error, loading, reload } = useApi<Row>(isNew ? null : `/vehicles/${id}`);
  const [tab, setTab] = useState<'details' | 'images' | 'events' | 'addons' | 'pricing' | 'availability' | 'history'>('details');
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, busy, error: actError, setError } = useAction();
  const { data: ev } = useApi<{ items: { id: string; title: string; archived_at: string | null }[] }>('/event-types');
  const { data: fleet } = useApi<{ items: { id: string; make: string; model: string }[] }>('/vehicles?limit=200');

  if (!isNew && loading && !data) return <Loading />;
  if (!isNew && error) return <ErrorBox error={error} retry={reload} />;

  const setPublished = (published: boolean) => run(async () => { await api(`/vehicles/${id}/publish`, { method: 'POST', body: { published } }); reload(); }, published ? 'Vehicle published' : 'Vehicle unpublished');

  return (
    <>
      <div className="row between wrap">
        <div className="row">
          <button className="btn sm" onClick={() => go('vehicles')}><FiArrowLeft /> Fleet</button>
          {data ? <><h2 className="display" style={{ margin: 0, fontSize: 24 }}>{data.make} {data.model}</h2><Badge status={data.operational_status} /><Badge status={data.published ? 'published' : 'draft'} label={data.published ? 'Published' : 'Not published'} /></> : <h2 className="display" style={{ margin: 0, fontSize: 24 }}>New vehicle</h2>}
        </div>
        {data ? (
          <div className="row wrap">
            <button className="btn sm" onClick={() => setPreview(true)}><FiEye /> Preview</button>
            <button className="btn sm" disabled={busy} onClick={() => setPublished(!data.published)}>{data.published ? 'Unpublish' : 'Publish'}</button>
            <button className="btn sm danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        ) : null}
      </div>
      <ErrorBox error={actError} />

      {!isNew ? (
        <Tabs value={tab} onChange={(t) => { setError(null); setTab(t); }} items={[
          { value: 'details', label: 'Details' }, { value: 'images', label: 'Images', count: data?.images.length },
          { value: 'events', label: 'Events' }, { value: 'addons', label: 'Add-ons' }, { value: 'pricing', label: 'Pricing' }, { value: 'availability', label: 'Availability' }, { value: 'history', label: 'Bookings' },
        ]} />
      ) : null}

      {tab === 'details' ? <Details key={data?.id ?? 'new'} row={data} onSaved={(r) => { if (isNew) go('vehicles/' + r.id); else reload(); }} /> : null}
      {tab === 'images' && data ? <Images row={data} reload={reload} /> : null}
      {tab === 'events' && data ? <EventsTab row={data} events={(ev?.items ?? []).filter((e) => !e.archived_at)} reload={reload} /> : null}
      {tab === 'addons' && data ? <AddonsTab row={data} reload={reload} /> : null}
      {tab === 'pricing' && data ? (
        <Panel title="Pricing for this car" hint={`Base rate ${gbp(data.price_per_hour_pence)} per hour (edit under Details)`}>
          <PricingRules vehicleId={id} vehicles={(fleet?.items ?? []).map((v) => ({ id: v.id, name: `${v.make} ${v.model}` }))} events={(ev?.items ?? []).map((e) => ({ id: e.id, name: e.title }))} />
        </Panel>
      ) : null}
      {tab === 'availability' && data ? <Panel title="Availability"><AvailabilityCalendar vehicleId={id} /></Panel> : null}
      {tab === 'history' && data ? <History id={id} /> : null}

      {preview && data ? <Preview row={data} events={(ev?.items ?? []).filter((e) => data.event_type_ids.includes(e.id))} onClose={() => setPreview(false)} /> : null}
      {confirmDelete && data ? (
        <ConfirmDialog title="Delete this vehicle?" danger confirmLabel="Delete vehicle"
          message="It is removed from the fleet and the public site. Past bookings keep their history. This is refused while upcoming bookings exist."
          onConfirm={async () => { await api(`/vehicles/${id}`, { method: 'DELETE' }); go('vehicles'); }} onClose={() => setConfirmDelete(false)} />
      ) : null}
    </>
  );
}

function Details({ row, onSaved }: { row: Row | null; onSaved: (r: Row) => void }) {
  const [f, setF] = useState<Form>(row ? fromRow(row) : blank);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const { run, busy, error, fieldErrors } = useAction();
  const fe = (k: string) => fieldErrors[k];
  // A car-level hourly rule replaces the base rate (newest first, as the price engine picks it), so say so here.
  const { data: rules } = useApi<{ items: { eventTypeId: string | null; kind: string; amountPence: number | null; active: boolean }[] }>(row ? `/pricing-rules?vehicleId=${row.id}` : null);
  const hourlyRule = rules?.items.find((r) => r.active && r.kind === 'hourly' && !r.eventTypeId);
  const required = !f.make.trim() || !f.model.trim() || !f.city.trim() || f.year == null || f.seats == null || f.pricePerHourPence == null || f.minHours == null || f.maxHours == null || (!f.selfDriveAvailable && !f.chauffeurAvailable);

  const save = async () => {
    const saved = await run(() => api<Row>(row ? `/vehicles/${row.id}` : '/vehicles', { method: row ? 'PATCH' : 'POST', body: toBody(f) }), 'Vehicle saved');
    if (saved) onSaved(saved);
  };

  return (
    <Panel title={row ? 'Vehicle details' : 'Add a vehicle'} hint={row ? undefined : 'You can add images, events and pricing after saving.'}>
      <div className="form-grid">
        <TextField label="Make *" value={f.make} onChange={(v) => set('make', v)} error={fe('make')} />
        <TextField label="Model *" value={f.model} onChange={(v) => set('model', v)} error={fe('model')} />
        <NumberField label="Year *" value={f.year} onChange={(v) => set('year', v)} error={fe('year')} />
        <SelectField label="Category *" value={f.category} onChange={(v) => set('category', v)} options={['Supercar', 'Convertible', 'SUV', 'Luxury'].map((c) => ({ value: c, label: c }))} />
        <TextField label="Fleet ID / registration" value={f.fleetRef} onChange={(v) => set('fleetRef', v)} error={fe('fleetRef')} hint="Internal only" />
        <TextField label="Colour" value={f.colour} onChange={(v) => set('colour', v)} />
        <TextField label="Transmission" value={f.transmission} onChange={(v) => set('transmission', v)} placeholder="Automatic" />
        <NumberField label="Seats *" value={f.seats} onChange={(v) => set('seats', v)} min={1} error={fe('seats')} />
        <TextField label="Power" value={f.power} onChange={(v) => set('power', v)} placeholder="631 hp" />
        <TextField label="Top speed" value={f.topSpeed} onChange={(v) => set('topSpeed', v)} placeholder="202 mph" />
        <TextField label="City *" value={f.city} onChange={(v) => set('city', v)} error={fe('city')} />
        <TextField label="Area" value={f.area} onChange={(v) => set('area', v)} />
        <div className="full"><TextField label="Description" value={f.description} onChange={(v) => set('description', v)} multiline error={fe('description')} /></div>
        <div className="full"><TextField label="Amenities" value={f.amenities} onChange={(v) => set('amenities', v)} hint="Comma separated, e.g. Heated seats, Bluetooth, Roof down" /></div>

        <div className="full"><h3 className="display" style={{ margin: '8px 0 0', fontSize: 18 }}>Pricing and rules</h3></div>
        <MoneyField label="Base hourly rate *" value={f.pricePerHourPence} onChange={(v) => set('pricePerHourPence', v)} error={fe('pricePerHourPence')}
          hint={hourlyRule ? `Not charged now: this car's hourly pricing rule (${gbp(hourlyRule.amountPence ?? 0)}/h) is used instead. Change or remove it under Pricing.` : 'Charged per hour unless a pricing rule for this car applies'} />
        <MoneyField label="Deposit due now" value={f.depositPence} onChange={(v) => set('depositPence', v)} hint="Only used when payment mode is Deposit. 0 uses the % in Settings." />
        <NumberField label="Minimum hours *" value={f.minHours} onChange={(v) => set('minHours', v)} min={1} error={fe('minHours')} />
        <NumberField label="Maximum hours *" value={f.maxHours} onChange={(v) => set('maxHours', v)} min={1} error={fe('maxHours')} />
        <NumberField label="Extra turnaround buffer (minutes)" value={f.bufferMinutes} onChange={(v) => set('bufferMinutes', v)} min={0} hint="Kept free before and after every booking. The business buffer (Settings, default 60) applies if longer." />
        <div className="full"><ToggleField label="Vehicle status" hint="Inactive cars cannot be booked" checked={f.operationalStatus === 'active'} onChange={(v) => set('operationalStatus', v ? 'active' : 'inactive')} /></div>
        <div className="full"><ToggleField label="Under maintenance" hint="Takes the car out of service until you switch it off" checked={f.operationalStatus === 'maintenance'} onChange={(v) => set('operationalStatus', v ? 'maintenance' : 'active')} onText="Yes" offText="No" /></div>

        <div className="full"><h3 className="display" style={{ margin: '8px 0 0', fontSize: 18 }}>How customers get the car</h3></div>
        <div className="full"><ToggleField label="Can be collected from the showroom" checked={f.stationaryAvailable} onChange={(v) => set('stationaryAvailable', v)} onText="Yes" offText="No" /></div>
        <div className="full"><ToggleField label="Can be delivered to the customer" checked={f.deliveryAvailable} onChange={(v) => set('deliveryAvailable', v)} onText="Yes" offText="No" hint="Staff work out the delivery charge for each booking and add it on the booking page." /></div>
        <div className="full"><h3 className="display" style={{ margin: '8px 0 0', fontSize: 18 }}>Driving</h3></div>
        <div className="full"><ToggleField label="Can be booked without a driver (self-drive)" checked={f.selfDriveAvailable} onChange={(v) => set('selfDriveAvailable', v)} onText="Yes" offText="No" /></div>
        <div className="full"><ToggleField label="Can be booked with a driver" checked={f.chauffeurAvailable} onChange={(v) => set('chauffeurAvailable', v)} onText="Yes" offText="No" /></div>
        {!f.selfDriveAvailable && !f.chauffeurAvailable ? <div className="full"><div className="error-box">Offer the car self-drive, with a driver, or both.</div></div> : null}
        {f.chauffeurAvailable ? (
          <>
            <SelectField label="Driver charge" value={f.chauffeurChargeType} onChange={(v) => set('chauffeurChargeType', v)} options={[{ value: 'fixed', label: 'Fixed amount per booking' }, { value: 'hourly', label: 'Per hour (multiplied by hours booked)' }]} />
            <MoneyField label={f.chauffeurChargeType === 'hourly' ? 'Driver charge per hour' : 'Driver charge'} value={f.chauffeurFeePence} onChange={(v) => set('chauffeurFeePence', v)} hint={f.chauffeurChargeType === 'hourly' ? 'A 3-hour booking is charged 3 times this' : undefined} />
          </>
        ) : null}
      </div>
      <div style={{ marginTop: 20 }}><ErrorBox error={error} /></div>
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn gold" onClick={save} disabled={busy || required}>{busy ? 'Saving…' : row ? 'Save changes' : 'Create vehicle'}</button>
        {required ? <span className="muted small">Complete the fields marked *</span> : null}
      </div>
    </Panel>
  );
}

function Images({ row, reload }: { row: Row; reload: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [failed, setFailed] = useState<{ filename: string; reason: string }[]>([]);
  const [delImg, setDelImg] = useState<Img | null>(null);
  const { run, busy, error } = useAction();

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setFailed([]);
    await run(async () => {
      const form = new FormData();
      list.forEach((f) => form.append('file', f));
      const r = await api<{ saved: unknown[]; failed: { filename: string; reason: string }[] }>(`/vehicles/${row.id}/images`, { form });
      setFailed(r.failed);
      reload();
    });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); };
  const move = (i: number, d: number) => {
    const ids = row.images.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(async () => { await api(`/vehicles/${row.id}/images/order`, { method: 'PUT', body: { imageIds: ids } }); reload(); });
  };

  return (
    <Panel title="Images" hint="JPEG, PNG or WebP up to 8 MB. The cover image leads the listing.">
      <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
        <FiUploadCloud size={26} /><div>{busy ? 'Uploading…' : 'Drop images here or click to choose'}</div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files ?? []); e.target.value = ''; }} />
      </div>
      <ErrorBox error={error} />
      {failed.length ? <div className="error-box" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'flex-start' }}>{failed.map((f) => <div key={f.filename}><b>{f.filename}</b>: {f.reason}</div>)}</div> : null}
      {!row.images.length ? <Empty icon={FiUploadCloud} title="No images yet">A published car needs at least one image.</Empty> : (
        <div className="img-grid" style={{ marginTop: 18 }}>
          {row.images.map((im, i) => (
            <div className="img-card" key={im.id}>
              <img src={im.url} alt={`${row.make} ${row.model} photo ${i + 1}`} loading="lazy" />
              {im.isCover ? <span className="cover-tag"><Badge status="published" label="Cover" /></span> : null}
              <div className="bar">
                <button className="btn sm" aria-label="Move earlier" disabled={i === 0 || busy} onClick={() => move(i, -1)}><FiArrowLeft /></button>
                <button className="btn sm" aria-label="Move later" disabled={i === row.images.length - 1 || busy} onClick={() => move(i, 1)}><FiArrowRight /></button>
                {!im.isCover ? <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/images/${im.id}/cover`, { method: 'POST' }); reload(); }, 'Cover updated')}><FiStar /> Cover</button> : null}
                <button className="btn sm danger" aria-label="Delete image" disabled={busy} onClick={() => setDelImg(im)}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {delImg ? <ConfirmDialog title="Delete this image?" danger confirmLabel="Delete" message={delImg.isCover ? 'This is the cover image. The next image becomes the cover; with no images left the car is unpublished.' : undefined}
        onConfirm={async () => { await api(`/vehicles/${row.id}/images/${delImg.id}`, { method: 'DELETE' }); reload(); }} onClose={() => setDelImg(null)} /> : null}
    </Panel>
  );
}

function EventsTab({ row, events, reload }: { row: Row; events: { id: string; title: string }[]; reload: () => void }) {
  const [sel, setSel] = useState<string[]>(row.event_type_ids);
  useEffect(() => setSel(row.event_type_ids), [row.event_type_ids]);
  const { run, busy, error } = useAction();
  return (
    <Panel title="Supported events" hint="Customers only see this car for the events ticked here.">
      {!events.length ? <Empty icon={FiStar} title="No event types yet">Create event types under Events first.</Empty> : (
        <div className="form-grid">
          {events.map((e) => <CheckField key={e.id} label={e.title} checked={sel.includes(e.id)} onChange={(c) => setSel((p) => (c ? [...p, e.id] : p.filter((x) => x !== e.id)))} />)}
        </div>
      )}
      <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
      <div style={{ marginTop: 16 }}><button className="btn gold" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/event-types`, { method: 'PUT', body: { eventTypeIds: sel } }); reload(); }, 'Events saved')}>Save events</button></div>
    </Panel>
  );
}

type AddonOpt = { id: string; name: string; detail: string | null; pricePence: number; pricingType: 'fixed' | 'per_hour' | 'per_unit'; active: boolean; allVehicles: boolean };

/** Which add-ons customers can choose for this car. Add-ons offered on every car are always included. */
function AddonsTab({ row, reload }: { row: Row; reload: () => void }) {
  const { data } = useApi<{ items: AddonOpt[] }>('/addons');
  const [sel, setSel] = useState<string[]>(row.addon_ids ?? []);
  useEffect(() => setSel(row.addon_ids ?? []), [row.addon_ids]);
  const { run, busy, error } = useAction();
  const items = data?.items ?? [];
  const unit = (a: AddonOpt) => gbp(a.pricePence) + (a.pricingType === 'per_hour' ? '/h' : a.pricingType === 'per_unit' ? ' each' : '');
  return (
    <Panel title="Available add-ons" hint="Customers booking this car only see the add-ons ticked here (and only while they are switched on)."
      action={<button className="btn sm" onClick={() => go('addons')}>Manage add-ons</button>}>
      {data && !items.length ? <Empty icon={FiStar} title="No add-ons yet">Create them under Add-ons first.</Empty> : null}
      <div className="form-grid">
        {items.map((a) => a.allVehicles
          ? <CheckField key={a.id} label={`${a.name} (${unit(a)}) · every car`} checked onChange={() => {}} hint={a.active ? 'Offered on every car; change this under Add-ons' : 'Switched off'} />
          : <CheckField key={a.id} label={`${a.name} (${unit(a)})`} checked={sel.includes(a.id)} onChange={(c) => setSel((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} hint={a.active ? undefined : 'Switched off: not shown to customers'} />)}
      </div>
      <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
      <div style={{ marginTop: 16 }}><button className="btn gold" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/addons`, { method: 'PUT', body: { addonIds: sel } }); reload(); }, 'Add-ons saved')}>Save add-ons</button></div>
    </Panel>
  );
}

function History({ id }: { id: string }) {
  const { data, error, loading } = useApi<{ items: { id: string; ref: string; status: string; startAt: string; endAt: string; totalPence: number; customer: string }[] }>(`/vehicles/${id}/bookings`);
  return (
    <Panel title="Booking history">
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiStar} title="No bookings for this car yet" /> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Reference</th><th>When</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
          <tbody>{data.items.map((b) => <tr key={b.id} className="click" onClick={() => go('bookings/' + b.id)}><td className="cell-title">{b.ref}</td><td>{fmtDateTime(b.startAt)}</td><td>{b.customer}</td><td><Badge status={b.status} /></td><td className="num">{gbp(b.totalPence)}</td></tr>)}</tbody>
        </table></div>
      ) : null}
    </Panel>
  );
}

function Preview({ row, events, onClose }: { row: Row; events: { id: string; title: string }[]; onClose: () => void }) {
  const cover = row.images.find((i) => i.isCover) ?? row.images[0];
  return (
    <Drawer title="Customer preview" onClose={onClose}>
      <div className="note">This is how the car appears to customers{row.published ? '.' : ' once published. It is currently hidden.'}</div>
      {cover ? <img src={cover.url} alt="" style={{ width: '100%', borderRadius: 16, aspectRatio: '16/10', objectFit: 'cover' }} /> : <Empty icon={FiEye} title="No cover image" />}
      <div><h3 className="display" style={{ margin: 0, fontSize: 24 }}>{row.make} {row.model}</h3><div className="muted">{row.year} · {row.category} · {row.city}</div></div>
      <div className="display" style={{ fontSize: 26 }}>From {gbp(row.price_per_hour_pence)}<span className="muted small"> / hour</span></div>
      <dl className="kv">
        <dt>Seats</dt><dd>{row.seats}</dd>
        {row.colour ? <><dt>Colour</dt><dd>{row.colour}</dd></> : null}
        {row.transmission ? <><dt>Transmission</dt><dd>{row.transmission}</dd></> : null}
        {row.power ? <><dt>Power</dt><dd>{row.power}</dd></> : null}
        <dt>Duration</dt><dd>{row.min_hours} to {row.max_hours} hours</dd>
        <dt>Events</dt><dd>{events.length ? events.map((e) => e.title).join(', ') : 'None selected'}</dd>
        <dt>Delivery</dt><dd>{row.delivery_available ? 'Yes, priced per booking' : 'No'}</dd>
        <dt>Driver</dt><dd>{[row.self_drive_available ? 'Self-drive' : null, row.chauffeur_available ? `With driver (${gbp(row.chauffeur_fee_pence)})` : null].filter(Boolean).join(' or ')}</dd>
      </dl>
      {row.description ? <p className="dim pre">{row.description}</p> : null}
      {row.amenities?.length ? <div className="row wrap">{row.amenities.map((a: string) => <span className="badge mute" key={a}>{a}</span>)}</div> : null}
    </Drawer>
  );
}
