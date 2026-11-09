import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { api, qs, useApi } from '../../lib/api';
import AvailabilityCalendar from './AvailabilityCalendar';
import { SelectField } from '../../components/forms';
import { ErrorBox, Loading } from '../../components/feedback';
import { Empty, Panel } from '../../components/ui';
import { addDays, londonIso, ymd } from '../../lib/format';

type Cal = { bookings: { startAt: string; endAt: string }[]; blocks: { startAt: string; endAt: string }[] };
type Veh = { id: string; make: string; model: string; operational_status: string };

const monday = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));

export default function CalendarPage() {
  const { data: fleet, error, loading } = useApi<{ items: Veh[] }>('/vehicles?limit=200');
  const [vehicleId, setVehicleId] = useState('all');
  const cars = fleet?.items ?? [];

  return (
    <>
      <div className="filters">
        <SelectField label="Car" value={vehicleId} onChange={setVehicleId} options={[{ value: 'all', label: 'All cars (week overview)' }, ...cars.map((v) => ({ value: v.id, label: `${v.make} ${v.model}` }))]} />
      </div>
      <ErrorBox error={error} />
      {loading && !fleet ? <Loading /> : null}
      {fleet && !cars.length ? <Panel><Empty icon={FiChevronRight} title="No cars yet">Add a vehicle first.</Empty></Panel> : null}
      {fleet && cars.length && vehicleId === 'all' ? <Overview cars={cars} onPick={setVehicleId} /> : null}
      {fleet && vehicleId !== 'all' ? <Panel title={(() => { const v = cars.find((c) => c.id === vehicleId); return v ? `${v.make} ${v.model}` : 'Car'; })()}><AvailabilityCalendar key={vehicleId} vehicleId={vehicleId} /></Panel> : null}
    </>
  );
}

function Overview({ cars, onPick }: { cars: Veh[]; onPick: (id: string) => void }) {
  const [anchor, setAnchor] = useState(() => ymd(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => ymd(addDays(monday(new Date(anchor + 'T12:00:00Z')), i))), [anchor]);
  const [cals, setCals] = useState<Record<string, Cal> | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    setCals(null);
    const from = londonIso(days[0], 0), to = londonIso(ymd(addDays(new Date(days[6] + 'T12:00:00Z'), 1)), 0);
    Promise.all(cars.map((c) => api<Cal>(`/vehicles/${c.id}/calendar` + qs({ from, to })).then((r) => [c.id, r] as const)))
      .then((rows) => live && setCals(Object.fromEntries(rows)))
      .catch((e) => live && setErr(e));
    return () => { live = false; };
  }, [days, cars]);

  const count = (cal: Cal, day: string) => {
    const a = new Date(londonIso(day, 0)).getTime(), b = new Date(londonIso(ymd(addDays(new Date(day + 'T12:00:00Z'), 1)), 0)).getTime();
    const hit = (x: { startAt: string; endAt: string }) => new Date(x.startAt).getTime() < b && new Date(x.endAt).getTime() > a;
    return { bookings: cal.bookings.filter(hit).length, blocks: cal.blocks.filter(hit).length };
  };

  return (
    <Panel title="Fleet this week" hint="Bookings and blocked time per car. Click a cell to open that car."
      action={<div className="row">
        <button className="icon-btn" style={{ width: 38, height: 38 }} aria-label="Previous week" onClick={() => setAnchor(ymd(addDays(new Date(anchor + 'T12:00:00Z'), -7)))}><FiChevronLeft /></button>
        <button className="btn sm" onClick={() => setAnchor(ymd(new Date()))}>This week</button>
        <button className="icon-btn" style={{ width: 38, height: 38 }} aria-label="Next week" onClick={() => setAnchor(ymd(addDays(new Date(anchor + 'T12:00:00Z'), 7)))}><FiChevronRight /></button>
      </div>}>
      <ErrorBox error={err} />
      {!cals && !err ? <Loading /> : null}
      {cals ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Car</th>{days.map((d) => <th key={d} className="num">{new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}</th>)}</tr></thead>
          <tbody>{cars.map((c) => (
            <tr key={c.id}>
              <td><div className="cell-title">{c.make} {c.model}</div>{c.operational_status !== 'active' ? <div className="cell-sub">{c.operational_status}</div> : null}</td>
              {days.map((d) => {
                const n = count(cals[c.id], d);
                return <td key={d} className="num"><button className="link-btn" onClick={() => onPick(c.id)} aria-label={`${c.make} ${c.model} on ${d}`}>
                  {n.bookings ? <span className="badge warn">{n.bookings}</span> : null}{n.blocks ? <span className="badge mute" style={{ marginLeft: 4 }}>blocked</span> : null}{!n.bookings && !n.blocks ? <span className="muted">available</span> : null}
                </button></td>;
              })}
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
    </Panel>
  );
}
