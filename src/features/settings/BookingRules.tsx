import { MoneyField, NumberField, ToggleField } from '../../components/forms';
import { ErrorBox } from '../../components/feedback';
import { Panel } from '../../components/ui';
import { useSettingsForm, type S } from './settingsShared';

/** Settings > Booking rules: opening hours, holds, cancellation, buffers and delivery. */
export function BookingRules({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const n = (k: string) => f.v[k] as number;
  const keys = ['booking.openHour', 'booking.closeHour', 'booking.minLeadHours', 'booking.requireApproval', 'booking.holdMinutes', 'booking.cancellationFreeHours', 'booking.cancellationLateRefundPercent', 'driver.bufferMinutes', 'booking.bufferMinutes', 'booking.maxAdvanceDays', 'booking.maxVehiclesPerOrder', 'booking.allowExtensions', 'delivery.showroomFeePence'];
  const bad = n('booking.closeHour') <= n('booking.openHour') || n('booking.closeHour') > 24 || n('booking.cancellationLateRefundPercent') > 100 || n('booking.maxAdvanceDays') < 1 || n('booking.bufferMinutes') > 1440;
  return (
    <>
      <Panel title="Booking rules" hint={`Times are in ${s['booking.timezone']}.`}>
        <div className="form-grid">
          <NumberField label="First start hour" value={n('booking.openHour')} onChange={(v) => f.set('booking.openHour', v ?? 0)} min={0} max={23} />
          <NumberField label="Everything must finish by (hour)" value={n('booking.closeHour')} onChange={(v) => f.set('booking.closeHour', v ?? 0)} min={1} max={24} error={n('booking.closeHour') <= n('booking.openHour') ? 'Must be after the first start hour' : undefined} />
          <NumberField label="Minimum notice (hours)" value={n('booking.minLeadHours')} onChange={(v) => f.set('booking.minLeadHours', v ?? 0)} min={0} />
          <NumberField label="Unpaid hold (minutes)" value={n('booking.holdMinutes')} onChange={(v) => f.set('booking.holdMinutes', v ?? 0)} min={1} hint="How long a car is held while the customer pays" />
          <NumberField label="Free cancellation up to (hours before)" value={n('booking.cancellationFreeHours')} onChange={(v) => f.set('booking.cancellationFreeHours', v ?? 0)} min={0} />
          <NumberField label="Refund after that (%)" value={n('booking.cancellationLateRefundPercent')} onChange={(v) => f.set('booking.cancellationLateRefundPercent', v ?? 0)} min={0} max={100} />
          <NumberField label="Driver travel buffer (minutes)" value={n('driver.bufferMinutes')} onChange={(v) => f.set('driver.bufferMinutes', v ?? 0)} min={0} hint="Kept free either side of a driver's job" />
          <NumberField label="Car preparation buffer (minutes)" value={n('booking.bufferMinutes')} onChange={(v) => f.set('booking.bufferMinutes', v ?? 0)} min={0} max={1440} hint="Kept free before and after every booking for cleaning and handover. Not charged." />
          <NumberField label="Book up to (days ahead)" value={n('booking.maxAdvanceDays')} onChange={(v) => f.set('booking.maxAdvanceDays', v ?? 1)} min={1} max={1095} hint="Bookings always start today or later" />
          <NumberField label="Vehicles per booking (max)" value={n('booking.maxVehiclesPerOrder')} onChange={(v) => f.set('booking.maxVehiclesPerOrder', v ?? 1)} min={1} max={20} hint="How many cars a customer can book together" />
          <div className="full"><ToggleField label="Customers can extend bookings in the app" checked={f.v['booking.allowExtensions'] as boolean} onChange={(c) => f.set('booking.allowExtensions', c)} onText="On" offText="Off" hint="Only when the car is free afterwards. Otherwise they can ask you, and you approve or decline." /></div>
          <div className="full"><ToggleField label="Require approval for new bookings" checked={f.v['booking.requireApproval'] as boolean} onChange={(c) => f.set('booking.requireApproval', c)} onText="On" offText="Off" hint="On: bookings start as Pending until you approve. Off: they go straight to payment." /></div>
        </div>
      </Panel>
      <Panel title="Delivery and collection" hint="Delivery is priced per booking: staff work out the charge and add it on the booking page, and the customer is emailed the new total.">
        <div className="form-grid">
          <MoneyField label="Showroom collection fee" value={n('delivery.showroomFeePence')} onChange={(v) => f.set('delivery.showroomFeePence', v ?? 0)} hint="Leave at 0 to keep collection free" />
        </div>
      </Panel>
      <ErrorBox error={f.error} />
      <div><button className="btn gold" disabled={f.busy || !f.changed.length || bad} onClick={() => f.save(keys)}>{f.busy ? 'Saving…' : 'Save booking rules'}</button></div>
    </>
  );
}
