import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCopy } from 'react-icons/fi';
import { API_URL, api, useApi } from '../api';
import { ErrorBox, Loading, MoneyField, NumberField, SelectField, TextField, ToggleField, useAction } from '../components/forms';
import { Badge, Panel, Tabs, useToast } from '../components/ui';
import { fmtDateTime, gbp, humanize } from '../format';
import { useSettingsForm, type Payload, type S } from './settingsShared';
import { EmailSettings } from './SettingsEmailMaps';

export default function Settings() {
  const [tab, setTab] = useState<'business' | 'tax' | 'payments' | 'email' | 'audit'>('business');
  const { data, error, loading, reload } = useApi<Payload>('/settings');
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'business', label: 'Business' }, { value: 'tax', label: 'Tax' }, { value: 'payments', label: 'Payments and Stripe' }, { value: 'email', label: 'Email (SMTP)' }, { value: 'audit', label: 'Audit log' }]} />
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && tab === 'business' ? <Business key={JSON.stringify(data.settings)} s={data.settings} onSaved={reload} /> : null}
      {data && tab === 'tax' ? <TaxSettings key={JSON.stringify(data.settings)} s={data.settings} onSaved={reload} /> : null}
      {data && tab === 'payments' ? <Payments s={data.settings} secrets={data.secrets} onSaved={reload} /> : null}
      {data && tab === 'email' ? <EmailSettings s={data.settings} secrets={data.secrets} source={data.mail.source} onSaved={reload} /> : null}
      {tab === 'audit' ? <Audit /> : null}
    </>
  );
}

