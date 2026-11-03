import { useEffect, useState, type MouseEvent } from 'react';
import { FiClipboard, FiFilter, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { qs, useApi } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Empty, Panel } from '../../components/ui';
import { addDays, fmtDateTime, gbp, humanize, ymd } from '../../lib/format';
import { go } from '../../lib/nav';
import { NewBooking } from './NewBooking';
import { NEW_BOOKINGS_EVENT } from '../notifications/BookingAlerts';

export type BookingRow = {
  id: string; ref: string; status: string; paymentStatus: string; startAt: string; endAt: string; hours: number; totalPence: number; paidPence: number; refundedPence: number;
  customer: { id: string; name: string; email: string }; vehicle: { id: string; name: string }; eventType: { id: string; title: string } | null; driver: { id: string; name: string } | null;
  order: { id: string; ref: string; totalPence: number; balancePence: number; vehicles: number; items: number }; extensions: number; extensionRequested: boolean;
};

export const PAYMENT_STATUSES = ['unpaid', 'deposit_paid', 'partially_paid', 'paid', 'payment_failed', 'refund_pending', 'partially_refunded', 'refunded'];
export const STATUSES = ['pending', 'awaiting_payment', 'confirmed', 'driver_assigned', 'in_progress', 'completed', 'cancellation_requested', 'cancelled', 'rejected', 'payment_failed'];

