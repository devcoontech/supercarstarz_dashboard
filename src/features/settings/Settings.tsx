import { useState } from 'react';
import { useApi } from '../../lib/api';
import { ErrorBox, Loading } from '../../components/feedback';
import { Tabs } from '../../components/ui';
import { type Payload } from './settingsShared';
import { EmailSettings } from './EmailSettings';
import { Business } from './BusinessSettings';
import { TaxSettings } from './TaxSettings';
import { Payments } from './PaymentSettings';
import { Audit } from './AuditLog';

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
