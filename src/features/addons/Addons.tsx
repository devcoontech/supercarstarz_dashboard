import { useRef, useState } from 'react';
import { FiPackage, FiPlus, FiUploadCloud } from 'react-icons/fi';
import { DeleteDialog, RowActions } from '../../components/RowActions';
import { api, useApi } from '../../lib/api';
import { CheckField, MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Drawer, Empty, Panel, Switch } from '../../components/ui';
import { gbp } from '../../lib/format';

export type Addon = {
  id: string; name: string; detail: string | null; pricePence: number; active: boolean; sortOrder: number; imageUrl: string | null;
  pricingType: 'fixed' | 'per_hour' | 'per_unit'; maxQuantity: number; allVehicles: boolean; vehicleIds: string[]; timesBooked: number;
};

const PRICING: { value: Addon['pricingType']; label: string; unit: string }[] = [
  { value: 'fixed', label: 'Fixed price per booking', unit: '' },
  { value: 'per_unit', label: 'Price per item (customer picks a quantity)', unit: ' each' },
  { value: 'per_hour', label: 'Price per hour booked', unit: ' per hour' },
];
export const priceLabel = (a: Pick<Addon, 'pricePence' | 'pricingType'>) => gbp(a.pricePence) + (PRICING.find((p) => p.value === a.pricingType)?.unit ?? '');

/**
 * Optional services customers can add to a booking (photographer, decoration, equipment, anything else).
 * Changing a price here never changes an existing booking: each booking keeps the price agreed when it was made.
 */
