import { Fragment, useState } from 'react';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';
import { FiArrowLeft, FiCalendar, FiCheck, FiCreditCard, FiPrinter, FiTruck, FiUser } from 'react-icons/fi';
import { api, openDocument, useApi } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Empty, Panel } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtTime, gbp, humanize } from '../../lib/format';
import { go } from '../../lib/nav';
import type { Detail, Dialog, Pt } from './bookingDetail.types';
import { AddVehicle, StatusDialog, ChangeVehicle, AssignDriver } from './dialogs/ChangeDialogs';
import { DeliveryCharge, Adjustment } from './dialogs/ChargeDialogs';
import { ManualPay, PaymentStatus, Refund } from './dialogs/PaymentDialogs';
import { Extend, DecideExtension } from './dialogs/ExtensionDialogs';

/** Status values are humanised; reschedule times are formatted; names and amounts pass through. */
const shown = (action: string, v: string) => (action === 'rescheduled' || action === 'extended' ? fmtDateTime(v)
  : action === 'total_changed' || action === 'order_repriced' ? gbp(Number(v))
  : ['driver_assigned', 'driver_reassigned', 'driver_removed', 'vehicle_changed', 'delivery_charge_confirmed', 'delivery_charge_amended', 'delivery_charge_removed', 'adjustment_charge_removed', 'charge_added', 'credit_added'].includes(action) ? v : humanize(v));
const MapLink = ({ p }: { p: Pt | null }) => (p ? <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer">View on map</a> : null);
const DISPATCH = ['not_dispatched', 'dispatched', 'en_route', 'arrived', 'service_started', 'service_complete'];
const METHOD: Record<string, string> = { cash: 'Cash', card_terminal: 'Card', bank_transfer: 'Bank transfer', other: 'Other', card: 'Card' };
const Money = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) => (
  <><dt className={strong ? 'strong' : 'dim'}>{label}</dt><dd className={strong ? 'strong' : undefined} style={{ textAlign: 'right', color: tone }}>{value}</dd></>
);

