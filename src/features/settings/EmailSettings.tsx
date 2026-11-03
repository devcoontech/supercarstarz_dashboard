import { useState } from 'react';
import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { api } from '../../lib/api';
import { NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox } from '../../components/feedback';
import { Badge, Panel } from '../../components/ui';
import { useToast } from '../../components/toast';
import { EMAIL_RE, useSettingsForm, type Payload, type S, type Secrets } from './settingsShared';

const EMAIL_PRESETS: Record<string, { label: string; host: string; port: number; secure: boolean; user?: string; note?: string }> = {
  custom: { label: 'Other / my own server', host: '', port: 587, secure: false },
  google: { label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use an app password, not your normal Google password.' },
  brevo: { label: 'Brevo (Sendinblue)', host: 'smtp-relay.brevo.com', port: 587, secure: false, note: 'Username is your Brevo login email; the password is an SMTP key.' },
  sendgrid: { label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, user: 'apikey', note: 'Username is the word apikey; the password is your API key.' },
  mailgun: { label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, secure: false },
  postmark: { label: 'Postmark', host: 'smtp.postmarkapp.com', port: 587, secure: false, note: 'Username and password are both your server token.' },
  resend: { label: 'Resend', host: 'smtp.resend.com', port: 465, secure: true, user: 'resend', note: 'The password is your API key.' },
  ses: { label: 'Amazon SES', host: 'email-smtp.eu-west-2.amazonaws.com', port: 587, secure: false, note: 'Use your SES SMTP credentials and the region you set SES up in.' },
};

const EMAIL_KEYS = ['email.host', 'email.port', 'email.secure', 'email.user', 'email.fromName', 'email.fromAddress'];

export function EmailSettings({ s, secrets, source, onSaved }: { s: S; secrets: Secrets; source: Payload['mail']['source']; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const toast = useToast();
  const [preset, setPreset] = useState('custom');
  const [password, setPassword] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { run, busy, error } = useAction();
  const pw = secrets['email.password'];
  const host = f.v['email.host'] as string;
  const dirty = f.changed.some((k) => EMAIL_KEYS.includes(k)) || !!password;
  const hostOk = !host || /^[A-Za-z0-9.-]+$/.test(host.trim());
  const fromOk = !(f.v['email.fromAddress'] as string) || EMAIL_RE.test((f.v['email.fromAddress'] as string).trim());
  const port = f.v['email.port'] as number;
  const portOk = Number.isInteger(port) && port >= 1 && port <= 65535;
  const valid = hostOk && fromOk && portOk;

  const applyPreset = (k: string) => {
    setPreset(k);
    if (k === 'custom') return;
    const p = EMAIL_PRESETS[k];
    f.set('email.host', p.host);
    f.set('email.port', p.port);
    f.set('email.secure', p.secure);
    if (p.user) f.set('email.user', p.user);
  };

  const save = () => run(async () => {
    const settings = Object.fromEntries(EMAIL_KEYS.filter((k) => f.changed.includes(k)).map((k) => [k, f.v[k]]));
    await api('/settings', { method: 'PUT', body: { settings, secrets: password ? { emailPassword: password } : undefined } });
    setPassword('');
    setResult(null);
    onSaved();
  }, 'Email settings saved');

  const verify = () => run(async () => {
    setResult(null);
    try {
      await api('/settings/email/verify', { method: 'POST' });
      setResult({ ok: true, text: 'Connected and signed in to the email server.' });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
  });

  const sendTest = () => run(async () => {
    setResult(null);
    try {
      await api('/settings/email/test', { body: { to } });
      setResult({ ok: true, text: `Test email sent to ${to}. Check the inbox (and the spam folder).` });
      toast('Test email sent');
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
  });

  const badge = source === 'dashboard' ? 'Configured (these settings)' : source === 'environment' ? 'Using the server environment' : 'Not set up: emails are not sent';

  return (
    <>
      <Panel title="Email server (SMTP)" hint="Used for password reset codes and booking emails. Any SMTP provider works."
        action={<Badge status={source === 'none' ? 'inactive' : 'active'} label={badge} />}>
        {source === 'environment' ? <div className="note" style={{ marginBottom: 16 }}>Emails currently use the SMTP_URL set on the server. Saving a server here replaces it.</div> : null}
        <div className="form-grid">
          <div className="full"><SelectField label="Quick fill for a provider" value={preset} onChange={applyPreset} options={Object.entries(EMAIL_PRESETS).map(([value, p]) => ({ value, label: p.label }))} hint={EMAIL_PRESETS[preset].note} /></div>
          <TextField label="SMTP server" value={host} onChange={(v) => f.set('email.host', v)} placeholder="smtp.example.com" error={hostOk ? undefined : 'Enter a host name like smtp.example.com'} />
          <NumberField label="Port" value={port} onChange={(v) => f.set('email.port', v ?? 0)} min={1} max={65535} hint="587 for STARTTLS, 465 for TLS" error={portOk ? undefined : 'Between 1 and 65535'} />
          <div className="full"><ToggleField label="Secure connection (TLS from the start)" hint="On for port 465. Off for port 587, which upgrades the connection automatically." checked={f.v['email.secure'] as boolean} onChange={(v) => f.set('email.secure', v)} onText="On" offText="Off" /></div>
          <TextField label="Username" value={f.v['email.user'] as string} onChange={(v) => f.set('email.user', v)} />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder={pw.configured ? `Saved (ends ${pw.hint}). Type to replace.` : ''} hint="Stored encrypted and never shown again" />
          <TextField label="From name" value={f.v['email.fromName'] as string} onChange={(v) => f.set('email.fromName', v)} placeholder="Supercarstars" />
          <TextField label="From address" value={f.v['email.fromAddress'] as string} onChange={(v) => f.set('email.fromAddress', v)} placeholder="bookings@yourdomain.com" error={fromOk ? undefined : 'Enter a valid email address'} hint="Must be allowed by your provider (a verified sender or domain)" />
        </div>
        <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          <button className="btn gold" disabled={busy || !dirty || !valid} onClick={save}>{busy ? 'Working…' : 'Save'}</button>
          <button className="btn" disabled={busy || dirty || source === 'none'} onClick={verify}><FiMail /> Test connection</button>
          {pw.configured ? (
            <button className="btn danger" disabled={busy} onClick={() => run(async () => { await api('/settings', { method: 'PUT', body: { clearSecrets: ['email.password'] } }); onSaved(); }, 'Password removed')}>Remove saved password</button>
          ) : null}
        </div>
        {dirty ? <div className="muted small" style={{ marginTop: 8 }}>Save your changes before testing.</div> : null}
      </Panel>
      <Panel title="Send a test email" hint="Sends a real message through the saved settings.">
        <div className="row wrap" style={{ alignItems: 'end' }}>
          <div style={{ minWidth: 260, flex: 1 }}><TextField label="Send to" type="email" value={to} onChange={setTo} placeholder="you@yourdomain.com" /></div>
          <button className="btn gold" disabled={busy || dirty || source === 'none' || !EMAIL_RE.test(to)} onClick={sendTest}>Send test email</button>
        </div>
        {result ? <div className={result.ok ? 'note' : 'error-box'} style={{ marginTop: 16 }} role="status">{result.ok ? <FiCheckCircle /> : null} {result.text}</div> : null}
      </Panel>
    </>
  );
}
