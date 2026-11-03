import { useRef, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiBell, FiBriefcase, FiImage, FiMapPin, FiPhone, FiSave, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { SelectField, TextField } from '../../components/forms';
import { ErrorBox } from '../../components/feedback';
import { useSettingsForm, EMAIL_RE, type S } from './settingsShared';

/** Settings > Business details: the company profile printed on receipts and used in customer emails. */

const KEYS = [
  'company.name',
  'company.email', 'company.supportEmail', 'company.supportPhone', 'company.altPhone', 'company.websiteUrl',
  'company.addressLine1', 'company.addressLine2', 'company.city', 'company.region', 'company.postcode', 'company.country',
  'notifications.ownerEmails', 'company.dashboardUrl',
];
const COUNTRIES = ['United Kingdom', 'Ireland', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'United Arab Emirates', 'United States'];
const URL_RE = /^https?:\/\/\S+$/i;

function Card({ icon: Icon, title, hint, children }: { icon: IconType; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="panel bz-card">
      <header className="bz-card-head"><span className="bz-icon"><Icon size={18} /></span><div><h2>{title}</h2><div className="hint">{hint}</div></div></header>
      {children}
    </section>
  );
}

const ADDRESS = ['company.addressLine1', 'company.addressLine2', 'company.city', 'company.region', 'company.postcode', 'company.country'];

/** An address saved before it was split into parts starts out in the street line, so it is not lost. */
const withAddressParts = (s: S): S => (s['company.address'] && !ADDRESS.slice(0, 5).some((k) => String(s[k] ?? '').trim()) ? { ...s, 'company.addressLine1': s['company.address'] } : s);

export function Business({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(withAddressParts(s), onSaved);
  const str = (k: string) => (f.v[k] as string) ?? '';
  const text = (k: string) => (v: string) => f.set(k, v);
  const logo = useRef<HTMLInputElement>(null);
  const logoAction = useAction();

  // Same rules as the server, shown as you type.
  const errors: Record<string, string> = {};
  if (!str('company.name').trim()) errors['company.name'] = 'Enter the business name';
  for (const k of ['company.email', 'company.supportEmail']) if (str(k).trim() && !EMAIL_RE.test(str(k).trim())) errors[k] = 'Enter a valid email address';
  for (const k of ['company.websiteUrl', 'company.dashboardUrl']) if (str(k).trim() && !URL_RE.test(str(k).trim())) errors[k] = 'Start the address with https://';
  if (str('notifications.ownerEmails').trim() && !str('notifications.ownerEmails').split(/[,;\s]+/).filter(Boolean).every((e) => EMAIL_RE.test(e))) errors['notifications.ownerEmails'] = 'Email addresses separated by commas';
  const err = (k: string) => (f.changed.includes(k) || f.error ? errors[k] : undefined);
  const invalid = Object.keys(errors).length > 0;
  const dirty = KEYS.some((k) => f.changed.includes(k));
  const printed = ADDRESS.map(str).map((x) => x.trim()).filter(Boolean).join(', ');
  const logoUrl = str('company.logoUrl');

  const uploadLogo = (file: File | undefined) => {
    if (!file) return;
    logoAction.run(async () => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('The logo must be a JPEG, PNG or WebP image');
      if (file.size > 8 * 1024 * 1024) throw new Error('The logo must be 8 MB or smaller');
      const form = new FormData();
      form.append('file', file);
      await api('/settings/logo', { form });
      onSaved();
    }, logoUrl ? 'Logo replaced' : 'Logo uploaded');
  };
  // Address parts are saved together, so the printed address is always built from all of them.
  const save = () => f.save(KEYS, undefined, ADDRESS.some((k) => f.changed.includes(k)) ? ADDRESS : []);
  const SaveButton = () => (
    <button className="btn gold" disabled={f.busy || !dirty || invalid} onClick={save}><FiSave /> {f.busy ? 'Saving…' : 'Save changes'}</button>
  );

  return (
    <div className="bz">
      <div className="panel bz-head">
        <div className="bz-logo">{logoUrl ? <img src={logoUrl} alt={`${str('company.name')} logo`} /> : <FiImage size={26} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="bz-title">Business details</h2>
          <div className="muted">Manage your business information and company profile. It appears on receipts, statements and customer emails.</div>
        </div>
        <SaveButton />
      </div>

      <div className="bz-grid">
        <Card icon={FiBriefcase} title="Business profile" hint="Who you are, as shown on documents">
          <div className="bz-logo-row">
            <div className="bz-logo lg">{logoUrl ? <img src={logoUrl} alt="" /> : <FiImage size={30} />}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="strong">Business logo</div>
              <div className="muted small">JPEG, PNG or WebP up to 8 MB. Printed on receipts and statements. Saved straight away.</div>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="btn sm" disabled={logoAction.busy} onClick={() => logo.current?.click()}><FiUploadCloud /> {logoAction.busy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}</button>
                {logoUrl ? <button className="btn sm danger" disabled={logoAction.busy} onClick={() => logoAction.run(async () => { await api('/settings/logo', { method: 'DELETE' }); onSaved(); }, 'Logo removed')}><FiTrash2 /> Remove</button> : null}
              </div>
              <input ref={logo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <ErrorBox error={logoAction.error} />
          <div className="form-grid">
            <div className="full"><TextField label="Business name *" value={str('company.name')} onChange={text('company.name')} error={err('company.name')} placeholder="e.g. Supercarstars Ltd" /></div>
          </div>
        </Card>

        <Card icon={FiPhone} title="Contact information" hint="How customers and suppliers reach you">
          <div className="form-grid">
            <TextField label="Business email" type="email" value={str('company.email')} onChange={text('company.email')} error={err('company.email')} placeholder="hello@yourcompany.com" />
            <TextField label="Support email" type="email" value={str('company.supportEmail')} onChange={text('company.supportEmail')} error={err('company.supportEmail')} placeholder="support@yourcompany.com" hint="Shown to customers in emails and on receipts" />
            <TextField label="Contact number" value={str('company.supportPhone')} onChange={text('company.supportPhone')} placeholder="020 0000 0000" hint="Shown to customers" />
            <TextField label="Alternate number" value={str('company.altPhone')} onChange={text('company.altPhone')} placeholder="Optional" />
            <div className="full"><TextField label="Website" value={str('company.websiteUrl')} onChange={text('company.websiteUrl')} error={err('company.websiteUrl')} placeholder="https://yourcompany.com" hint="Linked from the buttons in customer emails" /></div>
          </div>
        </Card>

        <Card icon={FiMapPin} title="Business address" hint="Printed on receipts and statements">
          <div className="form-grid">
            <div className="full"><TextField label="Street address" value={str('company.addressLine1')} onChange={text('company.addressLine1')} placeholder="Building and street" /></div>
            <div className="full"><TextField label="Address line 2" value={str('company.addressLine2')} onChange={text('company.addressLine2')} placeholder="Unit, floor (optional)" /></div>
            <TextField label="City" value={str('company.city')} onChange={text('company.city')} />
            <TextField label="County / state / province" value={str('company.region')} onChange={text('company.region')} />
            <TextField label="Postcode" value={str('company.postcode')} onChange={(v) => f.set('company.postcode', v.toUpperCase())} />
            <SelectField label="Country" value={str('company.country')} onChange={text('company.country')} options={[...new Set([...COUNTRIES, str('company.country')].filter(Boolean))].map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="bz-printed"><span className="muted small">Printed as</span><div>{printed || <span className="muted">No address yet</span>}</div></div>
        </Card>

        <Card icon={FiBell} title="Notifications and links" hint="Where booking alerts go">
          <div className="form-grid">
            <div className="full"><TextField label="Owner notification emails" value={str('notifications.ownerEmails')} onChange={text('notifications.ownerEmails')} error={err('notifications.ownerEmails')} hint="Get new bookings, confirmations and cancellations. Separate several with commas. Blank uses the support email" /></div>
            <div className="full"><TextField label="Dashboard address" value={str('company.dashboardUrl')} onChange={text('company.dashboardUrl')} error={err('company.dashboardUrl')} placeholder="https://admin.yourcompany.com" hint="Adds an Open in dashboard button to owner emails" /></div>
          </div>
        </Card>
      </div>

      <ErrorBox error={f.error} />
      {dirty ? (
        <div className="bz-bar" role="region" aria-label="Unsaved changes">
          <span>You have unsaved changes{invalid ? ': fix the highlighted fields first' : ''}</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" disabled={f.busy} onClick={f.reset}>Discard</button>
            <SaveButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
