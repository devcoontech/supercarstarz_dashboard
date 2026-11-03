import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheck, FiImage, FiPlus, FiStar, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { api, useApi } from '../../../lib/api';
import { useAction } from '../../../lib/hooks';
import { CheckField } from '../../../components/forms';
import { ErrorBox } from '../../../components/feedback';
import { Badge, Empty, Panel } from '../../../components/ui';
import { gbp } from '../../../lib/format';
import { go } from '../../../lib/nav';
import { blankVehicle, vehicleBody, vehicleErrors, type VehicleForm } from '../vehicleForm';
import { AvailabilityFields, BasicsFields, PricingFields, SpecsFields } from '../VehicleFields';
import { describePrice, PriceForm, PriceTable, priceTypeLabel, type PriceBody } from '../editor/Prices';

/**
 * Adding a vehicle, one step at a time. Nothing is saved until the last step: then the car is created, its events,
 * add-ons, prices and images are added, and it is published (or kept as a draft). If one part fails, trying again
 * carries on from where it stopped rather than creating the car twice.
 */

const STEPS = [
  { title: 'Basic information', desc: 'Brand, model and year' },
  { title: 'Specifications', desc: 'Engine, seats and features' },
  { title: 'Pricing', desc: 'What the car costs to book' },
  { title: 'Images', desc: 'Photos for the listing' },
  { title: 'Availability', desc: 'Status, location and events' },
  { title: 'Review and publish', desc: 'Check everything' },
];

type Pic = { key: string; file: File; url: string };
type Draft = PriceBody & { key: string };
type Event = { id: string; title: string; archived_at: string | null; pricing_basis?: string };
type Addon = { id: string; name: string; pricePence: number; pricingType: string; active: boolean; allVehicles: boolean };

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let seq = 0;
const nextKey = () => `k${++seq}`;

