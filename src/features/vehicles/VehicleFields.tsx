import { MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { CATEGORIES, FUEL_TYPES, TRANSMISSIONS, type VehicleForm } from './vehicleForm';

/** The vehicle's fields in groups. The add-vehicle wizard shows one group per step; the vehicle page shows them all. */

type P = { f: VehicleForm; set: <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => void; err: Record<string, string | undefined> };

const opts = (list: string[], blank?: string) => [...(blank ? [{ value: '', label: blank }] : []), ...list.map((x) => ({ value: x, label: x }))];

export function BasicsFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <TextField label="Brand *" value={f.make} onChange={(v) => set('make', v)} error={err.make} placeholder="e.g. Lamborghini" />
      <TextField label="Model *" value={f.model} onChange={(v) => set('model', v)} error={err.model} placeholder="e.g. Huracán EVO Spyder" />
      <div className="full vw-name"><span className="muted small">Listed as</span><b>{[f.make.trim(), f.model.trim()].filter(Boolean).join(' ') || 'Brand and model'}</b></div>
      <NumberField label="Year of manufacture *" value={f.year} onChange={(v) => set('year', v)} error={err.year} />
      <SelectField label="Category *" value={f.category} onChange={(v) => set('category', v)} options={opts(CATEGORIES)} />
      <TextField label="Registration number" value={f.fleetRef} onChange={(v) => set('fleetRef', v.toUpperCase())} error={err.fleetRef} placeholder="e.g. AB12 CDE" hint="Internal only, never shown to customers" />
      <TextField label="Colour" value={f.colour} onChange={(v) => set('colour', v)} placeholder="e.g. Giallo Belenus" />
      <div className="full"><TextField label="Description" value={f.description} onChange={(v) => set('description', v)} multiline error={err.description} hint="Shown on the car's page in the app" /></div>
    </div>
  );
}

export function SpecsFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <SelectField label="Transmission" value={f.transmission} onChange={(v) => set('transmission', v)} options={opts(TRANSMISSIONS, 'Not set')} />
      <SelectField label="Fuel type" value={f.fuelType} onChange={(v) => set('fuelType', v)} options={opts(FUEL_TYPES, 'Not set')} />
      <NumberField label="Seats *" value={f.seats} onChange={(v) => set('seats', v)} min={1} max={20} error={err.seats} />
      <NumberField label="Doors" value={f.doors} onChange={(v) => set('doors', v)} min={1} max={8} error={err.doors} />
      <TextField label="Engine" value={f.engine} onChange={(v) => set('engine', v)} placeholder="e.g. 5.2L V10" />
      <TextField label="Power" value={f.power} onChange={(v) => set('power', v)} placeholder="e.g. 631 hp" />
      <TextField label="Top speed" value={f.topSpeed} onChange={(v) => set('topSpeed', v)} placeholder="e.g. 202 mph" />
      <NumberField label="Mileage" value={f.mileage} onChange={(v) => set('mileage', v)} min={0} error={err.mileage} hint="Current odometer reading in miles. Internal only" />
      <div className="full"><TextField label="Features" value={f.amenities} onChange={(v) => set('amenities', v)} hint="Separate with commas, e.g. Heated seats, Bluetooth, Roof down" /></div>
    </div>
  );
}

export function PricingFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <MoneyField label="Price per hour *" value={f.pricePerHourPence} onChange={(v) => set('pricePerHourPence', v)} error={err.pricePerHourPence} hint="The car's standard price. Charged for each hour booked" />
      <MoneyField label="Deposit due at booking" value={f.depositPence} onChange={(v) => set('depositPence', v)} hint="Only used when payments are set to Deposit. 0 uses the % in Settings" />
      <NumberField label="Shortest booking (hours) *" value={f.minHours} onChange={(v) => set('minHours', v)} min={1} error={err.minHours} />
      <NumberField label="Longest booking (hours) *" value={f.maxHours} onChange={(v) => set('maxHours', v)} min={1} error={err.maxHours} />
    </div>
  );
}

export function AvailabilityFields({ f, set, err }: P) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid">
        <SelectField label="Vehicle status" value={f.operationalStatus} onChange={(v) => set('operationalStatus', v)}
          hint={f.operationalStatus === 'active' ? 'Can be booked' : 'Cannot be booked until it is Active again'}
          options={[{ value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Under maintenance' }, { value: 'inactive', label: 'Inactive' }]} />
        <NumberField label="Turnaround time (minutes)" value={f.bufferMinutes} onChange={(v) => set('bufferMinutes', v)} min={0} hint="Kept free before and after each booking. The longer of this and the business setting applies" />
        <TextField label="City *" value={f.city} onChange={(v) => set('city', v)} error={err.city} placeholder="e.g. London" />
        <TextField label="Area" value={f.area} onChange={(v) => set('area', v)} placeholder="e.g. Mayfair" />
        <div className="full"><TextField label="Base address" value={f.baseAddress} onChange={(v) => set('baseAddress', v)} error={err.baseAddress} hint="Where the car is kept. Delivery distance is measured from here" /></div>
      </div>
      <div className="vw-group">
        <div className="strong">How customers get the car</div>
        <ToggleField label="Collect from the showroom" checked={f.stationaryAvailable} onChange={(v) => set('stationaryAvailable', v)} onText="Yes" offText="No" />
        <ToggleField label="Delivered to the customer" checked={f.deliveryAvailable} onChange={(v) => set('deliveryAvailable', v)} onText="Yes" offText="No" hint="You add the delivery charge on each booking" />
      </div>
      <div className="vw-group">
        <div className="strong">Driving</div>
        <ToggleField label="Self-drive" checked={f.selfDriveAvailable} onChange={(v) => set('selfDriveAvailable', v)} onText="Yes" offText="No" hint="Booked without a driver" />
        <ToggleField label="With a driver" checked={f.chauffeurAvailable} onChange={(v) => set('chauffeurAvailable', v)} onText="Yes" offText="No" hint="Needed for pick-up and drop-off events" />
        {err.driving ? <div className="field-error" role="alert">{err.driving}</div> : null}
        {f.chauffeurAvailable ? (
          <div className="form-grid">
            <SelectField label="Driver charge" value={f.chauffeurChargeType} onChange={(v) => set('chauffeurChargeType', v)} options={[{ value: 'fixed', label: 'Fixed amount per booking' }, { value: 'hourly', label: 'Per hour booked' }]} />
            <MoneyField label={f.chauffeurChargeType === 'hourly' ? 'Driver charge per hour' : 'Driver charge'} value={f.chauffeurFeePence} onChange={(v) => set('chauffeurFeePence', v)} error={err.chauffeurFeePence} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
