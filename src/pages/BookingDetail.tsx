import { Fragment, useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiFileText, FiPrinter, FiUser } from 'react-icons/fi';
import { api, newIdempotencyKey, openDocument, useApi } from '../api';
import { CheckField, ConfirmDialog, ErrorBox, Loading, MoneyField, NumberField, SelectField, TextField, useAction } from '../components/forms';
import { Badge, Empty, Panel } from '../components/ui';
import { fmtDate, fmtDateTime, fmtTime, gbp, humanize, ymd } from '../format';
import { go } from '../nav';

type Finance = {
  currency: string; quotedTotalPence: number; confirmedChargesPence: number; finalTotalPence: number; depositRequiredPence: number; depositMode: boolean; depositPaid: boolean;
  paidPence: number; refundedPence: number; netPaidPence: number; balanceDuePence: number; dueNowPence: number; creditPence: number; paymentStatus: string;
  delivery: null | { status: 'pending' | 'confirmed'; amountPence: number; distanceMiles: number | null; ratePerMilePence: number | null };
};
type Charge = {
  id: string; kind: 'delivery' | 'adjustment'; status: 'pending' | 'confirmed' | 'void'; amountPence: number; description: string; address: string | null; distanceMiles: number | null;
  ratePerMilePence: number | null; calculatedPence: number | null; createdAt: string; approvedBy: string | null; voidedAt: string | null; voidedBy: string | null; voidReason: string | null;
};
type Doc = { id: string; number: string; kind: string; amountPence: number; bookingTotalPence: number; paidToDatePence: number; balancePence: number; issuedAt: string };
type Payment = {
  id: string; amountPence: number; method: string; source: string; purpose: string; status: string; providerRef: string | null; manualReference: string | null; note: string | null;
  paidAt: string | null; verified: boolean; createdAt: string; recordedBy: string | null; statusChangedBy: string | null; receiptId: string | null; receiptNumber: string | null;
};

type Detail = {
  id: string; ref: string; status: string; paymentStatus: string; startAt: string; endAt: string; hours: number; experience: string; address: string | null; chauffeur: boolean;
  driverOption: 'with_driver' | 'self_drive'; source: 'customer_app' | 'admin'; createdByName: string | null;
  dispatchStatus: string; totalPence: number; paidPence: number; refundedPence: number; depositDuePence: number; occasion: string | null; children: number | null;
  customerNotes: string | null; pickupAddress: string | null; dropoffAddress: string | null; points: { address: Pt | null; pickup: Pt | null; dropoff: Pt | null }; routeMiles: number | null; deliveryMiles: number | null; consents: { guardian?: boolean; terms?: boolean; marketingPhotos?: boolean; at?: string } | null; cancelReason: string | null; holdExpiresAt: string | null; createdAt: string;
  customer: { id: string; name: string; email: string; phone: string | null }; vehicle: { id: string; name: string };
  eventType: { id: string; title: string } | null; driver: { id: string; name: string } | null;
  pricing: { lines: { key: string; label: string; amountPence: number }[]; discountPence: number; serviceFeePence: number; vatPence: number; totalPence: number; depositDuePence: number; offer: { title: string; code: string | null } | null; deliveryEstimate?: { amountPence: number | null; label: string } | null };
  emails: { kind: string; status: string; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string }[];
  events: { id: number; actorType: string; actorName: string | null; action: string; from: string | null; to: string | null; reason: string | null; createdAt: string; meta: any; bookingRef?: string }[];
  payments: Payment[];
  refunds: { id: string; paymentId: string; amountPence: number; reason: string | null; status: string; createdAt: string }[];
  driverAssignments: { id: string; driverName: string; active: boolean; createdAt: string; endedAt: string | null; endedReason: string | null }[];
  cancellationPolicy: { percent: number; refundPence: number; hoursAhead: number };
  finance: Finance; charges: Charge[]; invoices: Doc[]; defaultDeliveryRatePence: number;
  order: OrderInfo; extensions: Extension[];
  addons: { id: string; name: string; pricingType: string; unitPricePence: number; quantity: number; hours: number | null; totalPence: number }[];
};

/** Status values are humanised; reschedule times are formatted; names and amounts pass through. */
const shown = (action: string, v: string) => (action === 'rescheduled' || action === 'extended' ? fmtDateTime(v)
  : action === 'total_changed' || action === 'order_repriced' ? gbp(Number(v))
  : ['driver_assigned', 'driver_reassigned', 'driver_removed', 'vehicle_changed', 'delivery_charge_confirmed', 'delivery_charge_amended', 'delivery_charge_removed', 'adjustment_charge_removed', 'charge_added', 'credit_added'].includes(action) ? v : humanize(v));

