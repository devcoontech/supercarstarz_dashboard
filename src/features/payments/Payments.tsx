import { useState } from 'react';
import { FiCreditCard, FiDownload } from 'react-icons/fi';
import { api, downloadCsv, openDocument, qs, useApi } from '../../lib/api';
import { MoneyField, SelectField, TextField } from '../../components/forms';
import { useAction, useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Empty, Panel } from '../../components/ui';
import { useToast } from '../../components/toast';
import { fmtDateTime, gbp, humanize } from '../../lib/format';
import { go } from '../../lib/nav';

type P = {
  id: string; bookingRef: string; bookingId: string; customer: string; amountPence: number; method: string; source: string; purpose: string; status: string;
  providerRef: string | null; manualReference: string | null; recordedBy: string | null; reconciledAt: string | null; createdAt: string; refundedPence: number;
  paidAt: string | null; verified: boolean; receiptId: string | null; receiptNumber: string | null;
};

export default function Payments() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const query = { q: dq, status, source, from, to: to ? new Date(new Date(to + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10) : '' };
  const { data, error, loading, reload } = useApi<{ items: P[]; total: number }>('/payments' + qs({ ...query, limit: 25, offset }));
  const [refunding, setRefunding] = useState<P | null>(null);
  const { run, busy, error: actError } = useAction();
  const toast = useToast();
  const reset = (fn: () => void) => { fn(); setOffset(0); };

  const exportCsv = () => run(async () => {
    const r = await api<{ csv: string }>('/payments' + qs({ ...query, format: 'csv' }));
    downloadCsv('payments.csv', r.csv);
  }, 'Export ready');

  const reconcile = (p: P) => run(async () => {
    const r = await api<{ matches: boolean; repaired: boolean; gatewayStatus: string; ledgerStatus: string }>(`/payments/${p.id}/reconcile`, { method: 'POST' });
    toast(r.repaired ? 'Payment confirmed by Stripe and recorded' : r.matches ? 'Matches Stripe' : `Mismatch: ledger ${r.ledgerStatus}, Stripe ${r.gatewayStatus}`);
    reload();
  });

  return (
    <>
      <Panel title="Payments" hint="All booking payments and manual receipts. Record manual payments from the booking page." action={<button className="btn sm" disabled={busy} onClick={exportCsv}><FiDownload /> Export CSV</button>}>
        <div className="filters">
          <TextField label="Search" value={q} onChange={(v) => reset(() => setQ(v))} placeholder="Booking ref, Stripe ID, customer" />
          <SelectField label="Status" value={status} onChange={(v) => reset(() => setStatus(v))} options={[{ value: '', label: 'All' }, ...['pending', 'succeeded', 'failed', 'canceled'].map((s) => ({ value: s, label: humanize(s) }))]} />
          <SelectField label="Source" value={source} onChange={(v) => reset(() => setSource(v))} options={[{ value: '', label: 'All' }, { value: 'stripe', label: 'Stripe' }, { value: 'manual', label: 'Manual' }]} />
          <TextField label="From" type="date" value={from} onChange={(v) => reset(() => setFrom(v))} />
          <TextField label="To" type="date" value={to} onChange={(v) => reset(() => setTo(v))} />
        </div>
        <ErrorBox error={error} retry={reload} /><ErrorBox error={actError} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiCreditCard} title="No payments match" /> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th>Method</th><th>Status</th><th className="num">Amount</th><th className="num">Refunded</th><th>Reconciled</th><th /></tr></thead>
            <tbody>{data.items.map((p) => (
              <tr key={p.id}>
                <td>{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                <td><button className="link-btn" onClick={() => go('bookings/' + p.bookingId)}>{p.bookingRef}</button></td>
                <td>{p.customer}</td>
                <td>{p.source === 'stripe' ? <>Card online {p.verified ? <Badge status="succeeded" label="Verified" /> : null}</> : <>{p.method === 'card_terminal' ? 'Card' : humanize(p.method)} <Badge status="draft" label="Recorded by staff" /></>}<div className="cell-sub">{p.source === 'stripe' ? p.providerRef : `${p.manualReference ?? ''} · ${p.recordedBy}`}</div></td>
                <td><Badge status={p.status} /></td>
                <td className="num">{gbp(p.amountPence)}</td>
                <td className="num">{p.refundedPence ? gbp(p.refundedPence) : '—'}</td>
                <td>{p.source === 'manual' ? <span className="muted">n/a</span> : p.reconciledAt ? <Badge status="succeeded" label="Yes" /> : <span className="muted">No</span>}</td>
                <td className="num"><div className="row" style={{ justifyContent: 'flex-end' }}>
                  {p.receiptId ? <button className="btn sm" title={p.receiptNumber ?? ''} disabled={busy} onClick={() => run(() => openDocument(`/invoices/${p.receiptId}/document`))}>Receipt</button> : null}
                  {p.source === 'stripe' ? <button className="btn sm" disabled={busy} onClick={() => reconcile(p)}>Check with Stripe</button> : null}
                  {p.status === 'succeeded' && p.amountPence - p.refundedPence > 0 ? <button className="btn sm" onClick={() => setRefunding(p)}>Refund</button> : null}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : null}
        {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      </Panel>
      {refunding ? <RefundDialog p={refunding} onClose={() => setRefunding(null)} onDone={reload} /> : null}
    </>
  );
}

function RefundDialog({ p, onClose, onDone }: { p: P; onClose: () => void; onDone: () => void }) {
  const max = p.amountPence - p.refundedPence;
  const [amount, setAmount] = useState<number | null>(max);
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title={`Refund ${p.bookingRef}`} danger confirmLabel="Issue refund" onClose={onClose}
      message={`Up to ${gbp(max)}. ${p.source === 'stripe' ? 'The refund is sent to Stripe.' : 'This records a manual refund; return the money yourself.'}`}
      extra={<><MoneyField label="Amount" value={amount} onChange={setAmount} /><TextField label="Reason *" value={reason} onChange={setReason} multiline /></>}
      onConfirm={async () => {
        if (!amount || !reason.trim()) throw new Error('Enter an amount and a reason.');
        await api(`/payments/${p.id}/refund`, { body: { amountPence: amount, reason } });
        onDone();
      }} />
  );
}
