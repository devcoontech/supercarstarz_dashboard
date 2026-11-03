import { useState } from 'react';
import { api, useApi } from '../../../lib/api';
import { CheckField, NumberField, SelectField, TextField } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../../components/feedback';
import { fmtTime, ymd } from '../../../lib/format';
import type { Detail, Dialog } from '../bookingDetail.types';

/** Changes to the booking itself: status, time, car, extra vehicles and driver. */

/** Adds another vehicle to this order. Same checks as a new booking; the order is re-priced. */
export function AddVehicle({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const { data } = useApi<{ items: { id: string; make: string; model: string; operational_status: string; chauffeur_available: boolean; self_drive_available: boolean; min_hours: number; max_hours: number }[] }>('/vehicles?limit=200');
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(new Date(b.startAt).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }));
  const [time, setTime] = useState(fmtTime(b.startAt));
  const [hours, setHours] = useState<number | null>(b.hours);
  const [driverOption, setDriverOption] = useState('');
  const { data: events } = useApi<{ items: { id: string; title: string; archived_at: string | null; pricing_basis: string; vehicle_ids: string[] }[] }>('/event-types');
  const [eventTypeId, setEventTypeId] = useState(b.eventType?.id ?? '');
  const [experience, setExperience] = useState<'stationary' | 'delivered'>(b.experience === 'delivered' ? 'delivered' : 'stationary');
  const [address, setAddress] = useState(b.experience === 'delivered' ? b.address ?? '' : '');
  const veh = data?.items.find((v) => v.id === vehicleId);
  const choices = [...(veh?.chauffeur_available ? [{ value: 'with_driver', label: 'With driver' }] : []), ...(veh?.self_drive_available ? [{ value: 'self_drive', label: 'Without driver (self-drive)' }] : [])];
  const driver = choices.length === 1 ? choices[0].value : driverOption;
  // Only occasions this car is offered for; trips priced by distance need their own route, so they are booked separately.
  const carEvents = (events?.items ?? []).filter((e) => !e.archived_at && e.pricing_basis !== 'distance' && (!vehicleId || e.vehicle_ids.includes(vehicleId)));
  const event = carEvents.some((e) => e.id === eventTypeId) ? eventTypeId : '';
  return (
    <ConfirmDialog title={`Add a vehicle to order ${b.order.ref}`} confirmLabel="Add vehicle" onClose={onClose}
      message="The car must be free at that time (including the preparation buffer). Offers and tax for the whole order are worked out again and logged."
      extra={<>
        <SelectField label="Car" value={vehicleId} onChange={setVehicleId} options={[{ value: '', label: 'Choose a car' }, ...(data?.items ?? []).filter((v) => v.operational_status === 'active').map((v) => ({ value: v.id, label: `${v.make} ${v.model}` }))]} />
        <div className="form-grid"><TextField label="Date" type="date" value={date} onChange={setDate} min={ymd(new Date())} /><TextField label="Start time" type="time" value={time} onChange={setTime} /></div>
        <div className="form-grid"><NumberField label="Hours" value={hours} onChange={setHours} min={veh?.min_hours ?? 1} max={veh?.max_hours} />
          <SelectField label="Driver" value={driver} onChange={setDriverOption} disabled={choices.length < 2} options={choices.length === 1 ? choices : [{ value: '', label: 'Choose' }, ...choices]} /></div>
        <div className="form-grid">
          <SelectField label="Event" value={event} onChange={setEventTypeId} options={[{ value: '', label: carEvents.length ? 'None' : 'None offered for this car' }, ...carEvents.map((e) => ({ value: e.id, label: e.title }))]} />
          <SelectField label="Collection" value={experience} onChange={(v) => setExperience(v as 'stationary' | 'delivered')} options={[{ value: 'stationary', label: 'Collect from showroom' }, { value: 'delivered', label: 'Deliver to an address' }]} />
        </div>
        {experience === 'delivered' ? <TextField label="Delivery address" value={address} onChange={setAddress} hint="Looked up and measured by the server; the delivery charge is confirmed on the booking as usual" /> : null}
      </>}
      onConfirm={async () => {
        if (!vehicleId || !hours || !driver) throw new Error('Choose a car, a time and the driver option.');
        if (experience === 'delivered' && address.trim().length < 5) throw new Error('Enter the delivery address.');
        await api(`/orders/${b.order.id}/items`, { body: { vehicleId, date, time, hours, experience, address: experience === 'delivered' ? address.trim() : null, eventTypeId: event || null, driverOption: driver } });
        onDone();
      }} />
  );
}

