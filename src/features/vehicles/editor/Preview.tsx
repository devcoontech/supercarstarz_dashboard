import { FiEye } from 'react-icons/fi';
import { Drawer, Empty } from '../../../components/ui';
import { gbp } from '../../../lib/format';
import { type Row } from '../vehicle.types';

export function Preview({ row, events, onClose }: { row: Row; events: { id: string; title: string }[]; onClose: () => void }) {
  const cover = row.images.find((i) => i.isCover) ?? row.images[0];
  return (
    <Drawer title="Customer preview" onClose={onClose}>
      <div className="note">This is how the car appears to customers{row.published ? '.' : ' once published. It is currently hidden.'}</div>
      {cover ? <img src={cover.url} alt="" style={{ width: '100%', borderRadius: 16, aspectRatio: '16/10', objectFit: 'cover' }} /> : <Empty icon={FiEye} title="No cover image" />}
      <div><h3 className="display" style={{ margin: 0, fontSize: 24 }}>{row.make} {row.model}</h3><div className="muted">{row.year} · {row.category} · {row.city}</div></div>
      <div className="display" style={{ fontSize: 26 }}>From {gbp(row.price_per_hour_pence)}<span className="muted small"> / hour</span></div>
      <dl className="kv">
        <dt>Seats</dt><dd>{row.seats}</dd>
        {row.colour ? <><dt>Colour</dt><dd>{row.colour}</dd></> : null}
        {row.transmission ? <><dt>Transmission</dt><dd>{row.transmission}</dd></> : null}
        {row.power ? <><dt>Power</dt><dd>{row.power}</dd></> : null}
        <dt>Duration</dt><dd>{row.min_hours} to {row.max_hours} hours</dd>
        <dt>Events</dt><dd>{events.length ? events.map((e) => e.title).join(', ') : 'None selected'}</dd>
        <dt>Delivery</dt><dd>{row.delivery_available ? 'Yes, priced per booking' : 'No'}</dd>
        <dt>Driver</dt><dd>{[row.self_drive_available ? 'Self-drive' : null, row.chauffeur_available ? `With driver (${gbp(row.chauffeur_fee_pence)})` : null].filter(Boolean).join(' or ')}</dd>
      </dl>
      {row.description ? <p className="dim pre">{row.description}</p> : null}
      {row.amenities?.length ? <div className="row wrap">{row.amenities.map((a: string) => <span className="badge mute" key={a}>{a}</span>)}</div> : null}
    </Drawer>
  );
}
