import { useEffect, useState } from 'react';
import { FiStar } from 'react-icons/fi';
import { api, useApi } from '../../../lib/api';
import { CheckField } from '../../../components/forms';
import { useAction } from '../../../lib/hooks';
import { ErrorBox } from '../../../components/feedback';
import { Empty, Panel } from '../../../components/ui';
import { gbp } from '../../../lib/format';
import { go } from '../../../lib/nav';
import { type Row } from '../vehicle.types';

type AddonOpt = { id: string; name: string; detail: string | null; pricePence: number; pricingType: 'fixed' | 'per_hour' | 'per_unit'; active: boolean; allVehicles: boolean };

/** Which add-ons customers can choose for this car. Add-ons offered on every car are always included. */
export function AddonsTab({ row, reload }: { row: Row; reload: () => void }) {
  const { data } = useApi<{ items: AddonOpt[] }>('/addons');
  const [sel, setSel] = useState<string[]>(row.addon_ids ?? []);
  useEffect(() => setSel(row.addon_ids ?? []), [row.addon_ids]);
  const { run, busy, error } = useAction();
  const items = data?.items ?? [];
  const unit = (a: AddonOpt) => gbp(a.pricePence) + (a.pricingType === 'per_hour' ? '/h' : a.pricingType === 'per_unit' ? ' each' : '');
  return (
    <Panel title="Available add-ons" hint="Customers booking this car only see the add-ons ticked here (and only while they are switched on)."
      action={<button className="btn sm" onClick={() => go('addons')}>Manage add-ons</button>}>
      {data && !items.length ? <Empty icon={FiStar} title="No add-ons yet">Create them under Add-ons first.</Empty> : null}
      <div className="form-grid">
        {items.map((a) => a.allVehicles
          ? <CheckField key={a.id} label={`${a.name} (${unit(a)}) · every car`} checked onChange={() => {}} hint={a.active ? 'Offered on every car; change this under Add-ons' : 'Switched off'} />
          : <CheckField key={a.id} label={`${a.name} (${unit(a)})`} checked={sel.includes(a.id)} onChange={(c) => setSel((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} hint={a.active ? undefined : 'Switched off: not shown to customers'} />)}
      </div>
      <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
      <div style={{ marginTop: 16 }}><button className="btn gold" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/addons`, { method: 'PUT', body: { addonIds: sel } }); reload(); }, 'Add-ons saved')}>Save add-ons</button></div>
    </Panel>
  );
}
