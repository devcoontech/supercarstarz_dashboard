import { Fragment, useState } from 'react';
import { FiPlus, FiTag } from 'react-icons/fi';
import { API_URL, api, useApi } from '../api';
import PricingRules from '../components/PricingRules';
import { CheckField, ErrorBox, NumberField, SelectField, TextField, useAction } from '../components/forms';
import { Empty, Panel, Tabs } from '../components/ui';
import { addDays, gbp, ymd } from '../format';
import { go } from '../nav';
import { priceLabel, type Addon } from './Addons';

export default function Pricing() {
  const [tab, setTab] = useState<'rules' | 'preview'>('rules');
  const { data: fleet } = useApi<{ items: { id: string; make: string; model: string }[] }>('/vehicles?limit=200');
  const { data: ev } = useApi<{ items: { id: string; title: string; pricing_basis: string }[] }>('/event-types');
  const vehicles = (fleet?.items ?? []).map((v) => ({ id: v.id, name: `${v.make} ${v.model}` }));
  const events = (ev?.items ?? []).map((e) => ({ id: e.id, name: e.title }));
  const distanceEventIds = (ev?.items ?? []).filter((e) => e.pricing_basis === 'distance').map((e) => e.id);
  return (
    <>
      <div className="row between wrap">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'rules', label: 'Pricing rules' }, { value: 'preview', label: 'Price preview' }]} />
        <div className="row"><button className="btn sm" onClick={() => go('addons')}>Add-ons</button><button className="btn sm" onClick={() => go('settings')}>Fees, tax and deposits are in Settings</button></div>
      </div>
      {tab === 'rules' ? <Panel title="Pricing rules" hint="Per car, per event or both. Add hourly rates, packages, extra hours and special dates."><PricingRules vehicles={vehicles} events={events} /></Panel> : null}
      {tab === 'preview' ? <Preview vehicles={vehicles} events={events} distanceEventIds={distanceEventIds} /> : null}
    </>
  );
}

/** Calls the same quote endpoint the customer app uses, so staff see exactly what a customer would be charged. */
function Preview({ vehicles, events, distanceEventIds }: { vehicles: { id: string; name: string }[]; events: { id: string; name: string }[]; distanceEventIds: string[] }) {
  const { data: extras } = useApi<{ items: Addon[] }>('/addons');
  const [vehicleId, setVehicleId] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [date, setDate] = useState(ymd(addDays(new Date(), 14)));
  const [time, setTime] = useState('11:00');
  const [hours, setHours] = useState<number | null>(2);
  const [experience, setExperience] = useState('stationary');
  const [chauffeur, setChauffeur] = useState(false);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const isDistance = distanceEventIds.includes(eventTypeId);
  const [result, setResult] = useState<any>(null);
  const { run, busy, error } = useAction();

  const quote = () => run(async () => {
    const res = await fetch(API_URL + '/api/public/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleId, eventTypeId: eventTypeId || null, date, time, hours, experience, address: address || null, pickupAddress: pickup || null, dropoffAddress: dropoff || null, driverOption: chauffeur ? 'with_driver' : 'self_drive', addonIds, offerCode: code || null }),
    });
    const j = await res.json();
    if (!res.ok) { setResult(null); throw new Error(j?.error?.message ?? 'Quote failed'); }
    setResult(j);
  });

  return (
    <div className="grid g-2">
      <Panel title="Price preview" hint="Only published cars can be previewed.">
        <div className="form-grid">
          <div className="full"><SelectField label="Car" value={vehicleId} onChange={setVehicleId} options={[{ value: '', label: 'Choose a car' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]} /></div>
          <SelectField label="Event" value={eventTypeId} onChange={setEventTypeId} options={[{ value: '', label: 'None' }, ...events.map((e) => ({ value: e.id, label: e.name }))]} />
          <SelectField label="Experience" value={experience} onChange={setExperience} options={[{ value: 'stationary', label: 'At location' }, { value: 'delivered', label: 'Delivered' }]} />
          <TextField label="Date" type="date" value={date} onChange={setDate} />
          <TextField label="Start time" type="time" value={time} onChange={setTime} />
          <NumberField label="Hours" value={hours} onChange={setHours} min={1} />
          <TextField label="Offer code" value={code} onChange={setCode} />
          {isDistance ? (
            <>
              <div className="full"><TextField label="Pick-up address" value={pickup} onChange={setPickup} placeholder="e.g. 10 Downing Street, London" /></div>
              <div className="full"><TextField label="Drop-off address" value={dropoff} onChange={setDropoff} /></div>
            </>
          ) : experience === 'delivered' ? <div className="full"><TextField label="Delivery address" value={address} onChange={setAddress} hint="Measured from the car's base address" /></div> : null}
          <div className="full"><CheckField label="With driver" checked={chauffeur} onChange={setChauffeur} /></div>
          {extras?.items.filter((a) => a.active && vehicleId && (a.allVehicles || a.vehicleIds.includes(vehicleId))).map((a) => <CheckField key={a.id} label={`${a.name} (${priceLabel(a)})`} checked={addonIds.includes(a.id)} onChange={(c) => setAddonIds((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} />)}
        </div>
        <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
        <div style={{ marginTop: 16 }}><button className="btn gold" disabled={busy || !vehicleId || !hours} onClick={quote}>{busy ? 'Calculating…' : 'Calculate price'}</button></div>
      </Panel>
      <Panel title="Breakdown">
        {!result ? <Empty icon={FiTag} title="Nothing calculated yet" /> : (
          <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            {result.pricing.lines.map((l: any) => <Fragment key={l.key}><dt className="dim">{l.label}</dt><dd style={{ textAlign: 'right' }}>{gbp(l.amountPence)}</dd></Fragment>)}
            {result.pricing.discountPence ? <><dt className="dim">Discount ({result.pricing.offer?.title})</dt><dd style={{ textAlign: 'right' }}>-{gbp(result.pricing.discountPence)}</dd></> : null}
            <dt className="dim">Service fee</dt><dd style={{ textAlign: 'right' }}>{gbp(result.pricing.serviceFeePence)}</dd>
            {result.pricing.vatPence ? <><dt className="dim">VAT</dt><dd style={{ textAlign: 'right' }}>{gbp(result.pricing.vatPence)}</dd></> : null}
            <dt className="strong">Total</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(result.pricing.totalPence)}</dd>
            <dt className="dim">Due now</dt><dd style={{ textAlign: 'right' }}>{gbp(result.pricing.depositDuePence)}</dd>
            {result.pricing.deliveryEstimate ? <><dt className="dim">{result.pricing.deliveryEstimate.label} (confirmed later, not in the total)</dt><dd style={{ textAlign: 'right' }}>{result.pricing.deliveryEstimate.amountPence != null ? gbp(result.pricing.deliveryEstimate.amountPence) : '—'}</dd></> : null}
            <dt className="dim">Slot</dt><dd style={{ textAlign: 'right' }}>{result.available ? 'Available' : result.unavailableReason ?? 'Not available'}</dd>
          </dl>
        )}
      </Panel>
    </div>
  );
}