type Pt = { lat: number; lng: number };
type OrderInfo = {
  id: string; ref: string; status: string; subtotalPence: number; discountPence: number; taxablePence: number; taxPence: number; serviceFeePence: number; quotedTotalPence: number; totalPence: number;
  tax: { enabled: boolean; rateBp: number; policy: string; label: string };
  offers: { offerId: string | null; title: string; code: string | null; discountType: string; discountValue: number; appliesTo: string; discountPence: number; conditions: string | null }[];
  items: { id: string; ref: string; status: string; startAt: string; endAt: string; hours: number; vehicle: string; category: string; pricePerHourPence: number; subtotalPence: number; discountPence: number;
    taxPence: number; totalPence: number; extensions: number; lines: { key: string; label: string; amountPence: number }[] | null }[];
};
type Extension = {
  id: string; status: string; previousEndAt: string; requestedEndAt: string; additionalHours: number; priceDifferencePence: number | null; taxDifferencePence: number | null;
  requestedBy: string; createdAt: string; decidedAt: string | null; decisionReason: string | null; customerMessage: string | null; conflictReason?: string | null; decidedBy?: string | null;
};
type ExtQuote = {
  available: boolean; reason: string | null; maxAvailableHours: number | null; newEndAt: string; additionalPence: number; previousTotalPence: number; newTotalPence: number;
  priceDifferencePence: number; taxDifferencePence: number; taxLabel: string; paidPence: number; balanceAfterPence: number; lines: { key: string; label: string; amountPence: number }[];
};
const MapLink = ({ p }: { p: Pt | null }) => (p ? <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer">View on map</a> : null);

const DISPATCH = ['not_dispatched', 'dispatched', 'en_route', 'arrived', 'service_started', 'service_complete'];
const DOC_LABEL: Record<string, string> = {
  deposit_receipt: 'Deposit receipt', payment_receipt: 'Payment receipt', full_payment_receipt: 'Final payment receipt', refund_receipt: 'Refund receipt', adjustment_note: 'Adjustment', credit_note: 'Credit note',
};
const METHOD: Record<string, string> = { cash: 'Cash', card_terminal: 'Card', bank_transfer: 'Bank transfer', other: 'Other', card: 'Card' };
const Money = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) => (
  <><dt className={strong ? 'strong' : 'dim'}>{label}</dt><dd className={strong ? 'strong' : undefined} style={{ textAlign: 'right', color: tone }}>{value}</dd></>
);

type Dialog =
  | { t: 'status'; to: string; label: string; reason?: boolean; danger?: boolean; unpaidOption?: boolean }
  | { t: 'reschedule' } | { t: 'vehicle' } | { t: 'driver' } | { t: 'removeDriver' } | { t: 'manualPay' } | { t: 'refund'; paymentId: string; max: number }
  | { t: 'delivery' } | { t: 'adjust' } | { t: 'voidCharge'; charge: Charge } | { t: 'payStatus'; payment: Payment }
  | { t: 'extend' } | { t: 'addVehicle' } | { t: 'decideExt'; ext: Extension; approve: boolean };

