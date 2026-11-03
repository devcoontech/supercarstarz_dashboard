import { useState } from 'react';
import { FiPlus, FiTruck } from 'react-icons/fi';
import { qs, useApi } from '../../lib/api';
import { SelectField, TextField } from '../../components/forms';
import { useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Empty, Panel } from '../../components/ui';
import { gbp } from '../../lib/format';
import { go } from '../../lib/nav';
import { DeleteDialog, RowActions } from '../../components/RowActions';

export type VehicleRow = {
  id: string; fleet_ref: string | null; make: string; model: string; year: number; category: string; city: string; price_per_hour_pence: number;
  operational_status: string; published: boolean; images: { id: string; url: string; isCover: boolean }[];
};

export default function Vehicles() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [published, setPublished] = useState('');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const [deleting, setDeleting] = useState<VehicleRow | null>(null);
  const { data, error, loading, reload } = useApi<{ items: VehicleRow[]; total: number }>('/vehicles' + qs({ q: dq, status, published, limit: 25, offset }));

  return (
    <Panel title="Fleet" hint="Every car the company offers" action={<button className="btn gold" onClick={() => go('vehicles/new')}><FiPlus /> Add vehicle</button>}>
      <div className="filters">
        <TextField label="Search" value={q} onChange={(v) => { setQ(v); setOffset(0); }} placeholder="Make, model or fleet ID" />
        <SelectField label="Status" value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'maintenance', label: 'Maintenance' }]} />
        <SelectField label="Listing" value={published} onChange={(v) => { setPublished(v); setOffset(0); }} options={[{ value: '', label: 'All' }, { value: 'true', label: 'Published' }, { value: 'false', label: 'Unpublished' }]} />
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiTruck} title="No vehicles found">Add your first vehicle to start taking bookings.</Empty> : null}
      {data?.items.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Car</th><th>Fleet ID</th><th>City</th><th className="num">Base rate</th><th>Status</th><th>Listing</th><th className="actions-cell" /></tr></thead>
            <tbody>
              {data.items.map((v) => {
                const img = v.images.find((i) => i.isCover) ?? v.images[0];
                return (
                  <tr key={v.id} className="click" onClick={() => go('vehicles/' + v.id)}>
                    <td>
                      <div className="row">
                        <div className="car-thumb" style={img ? { backgroundImage: `url(${img.url})`, backgroundSize: 'cover' } : undefined} />
                        <div><div className="cell-title">{v.make} {v.model}</div><div className="cell-sub">{v.year} · {v.category}</div></div>
                      </div>
                    </td>
                    <td className="dim">{v.fleet_ref ?? '—'}</td>
                    <td>{v.city}</td>
                    <td className="num">{gbp(v.price_per_hour_pence)}/h</td>
                    <td><Badge status={v.operational_status} /></td>
                    <td><Badge status={v.published ? 'published' : 'draft'} label={v.published ? 'Published' : 'Not published'} /></td>
                    <td className="actions-cell"><RowActions name={`${v.make} ${v.model}`} onEdit={() => go('vehicles/' + v.id)} onDelete={() => setDeleting(v)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      {deleting ? <DeleteDialog what={`${deleting.make} ${deleting.model}`} path={`/vehicles/${deleting.id}`} note="It is removed from the fleet and the public site. Past bookings keep their history. Refused while upcoming bookings exist." onClose={() => setDeleting(null)} onDone={reload} /> : null}
    </Panel>
  );
}