function Business({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const n = (k: string) => f.v[k] as number;
  const keys = ['booking.openHour', 'booking.closeHour', 'booking.minLeadHours', 'booking.requireApproval', 'booking.holdMinutes', 'booking.pendingHoldHours', 'booking.maxOpenUnpaidOrders', 'booking.cancellationFreeHours', 'booking.cancellationLateRefundPercent', 'driver.bufferMinutes', 'booking.bufferMinutes', 'booking.maxAdvanceDays', 'booking.maxVehiclesPerOrder', 'booking.allowExtensions', 'delivery.showroomFeePence', 'company.name', 'company.supportEmail', 'company.supportPhone', 'company.address', 'company.vatNumber'];
  const bad = n('booking.closeHour') <= n('booking.openHour') || n('booking.closeHour') > 24 || n('booking.cancellationLateRefundPercent') > 100 || n('booking.maxAdvanceDays') < 1 || n('booking.bufferMinutes') > 1440;
  return (
    <>
      <Panel title="Booking rules" hint={`Times are in ${s['booking.timezone']}.`}>
        <div className="form-grid">
          <NumberField label="First start hour" value={n('booking.openHour')} onChange={(v) => f.set('booking.openHour', v ?? 0)} min={0} max={23} />
          <NumberField label="Everything must finish by (hour)" value={n('booking.closeHour')} onChange={(v) => f.set('booking.closeHour', v ?? 0)} min={1} max={24} error={n('booking.closeHour') <= n('booking.openHour') ? 'Must be after the first start hour' : undefined} />
          <NumberField label="Minimum notice (hours)" value={n('booking.minLeadHours')} onChange={(v) => f.set('booking.minLeadHours', v ?? 0)} min={0} />
          <NumberField label="Unpaid hold (minutes)" value={n('booking.holdMinutes')} onChange={(v) => f.set('booking.holdMinutes', v ?? 0)} min={1} hint="How long a car is held while the customer pays" />
          <NumberField label="Unapproved request hold (hours)" value={n('booking.pendingHoldHours')} onChange={(v) => f.set('booking.pendingHoldHours', v ?? 0)} min={0} hint="An unpaid request you have not approved is cancelled after this long, freeing the car. 0 keeps it until you act" />
          <NumberField label="Open unpaid requests per customer" value={n('booking.maxOpenUnpaidOrders')} onChange={(v) => f.set('booking.maxOpenUnpaidOrders', v ?? 0)} min={0} hint="Stops one account from holding many cars without paying. 0 = no limit" />
          <NumberField label="Free cancellation up to (hours before)" value={n('booking.cancellationFreeHours')} onChange={(v) => f.set('booking.cancellationFreeHours', v ?? 0)} min={0} />
          <NumberField label="Refund after that (%)" value={n('booking.cancellationLateRefundPercent')} onChange={(v) => f.set('booking.cancellationLateRefundPercent', v ?? 0)} min={0} max={100} />
          <NumberField label="Driver travel buffer (minutes)" value={n('driver.bufferMinutes')} onChange={(v) => f.set('driver.bufferMinutes', v ?? 0)} min={0} hint="Kept free either side of a driver's job" />
          <NumberField label="Car preparation buffer (minutes)" value={n('booking.bufferMinutes')} onChange={(v) => f.set('booking.bufferMinutes', v ?? 0)} min={0} max={1440} hint="Kept free before and after every booking for cleaning and handover. Not charged." />
          <NumberField label="Book up to (days ahead)" value={n('booking.maxAdvanceDays')} onChange={(v) => f.set('booking.maxAdvanceDays', v ?? 1)} min={1} max={1095} hint="Bookings always start today or later" />
          <NumberField label="Vehicles per booking (max)" value={n('booking.maxVehiclesPerOrder')} onChange={(v) => f.set('booking.maxVehiclesPerOrder', v ?? 1)} min={1} max={20} hint="How many cars a customer can book together" />
          <div className="full"><ToggleField label="Customers can extend bookings in the app" checked={f.v['booking.allowExtensions'] as boolean} onChange={(c) => f.set('booking.allowExtensions', c)} onText="On" offText="Off" hint="Only when the car is free afterwards. Otherwise they can ask you, and you approve or decline." /></div>
          <div className="full"><ToggleField label="Require approval for new bookings" checked={f.v['booking.requireApproval'] as boolean} onChange={(c) => f.set('booking.requireApproval', c)} onText="On" offText="Off" hint="On: bookings start as Pending until you approve. Off: they go straight to payment." /></div>
        </div>
      </Panel>
      <Panel title="Delivery and collection" hint="Delivery is priced per booking: staff work out the charge and add it on the booking page, and the customer is emailed the new total.">
        <div className="form-grid">
          <MoneyField label="Showroom collection fee" value={n('delivery.showroomFeePence')} onChange={(v) => f.set('delivery.showroomFeePence', v ?? 0)} hint="Leave at 0 to keep collection free" />
        </div>
      </Panel>
      <Panel title="Company" hint="Shown on receipts and invoices.">
        <div className="form-grid">
          <TextField label="Company name" value={f.v['company.name'] as string} onChange={(v) => f.set('company.name', v)} />
          <TextField label="Support email" value={f.v['company.supportEmail'] as string} onChange={(v) => f.set('company.supportEmail', v)} />
          <TextField label="Support phone" value={f.v['company.supportPhone'] as string} onChange={(v) => f.set('company.supportPhone', v)} />
          <TextField label="VAT number" value={f.v['company.vatNumber'] as string} onChange={(v) => f.set('company.vatNumber', v)} />
          <div className="full"><TextField label="Business address" value={f.v['company.address'] as string} onChange={(v) => f.set('company.address', v)} /></div>
        </div>
      </Panel>
      <ErrorBox error={f.error} />
      <div><button className="btn gold" disabled={f.busy || !f.changed.length || bad} onClick={() => f.save(keys)}>{f.busy ? 'Saving…' : 'Save settings'}</button></div>
    </>
  );
}

const PRESETS = [500, 1000, 1500, 2000];

/** Tax added to bookings. Each booking keeps the rate it was made with, so changes here never alter earlier bookings or receipts. */
function TaxSettings({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const rateBp = f.v['tax.rateBp'] as number;
  const enabled = f.v['tax.enabled'] as boolean;
  const [custom, setCustom] = useState(!PRESETS.includes(rateBp));
  const pct = rateBp / 100;
  const badRate = !Number.isFinite(rateBp) || rateBp < 0 || rateBp > 10000;
  const label = (f.v['tax.label'] as string) || 'VAT';
  // A worked example with the settings as they stand, using the same order as the server.
  const sub = 2000000, disc = 200000;
  const taxable = f.v['tax.policy'] === 'before_discount' ? sub : sub - disc;
  const tax = enabled ? Math.floor((taxable * rateBp + 5000) / 10000) : 0;
  return (
    <>
      <Panel title="Tax" hint="Worked out on the server for every quote, booking, extension and receipt.">
        <div className="form-grid">
          <div className="full"><ToggleField label="Add tax to bookings" checked={enabled} onChange={(c) => f.set('tax.enabled', c)} onText="On" offText="Off" hint="Off: prices already include any tax, or you are not registered" /></div>
          <TextField label="Tax name" value={label} onChange={(v) => f.set('tax.label', v)} hint="Shown to customers, e.g. VAT" error={!label.trim() ? 'Required' : undefined} />
          <SelectField label="Rate" value={custom ? 'custom' : String(rateBp)} onChange={(v) => { if (v === 'custom') setCustom(true); else { setCustom(false); f.set('tax.rateBp', Number(v)); } }}
            options={[...PRESETS.map((p) => ({ value: String(p), label: `${p / 100}%` })), { value: 'custom', label: 'Custom rate' }]} />
          {custom ? <NumberField label="Custom rate (%)" value={pct} onChange={(v) => f.set('tax.rateBp', Math.round((v ?? 0) * 100))} min={0} max={100} error={badRate ? 'Between 0% and 100%' : undefined} /> : null}
          <SelectField label="Apply tax" value={f.v['tax.policy'] as string} onChange={(v) => f.set('tax.policy', v)}
            options={[{ value: 'after_discount', label: 'After discounts (on the discounted amount)' }, { value: 'before_discount', label: 'Before discounts (on the full rental subtotal)' }]} />
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          Example: rental subtotal £20,000.00, discount £2,000.00, taxable amount {gbp(taxable)}, {label} at {enabled ? `${pct}%` : '0% (off)'} = {gbp(tax)}, total {gbp(sub - disc + tax)}.
          <div className="muted small">Existing bookings keep the tax rate they were made with.</div>
        </div>
        <ErrorBox error={f.error} />
        <div style={{ marginTop: 16 }}><button className="btn gold" disabled={f.busy || !f.changed.length || badRate || !label.trim()} onClick={() => f.save(['tax.enabled', 'tax.rateBp', 'tax.policy', 'tax.label'])}>{f.busy ? 'Saving…' : 'Save tax settings'}</button></div>
      </Panel>
    </>
  );
}

function Payments({ s, secrets, onSaved }: { s: S; secrets: Payload['secrets']; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const toast = useToast();
  const [secretKey, setSecretKey] = useState('');
  const [whsec, setWhsec] = useState('');
  const [test, setTest] = useState<{ liveMode: boolean; currencies: string[] } | null>(null);
  const { run, busy, error } = useAction();
  const fee = (f.v['pricing.serviceFeeBp'] as number) / 100;
  const dep = (f.v['payment.depositPercentBp'] as number) / 100;
  const webhook = `${API_URL}/api/webhooks/stripe`;
  const sk = secrets['stripe.secretKey'], wh = secrets['stripe.webhookSecret'];
  useEffect(() => setTest(null), [sk.hint]);

  const saveAll = () => run(async () => {
    const settings = Object.fromEntries(['pricing.serviceFeeBp', 'payment.mode', 'payment.depositPercentBp', 'stripe.publishableKey'].filter((k) => f.changed.includes(k)).map((k) => [k, f.v[k]]));
    const sec: Record<string, string> = {};
    if (secretKey.trim()) sec.stripeSecretKey = secretKey.trim();
    if (whsec.trim()) sec.stripeWebhookSecret = whsec.trim();
    await api('/settings', { method: 'PUT', body: { settings, secrets: sec } });
    setSecretKey(''); setWhsec('');
    onSaved();
  }, 'Payment settings saved');

  return (
    <>
      <Panel title="Charges and payment" hint="Percentages are applied on the server when a booking is priced.">
        <div className="form-grid">
          <NumberField label="Service fee (%)" value={fee} onChange={(v) => f.set('pricing.serviceFeeBp', Math.round((v ?? 0) * 100))} min={0} max={100} hint="Added to the customer total" />
          <SelectField label="Customer pays" value={f.v['payment.mode'] as string} onChange={(v) => f.set('payment.mode', v)} options={[{ value: 'full', label: 'Full amount upfront' }, { value: 'deposit', label: 'A deposit upfront' }]} />
          <NumberField label="Default deposit (%)" value={dep} onChange={(v) => f.set('payment.depositPercentBp', Math.round((v ?? 0) * 100))} min={0} max={100} hint="Used when a car has no fixed deposit" />
        </div>
      </Panel>

      <Panel title="Stripe" hint="Keys are stored encrypted and are never shown again after saving."
        action={<Badge status={sk.configured ? 'active' : 'inactive'} label={sk.configured ? 'Secret key set' : 'Not connected'} />}>
        <div className="form-grid">
          <div className="full"><TextField label="Publishable key" value={f.v['stripe.publishableKey'] as string} onChange={(v) => f.set('stripe.publishableKey', v.trim())} placeholder="pk_test_…" hint="Public by design. The customer app uses it to show the card form." error={(f.v['stripe.publishableKey'] as string) && !/^pk_(test|live)_/.test(f.v['stripe.publishableKey'] as string) ? 'Must start with pk_test_ or pk_live_' : undefined} /></div>
          <TextField label="Secret key" type="password" value={secretKey} onChange={setSecretKey} placeholder={sk.configured ? `Saved (ends ${sk.hint}). Enter a new key to replace.` : 'sk_test_… or rk_test_…'} hint="Use a test-mode key until you go live" />
          <TextField label="Webhook signing secret" type="password" value={whsec} onChange={setWhsec} placeholder={wh.configured ? `Saved (ends ${wh.hint}). Enter a new secret to replace.` : 'whsec_…'} />
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <div>In the Stripe dashboard add a webhook endpoint pointing to:</div>
          <div className="row" style={{ marginTop: 6 }}><code style={{ wordBreak: 'break-all' }}>{webhook}</code>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(webhook).then(() => toast('Copied'), () => toast('Copy failed')); }}><FiCopy /> Copy</button></div>
          <div className="muted small" style={{ marginTop: 6 }}>Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, refund.created, refund.updated. Stripe cannot reach localhost; use the Stripe CLI (stripe listen) for local testing.</div>
        </div>
        <ErrorBox error={error} /><ErrorBox error={f.error} />
        {test ? <div className="note" style={{ marginTop: 12 }}><FiCheckCircle /> Connected to Stripe in <b>{test.liveMode ? 'LIVE' : 'test'}</b> mode. Balance currencies: {test.currencies.join(', ') || 'none'}.</div> : null}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn gold" disabled={busy || f.busy || (!f.changed.length && !secretKey.trim() && !whsec.trim())} onClick={saveAll}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn" disabled={busy || !sk.configured || !!secretKey.trim()} onClick={() => run(async () => setTest(await api('/settings/stripe/test', { method: 'POST' })))}>Test connection</button>
        </div>
      </Panel>
    </>
  );
}

function Audit() {
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