export default function BookingDetail({ id }: { id: string }) {
  const { data: b, error, loading, reload } = useApi<Detail>(`/bookings/${id}`);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { run, busy, error: actError } = useAction();
  if (loading && !b) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!b) return null;

  const f = b.finance;
  const unpaid = f.netPaidPence < b.depositDuePence;
  const s = b.status;
  const closed = ['cancelled', 'rejected'].includes(s);
  const actions: Dialog[] = [];
  if (s === 'pending') actions.push({ t: 'status', to: 'awaiting_payment', label: 'Approve (request payment)' }, { t: 'status', to: 'confirmed', label: 'Confirm', unpaidOption: unpaid }, { t: 'status', to: 'rejected', label: 'Reject', reason: true, danger: true });
  if (s === 'awaiting_payment') actions.push({ t: 'status', to: 'confirmed', label: 'Confirm', unpaidOption: unpaid }, { t: 'status', to: 'payment_failed', label: 'Mark payment failed' });
  if (s === 'payment_failed') actions.push({ t: 'status', to: 'awaiting_payment', label: 'Re-open for payment' });
  if (s === 'confirmed' || s === 'driver_assigned') actions.push({ t: 'status', to: 'in_progress', label: 'Start service' });
  if (s === 'in_progress') actions.push({ t: 'status', to: 'completed', label: 'Mark completed' });
  if (s === 'cancellation_requested') actions.push({ t: 'status', to: 'cancelled', label: 'Approve cancellation', reason: true, danger: true }, { t: 'status', to: 'confirmed', label: 'Decline request' });
  if (['pending', 'awaiting_payment', 'payment_failed', 'confirmed', 'driver_assigned'].includes(s)) actions.push({ t: 'status', to: 'cancelled', label: 'Cancel booking', reason: true, danger: true });
  const editable = ['pending', 'awaiting_payment', 'confirmed', 'driver_assigned'].includes(s);
  const active = ['confirmed', 'driver_assigned', 'in_progress'].includes(s);
  const nextDispatch = DISPATCH[DISPATCH.indexOf(b.dispatchStatus) + 1];
  const delivery = b.charges.find((c) => c.kind === 'delivery' && c.status !== 'void');
  const legacyDelivery = b.pricing.lines.some((l) => l.key === 'delivery');
  const liveCharges = b.charges.filter((c) => c.status === 'confirmed');
  const replaced = b.charges.filter((c) => c.status === 'void');

  return (
    <>
      <div className="row between wrap">
        <div className="row wrap">
          <button className="btn sm" onClick={() => go('bookings')}><FiArrowLeft /> Bookings</button>
          <h2 className="display" style={{ margin: 0, fontSize: 24 }}>{b.ref}</h2>
          <Badge status={b.status} /><Badge status={b.paymentStatus} />
          <Badge status="draft" label={b.source === 'admin' ? `Created by admin${b.createdByName ? ` (${b.createdByName})` : ''}` : 'Booked in the customer app'} />
          {b.holdExpiresAt && s === 'awaiting_payment' ? <span className="muted small">Car held until {fmtTime(b.holdExpiresAt)}</span> : null}
        </div>
        <div className="row wrap">
          {actions.map((a) => a.t === 'status' ? <button key={a.to + a.label} className={'btn sm ' + (a.danger ? 'danger' : a.to === 'confirmed' || a.to === 'awaiting_payment' ? 'gold' : '')} onClick={() => setDialog(a)}>{a.label}</button> : null)}
          {editable ? <button className="btn sm" onClick={() => setDialog({ t: 'reschedule' })}>Reschedule</button> : null}
          {editable ? <button className="btn sm" onClick={() => setDialog({ t: 'vehicle' })}>Change car</button> : null}
          {['pending', 'awaiting_payment', 'confirmed', 'driver_assigned', 'in_progress'].includes(s) ? <button className="btn sm" onClick={() => setDialog({ t: 'extend' })}>Extend</button> : null}
          {!closed ? <button className="btn sm" onClick={() => setDialog({ t: 'addVehicle' })}>Add vehicle to order</button> : null}
        </div>
      </div>
      <ErrorBox error={actError} />
      {s === 'cancellation_requested' ? <div className="note">The customer asked to cancel. Under the policy they are due {b.cancellationPolicy.percent}% of what they paid ({gbp(b.cancellationPolicy.refundPence)}) since the booking is {b.cancellationPolicy.hoursAhead} hours away. Cancel, then refund from the payments list.</div> : null}
      {b.cancelReason && closed ? <div className="note">Reason: {b.cancelReason}</div> : null}
      {f.creditPence ? <div className="note">The customer has paid {gbp(f.creditPence)} more than the booking total. Refund the difference from the payments list.</div> : null}
      {b.extensions.filter((x) => x.status === 'requested').map((x) => (
        <div key={x.id} className="note row between wrap">
          <span><b>Extension requested:</b> {x.additionalHours} more hour{x.additionalHours === 1 ? '' : 's'}, to {fmtTime(x.requestedEndAt)}{x.customerMessage ? ` · "${x.customerMessage}"` : ''}
            {x.conflictReason ? <div className="small">Not possible online: {x.conflictReason}</div> : null}</span>
          <span className="row"><button className="btn sm gold" onClick={() => setDialog({ t: 'decideExt', ext: x, approve: true })}>Approve</button><button className="btn sm danger" onClick={() => setDialog({ t: 'decideExt', ext: x, approve: false })}>Decline</button></span>
        </div>
      ))}
      {delivery?.status === 'pending' && !closed ? <div className="note">Delivery charge not confirmed yet. The customer sees an estimate{delivery.amountPence ? ` of ${gbp(delivery.amountPence)}` : ''}; it is not payable until you confirm it below.</div> : null}

      <div className="grid g-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <Panel title="Booking">
            <dl className="kv">
              <dt>Customer</dt><dd><button className="link-btn" onClick={() => go('customers/' + b.customer.id)}>{b.customer.name}</button><div className="muted small">{b.customer.email}{b.customer.phone ? ` · ${b.customer.phone}` : ''}</div></dd>
              <dt>Car</dt><dd><button className="link-btn" onClick={() => go('vehicles/' + b.vehicle.id)}>{b.vehicle.name}</button></dd>
              <dt>Event</dt><dd>{b.eventType?.title ?? '—'}</dd>
              <dt>When</dt><dd>{fmtDate(b.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {fmtTime(b.startAt)} to {fmtTime(b.endAt)} ({b.hours}h)</dd>
              <dt>Driver</dt><dd>{b.driverOption === 'with_driver' ? 'With driver' : 'Without driver (self-drive)'}</dd>
              <dt>Collection</dt><dd>{b.pickupAddress
                ? <>Pick-up: {b.pickupAddress} <MapLink p={b.points.pickup} /><br />Drop-off: {b.dropoffAddress} <MapLink p={b.points.dropoff} /><div className="muted small">{b.routeMiles} miles by road</div></>
                : b.experience === 'delivered'
                  ? <>Deliver to: {b.address} <MapLink p={b.points.address} />{b.deliveryMiles != null ? <div className="muted small">{b.deliveryMiles} miles from the car's base (measured)</div> : null}</>
                  : 'Collect from showroom'}</dd>
              {b.children != null ? <><dt>Children</dt><dd>{b.children}</dd></> : null}
              {b.consents ? <><dt>Consents</dt><dd>Guardian present: {b.consents.guardian ? 'yes' : 'no'} · Terms: {b.consents.terms ? 'yes' : 'no'} · Photo marketing: {b.consents.marketingPhotos ? 'yes' : 'no'}</dd></> : null}
              <dt>Created</dt><dd>{fmtDateTime(b.createdAt)} · {b.source === 'admin' ? `Admin${b.createdByName ? ` (${b.createdByName})` : ''}` : 'Customer app'}</dd>
            </dl>
          </Panel>

          {b.order.items.length > 1 ? (
            <Panel title={`Order ${b.order.ref}`} hint="Vehicles booked and paid for together. Each has its own price, times and status.">
              <div className="table-wrap"><table>
                <thead><tr><th>Booking</th><th>Vehicle</th><th>When</th><th>Status</th><th className="num">Price</th><th className="num">Discount</th><th className="num">{b.order.tax.label}</th><th className="num">Total</th></tr></thead>
                <tbody>{b.order.items.map((it) => (
                  <tr key={it.id} className={it.id === b.id ? '' : 'click'} onClick={() => it.id !== b.id && go('bookings/' + it.id)} style={it.id === b.id ? { background: 'var(--gold-soft)' } : undefined}>
                    <td className="cell-title">{it.ref}{it.extensions ? <div className="cell-sub">Extended</div> : null}</td>
                    <td>{it.vehicle}<div className="cell-sub">{it.category} · {gbp(it.pricePerHourPence)}/h</div></td>
                    <td>{fmtDateTime(it.startAt)}<div className="cell-sub">{it.hours}h, to {fmtTime(it.endAt)}</div></td>
                    <td><Badge status={it.status} /></td>
                    <td className="num">{gbp(it.subtotalPence)}</td><td className="num">{it.discountPence ? `-${gbp(it.discountPence)}` : '—'}</td>
                    <td className="num">{it.taxPence ? gbp(it.taxPence) : '—'}</td><td className="num">{['cancelled', 'rejected'].includes(it.status) ? <span className="muted">not charged</span> : gbp(it.totalPence)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
              <div className="muted small" style={{ marginTop: 8 }}>Remove a vehicle by cancelling its booking: the others carry on, and the order's offers and tax are worked out again.</div>
            </Panel>
          ) : null}

          <Panel title="Price" hint="Quoted at booking (later price or tax changes never affect it), plus charges confirmed since. Worked out by the server."
            action={closed ? undefined : <button className="btn sm" onClick={() => setDialog({ t: 'adjust' })}>Add charge or credit</button>}>
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              {b.order.items.filter((it) => !['cancelled', 'rejected'].includes(it.status) || b.order.items.every((x) => ['cancelled', 'rejected'].includes(x.status))).map((it) => (
                <Fragment key={it.id}>
                  {b.order.items.length > 1 ? <><dt className="strong">{it.vehicle} <span className="muted small">{it.ref}</span></dt><dd /></> : null}
                  {(it.lines ?? []).map((l) => <Fragment key={it.id + l.key}><dt className="dim">{l.label}</dt><dd style={{ textAlign: 'right' }}>{gbp(l.amountPence)}</dd></Fragment>)}
                </Fragment>
              ))}
              <Money label="Subtotal" value={gbp(b.order.subtotalPence)} />
              {b.order.offers.map((o) => <Money key={o.title} label={`Discount: ${o.title}${o.code ? ` (${o.code})` : ''}${o.conditions ? ` · ${o.conditions}` : ''}`} value={`-${gbp(o.discountPence)}`} />)}
              {b.order.tax.enabled || b.order.taxPence ? <>
                <Money label={`Taxable amount${b.order.tax.policy === 'before_discount' ? ' (before discounts)' : ''}`} value={gbp(b.order.taxablePence)} />
                <Money label={`${b.order.tax.label} at ${b.order.tax.rateBp / 100}% (rate saved with this booking)`} value={gbp(b.order.taxPence)} />
              </> : null}
              {b.order.serviceFeePence ? <Money label="Service fee" value={gbp(b.order.serviceFeePence)} /> : null}
              <Money label="Quoted price" value={gbp(f.quotedTotalPence)} />
              {liveCharges.map((c) => <Money key={c.id} label={`${c.description}${c.approvedBy ? ` · approved by ${c.approvedBy}` : ''}`} value={gbp(c.amountPence)} />)}
              {f.finalTotalPence - f.quotedTotalPence - f.confirmedChargesPence ? <Money label="Charges on the other vehicles" value={gbp(f.finalTotalPence - f.quotedTotalPence - f.confirmedChargesPence)} /> : null}
              {delivery?.status === 'pending' ? <Money label="Delivery (estimate, not charged yet)" value={delivery.amountPence ? gbp(delivery.amountPence) : 'To confirm'} tone="var(--text-dim)" /> : null}
              <Money label={b.order.items.length > 1 ? 'Order total' : 'Booking total'} value={gbp(f.finalTotalPence)} strong />
            </dl>
            {b.addons.length ? (
              <div style={{ marginTop: 16 }}>
                <div className="strong small" style={{ marginBottom: 6 }}>Add-ons (price agreed at booking)</div>
                <div className="list">{b.addons.map((a) => (
                  <div className="list-item" key={a.id}><div style={{ flex: 1 }}>{a.name}<div className="muted small">{gbp(a.unitPricePence)}{a.pricingType === 'per_hour' ? `/h × ${a.hours}h` : ''}{a.quantity > 1 ? ` × ${a.quantity}` : ''}</div></div><div>{gbp(a.totalPence)}</div></div>
                ))}</div>
              </div>
            ) : null}
          </Panel>

          {b.experience === 'delivered' && !b.pickupAddress ? (
            <Panel title="Delivery charge" hint="Work out the delivery charge for this address and add it. The customer is emailed the new total."
              action={closed || legacyDelivery ? undefined : <div className="row">
                <button className="btn sm gold" onClick={() => setDialog({ t: 'delivery' })}>{delivery?.status === 'confirmed' ? 'Change charge' : 'Add delivery charge'}</button>
                {delivery?.status === 'confirmed' ? <button className="btn sm danger" onClick={() => setDialog({ t: 'voidCharge', charge: delivery })}>Remove</button> : null}
              </div>}>
              {legacyDelivery ? <div className="note">Delivery was included in this booking's quoted price, so no separate charge is needed.</div> : (
                <dl className="kv">
                  <dt>Address</dt><dd>{delivery?.address ?? b.address}</dd>
                  <dt>Charge</dt><dd><b>{delivery?.status === 'confirmed' ? gbp(delivery.amountPence) : '—'}</b></dd>
                  <dt>Status</dt><dd><Badge status={delivery?.status === 'confirmed' ? 'confirmed' : 'pending'} label={delivery?.status === 'confirmed' ? 'Added' : 'Not added yet'} />{delivery?.approvedBy ? <span className="muted small"> by {delivery.approvedBy}, {fmtDateTime(delivery.createdAt)}</span> : null}</dd>
                </dl>
              )}
              {replaced.length ? (
                <div className="timeline" style={{ marginTop: 14 }}>{replaced.map((c) => (
                  <div key={c.id}><i /><div><span className="muted">{c.description}: {gbp(c.amountPence)} ({c.status === 'void' && c.approvedBy ? 'confirmed' : 'estimate'})</span>
                    <div className="muted small">Replaced {c.voidedAt ? fmtDateTime(c.voidedAt) : ''}{c.voidedBy ? ` by ${c.voidedBy}` : ''}{c.voidReason ? ` · ${c.voidReason}` : ''}</div></div></div>
                ))}</div>
              ) : null}
            </Panel>
          ) : null}

          {b.emails.length ? (
            <Panel title="Customer emails" hint="Only shown as sent when the email provider accepted the message">
              <div className="list">{b.emails.map((m, i) => (
                <div className="list-item" key={i}>
                  <div style={{ flex: 1 }}><div className="strong">{humanize(m.kind.replace('booking_', ''))}</div>
                    <div className="muted small">{m.status === 'sent' && m.sentAt ? `Sent ${fmtDateTime(m.sentAt)}` : m.status === 'skipped' ? 'Not sent: no email provider configured' : m.status === 'failed' ? `Failed after ${m.attempts} attempts: ${m.lastError ?? ''}` : `Queued${m.lastError ? ` (retrying: ${m.lastError})` : ''}`}</div></div>
                  <Badge status={m.status === 'sent' ? 'succeeded' : m.status === 'failed' ? 'failed' : m.status === 'skipped' ? 'inactive' : 'pending'} label={humanize(m.status)} />
                </div>
              ))}</div>
            </Panel>
          ) : null}
          {b.extensions.length ? (
            <Panel title="Extensions" hint="Every extension of this booking: previous and new end time, price difference and who approved it.">
              <div className="list">{b.extensions.map((x) => (
                <div className="list-item" key={x.id} style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="strong">+{x.additionalHours}h · {fmtTime(x.previousEndAt)} → {fmtTime(x.requestedEndAt)} <Badge status={x.status === 'confirmed' ? 'confirmed' : x.status === 'requested' ? 'pending' : 'cancelled'} label={humanize(x.status)} /></div>
                    <div className="muted small">{x.requestedBy === 'customer' ? 'Asked by the customer' : 'Made by staff'} · {fmtDateTime(x.createdAt)}{x.decidedBy ? ` · ${x.status === 'rejected' ? 'declined' : 'approved'} by ${x.decidedBy}` : ''}</div>
                    {x.priceDifferencePence != null ? <div className="muted small">Price {x.priceDifferencePence >= 0 ? '+' : ''}{gbp(x.priceDifferencePence)}{x.taxDifferencePence ? ` (incl. ${gbp(x.taxDifferencePence)} tax)` : ''}</div> : null}
                    {x.decisionReason ? <div className="small">"{x.decisionReason}"</div> : null}
                  </div>
                </div>
              ))}</div>
            </Panel>
          ) : null}

          <Panel title="History" hint="Every change to the vehicles in this order, who made it and when">
            <div className="timeline">{b.events.map((e) => (
              <div key={e.id}><i /><div>
                <div><b>{humanize(e.action)}</b>{e.bookingRef && e.bookingRef !== b.ref ? <span className="muted small"> ({e.bookingRef})</span> : null}{e.from || e.to ? <> · {e.from ? shown(e.action, e.from) + ' → ' : ''}{e.to ? shown(e.action, e.to) : ''}</> : null}</div>
                <div className="muted small">{fmtDateTime(e.createdAt)} · {e.actorType === 'staff' ? e.actorName ?? 'Staff' : humanize(e.actorType)}{e.reason ? ` · "${e.reason}"` : ''}</div>
              </div></div>
            ))}</div>
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <Panel title="Money" action={<button className="btn sm" disabled={busy} onClick={() => run(() => openDocument(`/bookings/${id}/statement`))}><FiPrinter /> Statement</button>}>
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto', marginBottom: 14 }}>
              <Money label="Booking total" value={gbp(f.finalTotalPence)} />
              {f.depositMode ? <Money label={`Deposit required · ${f.depositPaid ? 'paid' : 'not paid'}`} value={gbp(f.depositRequiredPence)} /> : null}
              <Money label="Payments received" value={gbp(f.paidPence)} />
              {f.refundedPence ? <Money label="Refunded" value={`-${gbp(f.refundedPence)}`} /> : null}
              {f.creditPence ? <Money label="Overpaid (refund due)" value={gbp(f.creditPence)} strong tone="var(--bad)" /> : <Money label="Outstanding" value={gbp(f.balanceDuePence)} strong />}
            </dl>
            {!closed ? <button className="btn sm gold" disabled={f.balanceDuePence <= 0} onClick={() => setDialog({ t: 'manualPay' })}>Record cash or card payment</button> : null}
          </Panel>

          <Panel title="Payment history" hint="Only received payments count towards the amount paid.">
            {!b.payments.length ? <Empty icon={FiUser} title="No payments yet" /> : (
              <div className="list">{b.payments.map((p) => {
                const refunded = b.refunds.filter((r) => r.paymentId === p.id && r.status !== 'failed').reduce((a, r) => a + r.amountPence, 0);
                return (
                  <div className="list-item" key={p.id} style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong">{gbp(p.amountPence)} <Badge status={p.status} label={p.status === 'succeeded' ? 'Received' : undefined} /> {p.source === 'stripe' ? <Badge status={p.verified ? 'succeeded' : 'pending'} label={p.verified ? 'Verified online' : 'Online, not verified'} /> : <Badge status="draft" label="Recorded by staff" />}</div>
                      <div className="muted small">{p.source === 'manual' ? `${METHOD[p.method] ?? humanize(p.method)}${p.manualReference ? ` · ref ${p.manualReference}` : ''} · recorded by ${p.recordedBy ?? 'staff'}` : `Card online · ${p.providerRef}`} · {humanize(p.purpose)}</div>
                      <div className="muted small">{p.paidAt ? `Paid ${fmtDateTime(p.paidAt)}` : `Created ${fmtDateTime(p.createdAt)}`}{p.statusChangedBy ? ` · updated by ${p.statusChangedBy}` : ''}{refunded ? ` · refunded ${gbp(refunded)}` : ''}</div>
                      {p.note ? <div className="small pre" style={{ marginTop: 4 }}>Note: {p.note}</div> : null}
                    </div>
                    <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                      {p.receiptId ? <button className="btn sm" title={p.receiptNumber ?? ''} onClick={() => run(() => openDocument(`/invoices/${p.receiptId}/document`))}><FiFileText /> Receipt</button> : null}
                      {p.source === 'manual' && p.status === 'pending' ? <button className="btn sm gold" onClick={() => setDialog({ t: 'payStatus', payment: p })}>Update</button> : null}
                      {p.status === 'succeeded' && p.amountPence - refunded > 0 ? <button className="btn sm" onClick={() => setDialog({ t: 'refund', paymentId: p.id, max: p.amountPence - refunded })}>Refund</button> : null}
                    </div>
                  </div>
                );
              })}</div>
            )}
          </Panel>

          <Panel title="Receipts and invoices" hint="One per payment, refund or change. Issued documents never change.">
            {!b.invoices.length ? <Empty icon={FiFileText} title="Nothing issued yet" /> : (
              <div className="list">{b.invoices.map((d) => (
                <div className="list-item" key={d.id}>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="strong">{DOC_LABEL[d.kind] ?? humanize(d.kind)} · {d.number}</div>
                    <div className="muted small">{fmtDateTime(d.issuedAt)} · total then {gbp(d.bookingTotalPence)} · balance after {gbp(d.balancePence)}</div></div>
                  <div className="row"><b>{gbp(d.amountPence)}</b><button className="btn sm" aria-label={`Open ${d.number}`} onClick={() => run(() => openDocument(`/invoices/${d.id}/document`))}><FiPrinter /></button></div>
                </div>
              ))}</div>
            )}
          </Panel>

          <Panel title="Driver and progress">
            <dl className="kv">
              <dt>Driver</dt><dd>{b.driver?.name ?? <span className="muted">{b.chauffeur ? 'Needed, not assigned' : 'Self-drive'}</span>}</dd>
              <dt>Progress</dt><dd><Badge status={b.dispatchStatus} /></dd>
            </dl>
            <div className="row wrap" style={{ marginTop: 14 }}>
              {['confirmed', 'driver_assigned'].includes(s) ? <button className="btn sm" onClick={() => setDialog({ t: 'driver' })}>{b.driver ? 'Reassign driver' : 'Assign driver'}</button> : null}
              {b.driver && ['confirmed', 'driver_assigned'].includes(s) ? <button className="btn sm danger" onClick={() => setDialog({ t: 'removeDriver' })}>Remove driver</button> : null}
              {active && nextDispatch ? <button className="btn sm gold" disabled={busy} onClick={() => run(async () => { await api(`/bookings/${id}/dispatch`, { body: { status: nextDispatch } }); reload(); }, 'Progress updated')}>Mark: {humanize(nextDispatch)}</button> : null}
            </div>
            <div className="muted small" style={{ marginTop: 10 }}>Status tracking only. No live location is collected.</div>
            {b.driverAssignments.length ? (
              <div className="timeline" style={{ marginTop: 14 }}>{b.driverAssignments.map((a) => (
                <div key={a.id}><i /><div><b>{a.driverName}</b> {a.active ? <Badge status="active" /> : null}
                  <div className="muted small">Assigned {fmtDateTime(a.createdAt)}{a.endedAt ? ` · ended ${fmtDateTime(a.endedAt)}${a.endedReason ? ` (${a.endedReason})` : ''}` : ''}</div></div></div>
              ))}</div>
            ) : null}
          </Panel>
        </div>
      </div>

      {dialog?.t === 'status' ? <StatusDialog d={dialog} bookingId={id} onClose={() => setDialog(null)} onDone={reload} unpaid={unpaid} /> : null}
      {dialog?.t === 'reschedule' ? <Reschedule b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'vehicle' ? <ChangeVehicle b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'driver' ? <AssignDriver b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'removeDriver' ? <ConfirmDialog title="Remove the driver?" requireReason confirmLabel="Remove" danger onClose={() => setDialog(null)}
        onConfirm={async (reason) => { await api(`/bookings/${id}/driver`, { method: 'DELETE', body: { reason } }); reload(); }} /> : null}
      {dialog?.t === 'manualPay' ? <ManualPay b={b} outstanding={f.balanceDuePence} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'refund' ? <Refund paymentId={dialog.paymentId} max={dialog.max} suggested={['cancelled', 'cancellation_requested'].includes(s) ? b.cancellationPolicy.refundPence : f.creditPence || null} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'delivery' ? <DeliveryCharge b={b} current={delivery ?? null} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'adjust' ? <Adjustment b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'voidCharge' ? <ConfirmDialog title="Remove this charge?" danger requireReason confirmLabel="Remove charge" onClose={() => setDialog(null)}
        message={`${dialog.charge.description}: ${gbp(dialog.charge.amountPence)}. It is taken off the booking total and a credit note is issued.`}
        onConfirm={async (reason) => { await api(`/bookings/${id}/charges/${dialog.charge.id}/void`, { body: { reason } }); reload(); }} /> : null}
      {dialog?.t === 'payStatus' ? <PaymentStatus p={dialog.payment} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'extend' ? <Extend b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'addVehicle' ? <AddVehicle b={b} onClose={() => setDialog(null)} onDone={reload} /> : null}
      {dialog?.t === 'decideExt' ? <DecideExtension b={b} ext={dialog.ext} approve={dialog.approve} onClose={() => setDialog(null)} onDone={reload} /> : null}
    </>
  );
}

/**
 * Extend this booking. The server checks the time is free (other bookings, the preparation buffer, the driver) and
 * shows the price change first; staff may go past opening hours or the car's maximum, never into another booking.
 */
function Extend({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const [hours, setHours] = useState<number | null>(1);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState<ExtQuote | null>(null);
  const [qErr, setQErr] = useState<Error | null>(null);
  useEffect(() => {
    if (!hours || hours < 1 || hours > 12) { setQ(null); return; }
    let live = true;
    api<ExtQuote>(`/bookings/${b.id}/extension-quote`, { body: { hours } }).then((r) => { if (live) { setQ(r); setQErr(null); } }, (e) => { if (live) { setQ(null); setQErr(e); } });
    return () => { live = false; };
  }, [b.id, hours]);
  return (
    <ConfirmDialog title="Extend booking" confirmLabel={q?.available ? 'Extend' : 'Not available'} onClose={onClose}
      message={`Currently ends at ${fmtTime(b.endAt)}. The extra time is added to this booking and the order's offers and tax are worked out again.`}
      extra={<>
        <NumberField label="Extra hours" value={hours} onChange={setHours} min={1} max={12} />
        <ErrorBox error={qErr} />
        {q ? (q.available ? (
          <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt className="dim">New end time</dt><dd style={{ textAlign: 'right' }}>{fmtTime(q.newEndAt)}</dd>
            {q.lines.map((l) => <Fragment key={l.key}><dt className="dim">{l.label}</dt><dd style={{ textAlign: 'right' }}>{gbp(l.amountPence)}</dd></Fragment>)}
            {q.taxDifferencePence ? <><dt className="dim">{q.taxLabel} on the extra</dt><dd style={{ textAlign: 'right' }}>{gbp(q.taxDifferencePence)}</dd></> : null}
            <dt className="dim">Order total</dt><dd style={{ textAlign: 'right' }}>{gbp(q.previousTotalPence)} → {gbp(q.newTotalPence)}</dd>
            <dt className="dim">Already paid</dt><dd style={{ textAlign: 'right' }}>{gbp(q.paidPence)}</dd>
            <dt className="strong">Balance after</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(q.balanceAfterPence)}</dd>
          </dl>
        ) : <div className="error-box">{q.reason}</div>) : null}
        <TextField label="Reason (for the history)" value={reason} onChange={setReason} />
      </>}
      onConfirm={async () => {
        if (!q?.available || !hours) throw new Error(q?.reason ?? 'Choose how long to extend by.');
        await api(`/bookings/${b.id}/extend`, { body: { hours, reason: reason || null, expectedEndAt: b.endAt } });
        onDone();
      }} />
  );
}

/**
 * Approve or decline a customer's request for more time. When approving, staff can grant fewer (or more) hours than
 * asked, e.g. the most the car is free for, and see the price change first.
 */
function DecideExtension({ b, ext, approve, onClose, onDone }: { b: Detail; ext: Extension; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState<number | null>(ext.additionalHours);
  const [q, setQ] = useState<ExtQuote | null>(null);
  const [qErr, setQErr] = useState<Error | null>(null);
  useEffect(() => {
    if (!approve || !hours || hours < 1 || hours > 12) { setQ(null); return; }
    let live = true;
    api<ExtQuote>(`/bookings/${b.id}/extension-quote`, { body: { hours } }).then((r) => { if (live) { setQ(r); setQErr(null); } }, (e) => { if (live) { setQ(null); setQErr(e); } });
    return () => { live = false; };
  }, [approve, b.id, hours]);
  return (
    <ConfirmDialog title={approve ? 'Approve extension' : 'Decline extension'} confirmLabel={approve ? 'Approve and extend' : 'Decline'} danger={!approve} onClose={onClose}
      message={approve ? `The customer asked for ${ext.additionalHours} more hour${ext.additionalHours === 1 ? '' : 's'}${ext.customerMessage ? `: "${ext.customerMessage}"` : ''}. Availability is checked again when you approve; if the time is taken, nothing changes and you will see why.`
        : 'The customer is told, with your reason. The booking does not change.'}
      extra={<>
        {approve ? <>
          <NumberField label="Hours to add" value={hours} onChange={setHours} min={1} max={12} hint="Defaults to what the customer asked for" />
          <ErrorBox error={qErr} />
          {q ? (q.available ? (
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt className="dim">New end time</dt><dd style={{ textAlign: 'right' }}>{fmtTime(q.newEndAt)}</dd>
              <dt className="dim">Order total</dt><dd style={{ textAlign: 'right' }}>{gbp(q.previousTotalPence)} → {gbp(q.newTotalPence)}</dd>
              <dt className="strong">Balance after</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(q.balanceAfterPence)}</dd>
            </dl>
          ) : <div className="error-box">{q.reason}{q.maxAvailableHours ? <> <button className="btn sm" onClick={() => setHours(q.maxAvailableHours)}>Use {q.maxAvailableHours}h</button></> : null}</div>) : null}
        </> : null}
        <TextField label={approve ? 'Note (optional)' : 'Reason for the customer *'} value={reason} onChange={setReason} multiline />
      </>}
      onConfirm={async () => {
        if (!approve && !reason.trim()) throw new Error('Give the customer a reason.');
        if (approve && (!hours || q?.available === false)) throw new Error(q?.reason ?? 'Choose how many hours to add.');
        await api(`/extensions/${ext.id}/${approve ? 'approve' : 'reject'}`, { body: approve ? { reason: reason || null, hours } : { reason } });
        onDone();
      }} />
  );
}

/** Adds another vehicle to this order. Same checks as a new booking; the order is re-priced. */
function AddVehicle({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
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

/** The delivery charge staff work out for this address (they measure the distance themselves). */
function DeliveryCharge({ b, current, onClose, onDone }: { b: Detail; current: Charge | null; onClose: () => void; onDone: () => void }) {
  const confirmed = current?.status === 'confirmed';
  const [final, setFinal] = useState<number | null>(confirmed ? current!.amountPence : null);
  const [address, setAddress] = useState(current?.address ?? b.address ?? '');
  const [reason, setReason] = useState('');
  const newTotal = b.finance.finalTotalPence - (confirmed ? current!.amountPence : 0) + (final ?? 0);
  const newBalance = Math.max(0, newTotal - b.finance.netPaidPence);
  return (
    <ConfirmDialog title={confirmed ? 'Change delivery charge' : 'Add delivery charge'} confirmLabel={confirmed ? 'Save change' : 'Add to booking'} onClose={onClose}
      message="The charge replaces any earlier delivery charge, so it is never counted twice. The customer is emailed the new total."
      extra={<>
        <TextField label="Delivery address" value={address} onChange={setAddress} />
        <MoneyField label="Delivery charge" value={final} onChange={setFinal} hint="The amount you've worked out for this delivery" />
        <div className="muted small">New booking total {gbp(newTotal)} · paid {gbp(b.finance.netPaidPence)} · outstanding {gbp(newBalance)}</div>
        {confirmed ? <TextField label="Reason for the change" value={reason} onChange={setReason} /> : null}
      </>}
      onConfirm={async () => {
        if (final == null) throw new Error('Enter the delivery charge.');
        await api(`/bookings/${b.id}/delivery-charge`, { body: { distanceMiles: null, ratePerMilePence: 0, finalPence: final, address: address || null, reason: reason || null } });
        onDone();
      }} />
  );
}

function Adjustment({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState('charge');
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const signed = amount == null ? 0 : kind === 'credit' ? -amount : amount;
  return (
    <ConfirmDialog title="Add a charge or credit" confirmLabel="Add to booking" onClose={onClose}
      message="Confirmed straight away and shown to the customer with an adjustment note. To change it later, remove it and add a new one."
      extra={<>
        <SelectField label="Type" value={kind} onChange={setKind} options={[{ value: 'charge', label: 'Extra charge' }, { value: 'credit', label: 'Credit (reduces the total)' }]} />
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
        <TextField label="Description (shown to the customer) *" value={description} onChange={setDescription} />
        <div className="muted small">New booking total {gbp(b.finance.finalTotalPence + signed)}</div>
      </>}
      onConfirm={async () => {
        if (!amount || !description.trim()) throw new Error('Enter an amount and a description.');
        await api(`/bookings/${b.id}/adjustments`, { body: { amountPence: signed, description } });
        onDone();
      }} />
  );
}

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function ManualPay({ b, outstanding, onClose, onDone }: { b: Detail; outstanding: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>((b.finance.depositMode && b.finance.dueNowPence) || outstanding);
  const [method, setMethod] = useState('cash');
  const [paidAt, setPaidAt] = useState(localInput(new Date()));
  const [status, setStatus] = useState('succeeded');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const key = useRef(newIdempotencyKey()); // one key for this form, so a double click records it once
  const purpose = b.finance.netPaidPence === 0 && b.finance.depositMode && amount != null && amount < outstanding ? 'deposit' : b.finance.netPaidPence > 0 ? 'balance' : 'payment';
  return (
    <ConfirmDialog title="Record a payment" confirmLabel="Record payment" onClose={onClose}
      message="For money taken outside the app. It is saved under your name and labelled as recorded by staff, never as a verified online card payment."
      extra={<>
        <MoneyField label="Amount received" value={amount} onChange={setAmount} hint={`Outstanding ${gbp(outstanding)}${b.finance.depositMode && b.finance.dueNowPence ? ` · deposit still due ${gbp(b.finance.dueNowPence)}` : ''}`} />
        <div className="form-grid">
          <SelectField label="Method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card_terminal', label: 'Card' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'other', label: 'Other' }]} />
          <SelectField label="Status" value={status} onChange={setStatus} options={[{ value: 'succeeded', label: 'Received' }, { value: 'pending', label: 'Pending (not counted yet)' }]} />
        </div>
        <TextField label="Payment date and time" type="datetime-local" value={paidAt} onChange={setPaidAt} max={localInput(new Date())} />
        <TextField label="Transaction or receipt reference" value={reference} onChange={setReference} hint="Printed on the customer's receipt" />
        <TextField label="Note (staff only)" value={note} onChange={setNote} multiline />
      </>}
      onConfirm={async () => {
        if (!amount) throw new Error('Enter the amount received.');
        await api(`/bookings/${b.id}/payments/manual`, {
          headers: { 'idempotency-key': key.current },
          body: { amountPence: amount, method, status, purpose, paidAt: paidAt ? new Date(paidAt).toISOString() : null, reference: reference || undefined, note: note || null },
        });
        onDone();
      }} />
  );
}

function PaymentStatus({ p, onClose, onDone }: { p: Payment; onClose: () => void; onDone: () => void }) {
  const [to, setTo] = useState('succeeded');
  const [paidAt, setPaidAt] = useState(localInput(new Date()));
  return (
    <ConfirmDialog title={`Update ${gbp(p.amountPence)} payment`} confirmLabel="Save" onClose={onClose}
      message="Marking it received counts it towards the amount paid and issues a receipt. Failed or cancelled payments are never counted."
      extra={<>
        <SelectField label="Status" value={to} onChange={setTo} options={[{ value: 'succeeded', label: 'Received' }, { value: 'failed', label: 'Failed' }, { value: 'canceled', label: 'Cancelled' }]} />
        {to === 'succeeded' ? <TextField label="Received on" type="datetime-local" value={paidAt} onChange={setPaidAt} max={localInput(new Date())} /> : null}
      </>}
      onConfirm={async () => { await api(`/payments/${p.id}/status`, { body: { status: to, paidAt: to === 'succeeded' && paidAt ? new Date(paidAt).toISOString() : null } }); onDone(); }} />
  );
}

function StatusDialog({ d, bookingId, onClose, onDone, unpaid }: { d: Extract<Dialog, { t: 'status' }>; bookingId: string; onClose: () => void; onDone: () => void; unpaid: boolean }) {
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

function Reschedule({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
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

function ChangeVehicle({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
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

function AssignDriver({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
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

function Refund({ paymentId, max, suggested, onClose, onDone }: { paymentId: string; max: number; suggested: number | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>(suggested != null ? Math.min(suggested, max) : max);
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title="Refund" confirmLabel="Issue refund" danger onClose={onClose}
      message={`Up to ${gbp(max)} can be refunded on this payment. Card refunds are sent to Stripe.${suggested != null ? ` The cancellation policy suggests ${gbp(suggested)}.` : ''}`}
      extra={<><MoneyField label="Refund amount" value={amount} onChange={setAmount} /><TextField label="Reason *" value={reason} onChange={setReason} multiline /></>}
      onConfirm={async () => {
        if (!amount || !reason.trim()) throw new Error('Enter an amount and a reason.');
        await api(`/payments/${paymentId}/refund`, { body: { amountPence: amount, reason } });
        onDone();
      }} />
  );
}
