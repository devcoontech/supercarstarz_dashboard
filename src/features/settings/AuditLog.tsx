import { useApi } from '../../lib/api';
import { ErrorBox, Loading } from '../../components/feedback';
import { Panel } from '../../components/ui';
import { fmtDateTime, humanize } from '../../lib/format';

export function Audit() {
  const { data, error, loading } = useApi<{ items: { id: number; entity: string; entityId: string | null; action: string; staff: string | null; createdAt: string; after: unknown }[] }>('/audit-log?limit=200');
  return (
    <Panel title="Audit log" hint="Administrative changes. Secret values are never recorded.">
      <ErrorBox error={error} />{loading && !data ? <Loading /> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr></thead>
          <tbody>{data.items.map((a) => <tr key={a.id}><td>{fmtDateTime(a.createdAt)}</td><td>{a.staff ?? 'System'}</td><td>{humanize(a.entity)} · {humanize(a.action)}</td><td className="cell-sub">{a.entityId?.slice(0, 8) ?? ''}</td></tr>)}</tbody>
        </table></div>
      ) : null}
    </Panel>
  );
}