export default function Bookings({ initial }: { initial?: { status?: string } }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initial?.status ?? '');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [extensionRequests, setExtensionRequests] = useState(false);
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [more, setMore] = useState(false);
  const dq = useDebounced(q);
  const { data: fleet } = useApi<{ items: { id: string; make: string; model: string }[] }>('/vehicles?limit=200');
  const { data: ev } = useApi<{ items: { id: string; title: string }[] }>('/event-types');
  const { data, error, loading, reload } = useApi<{ items: BookingRow[]; total: number }>('/bookings' + qs({ q: dq, status, paymentStatus, vehicleId, eventTypeId, extensionRequests: extensionRequests ? 'true' : '', from, to: to ? ymd(addDays(new Date(to + 'T12:00:00Z'), 1)) : '', sort, limit: 25, offset, group: 'order' }));
  // One row per order: the API returns every vehicle of each order, in order.
  const orders = (data?.items ?? []).reduce<BookingRow[][]>((acc, b) => {
    const last = acc[acc.length - 1];
    if (last && last[0].order.id === b.order.id) last.push(b); else acc.push([b]);
    return acc;
  }, []);
  const reset = (fn: () => void) => { fn(); setOffset(0); };
  const extraCount = [vehicleId, eventTypeId, from || to, extensionRequests].filter(Boolean).length;
  const activeCount = extraCount + [q, status, paymentStatus].filter(Boolean).length;
  const clearAll = () => reset(() => { setQ(''); setStatus(''); setPaymentStatus(''); setVehicleId(''); setEventTypeId(''); setFrom(''); setTo(''); setExtensionRequests(false); });
  // A new booking just came in: refresh the list so it shows at the top.
  useEffect(() => {
    window.addEventListener(NEW_BOOKINGS_EVENT, reload);
    return () => window.removeEventListener(NEW_BOOKINGS_EVENT, reload);
  }, [reload]);

  return (
    <>
      <Panel title="Bookings" hint="Every booking, whatever its status" action={<button className="btn gold" onClick={() => setCreating(true)}><FiPlus /> New booking</button>}>
        <div className="bk-filters">
          <div className="bk-row bk-main">
            <label className="bk-search">
              <FiSearch size={17} />
              <input value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder="Search reference, name, email" aria-label="Search bookings" />
              {q ? <button type="button" className="bk-clear-x" aria-label="Clear search" onClick={() => reset(() => setQ(''))}><FiX size={15} /></button> : null}
            </label>
            <select className="input bk-select" value={status} onChange={(e) => reset(() => setStatus(e.target.value))} aria-label="Status">
              <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
            <select className="input bk-select" value={paymentStatus} onChange={(e) => reset(() => setPaymentStatus(e.target.value))} aria-label="Payment">
              <option value="">All payments</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s === 'paid' ? 'Paid in full' : humanize(s)}</option>)}
            </select>
            <select className="input bk-select bk-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="created_desc">Newest booked first</option><option value="start_desc">Event date, latest</option><option value="start_asc">Event date, soonest</option>
            </select>
            <button type="button" className={'btn bk-more' + (more || extraCount ? ' on' : '')} onClick={() => setMore((m) => !m)} aria-expanded={more}>
              <FiFilter size={15} /> More filters{extraCount ? <span className="bk-count">{extraCount}</span> : null}
            </button>
          </div>
          {more ? (
            <div className="bk-row bk-extra">
              <div className="bk-field"><span>Car</span>
                <select className="input" value={vehicleId} onChange={(e) => reset(() => setVehicleId(e.target.value))}>
                  <option value="">Any car</option>{(fleet?.items ?? []).map((v) => <option key={v.id} value={v.id}>{v.make} {v.model}</option>)}
                </select></div>
              <div className="bk-field"><span>Event</span>
                <select className="input" value={eventTypeId} onChange={(e) => reset(() => setEventTypeId(e.target.value))}>
                  <option value="">Any event</option>{(ev?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select></div>
              <div className="bk-field bk-dates"><span>Event date</span>
                <div className="bk-range">
                  <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => reset(() => setFrom(e.target.value))} aria-label="From date" />
                  <span className="muted">to</span>
                  <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} aria-label="To date" />
                </div></div>
              <label className={'bk-chip' + (extensionRequests ? ' on' : '')}>
                <input type="checkbox" checked={extensionRequests} onChange={(e) => reset(() => setExtensionRequests(e.target.checked))} /> Extension requests only
              </label>
            </div>
          ) : null}
          {activeCount ? (
            <div className="bk-summary">
              <span className="muted small">{data ? `${data.total} order${data.total === 1 ? '' : 's'} match` : 'Filtering…'}</span>
              <button type="button" className="link-btn small" onClick={clearAll}>Clear all filters</button>
            </div>
          ) : null}
        </div>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiClipboard} title="No bookings match">Try clearing a filter.</Empty> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Reference</th><th>Customer</th><th>Cars</th><th>When</th><th>Status</th><th>Payment</th><th className="num">Total</th><th className="num">Balance</th></tr></thead>
            <tbody>{orders.map((group) => {
              const [first] = group;
              const balance = first.order.balancePence;
              const multi = group.length > 1;
              const sameTime = group.every((b) => b.startAt === first.startAt && b.hours === first.hours);
              const sameStatus = group.every((b) => b.status === first.status);
              const extRequested = group.some((b) => b.extensionRequested), extended = group.some((b) => b.extensions);
              // With several cars, each car line opens that car's booking; clicking elsewhere opens the first one.
              const open = (b: BookingRow) => (e: MouseEvent) => { e.stopPropagation(); go('bookings/' + b.id); };
              return (
                <tr key={first.order.id} className="click" onClick={() => go('bookings/' + first.id)}>
                  <td className="cell-title">{multi ? first.order.ref : first.ref}
                    {multi ? <div className="cell-sub">{group.length} vehicles{first.order.vehicles < group.length ? ` · ${first.order.vehicles} active` : ''}</div> : null}
                    {extRequested ? <Badge status="pending" label="Extension requested" /> : extended ? <div className="cell-sub">Extended</div> : null}</td>
                  <td><div>{first.customer.name}</div><div className="cell-sub">{first.eventType?.title ?? 'No event'}</div></td>
                  <td>{group.map((b) => (
                    <div key={b.id} className={multi ? 'car-line' : undefined} onClick={multi ? open(b) : undefined}>
                      {b.vehicle.name}
                      {!sameTime ? <span className="cell-sub"> · {fmtDateTime(b.startAt)}, {b.hours}h</span> : null}
                      {!sameStatus ? <span> <Badge status={b.status} /></span> : null}
                      {b.driver ? <div className="cell-sub">Driver: {b.driver.name}</div> : null}
                    </div>
                  ))}</td>
                  <td>{sameTime ? <>{fmtDateTime(first.startAt)}<div className="cell-sub">{first.hours}h</div></> : <>{fmtDateTime(group.reduce((m, b) => (b.startAt < m ? b.startAt : m), first.startAt))}<div className="cell-sub">Times vary</div></>}</td>
                  <td>{sameStatus ? <Badge status={first.status} /> : <span className="cell-sub">Varies by car</span>}</td>
                  <td><Badge status={first.paymentStatus} /></td>
                  <td className="num">{gbp(first.order.totalPence)}</td>
                  <td className="num">{balance > 0 ? gbp(balance) : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : null}
        {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      </Panel>
      {creating ? <NewBooking onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); go('bookings/' + id); }} /> : null}
    </>
  );
}