export function StatusDialog({ d, bookingId, onClose, onDone, unpaid }: { d: Extract<Dialog, { t: 'status' }>; bookingId: string; onClose: () => void; onDone: () => void; unpaid: boolean }) {
  const [allowUnpaid, setAllowUnpaid] = useState(false);
  return (
    <ConfirmDialog title={d.label} danger={d.danger} requireReason={d.reason} confirmLabel={d.label} onClose={onClose}
      message={d.to === 'confirmed' && unpaid ? 'Payment due has not been received.' : d.to === 'awaiting_payment' ? 'The customer is asked to pay and the car is held for the payment window.' : 'This is recorded in the booking history. Changing the status does not record any payment.'}
      extra={d.to === 'confirmed' && unpaid ? <CheckField label="Confirm without payment received" checked={allowUnpaid} onChange={setAllowUnpaid} hint="Logged against your name. Use for pay-on-the-day or account customers." /> : undefined}
      onConfirm={async (reason) => {
        if (d.to === 'confirmed' && unpaid && !allowUnpaid) throw new Error('Tick "Confirm without payment received" to confirm before payment arrives.');
        await api(`/bookings/${bookingId}/status`, { body: { to: d.to, reason: reason || undefined, allowUnpaid: allowUnpaid || undefined } });
        onDone();
      }} />
  );
}

export function Reschedule({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(new Date(b.startAt).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }));
  const today = ymd(new Date());
  const [time, setTime] = useState(fmtTime(b.startAt));
  const [hours, setHours] = useState<number | null>(b.hours);
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title="Reschedule" confirmLabel="Reschedule" onClose={onClose}
      message="The car and any driver must be free at the new time. The price stays as originally quoted."
      extra={<><div className="form-grid"><TextField label="Date" type="date" value={date} onChange={setDate} min={today} error={date < today ? 'Choose today or a later date' : undefined} /><TextField label="Start time" type="time" value={time} onChange={setTime} /></div>
        <NumberField label="Hours" value={hours} onChange={setHours} min={1} /><TextField label="Reason" value={reason} onChange={setReason} /></>}
      onConfirm={async () => { await api(`/bookings/${b.id}/reschedule`, { body: { date, time, hours: hours ?? undefined, reason: reason || undefined } }); onDone(); }} />
  );
}

export function ChangeVehicle({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const { data } = useApi<{ items: { id: string; make: string; model: string; operational_status: string }[] }>('/vehicles?limit=200');
  const [vehicleId, setVehicleId] = useState('');
  const [reprice, setReprice] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title="Change car" confirmLabel="Change car" onClose={onClose} message="The new car must be free for the same time."
      extra={<>
        <SelectField label="New car" value={vehicleId} onChange={setVehicleId} options={[{ value: '', label: 'Choose a car' }, ...(data?.items ?? []).filter((v) => v.id !== b.vehicle.id && v.operational_status === 'active').map((v) => ({ value: v.id, label: `${v.make} ${v.model}` }))]} />
        <CheckField label="Re-price for the new car" checked={reprice} onChange={setReprice} hint="Off keeps the original price. On recalculates with today's rules." />
        <TextField label="Reason *" value={reason} onChange={setReason} />
      </>}
      onConfirm={async () => {
        if (!vehicleId || !reason.trim()) throw new Error('Choose a car and give a reason.');
        await api(`/bookings/${b.id}/change-vehicle`, { body: { vehicleId, reprice, reason } });
        onDone();
      }} />
  );
}

export function AssignDriver({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const { data, error, loading } = useApi<{ items: { id: string; name: string; phone: string; busy: boolean; licenceExpired: boolean; eligible: boolean }[] }>(`/bookings/${b.id}/eligible-drivers`);
  const [driverId, setDriverId] = useState('');
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title={b.driver ? 'Reassign driver' : 'Assign driver'} confirmLabel="Assign" onClose={onClose}
      message="Drivers with an overlapping job (including travel time) or an expired licence cannot be chosen."
      extra={<>
        {loading ? <Loading /> : null}<ErrorBox error={error} />
        {data && !data.items.length ? <div className="note">No active drivers. Add one under Drivers.</div> : null}
        {data?.items.map((d) => (
          <label key={d.id} className="check" style={{ opacity: d.eligible ? 1 : 0.55 }}>
            <input type="radio" name="driver" disabled={!d.eligible} checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
            <span>{d.name} <span className="muted small">{d.phone}{d.busy ? ' · busy at this time' : ''}{d.licenceExpired ? ' · licence expires before the booking' : ''}</span></span>
          </label>
        ))}
        {b.driver ? <TextField label="Reason for change *" value={reason} onChange={setReason} /> : null}
      </>}
      onConfirm={async () => {
        if (!driverId) throw new Error('Choose a driver.');
        if (b.driver && !reason.trim()) throw new Error('Give a reason for the change.');
        await api(`/bookings/${b.id}/driver`, { body: { driverId, reason: reason || undefined } });
        onDone();
      }} />
  );
}
