import { useState } from 'react';
import { api, useApi } from '../../../lib/api';
import { MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../../components/forms';
import { useAction } from '../../../lib/hooks';
import { ErrorBox } from '../../../components/feedback';
import { Panel } from '../../../components/ui';
import { gbp } from '../../../lib/format';
import { type Row } from '../vehicle.types';

/** The vehicle's details form: name, category, pricing basics, driving options and base address. */

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

export function Details({ row, onSaved }: { row: Row | null; onSaved: (r: Row) => void }) {
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
