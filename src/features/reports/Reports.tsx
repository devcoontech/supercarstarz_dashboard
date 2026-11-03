import { useState } from 'react';
import { FiBarChart2, FiDownload } from 'react-icons/fi';
import { api, downloadCsv, qs, useApi } from '../../lib/api';
import { TextField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Empty, Panel, Tabs } from '../../components/ui';
import { addDays, fmtDateTime, gbp, humanize, ymd } from '../../lib/format';

const REPORTS = [
  { value: 'bookings-by-event', label: 'By event', hint: 'Bookings and booking value per event type' },
  { value: 'bookings-by-vehicle', label: 'By car', hint: 'Bookings and value per car (excludes cancelled)' },
  { value: 'payments-collected', label: 'Payments collected', hint: 'Succeeded payments per day and source' },
  { value: 'outstanding-balances', label: 'Outstanding', hint: 'Live bookings in the period with an unpaid balance' },
  { value: 'refunds', label: 'Refunds', hint: 'Refunds issued in the period' },
  { value: 'cancellations', label: 'Cancellations', hint: 'Cancelled, rejected and requested cancellations' },
  { value: 'popular-events', label: 'Popular events', hint: 'Confirmed and completed bookings per event' },
  { value: 'offers', label: 'Offers', hint: 'Uses and discount given in the period' },
  { value: 'driver-workload', label: 'Driver workload', hint: 'Active assignments and hours for bookings in the period' },
] as const;

const cell = (k: string, v: unknown) => {
  if (v == null) return '—';
  if (k.endsWith('Pence')) return gbp(v as number);
  if (/At$/.test(k) && typeof v === 'string') return fmtDateTime(v);
  if (k === 'status' || k === 'source') return humanize(String(v));
  return String(v);
};

export default function Reports() {
  const [name, setName] = useState<(typeof REPORTS)[number]['value']>('bookings-by-event');
  const [from, setFrom] = useState(ymd(addDays(new Date(), -29)));
  const [to, setTo] = useState(ymd(new Date()));
  const { data, error, loading, reload } = useApi<{ rows: Record<string, unknown>[] }>(from && to ? `/reports/${name}` + qs({ from, to }) : null);
  const { run, busy, error: expErr } = useAction();
  const def = REPORTS.find((r) => r.value === name)!;
  const cols = data?.rows[0] ? Object.keys(data.rows[0]) : [];

  return (
    <>
      <Tabs value={name} onChange={setName} items={REPORTS.map((r) => ({ value: r.value, label: r.label }))} />
      <Panel title={def.label} hint={def.hint} action={<button className="btn sm" disabled={busy || !data?.rows.length} onClick={() => run(async () => { const r = await api<{ csv: string }>(`/reports/${name}` + qs({ from, to, format: 'csv' })); downloadCsv(`${name}-${from}-to-${to}.csv`, r.csv); }, 'Export ready')}><FiDownload /> Export CSV</button>}>
        <div className="filters">
          <TextField label="From" type="date" value={from} onChange={setFrom} />
          <TextField label="To" type="date" value={to} onChange={setTo} />
        </div>
        <ErrorBox error={error} retry={reload} /><ErrorBox error={expErr} />
        {loading && !data ? <Loading /> : null}
        {data && !data.rows.length ? <Empty icon={FiBarChart2} title="No data for this period" /> : null}
        {data?.rows.length ? (
          <div className="table-wrap"><table>
            <thead><tr>{cols.map((c) => <th key={c} className={/Pence$|^(bookings|payments|uses|assignments|hours)$/.test(c) ? 'num' : ''}>{humanize(c.replace(/([A-Z])/g, ' $1').replace(/ Pence$/, '')).replace(/ at$/i, '')}</th>)}</tr></thead>
            <tbody>{data.rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={/Pence$|^(bookings|payments|uses|assignments|hours)$/.test(c) ? 'num' : ''}>{cell(c, r[c])}</td>)}</tr>)}</tbody>
          </table></div>
        ) : null}
      </Panel>
    </>
  );
}
