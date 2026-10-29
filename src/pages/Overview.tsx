import { useMemo, useState } from 'react';
import { FiActivity, FiAlertCircle, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiDollarSign, FiRotateCcw, FiTruck, FiUserX } from 'react-icons/fi';
import { qs, useApi } from '../api';
import { ColumnChart, HBars } from '../components/charts';
import { ErrorBox, Field, Loading } from '../components/forms';
import { Badge, Empty, Panel, Stat } from '../components/ui';
import { addDays, fmtDateTime, gbp, ymd } from '../format';
import { go } from '../nav';

type Dash = {
  range: { from: string; to: string; timezone: string };
  money: { grossBookingValuePence: number; collectedPence: number; refundedPence: number; netCollectedPence: number; outstandingPence: number };
  fleet: { total: number; active: number; inactive: number; published: number; availableNow: number };
  bookings: { pending: number; confirmed: number; ongoing: number; completed: number; cancelled: number };
  attention: { driverAssignmentsNeeded: number };
  upcoming: { id: string; ref: string; startAt: string; status: string; vehicle: string; customer: string }[];
  perDay: { day: string; bookings: number; collectedPence: number }[];
  utilization: { id: string; name: string; bookedHours: number; percent: number }[];
};

export default function Overview() {
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = useMemo(() => {
    if (preset === 'custom') return { from, to };
    const today = new Date();
    return { from: ymd(addDays(today, -(Number(preset) - 1))), to: ymd(today) };
  }, [preset, from, to]);
  const { data, error, loading, reload } = useApi<Dash>(range.from && range.to ? '/dashboard' + qs(range) : null);

  const label = (i: number, n: number, day: string) => (n <= 14 || i % Math.ceil(n / 10) === 0 ? day.slice(8) + '/' + day.slice(5, 7) : '');

  return (
    <>
      <div className="filters">
        <Field label="Period">
          <select className="input" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </Field>
        {preset === 'custom' ? (
          <>
            <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        ) : null}
        {data ? <span className="muted small">{data.range.from} to {data.range.to} ({data.range.timezone})</span> : null}
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <div className="grid g-4">
            <Stat feature icon={FiDollarSign} label="Collected" value={gbp(data.money.collectedPence)} delta="Payments received in period" />
            <Stat icon={FiRotateCcw} label="Refunded" value={gbp(data.money.refundedPence)} delta={`Net collected ${gbp(data.money.netCollectedPence)}`} />
            <Stat icon={FiCreditCard} label="Booking value" value={gbp(data.money.grossBookingValuePence)} delta="Live bookings starting in period" />
            <Stat icon={FiAlertCircle} label="Outstanding" value={gbp(data.money.outstandingPence)} delta="Unpaid on live bookings, all time" trend={data.money.outstandingPence ? 'down' : undefined} />
          </div>
          <div className="grid g-4">
            <Stat icon={FiClock} label="Pending requests" value={String(data.bookings.pending)} delta="Awaiting your decision" />
            <Stat icon={FiCheckCircle} label="Confirmed" value={String(data.bookings.confirmed)} delta={`${data.bookings.ongoing} in progress · ${data.bookings.completed} completed`} />
            <Stat icon={FiTruck} label="Available now" value={`${data.fleet.availableNow} / ${data.fleet.active}`} delta={`${data.fleet.total} cars · ${data.fleet.inactive} out of service · ${data.fleet.published} published`} />
            <Stat icon={FiUserX} label="Need a driver" value={String(data.attention.driverAssignmentsNeeded)} delta="Chauffeur bookings in next 7 days" trend={data.attention.driverAssignmentsNeeded ? 'down' : undefined} />
          </div>
          <div className="grid g-main">
            <Panel title="Bookings per day" hint={`${data.bookings.cancelled} cancelled or rejected in period`}>
              <ColumnChart
                data={data.perDay.map((d, i) => ({ label: label(i, data.perDay.length, d.day), tip: `${d.day} · ${gbp(d.collectedPence)} collected`, value: d.bookings }))}
                format={(n) => String(Math.round(n))} highlightLast={false}
              />
            </Panel>
            <Panel title="Fleet utilisation" hint="Booked hours as a share of opening hours">
              {data.utilization.length ? <HBars data={data.utilization.map((u) => ({ label: u.name, value: u.percent }))} format={(n) => n + '%'} /> : <Empty icon={FiActivity} title="No active cars" />}
            </Panel>
          </div>
          <Panel title="Next 7 days" hint="Upcoming and pending bookings">
            {data.upcoming.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Reference</th><th>When</th><th>Car</th><th>Customer</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.upcoming.map((b) => (
                      <tr key={b.id} className="click" onClick={() => go('bookings/' + b.id)}>
                        <td className="cell-title">{b.ref}</td><td>{fmtDateTime(b.startAt)}</td><td>{b.vehicle}</td><td>{b.customer}</td><td><Badge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={FiCalendar} title="Nothing scheduled in the next 7 days" />}
          </Panel>
        </>
      ) : null}
    </>
  );
}
