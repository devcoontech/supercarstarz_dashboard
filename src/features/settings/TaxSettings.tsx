import { useState } from 'react';
import { NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { ErrorBox } from '../../components/feedback';
import { Panel } from '../../components/ui';
import { gbp } from '../../lib/format';
import { useSettingsForm, type S } from './settingsShared';

const PRESETS = [500, 1000, 1500, 2000];

/** Tax added to bookings. Each booking keeps the rate it was made with, so changes here never alter earlier bookings or receipts. */
export function TaxSettings({ s, onSaved }: { s: S; onSaved: () => void }) {
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
