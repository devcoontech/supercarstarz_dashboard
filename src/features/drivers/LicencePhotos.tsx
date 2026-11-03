import { useEffect, useRef, useState } from 'react';
import { FiCreditCard, FiUploadCloud } from 'react-icons/fi';
import { fetchBlobUrl, useApi } from '../../lib/api';
import { ErrorBox } from '../../components/feedback';
import { fmtDate } from '../../lib/format';

/** Driving licence photos (front and back): viewing, uploading and removing them. */

export type Side = 'front' | 'back';

export type LicenceImage = { id: string; side: Side; createdAt: string; uploadedBy: string | null };

const SIDES: { side: Side; label: string }[] = [{ side: 'front', label: 'Front' }, { side: 'back', label: 'Back' }];

/** Loads a licence photo through the authenticated API (the files are private) and frees it when unmounted. */
function useImageUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    let live = true, made: string | null = null;
    setFailed(false);
    fetchBlobUrl(path).then((u) => { made = u; if (live) setUrl(u); else URL.revokeObjectURL(u); }, () => live && setFailed(true));
    return () => { live = false; if (made) URL.revokeObjectURL(made); setUrl(null); };
  }, [path]);
  return { url, failed };
}

function LicenceThumb({ src, label, onOpen }: { src: string | null; label: string; onOpen?: () => void }) {
  return (
    <button type="button" className="btn" onClick={onOpen} disabled={!src || !onOpen} aria-label={`Open ${label}`}
      style={{ padding: 0, width: '100%', aspectRatio: '1.586', overflow: 'hidden', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="muted small"><FiCreditCard /> No photo</span>}
    </button>
  );
}

function StoredLicence({ driverId, image, label }: { driverId: string; image: LicenceImage; label: string }) {
  const { url, failed } = useImageUrl(`/drivers/${driverId}/licence-images/${image.id}`);
  return failed ? <div className="muted small">Could not load the {label.toLowerCase()} photo.</div> : <LicenceThumb src={url} label={label} onOpen={url ? () => window.open(url, '_blank') : undefined} />;
}

export function LicenceView({ driverId }: { driverId: string }) {
  const { data, error } = useApi<{ items: LicenceImage[] }>(`/drivers/${driverId}/licence-images`);
  return (
    <div className="field">
      <label>Driving licence photos</label>
      <ErrorBox error={error} />
      {data ? (
        <div className="form-grid">{SIDES.map(({ side, label }) => {
          const img = data.items.find((i) => i.side === side);
          return <div key={side}><div className="muted small" style={{ marginBottom: 6 }}>{label}{img ? ` · added ${fmtDate(img.createdAt)}${img.uploadedBy ? ` by ${img.uploadedBy}` : ''}` : ''}</div>
            {img ? <StoredLicence driverId={driverId} image={img} label={`${label} of licence`} /> : <LicenceThumb src={null} label={label} />}</div>;
        })}</div>
      ) : null}
    </div>
  );
}

/** Front and back photo pickers. Changes are kept here and sent when the driver is saved, so it works for new drivers too. */
export function LicencePhotos({ driverId, pending, setPending, removed, setRemoved }: {
  driverId: string | null; pending: Partial<Record<Side, File>>; setPending: (p: Partial<Record<Side, File>>) => void;
  removed: Side[]; setRemoved: (r: Side[]) => void;
}) {
  const { data } = useApi<{ items: LicenceImage[] }>(driverId ? `/drivers/${driverId}/licence-images` : null);
  const inputs = { front: useRef<HTMLInputElement>(null), back: useRef<HTMLInputElement>(null) };
  const [previews, setPreviews] = useState<Partial<Record<Side, string>>>({});
  useEffect(() => {
    const made = Object.fromEntries(Object.entries(pending).map(([k, f]) => [k, URL.createObjectURL(f as File)]));
    setPreviews(made);
    return () => Object.values(made).forEach((u) => URL.revokeObjectURL(u as string));
  }, [pending]);
  const pick = (side: Side, f: File | undefined) => {
    if (!f) return;
    setPending({ ...pending, [side]: f });
    setRemoved(removed.filter((s) => s !== side));
  };
  return (
    <div className="field">
      <label>Driving licence photos</label>
      <div className="form-grid">{SIDES.map(({ side, label }) => {
        const stored = data?.items.find((i) => i.side === side);
        const showStored = stored && !pending[side] && !removed.includes(side);
        return (
          <div key={side} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="muted small">{label}{pending[side] ? ' · new photo, saved with the driver' : removed.includes(side) ? ' · will be removed' : ''}</span>
            {pending[side] ? <LicenceThumb src={previews[side] ?? null} label={label} /> : showStored ? <StoredLicence driverId={driverId!} image={stored} label={`${label} of licence`} /> : <LicenceThumb src={null} label={label} />}
            <div className="row">
              <button type="button" className="btn sm" onClick={() => inputs[side].current?.click()}><FiUploadCloud /> {showStored || pending[side] ? 'Replace' : 'Upload'}</button>
              {pending[side] ? <button type="button" className="btn sm" onClick={() => { const { [side]: _, ...rest } = pending; setPending(rest); }}>Undo</button> : null}
              {showStored ? <button type="button" className="btn sm danger" onClick={() => setRemoved([...removed, side])}>Remove</button> : null}
              {stored && removed.includes(side) ? <button type="button" className="btn sm" onClick={() => setRemoved(removed.filter((s) => s !== side))}>Keep</button> : null}
            </div>
            <input ref={inputs[side]} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(side, e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        );
      })}</div>
      <span className="muted small">JPEG, PNG or WebP up to 8 MB. Kept private: only staff allowed to see licence details can view them.</span>
    </div>
  );
}
