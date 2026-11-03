import { FiStar } from 'react-icons/fi';
import { useApi } from '../../../lib/api';
import { ErrorBox, Loading } from '../../../components/feedback';
import { Badge, Empty, Panel } from '../../../components/ui';
import { fmtDateTime, gbp } from '../../../lib/format';
import { go } from '../../../lib/nav';

export function History({ id }: { id: string }) {
  const { data, error, loading } = useApi<{ items: { id: string; ref: string; status: string; startAt: string; endAt: string; totalPence: number; customer: string }[] }>(`/vehicles/${id}/bookings`);
  return (
    <Panel title="Booking history">
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiStar} title="No bookings for this car yet" /> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Reference</th><th>When</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
          <tbody>{data.items.map((b) => <tr key={b.id} className="click" onClick={() => go('bookings/' + b.id)}><td className="cell-title">{b.ref}</td><td>{fmtDateTime(b.startAt)}</td><td>{b.customer}</td><td><Badge status={b.status} /></td><td className="num">{gbp(b.totalPence)}</td></tr>)}</tbody>
        </table></div>
      ) : null}
    </Panel>
  );
}
