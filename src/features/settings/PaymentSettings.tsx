import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCopy } from 'react-icons/fi';
import { API_URL, api } from '../../lib/api';
import { NumberField, SelectField, TextField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox } from '../../components/feedback';
import { Badge, Panel } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useSettingsForm, type Payload, type S } from './settingsShared';

export function Payments({ s, secrets, onSaved }: { s: S; secrets: Payload['secrets']; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const toast = useToast();
  const [secretKey, setSecretKey] = useState('');
  const [whsec, setWhsec] = useState('');
  const [test, setTest] = useState<{ liveMode: boolean; currencies: string[] } | null>(null);
  const { run, busy, error } = useAction();
  const dep = (f.v['payment.depositPercentBp'] as number) / 100;
  const webhook = `${API_URL}/api/webhooks/stripe`;
  const sk = secrets['stripe.secretKey'], wh = secrets['stripe.webhookSecret'];
  useEffect(() => setTest(null), [sk.hint]);

  const saveAll = () => run(async () => {
    const settings = Object.fromEntries(['payment.mode', 'payment.depositPercentBp', 'stripe.publishableKey'].filter((k) => f.changed.includes(k)).map((k) => [k, f.v[k]]));
    const sec: Record<string, string> = {};
    if (secretKey.trim()) sec.stripeSecretKey = secretKey.trim();
    if (whsec.trim()) sec.stripeWebhookSecret = whsec.trim();
    await api('/settings', { method: 'PUT', body: { settings, secrets: sec } });
    setSecretKey(''); setWhsec('');
    onSaved();
  }, 'Payment settings saved');

  return (
    <>
      <Panel title="Charges and payment" hint="No service fee is charged. Tax is only added when it is switched on under Tax.">
        <div className="form-grid">
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
