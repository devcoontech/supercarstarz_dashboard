import { useState } from 'react';
import { FiArrowLeft, FiEye } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import AvailabilityCalendar from '../calendar/AvailabilityCalendar';
import { VehiclePrices } from './editor/Prices';
import VehicleWizard from './wizard/VehicleWizard';
import { useAction } from '../../lib/hooks';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Panel, Tabs } from '../../components/ui';
import { gbp } from '../../lib/format';
import { go } from '../../lib/nav';
import { type Row } from './vehicle.types';
import { Details } from './editor/DetailsTab';
import { Images } from './editor/ImagesTab';
import { EventsTab } from './editor/EventsTab';
import { AddonsTab } from './editor/AddonsTab';
import { History } from './editor/History';
import { Preview } from './editor/Preview';

export default function VehicleEditor({ id }: { id: string }) {
  return id === 'new' ? <VehicleWizard /> : <ExistingVehicle id={id} />;
}

function ExistingVehicle({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<Row>(`/vehicles/${id}`);
  const [tab, setTab] = useState<'details' | 'images' | 'events' | 'addons' | 'pricing' | 'availability' | 'history'>('details');
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, busy, error: actError, setError } = useAction();
  const { data: ev } = useApi<{ items: { id: string; title: string; archived_at: string | null }[] }>('/event-types');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;

  const setPublished = (published: boolean) => run(async () => { await api(`/vehicles/${id}/publish`, { method: 'POST', body: { published } }); reload(); }, published ? 'Vehicle published' : 'Vehicle unpublished');

  return (
    <>
      <div className="row between wrap">
        <div className="row">
          <button className="btn sm" onClick={() => go('vehicles')}><FiArrowLeft /> Fleet</button>
          {data ? <><h2 className="display" style={{ margin: 0, fontSize: 24 }}>{data.make} {data.model}</h2><Badge status={data.operational_status} /><Badge status={data.published ? 'published' : 'draft'} label={data.published ? 'Published' : 'Not published'} /></> : null}
        </div>
        {data ? (
          <div className="row wrap">
            <button className="btn sm" onClick={() => setPreview(true)}><FiEye /> Preview</button>
            <button className="btn sm" disabled={busy} onClick={() => setPublished(!data.published)}>{data.published ? 'Unpublish' : 'Publish'}</button>
            <button className="btn sm danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        ) : null}
      </div>
      <ErrorBox error={actError} />

      <Tabs value={tab} onChange={(t) => { setError(null); setTab(t); }} items={[
        { value: 'details', label: 'Details' }, { value: 'pricing', label: 'Pricing' }, { value: 'images', label: 'Images', count: data?.images.length },
        { value: 'events', label: 'Events' }, { value: 'addons', label: 'Add-ons' }, { value: 'availability', label: 'Availability' }, { value: 'history', label: 'Bookings' },
      ]} />

      {tab === 'details' && data ? <Details key={data.id + ':' + data.updated_at} row={data} onSaved={() => reload()} /> : null}
      {tab === 'images' && data ? <Images row={data} reload={reload} /> : null}
      {tab === 'events' && data ? <EventsTab row={data} events={(ev?.items ?? []).filter((e) => !e.archived_at)} reload={reload} /> : null}
      {tab === 'addons' && data ? <AddonsTab row={data} reload={reload} /> : null}
      {tab === 'pricing' && data ? (
        <Panel title="Pricing" hint={`Standard price ${gbp(data.price_per_hour_pence)} per hour, ${data.min_hours} to ${data.max_hours} hours (change it on the Details tab). Add other price types below.`}>
          <VehiclePrices vehicleId={id} events={(ev?.items ?? []).filter((e) => !e.archived_at).map((e) => ({ id: e.id, name: e.title }))} />
        </Panel>
      ) : null}
      {tab === 'availability' && data ? <Panel title="Availability"><AvailabilityCalendar vehicleId={id} /></Panel> : null}
      {tab === 'history' && data ? <History id={id} /> : null}

      {preview && data ? <Preview row={data} events={(ev?.items ?? []).filter((e) => data.event_type_ids.includes(e.id))} onClose={() => setPreview(false)} /> : null}
      {confirmDelete && data ? (
        <ConfirmDialog title="Delete this vehicle?" danger confirmLabel="Delete vehicle"
          message="It is removed from the fleet and the public site. Past bookings keep their history. This is refused while upcoming bookings exist."
          onConfirm={async () => { await api(`/vehicles/${id}`, { method: 'DELETE' }); go('vehicles'); }} onClose={() => setConfirmDelete(false)} />
      ) : null}
    </>
  );
}
