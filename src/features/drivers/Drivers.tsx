import { useState } from 'react';
import { FiPlus, FiUsers } from 'react-icons/fi';
import { api, qs, useApi } from '../../lib/api';
import { CheckField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { DeleteDialog, RowActions } from '../../components/RowActions';
import { Badge, Drawer, Empty, Panel, Switch, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { go } from '../../lib/nav';
import { type Side, type LicenceImage, LicenceView, LicencePhotos } from './LicencePhotos';

type Driver = {
  id: string; internal_ref: string | null; full_name: string; phone: string; email: string | null; address: string | null; license_number?: string | null; license_type?: string | null; license_expiry: string | null;
  employment: string; working_hours: { start: string; end: string } | null; notes: string | null; active: boolean; upcomingAssignments: number; licenceImages: number;
};

export default function Drivers() {
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const { data, error, loading, reload } = useApi<{ items: Driver[] }>('/drivers' + qs({ active: tab === 'active' }));
  const [editing, setEditing] = useState<Driver | 'new' | null>(null);
  const [viewing, setViewing] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState<Driver | null>(null);
  const { run, error: actError } = useAction();
  return (
    <>
      <div className="row between wrap">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        <button className="btn gold" onClick={() => setEditing('new')}><FiPlus /> Add driver</button>
      </div>
      <Panel title="Drivers" hint="Assign drivers from a booking. Overlapping jobs are blocked, including travel time.">
        <ErrorBox error={error} retry={reload} /><ErrorBox error={actError} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiUsers} title={tab === 'active' ? 'No active drivers' : 'No inactive drivers'} /> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Driver</th><th>Contact</th><th>Employment</th><th>Hours</th><th className="num">Upcoming jobs</th><th>Licence</th><th>Status</th><th className="actions-cell" /></tr></thead>
            <tbody>{data.items.map((d) => {
              const expiring = d.license_expiry && new Date(d.license_expiry) < new Date(Date.now() + 60 * 86400000);
              return (
                <tr key={d.id} className="click" onClick={() => setViewing(d)}>
                  <td><div className="cell-title">{d.full_name}</div></td>
                  <td>{d.phone}<div className="cell-sub">{d.email}</div></td>
                  <td><Badge status={d.employment} /></td>
                  <td>{d.working_hours ? `${d.working_hours.start}–${d.working_hours.end}` : 'Any time'}</td>
                  <td className="num">{d.upcomingAssignments}</td>
                  <td>{d.license_expiry ? <span className={expiring ? 'badge warn' : ''}>{fmtDate(d.license_expiry)}</span> : <span className="muted">—</span>}
                    <div className="cell-sub">{d.licenceImages === 2 ? 'Photos on file' : d.licenceImages === 1 ? '1 of 2 photos' : 'No photos'}</div></td>
                  <td onClick={(e) => e.stopPropagation()}><Switch text label={`${d.full_name} active`} checked={d.active} onChange={(v) => run(async () => { await api(`/drivers/${d.id}`, { method: 'PATCH', body: { active: v } }); reload(); })} /></td>
                  <td className="actions-cell"><RowActions name={d.full_name} onEdit={() => setEditing(d)} onDelete={() => setDeleting(d)} /></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : null}
      </Panel>
      {deleting ? <DeleteDialog what={deleting.full_name} path={`/drivers/${deleting.id}`} note="Drivers with assignment history cannot be deleted (it is kept as a record). Switch them to Inactive instead." onClose={() => setDeleting(null)} onDone={reload} /> : null}
      {viewing ? <DriverView d={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} /> : null}
      {editing ? <DriverForm d={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </>
  );
}

function DriverView({ d, onClose, onEdit }: { d: Driver; onClose: () => void; onEdit: () => void }) {
  const { data, error, loading } = useApi<{ items: { id: string; bookingId: string; ref: string; status: string; startAt: string; endAt: string; active: boolean; endedReason: string | null }[] }>(`/drivers/${d.id}/assignments`);
  return (
    <Drawer title={d.full_name} onClose={onClose} footer={<button className="btn gold" onClick={onEdit}>Edit driver</button>}>
      <dl className="kv">
        <dt>Phone</dt><dd>{d.phone}</dd><dt>Email</dt><dd>{d.email ?? '—'}</dd><dt>Address</dt><dd>{d.address ?? '—'}</dd><dt>Employment</dt><dd>{d.employment}</dd>
        {'license_number' in d ? <><dt>Licence no.</dt><dd>{d.license_number ?? '—'}</dd><dt>Licence type</dt><dd>{d.license_type ?? '—'}</dd></> : null}
        <dt>Licence expiry</dt><dd>{d.license_expiry ? fmtDate(d.license_expiry) : '—'}</dd>
        <dt>Working hours</dt><dd>{d.working_hours ? `${d.working_hours.start}–${d.working_hours.end}` : 'Any time'}</dd>
        {d.notes ? <><dt>Notes</dt><dd className="pre">{d.notes}</dd></> : null}
      </dl>
      {'license_number' in d ? <LicenceView driverId={d.id} /> : null}
      <h3 className="display" style={{ margin: 0, fontSize: 18 }}>Assignments</h3>
      <ErrorBox error={error} />{loading ? <Loading /> : null}
      {data && !data.items.length ? <span className="muted">No assignments yet.</span> : null}
      <div className="list">{data?.items.map((a) => (
        <div className="list-item" key={a.id}>
          <div style={{ flex: 1 }}><button className="link-btn" onClick={() => go('bookings/' + a.bookingId)}>{a.ref}</button><div className="muted small">{fmtDateTime(a.startAt)}{a.endedReason ? ` · ended: ${a.endedReason}` : ''}</div></div>
          <Badge status={a.active ? a.status : 'inactive'} label={a.active ? undefined : 'Ended'} />
        </div>
      ))}</div>
    </Drawer>
  );
}

function DriverForm({ d, onClose, onSaved }: { d: Driver | null; onClose: () => void; onSaved: () => void }) {
  const canSeeLicence = !d || 'license_number' in d;
  const [fullName, setFullName] = useState(d?.full_name ?? '');
  const [phone, setPhone] = useState(d?.phone ?? '');
  const [email, setEmail] = useState(d?.email ?? '');
  const [address, setAddress] = useState(d?.address ?? '');
  const [licence, setLicence] = useState(d?.license_number ?? '');
  const [licenceType, setLicenceType] = useState(d?.license_type ?? '');
  const [tried, setTried] = useState(false);
  const [expiry, setExpiry] = useState(d?.license_expiry ? d.license_expiry.slice(0, 10) : '');
  const [employment, setEmployment] = useState(d?.employment ?? 'employee');
  const [hours, setHours] = useState(!!d?.working_hours);
  const [start, setStart] = useState(d?.working_hours?.start ?? '08:00');
  const [end, setEnd] = useState(d?.working_hours?.end ?? '20:00');
  const [notes, setNotes] = useState(d?.notes ?? '');
  const [active, setActive] = useState(d?.active ?? true);
  const [pending, setPending] = useState<Partial<Record<Side, File>>>({});
  const [removed, setRemoved] = useState<Side[]>([]);
  const [savedId, setSavedId] = useState<string | null>(d?.id ?? null);
  const { run, busy, error, fieldErrors } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const errors: Record<string, string> = {};
  if (!fullName.trim()) errors.fullName = 'Enter the driver\u2019s name';
  if (phone.trim().length < 5) errors.phone = 'Enter a phone number';
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address';
  if (hours && end <= start) errors.end = 'Must be after the start time';
  const e = (k: string) => fieldErrors[k] ?? (tried ? errors[k] : undefined);
  const expired = !!expiry && expiry < today;
  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const body: Record<string, unknown> = {
      fullName: fullName.trim(), phone: phone.trim(), email: email.trim() || null, address: address.trim() || null, employment,
      workingHours: hours ? { start, end } : null, notes: notes.trim() || null, active,
    };
    if (canSeeLicence) { body.licenseNumber = licence.trim() || null; body.licenseType = licenceType.trim() || null; body.licenseExpiry = expiry || null; }
    const ok = await run(async () => {
      // A new driver is created once; if a photo upload then fails, saving again updates that driver instead of adding another.
      const saved = await api<{ id: string }>(savedId ? `/drivers/${savedId}` : '/drivers', { method: savedId ? 'PATCH' : 'POST', body });
      setSavedId(saved.id);
      if (canSeeLicence) {
        const stored = savedId ? (await api<{ items: LicenceImage[] }>(`/drivers/${saved.id}/licence-images`)).items : [];
        for (const side of removed) {
          const img = stored.find((i) => i.side === side);
          if (img) await api(`/drivers/${saved.id}/licence-images/${img.id}`, { method: 'DELETE' });
        }
        for (const [side, file] of Object.entries(pending) as [Side, File][]) {
          const form = new FormData();
          form.append('file', file);
          await api(`/drivers/${saved.id}/licence-images/${side}`, { form });
        }
      }
      return saved;
    }, 'Driver saved');
    if (ok) onSaved();
  };
  return (
    <Drawer title={d ? `Edit ${d.full_name}` : 'New driver'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy} onClick={save}>{busy ? 'Saving…' : d ? 'Save changes' : 'Add driver'}</button></>}>
      <section className="dr-section">
        <h4>Personal information</h4>
        <TextField label="Full name *" value={fullName} onChange={setFullName} error={e('fullName')} />
        <div className="form-grid">
          <TextField label="Phone *" value={phone} onChange={setPhone} error={e('phone')} />
          <TextField label="Email" type="email" value={email} onChange={setEmail} error={e('email')} />
        </div>
        <TextField label="Address" value={address} onChange={setAddress} multiline />
      </section>
      {canSeeLicence ? (
        <section className="dr-section">
          <h4>Driving licence</h4>
          <div className="form-grid">
            <TextField label="Licence number" value={licence} onChange={(v) => setLicence(v.toUpperCase())} hint="Visible to authorised staff only" />
            <TextField label="Licence type" value={licenceType} onChange={setLicenceType} placeholder="e.g. B, C1" hint="Categories the driver holds" />
            <TextField label="Expiry date" type="date" value={expiry} onChange={setExpiry} />
          </div>
          {expired ? <div className="error-box">This licence expired on {fmtDate(expiry)}. Update the expiry date once the driver has renewed it.</div> : null}
          <LicencePhotos driverId={savedId} pending={pending} setPending={setPending} removed={removed} setRemoved={setRemoved} />
        </section>
      ) : null}
      <section className="dr-section">
        <h4>Work and availability</h4>
        <SelectField label="Employment" value={employment} onChange={setEmployment} options={[{ value: 'employee', label: 'Employee' }, { value: 'contractor', label: 'Contractor' }]} />
        <CheckField label="Only available during set hours" checked={hours} onChange={setHours} />
        {hours ? <div className="form-grid"><TextField label="From" type="time" value={start} onChange={setStart} /><TextField label="Until" type="time" value={end} onChange={setEnd} error={e('end')} /></div> : null}
        <ToggleField label="Driver status" checked={active} onChange={setActive} hint="Inactive drivers cannot be assigned. Reassign upcoming jobs first." />
        <TextField label="Notes" value={notes} onChange={setNotes} multiline />
      </section>
      <ErrorBox error={error} />
    </Drawer>
  );
}