export default function Addons() {
  const { data, error, loading, reload } = useApi<{ items: Addon[] }>('/addons');
  const { data: fleet } = useApi<{ items: { id: string; make: string; model: string }[] }>('/vehicles?limit=200');
  const [editing, setEditing] = useState<Addon | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Addon | null>(null);
  const { run, error: actError } = useAction();
  const cars = (fleet?.items ?? []).map((v) => ({ id: v.id, name: `${v.make} ${v.model}` }));
  return (
    <Panel title="Add-ons" hint="Optional services customers can choose when booking. Choose which cars offer each one here or on the car's page."
      action={<button className="btn gold sm" onClick={() => setEditing('new')}><FiPlus /> New add-on</button>}>
      <ErrorBox error={error} retry={reload} /><ErrorBox error={actError} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiPackage} title="No add-ons yet">Create photographers, decorations, equipment or any other service.</Empty> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Add-on</th><th className="num">Price</th><th>Offered on</th><th>Status</th><th className="actions-cell" /></tr></thead>
          <tbody>{data.items.map((a) => (
            <tr key={a.id}>
              <td><div className="row">{a.imageUrl ? <img src={a.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} /> : null}
                <div><div className="cell-title">{a.name}</div><div className="cell-sub">{a.detail}{a.maxQuantity > 1 ? ` · up to ${a.maxQuantity}` : ''}{a.timesBooked ? ` · booked ${a.timesBooked}×` : ''}</div></div></div></td>
              <td className="num">{priceLabel(a)}</td>
              <td>{a.allVehicles ? 'Every car' : a.vehicleIds.length ? `${a.vehicleIds.length} car${a.vehicleIds.length === 1 ? '' : 's'}` : <span className="muted">No cars yet</span>}</td>
              <td><Switch text label={`${a.name} active`} checked={a.active} onChange={(v) => run(async () => { await api(`/addons/${a.id}`, { method: 'PATCH', body: { active: v } }); reload(); })} /></td>
              <td className="actions-cell"><RowActions name={a.name} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {editing ? <AddonForm addon={editing === 'new' ? null : editing} cars={cars} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
      {deleting ? <DeleteDialog what={`"${deleting.name}"`} path={`/addons/${deleting.id}`} note="It is removed from every car. Bookings that already include it keep their price and wording. To hide it for now, switch it off instead." onClose={() => setDeleting(null)} onDone={reload} /> : null}
    </Panel>
  );
}

function AddonForm({ addon, cars, onClose, onSaved }: { addon: Addon | null; cars: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(addon?.name ?? '');
  const [detail, setDetail] = useState(addon?.detail ?? '');
  const [price, setPrice] = useState<number | null>(addon?.pricePence ?? null);
  const [pricingType, setPricingType] = useState<string>(addon?.pricingType ?? 'fixed');
  const [maxQuantity, setMaxQuantity] = useState<number | null>(addon?.maxQuantity ?? 1);
  const [active, setActive] = useState(addon?.active ?? true);
  const [allVehicles, setAllVehicles] = useState(addon?.allVehicles ?? false);
  const [vehicleIds, setVehicleIds] = useState<string[]>(addon?.vehicleIds ?? []);
  const [imageUrl, setImageUrl] = useState(addon?.imageUrl ?? '');
  const file = useRef<HTMLInputElement>(null);
  const { run, busy, error, fieldErrors } = useAction();
  const upload = (f: File) => run(async () => {
    const form = new FormData();
    form.append('file', f);
    setImageUrl((await api<{ url: string }>('/uploads/addons', { form })).url);
  }, 'Image uploaded');
  const save = async () => {
    const body = {
      name: name.trim(), detail: detail.trim() || null, pricePence: price, active, pricingType, maxQuantity: pricingType === 'per_unit' ? maxQuantity ?? 1 : 1,
      allVehicles, vehicleIds: allVehicles ? [] : vehicleIds, imageUrl: imageUrl || null,
    };
    const ok = await run(() => api(addon ? `/addons/${addon.id}` : '/addons', { method: addon ? 'PATCH' : 'POST', body }), 'Add-on saved');
    if (ok) onSaved();
  };
  return (
    <Drawer title={addon ? 'Edit add-on' : 'New add-on'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || !name.trim() || price == null} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <TextField label="Name *" value={name} onChange={setName} error={fieldErrors['name']} placeholder="e.g. Professional photographer" />
      <TextField label="Description" value={detail} onChange={setDetail} multiline />
      <div className="field">
        <label>Image</label>
        <div className="row">
          {imageUrl ? <img src={imageUrl} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }} /> : null}
          <button className="btn sm" onClick={() => file.current?.click()}><FiUploadCloud /> {imageUrl ? 'Replace' : 'Upload'}</button>
          {imageUrl ? <button className="btn sm" onClick={() => setImageUrl('')}>Remove</button> : null}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>
      </div>
      <SelectField label="Pricing" value={pricingType} onChange={setPricingType} options={PRICING.map((p) => ({ value: p.value, label: p.label }))} />
      <div className="form-grid">
        <MoneyField label={pricingType === 'per_hour' ? 'Price per hour *' : pricingType === 'per_unit' ? 'Price per item *' : 'Price *'} value={price} onChange={setPrice} error={fieldErrors['pricePence']} />
        {pricingType === 'per_unit' ? <NumberField label="Most a customer can add" value={maxQuantity} onChange={setMaxQuantity} min={1} max={100} /> : null}
      </div>
      <ToggleField label="Available to customers" checked={active} onChange={setActive} />
      <ToggleField label="Offer on every car" checked={allVehicles} onChange={setAllVehicles} onText="Yes" offText="No" hint="Off: choose the cars below" />
      {!allVehicles ? (
        <div className="field">
          <label>Applicable cars</label>
          {!cars.length ? <span className="muted small">Add cars under Fleet first.</span> : null}
          <div className="form-grid">{cars.map((c) => <CheckField key={c.id} label={c.name} checked={vehicleIds.includes(c.id)} onChange={(on) => setVehicleIds((p) => (on ? [...p, c.id] : p.filter((x) => x !== c.id)))} />)}</div>
        </div>
      ) : null}
      {addon?.timesBooked ? <div className="note small">Booked {addon.timesBooked} times. Those bookings keep the price agreed when they were made.</div> : null}
      <ErrorBox error={error} />
    </Drawer>
  );
}
