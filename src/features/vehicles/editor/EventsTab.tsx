import { useEffect, useState } from 'react';
import { FiStar } from 'react-icons/fi';
import { api } from '../../../lib/api';
import { CheckField } from '../../../components/forms';
import { useAction } from '../../../lib/hooks';
import { ErrorBox } from '../../../components/feedback';
import { Empty, Panel } from '../../../components/ui';
import { type Row } from '../vehicle.types';

export function EventsTab({ row, events, reload }: { row: Row; events: { id: string; title: string }[]; reload: () => void }) {
  const [sel, setSel] = useState<string[]>(row.event_type_ids);
  useEffect(() => setSel(row.event_type_ids), [row.event_type_ids]);
  const { run, busy, error } = useAction();
  return (
    <Panel title="Supported events" hint="Customers only see this car for the events ticked here.">
      {!events.length ? <Empty icon={FiStar} title="No event types yet">Create event types under Events first.</Empty> : (
        <div className="form-grid">
          {events.map((e) => <CheckField key={e.id} label={e.title} checked={sel.includes(e.id)} onChange={(c) => setSel((p) => (c ? [...p, e.id] : p.filter((x) => x !== e.id)))} />)}
        </div>
      )}
      <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
      <div style={{ marginTop: 16 }}><button className="btn gold" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/event-types`, { method: 'PUT', body: { eventTypeIds: sel } }); reload(); }, 'Events saved')}>Save events</button></div>
    </Panel>
  );
}
