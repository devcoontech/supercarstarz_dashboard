import { useState } from 'react';
import { FiPlus, FiUsers } from 'react-icons/fi';
import { api, qs, useApi } from '../api';
import { ErrorBox, Loading, Pager, TextField, useAction, useDebounced } from '../components/forms';
import { Badge, Drawer, Empty, Panel } from '../components/ui';
import { fmtDate, fmtDateTime, gbp } from '../format';
import { go } from '../nav';
import { RowActions } from '../components/RowActions';

type C = { id: string; name: string; email: string; phone: string | null; createdAt: string; bookings: number; paidPence: number };
type Detail = {
  id: string; name: string; email: string; phone: string | null; createdAt: string; cancellations: number;
  bookings: { id: string; ref: string; status: string; startAt: string; totalPence: number; paidPence: number; cancelReason: string | null; vehicle: string }[];
};

export default function Customers({ openId }: { openId?: string }) {
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ items: C[]; total: number }>('/customers' + qs({ q: dq, limit: 25, offset }));
  return (
    <>
      <Panel title="Customers" hint="Registered customers and their history" action={<button className="btn gold" onClick={() => setAdding(true)}><FiPlus /> Add customer</button>}>
        <div className="filters"><TextField label="Search" value={q} onChange={(v) => { setQ(v); setOffset(0); }} placeholder="Name, email or phone" /></div>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiUsers} title="No customers found" /> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Customer</th><th>Phone</th><th className="num">Bookings</th><th className="num">Paid</th><th>Joined</th><th className="actions-cell" /></tr></thead>
            <tbody>{data.items.map((c) => (
              <tr key={c.id} className="click" onClick={() => go('customers/' + c.id)}>
                <td><div className="cell-title">{c.name}</div><div className="cell-sub">{c.email}</div></td><td>{c.phone ?? '—'}</td>
                <td className="num">{c.bookings}</td><td className="num">{gbp(c.paidPence)}</td><td>{fmtDate(c.createdAt)}</td>
                <td className="actions-cell"><RowActions name={c.name} onEdit={() => go('customers/' + c.id)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : null}
        {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      </Panel>
      {openId ? <CustomerDrawer id={openId} onClose={() => go('customers')} onSaved={reload} /> : null}
      {adding ? <AddCustomer onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); reload(); go('customers/' + id); }} /> : null}
    </>
  );
}

function CustomerDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { data, error, loading, reload } = useApi<Detail>(`/customers/${id}`);
  return (
    <Drawer title={data?.name ?? 'Customer'} onClose={onClose}>
      <ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : null}
      {data ? <Body d={data} onSaved={() => { reload(); onSaved(); }} /> : null}
    </Drawer>
  );
}

function Body({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const [name, setName] = useState(d.name);
  const [phone, setPhone] = useState(d.phone ?? '');
  const { run, busy, error, fieldErrors } = useAction();
  const dirty = name !== d.name || phone !== (d.phone ?? '');
  return (
    <>
      <div className="muted">{d.email} · customer since {fmtDate(d.createdAt)} · {d.cancellations} cancellation{d.cancellations === 1 ? '' : 's'}</div>
      <div className="form-grid">
        <TextField label="Name" value={name} onChange={setName} error={fieldErrors['name']} />
        <TextField label="Phone" value={phone} onChange={setPhone} />
      </div>
      <div className="muted small">To use the app, the customer signs in with <b>{d.email}</b>. If they have never set a password, they tap “Forgot your password?” and we email them a code.</div>
      <ErrorBox error={error} />
      <div><button className="btn gold" disabled={busy || !dirty || !name.trim()} onClick={() => run(async () => {
        await api(`/customers/${d.id}`, { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() || null } });
        onSaved();
      }, 'Customer saved')}>Save changes</button></div>
      <h3 className="display" style={{ margin: '8px 0 0', fontSize: 18 }}>Bookings</h3>
      {!d.bookings.length ? <span className="muted">No bookings yet.</span> : null}
      <div className="list">{d.bookings.map((b) => (
        <div className="list-item" key={b.id}>
          <div style={{ flex: 1 }}><button className="link-btn" onClick={() => go('bookings/' + b.id)}>{b.ref}</button><div className="muted small">{b.vehicle} · {fmtDateTime(b.startAt)} · {gbp(b.paidPence)} of {gbp(b.totalPence)} paid{b.cancelReason ? ` · ${b.cancelReason}` : ''}</div></div>
          <Badge status={b.status} />
        </div>
      ))}</div>
    </>
  );
}

function AddCustomer({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [created, setCreated] = useState<{ id: string; email: string } | null>(null);
  const { run, busy, error, fieldErrors } = useAction();
  const create = async () => {
    const r = await run(() => api<{ customer: { id: string; email: string } }>('/customers', { body: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined } }), 'Customer created');
    if (r) setCreated(r.customer);
  };
  return (
    <Drawer title="Add customer" onClose={() => (created ? onCreated(created.id) : onClose())} footer={created ? <button className="btn gold" onClick={() => onCreated(created.id)}>Done</button> : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || !name.trim() || !email.trim()} onClick={create}>{busy ? 'Creating…' : 'Create'}</button></>}>
      {created ? <div className="note">Customer created. To use the app, they sign in with <b>{created.email}</b>: they tap “Forgot your password?”, we email them a code, and they choose their own password.</div> : (
        <>
          <TextField label="Name *" value={name} onChange={setName} error={fieldErrors['name']} />
          <TextField label="Email *" type="email" value={email} onChange={setEmail} error={fieldErrors['email']} hint="They use this email to sign in to the app later" />
          <TextField label="Phone" value={phone} onChange={setPhone} />
          <ErrorBox error={error} />
        </>
      )}
    </Drawer>
  );
}
