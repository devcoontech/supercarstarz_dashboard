import { useState } from 'react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/hooks';
import { ErrorBox } from '../../../components/feedback';
import { Panel } from '../../../components/ui';
import { type Row } from '../vehicle.types';
import { vehicleBody, vehicleErrors, vehicleFromRow, type VehicleForm } from '../vehicleForm';
import { AvailabilityFields, BasicsFields, PricingFields, SpecsFields } from '../VehicleFields';

/** Edit an existing vehicle: the same fields as the add-vehicle wizard, in sections on one page. */
export function Details({ row, onSaved }: { row: Row; onSaved: (r: Row) => void }) {
  const [f, setF] = useState<VehicleForm>(() => vehicleFromRow(row));
  const set = <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const [tried, setTried] = useState(false);
  const { run, busy, error, fieldErrors } = useAction();
  const errors = vehicleErrors(f);
  const all = { ...errors.basics, ...errors.specs, ...errors.pricing, ...errors.availability };
  const err = (group: Record<string, string>) => ({ ...fieldErrors, ...(tried ? group : {}) });

  const save = async () => {
    setTried(true);
    if (Object.keys(all).length) return;
    const saved = await run(() => api<Row>(`/vehicles/${row.id}`, { method: 'PATCH', body: vehicleBody(f) }), 'Vehicle saved');
    if (saved) onSaved(saved);
  };

  return (
    <>
      <Panel title="Basic information"><BasicsFields f={f} set={set} err={err(errors.basics)} /></Panel>
      <Panel title="Specifications"><SpecsFields f={f} set={set} err={err(errors.specs)} /></Panel>
      <Panel title="Standard price" hint="Packages, event rates, per-mile and special-date prices are on the Pricing tab"><PricingFields f={f} set={set} err={err(errors.pricing)} /></Panel>
      <Panel title="Availability and location"><AvailabilityFields f={f} set={set} err={err(errors.availability)} /></Panel>
      <ErrorBox error={error} />
      <div className="row">
        <button className="btn gold" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        {tried && Object.keys(all).length ? <span className="field-error">Fix the highlighted fields</span> : null}
      </div>
    </>
  );
}