export default function VehicleWizard() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [tried, setTried] = useState<boolean[]>(STEPS.map(() => false));
  const [f, setF] = useState<VehicleForm>(blankVehicle);
  const set = <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const [pics, setPics] = useState<Pic[]>([]);
  const [mainKey, setMainKey] = useState<string | null>(null);
  const [picErrors, setPicErrors] = useState<string[]>([]);
  const [prices, setPrices] = useState<Draft[]>([]);
  const [editingPrice, setEditingPrice] = useState<Draft | 'new' | null>(null);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const { data: ev } = useApi<{ items: Event[] }>('/event-types');
  const { data: ad } = useApi<{ items: Addon[] }>('/addons');
  const events = (ev?.items ?? []).filter((e) => !e.archived_at);
  const eventOpts = events.map((e) => ({ id: e.id, name: e.title }));
  const { run, busy, error, fieldErrors } = useAction();
  // What has been saved so far, so a retry continues instead of starting again.
  const saved = useRef<{ id: string | null; prices: Set<string>; pics: Set<string> }>({ id: null, prices: new Set(), pics: new Set() });
  const [savedId, setSavedId] = useState<string | null>(null);

  // Free the image previews when leaving the page.
  const picsRef = useRef(pics);
  picsRef.current = pics;
  useEffect(() => () => picsRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const errs = vehicleErrors(f);
  const stepErrors = [errs.basics, errs.specs, errs.pricing, {}, errs.availability, {}];
  const shown = (i: number) => ({ ...fieldErrors, ...(tried[i] ? stepErrors[i] : {}) });
  const main = pics.find((p) => p.key === mainKey) ?? pics[0];
  const distanceEvents = events.filter((e) => eventIds.includes(e.id) && e.pricing_basis === 'distance');
  const warnings = [
    !pics.length ? 'No images yet: the car can be saved as a draft, but it needs a main image to be published.' : null,
    f.operationalStatus !== 'active' ? 'The car is not Active, so it will be saved as a draft.' : null,
    !eventIds.length ? 'No events chosen: customers will not see this car until you add events.' : null,
    distanceEvents.length && !prices.some((p) => p.kind === 'per_mile' && p.active && (!p.eventTypeId || distanceEvents.some((e) => e.id === p.eventTypeId)))
      ? `${distanceEvents.map((e) => e.title).join(', ')} is priced by distance: add a Per mile price on the Pricing step.` : null,
    distanceEvents.length && !f.chauffeurAvailable ? `${distanceEvents.map((e) => e.title).join(', ')} needs the car to be offered with a driver.` : null,
  ].filter((w): w is string => !!w);
  const canPublish = !!pics.length && f.operationalStatus === 'active';

  const goTo = (i: number) => { setStep(i); setReached((r) => Math.max(r, i)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = () => {
    if (Object.keys(stepErrors[step]).length) { setTried((t) => t.map((x, i) => (i === step ? true : x))); return; }
    goTo(step + 1);
  };
  /** The first step with a problem, if any (checked again before saving). */
  const firstInvalid = () => stepErrors.findIndex((e) => Object.keys(e).length);

  const addFiles = (files: FileList | File[]) => {
    const bad: string[] = [];
    const ok: Pic[] = [];
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) bad.push(`${file.name}: only JPEG, PNG or WebP images`);
      else if (file.size > MAX_BYTES) bad.push(`${file.name}: larger than 8 MB`);
      else ok.push({ key: nextKey(), file, url: URL.createObjectURL(file) });
    }
    setPicErrors(bad);
    setPics((p) => [...p, ...ok]);
    if (!mainKey && ok[0]) setMainKey(ok[0].key);
  };
  const removePic = (key: string) => {
    setPics((p) => {
      const gone = p.find((x) => x.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      const rest = p.filter((x) => x.key !== key);
      if (mainKey === key) setMainKey(rest[0]?.key ?? null);
      return rest;
    });
  };

  const finish = async (publish: boolean) => {
    const bad = firstInvalid();
    if (bad >= 0) { setTried((t) => t.map((x, i) => (i === bad ? true : x))); goTo(bad); return; }
    const id = await run(async () => {
      const s = saved.current;
      const body = vehicleBody(f);
      if (!s.id) {
        s.id = (await api<{ id: string }>('/vehicles', { body })).id;
        setSavedId(s.id);
      } else {
        await api(`/vehicles/${s.id}`, { method: 'PATCH', body });
      }
      await api(`/vehicles/${s.id}/event-types`, { method: 'PUT', body: { eventTypeIds: eventIds } });
      await api(`/vehicles/${s.id}/addons`, { method: 'PUT', body: { addonIds } });
      for (const p of prices) {
        if (s.prices.has(p.key)) continue;
        const { key: _key, ...price } = p;
        await api('/pricing-rules', { body: { ...price, vehicleId: s.id } });
        s.prices.add(p.key);
      }
      // The main image goes first: the first image a car gets becomes its cover.
      const ordered = main ? [main, ...pics.filter((p) => p.key !== main.key)] : pics;
      for (const p of ordered) {
        if (s.pics.has(p.key)) continue;
        const form = new FormData();
        form.append('file', p.file);
        const r = await api<{ failed: { filename: string; reason: string }[] }>(`/vehicles/${s.id}/images`, { form });
        if (r.failed.length) throw new Error(`${p.file.name}: ${r.failed[0].reason}`);
        s.pics.add(p.key);
      }
      if (publish) await api(`/vehicles/${s.id}/publish`, { body: { published: true } });
      return s.id;
    }, publish ? 'Vehicle published' : 'Vehicle saved as a draft');
    if (id) go('vehicles/' + id);
  };

  const savePrice = (b: PriceBody) => {
    const editing = editingPrice && editingPrice !== 'new' ? editingPrice : null;
    if (editing && saved.current.prices.has(editing.key)) throw new Error('This price is already saved to the car. Change it on the car\'s Pricing tab after finishing.');
    setPrices((list) => (editing ? list.map((p) => (p.key === editing.key ? { ...b, key: p.key } : p)) : [...list, { ...b, key: nextKey() }]));
  };

  return (
    <Panel className="vw" title="Add a vehicle" hint={`Step ${step + 1} of ${STEPS.length} · nothing is saved until you finish`}
      action={<button className="btn sm" onClick={() => go('vehicles')}>Cancel</button>}>
      <ol className="vw-steps">
        {STEPS.map((s, i) => {
          const done = i < step || (i <= reached && i !== step && !Object.keys(stepErrors[i]).length);
          return (
            <li key={s.title} className={(i === step ? 'now ' : '') + (done ? 'done' : '')}>
              <button type="button" disabled={i > reached} onClick={() => goTo(i)} aria-current={i === step ? 'step' : undefined}>
                <span className="vw-dot">{done ? <FiCheck size={14} /> : i + 1}</span>
                <span className="vw-text"><b>{s.title}</b><span>{s.desc}</span></span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="vw-body" key={step}>
        <h3 className="vw-title">{STEPS[step].title}</h3>
        {step === 0 ? <BasicsFields f={f} set={set} err={shown(0)} /> : null}
        {step === 1 ? <SpecsFields f={f} set={set} err={shown(1)} /> : null}
        {step === 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <PricingFields f={f} set={set} err={shown(2)} />
            <div className="vw-group">
              <div className="row between wrap">
                <div><div className="strong">Other price types (optional)</div><div className="muted small">Packages such as a full day, a different rate for one event, extra hours, per-mile trips or special dates.</div></div>
                <button className="btn sm" onClick={() => setEditingPrice('new')}><FiPlus /> Add a price</button>
              </div>
              <PriceTable items={prices} events={eventOpts} onEdit={(p) => setEditingPrice(p)} onDelete={(p) => setPrices((l) => l.filter((x) => x.key !== p.key))} />
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <ImagesStep pics={pics} mainKey={main?.key ?? null} errors={picErrors} onAdd={addFiles} onRemove={removePic} onMain={setMainKey} />
        ) : null}
        {step === 4 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AvailabilityFields f={f} set={set} err={shown(4)} />
            <div className="vw-group">
              <div className="strong">Events this car is offered for</div>
              {!events.length ? <span className="muted small">No events yet. Add them under Events.</span> : (
                <div className="form-grid">{events.map((e) => <CheckField key={e.id} label={e.title} hint={e.pricing_basis === 'distance' ? 'Priced per mile' : undefined} checked={eventIds.includes(e.id)} onChange={(c) => setEventIds((p) => (c ? [...p, e.id] : p.filter((x) => x !== e.id)))} />)}</div>
              )}
            </div>
            {ad?.items.some((a) => !a.allVehicles) ? (
              <div className="vw-group">
                <div className="strong">Add-ons customers can choose</div>
                <div className="form-grid">{ad.items.filter((a) => !a.allVehicles).map((a) => <CheckField key={a.id} label={`${a.name} (${gbp(a.pricePence)}${a.pricingType === 'per_hour' ? '/h' : ''})`} hint={a.active ? undefined : 'Switched off'} checked={addonIds.includes(a.id)} onChange={(c) => setAddonIds((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} />)}</div>
              </div>
            ) : null}
          </div>
        ) : null}
        {step === 5 ? (
          <Review f={f} pics={pics} main={main} prices={prices} events={events.filter((e) => eventIds.includes(e.id)).map((e) => e.title)}
            addons={(ad?.items ?? []).filter((a) => addonIds.includes(a.id)).map((a) => a.name)} eventOpts={eventOpts} warnings={warnings} onEdit={goTo} />
        ) : null}
      </div>

      {savedId ? <div className="note">The car has been created. Finishing again carries on from where it stopped; it will not be added twice.</div> : null}
      <ErrorBox error={error} />
      {Object.keys(stepErrors[step]).length && tried[step] ? <div className="field-error">Fix the highlighted fields to continue.</div> : null}

      <div className="vw-foot">
        <button className="btn" disabled={step === 0 || busy} onClick={() => goTo(step - 1)}><FiArrowLeft /> Back</button>
        <div className="row wrap" style={{ gap: 8 }}>
          {step < STEPS.length - 1 ? <button className="btn gold" onClick={next}>Next <FiArrowRight /></button> : (
            <>
              <button className="btn" disabled={busy} onClick={() => finish(false)}>{busy ? 'Saving…' : 'Save as draft'}</button>
              <button className="btn gold" disabled={busy || !canPublish} title={canPublish ? undefined : 'Needs a main image and Active status'} onClick={() => finish(true)}>{busy ? 'Publishing…' : 'Publish vehicle'}</button>
            </>
          )}
        </div>
      </div>
      {editingPrice ? <PriceForm price={editingPrice === 'new' ? null : editingPrice} events={eventOpts} onClose={() => setEditingPrice(null)} onSubmit={savePrice} done="Price added" /> : null}
    </Panel>
  );
}

function ImagesStep({ pics, mainKey, errors, onAdd, onRemove, onMain }: {
  pics: Pic[]; mainKey: string | null; errors: string[]; onAdd: (f: FileList | File[]) => void; onRemove: (k: string) => void; onMain: (k: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
        <FiUploadCloud size={26} /><div>Drop photos here or click to choose</div><div className="muted small">JPEG, PNG or WebP, up to 8 MB each. They are uploaded when you finish.</div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { onAdd(e.target.files ?? []); e.target.value = ''; }} />
      </div>
      {errors.length ? <div className="error-box" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>{errors.map((e) => <div key={e}>{e}</div>)}</div> : null}
      {!pics.length ? <Empty icon={FiImage} title="No photos yet">The first photo becomes the main image. You can change it.</Empty> : (
        <div className="img-grid">
          {pics.map((p) => (
            <div className="img-card" key={p.key}>
              <img src={p.url} alt={p.file.name} />
              {p.key === mainKey ? <span className="cover-tag"><Badge status="published" label="Main image" /></span> : null}
              <div className="bar">
                {p.key !== mainKey ? <button className="btn sm" onClick={() => onMain(p.key)}><FiStar /> Make main</button> : null}
                <button className="btn sm danger" aria-label={`Remove ${p.file.name}`} onClick={() => onRemove(p.key)}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Review({ f, pics, main, prices, events, addons, eventOpts, warnings, onEdit }: {
  f: VehicleForm; pics: Pic[]; main: Pic | undefined; prices: Draft[]; events: string[]; addons: string[]; eventOpts: { id: string; name: string }[]; warnings: string[]; onEdit: (i: number) => void;
}) {
  const Item = ({ k, v }: { k: string; v: ReactNode }) => <><dt>{k}</dt><dd>{v || <span className="muted">—</span>}</dd></>;
  const Section = ({ i, children }: { i: number; children: ReactNode }) => (
    <section className="vw-review">
      <div className="row between"><b>{STEPS[i].title}</b><button className="btn sm" onClick={() => onEdit(i)}>Edit</button></div>
      {children}
    </section>
  );
  const eName = (id: string | null) => (id ? eventOpts.find((e) => e.id === id)?.name ?? 'One event' : 'Every event');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {warnings.map((w) => <div key={w} className="note row" style={{ gap: 10 }}><FiAlertTriangle style={{ flex: 'none' }} /> {w}</div>)}
      <div className="vw-review-grid">
        <Section i={0}><dl className="kv">
          <Item k="Vehicle" v={`${f.make} ${f.model}`} /><Item k="Year" v={f.year} /><Item k="Category" v={f.category} />
          <Item k="Registration" v={f.fleetRef} /><Item k="Colour" v={f.colour} /><Item k="Description" v={f.description ? <span className="pre">{f.description}</span> : null} />
        </dl></Section>
        <Section i={1}><dl className="kv">
          <Item k="Transmission" v={f.transmission} /><Item k="Fuel" v={f.fuelType} /><Item k="Seats" v={f.seats} /><Item k="Doors" v={f.doors} />
          <Item k="Engine" v={f.engine} /><Item k="Power" v={f.power} /><Item k="Top speed" v={f.topSpeed} /><Item k="Mileage" v={f.mileage != null ? `${f.mileage.toLocaleString()} miles` : null} />
          <Item k="Features" v={f.amenities} />
        </dl></Section>
        <Section i={2}><dl className="kv">
          <Item k="Price per hour" v={gbp(f.pricePerHourPence)} /><Item k="Booking length" v={`${f.minHours} to ${f.maxHours} hours`} />
          <Item k="Deposit" v={f.depositPence ? gbp(f.depositPence) : 'From Settings'} />
          <Item k="Other prices" v={prices.length ? <div>{prices.map((p) => <div key={p.key}>{priceTypeLabel(p.kind)}: {describePrice(p)} <span className="muted small">· {eName(p.eventTypeId)}</span></div>)}</div> : 'None'} />
        </dl></Section>
        <Section i={3}>
          {pics.length ? <div className="vw-thumbs">{[main!, ...pics.filter((p) => p !== main)].map((p) => <img key={p.key} src={p.url} alt="" className={p === main ? 'main' : ''} />)}</div> : <span className="muted">No images</span>}
        </Section>
        <Section i={4}><dl className="kv">
          <Item k="Status" v={<Badge status={f.operationalStatus} />} /><Item k="Location" v={[f.area, f.city].filter(Boolean).join(', ')} /><Item k="Base address" v={f.baseAddress} />
          <Item k="Customers get it by" v={[f.stationaryAvailable && 'Collection', f.deliveryAvailable && 'Delivery'].filter(Boolean).join(' and ')} />
          <Item k="Driving" v={[f.selfDriveAvailable && 'Self-drive', f.chauffeurAvailable && `With a driver (${gbp(f.chauffeurFeePence)}${f.chauffeurChargeType === 'hourly' ? '/h' : ''})`].filter(Boolean).join(', ')} />
          <Item k="Events" v={events.join(', ')} /><Item k="Add-ons" v={addons.join(', ')} />
        </dl></Section>
      </div>
    </div>
  );
}