/** A headline fact in the header card. */
const Fact = ({ icon: Icon, label, value, sub, tone }: { icon: IconType; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) => (
  <div className="bd-fact">
    <span className="bd-fact-icon"><Icon size={17} /></span>
    <div style={{ minWidth: 0 }}>
      <div className="bd-label">{label}</div>
      <div className="bd-fact-value" style={{ color: tone }}>{value}</div>
      {sub ? <div className="muted small">{sub}</div> : null}
    </div>
  </div>
);
/** A labelled field in the details card. */
const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
  <div className={'bd-field' + (wide ? ' wide' : '')}><div className="bd-label">{label}</div><div>{children}</div></div>
);
/** Where the booking is in its life: request, payment, confirmation, driver, the day itself, done. */
function Progress({ status, withDriver }: { status: string; withDriver: boolean }) {
  const steps = [
    { key: 'booked', label: 'Booked' },
    { key: 'paid', label: 'Paid' },
    { key: 'confirmed', label: 'Confirmed' },
    ...(withDriver ? [{ key: 'driver', label: 'Driver assigned' }] : []),
    { key: 'live', label: 'In progress' },
    { key: 'done', label: 'Completed' },
  ];
  const at: Record<string, string> = {
    pending: 'booked', awaiting_payment: 'paid', payment_failed: 'paid', confirmed: withDriver ? 'driver' : 'live', cancellation_requested: withDriver ? 'driver' : 'live',
    driver_assigned: 'live', in_progress: 'live', completed: 'end',
  };
  const current = at[status] === 'end' ? steps.length : steps.findIndex((x) => x.key === at[status]);
  return (
    <ol className="bd-steps">
      {steps.map((x, n) => {
        const state = n < current || (status === 'in_progress' && x.key === 'live') ? 'done' : n === current ? 'now' : '';
        return <li key={x.key} className={state}><span className="bd-step-dot">{state === 'done' ? <FiCheck size={13} /> : n + 1}</span><span>{x.label}</span></li>;
      })}
    </ol>
  );
}

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
  const editable = ['pending', 'awaiting_payment', 'confirmed', 'driver_assigned'].includes(s);
  const active = ['confirmed', 'driver_assigned', 'in_progress'].includes(s);
  const nextDispatch = DISPATCH[DISPATCH.indexOf(b.dispatchStatus) + 1];
  const delivery = b.charges.find((c) => c.kind === 'delivery' && c.status !== 'void');
  const legacyDelivery = b.pricing.lines.some((l) => l.key === 'delivery');
  const liveCharges = b.charges.filter((c) => c.status === 'confirmed');
  const replaced = b.charges.filter((c) => c.status === 'void');

  return (
    <>
      <section className="panel bd-hero">
        <div className="bd-hero-top">
          <div className="bd-id">
            <button className="icon-btn bd-back" onClick={() => go('bookings')} aria-label="Back to bookings" title="Back to bookings"><FiArrowLeft size={18} /></button>
            <div style={{ minWidth: 0 }}>
              <div className="bd-label">Booking{b.order.items.length > 1 ? ` · part of order ${b.order.ref}` : ''}</div>
              <h2 className="bd-ref">{b.ref}</h2>
              <div className="row wrap" style={{ gap: 8 }}>
                <Badge status={b.status} /><Badge status={b.paymentStatus} />
                <span className="muted small">{b.source === 'admin' ? `Created by ${b.createdByName ?? 'staff'}` : 'Booked in the customer app'} · {fmtDateTime(b.createdAt)}</span>
                {b.holdExpiresAt && s === 'awaiting_payment' ? <span className="muted small">· car held until {fmtTime(b.holdExpiresAt)}</span> : null}
              </div>
            </div>
          </div>
          <div className="bd-actions">
            {['pending', 'awaiting_payment', 'confirmed', 'driver_assigned', 'in_progress'].includes(s) ? <button className="btn sm" onClick={() => setDialog({ t: 'extend' })}>Extend</button> : null}
            {editable ? <button className="btn sm" onClick={() => setDialog({ t: 'vehicle' })}>Change car</button> : null}
            {!closed ? <button className="btn sm" onClick={() => setDialog({ t: 'addVehicle' })}>Add vehicle</button> : null}
            {actions.map((a) => a.t === 'status' ? <button key={a.to + a.label} className={'btn sm ' + (a.danger ? 'danger' : a.to === 'confirmed' || a.to === 'awaiting_payment' || a.to === 'in_progress' || a.to === 'completed' ? 'gold' : '')} onClick={() => setDialog(a)}>{a.label}</button> : null)}
          </div>
        </div>
        {closed ? null : <Progress status={s} withDriver={b.driverOption === 'with_driver' || b.chauffeur} />}
        <div className="bd-facts">
          <Fact icon={FiCalendar} label="When" value={fmtDate(b.startAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} sub={`${fmtTime(b.startAt)} to ${fmtTime(b.endAt)} · ${b.hours}h`} />
          <Fact icon={FiTruck} label="Car" value={b.vehicle.name} sub={b.driver ? `Driver: ${b.driver.name}` : b.driverOption === 'with_driver' || b.chauffeur ? 'With driver, not assigned yet' : 'Self-drive'} />
          <Fact icon={FiUser} label="Customer" value={b.customer.name} sub={b.customer.phone ?? b.customer.email} />
          <Fact icon={FiCreditCard} label={f.creditPence ? 'Overpaid' : 'Outstanding'} value={gbp(f.creditPence || f.balanceDuePence)} tone={f.creditPence ? 'var(--bad)' : f.balanceDuePence > 0 ? 'var(--gold)' : 'var(--good)'}
            sub={`${gbp(f.paidPence - f.refundedPence)} paid of ${gbp(f.finalTotalPence)}`} />
        </div>
      </section>
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
          <Panel title="Booking details">
            <div className="bd-fields">
              <Field label="Customer"><button className="link-btn" onClick={() => go('customers/' + b.customer.id)}>{b.customer.name}</button>
                <div className="muted small"><a href={`mailto:${b.customer.email}`}>{b.customer.email}</a>{b.customer.phone ? <> · <a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a></> : null}</div></Field>
              <Field label="Car"><button className="link-btn" onClick={() => go('vehicles/' + b.vehicle.id)}>{b.vehicle.name}</button></Field>
              <Field label="Date and time">{fmtDate(b.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<div className="muted small">{fmtTime(b.startAt)} to {fmtTime(b.endAt)} · {b.hours} hour{b.hours === 1 ? '' : 's'}</div></Field>
              <Field label="Event">{b.eventType?.title ?? '—'}{b.occasion ? <div className="muted small">{b.occasion}</div> : null}</Field>
              <Field label="Driver">{b.driver
                ? <>{b.driver.name}{b.driverAssignments.length > 1 ? <div className="muted small">Previously: {b.driverAssignments.filter((a) => !a.active).map((a) => a.driverName).join(', ')}</div> : null}</>
                : <span className={b.driverOption === 'with_driver' || b.chauffeur ? '' : 'muted'}>{b.driverOption === 'with_driver' || b.chauffeur ? 'Needed, not assigned yet' : 'Self-drive'}</span>}
                {['confirmed', 'driver_assigned'].includes(s) && (b.driverOption === 'with_driver' || b.chauffeur || b.driver) ? (
                  <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn sm" onClick={() => setDialog({ t: 'driver' })}>{b.driver ? 'Change driver' : 'Assign driver'}</button>
                    {b.driver ? <button className="btn sm danger" onClick={() => setDialog({ t: 'removeDriver' })}>Remove</button> : null}
                  </div>
                ) : null}</Field>
              <Field label="Progress"><Badge status={b.dispatchStatus} />
                {active && nextDispatch ? <div style={{ marginTop: 8 }}><button className="btn sm gold" disabled={busy} onClick={() => run(async () => { await api(`/bookings/${id}/dispatch`, { body: { status: nextDispatch } }); reload(); }, 'Progress updated')}>Mark: {humanize(nextDispatch)}</button></div> : null}</Field>
              <Field label={b.pickupAddress ? 'Journey' : b.experience === 'delivered' ? 'Delivery' : 'Collection'} wide>{b.pickupAddress
                ? <><div>From {b.pickupAddress} <MapLink p={b.points.pickup} /></div><div>To {b.dropoffAddress} <MapLink p={b.points.dropoff} /></div><div className="muted small">{b.routeMiles} miles by road</div></>
                : b.experience === 'delivered'
                  ? <>{b.address} <MapLink p={b.points.address} />{b.deliveryMiles != null ? <div className="muted small">{b.deliveryMiles} miles from the car's base</div> : null}</>
                  : 'Collect from the showroom'}</Field>
              {b.customerNotes ? <Field label="Customer notes" wide><div className="pre">{b.customerNotes}</div></Field> : null}
              {b.consents ? <Field label="Consents" wide><span className="row wrap" style={{ gap: 6 }}>
                <Badge status={b.consents.terms ? 'confirmed' : 'inactive'} label={`Terms ${b.consents.terms ? 'accepted' : 'not accepted'}`} />
                <Badge status={b.consents.guardian ? 'confirmed' : 'draft'} label={`Guardian present: ${b.consents.guardian ? 'yes' : 'no'}`} />
                <Badge status={b.consents.marketingPhotos ? 'confirmed' : 'draft'} label={`Photo marketing: ${b.consents.marketingPhotos ? 'yes' : 'no'}`} />
              </span></Field> : null}
            </div>
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

          <Panel title="Price and payment" hint="Quoted at booking, plus any charges confirmed since."
            action={<button className="btn sm" disabled={busy} onClick={() => run(() => openDocument(`/bookings/${id}/statement`))}><FiPrinter /> Statement</button>}>
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
            <div className="bd-divider" />
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto', marginBottom: 14 }}>
              {f.depositMode ? <Money label={`Deposit required · ${f.depositPaid ? 'paid' : 'not paid'}`} value={gbp(f.depositRequiredPence)} /> : null}
              <Money label="Payments received" value={gbp(f.paidPence)} />
              {f.refundedPence ? <Money label="Refunded" value={`-${gbp(f.refundedPence)}`} /> : null}
              {f.creditPence ? <Money label="Overpaid (refund due)" value={gbp(f.creditPence)} strong tone="var(--bad)" /> : <Money label="Outstanding" value={gbp(f.balanceDuePence)} strong />}
            </dl>
            <div className="bd-paidbar" aria-hidden="true"><span style={{ width: `${f.finalTotalPence ? Math.min(100, Math.round(((f.paidPence - f.refundedPence) / f.finalTotalPence) * 100)) : 0}%` }} /></div>
            {!closed ? <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
              {f.balanceDuePence > 0 ? <button className="btn sm gold" onClick={() => setDialog({ t: 'manualPay' })}>Record cash or card payment</button> : null}
              <button className="btn sm" onClick={() => setDialog({ t: 'adjust' })}>Add charge or credit</button>
            </div> : null}
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
                      {p.receiptId ? <button className="btn sm" title={p.receiptNumber ?? ''} onClick={() => run(() => openDocument(`/invoices/${p.receiptId}/document`))}><FiPrinter /> Print receipt</button> : null}
                      {p.source === 'manual' && p.status === 'pending' ? <button className="btn sm gold" onClick={() => setDialog({ t: 'payStatus', payment: p })}>Update</button> : null}
                      {p.status === 'succeeded' && p.amountPence - refunded > 0 ? <button className="btn sm" onClick={() => setDialog({ t: 'refund', paymentId: p.id, max: p.amountPence - refunded })}>Refund</button> : null}
                    </div>
                  </div>
                );
              })}</div>
            )}
          </Panel>

        </div>
      </div>

      {dialog?.t === 'status' ? <StatusDialog d={dialog} bookingId={id} onClose={() => setDialog(null)} onDone={reload} unpaid={unpaid} /> : null}
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
