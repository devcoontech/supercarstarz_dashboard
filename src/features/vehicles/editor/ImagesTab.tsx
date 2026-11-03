import { useRef, useState, type DragEvent } from 'react';
import { FiArrowLeft, FiArrowRight, FiStar, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/hooks';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBox } from '../../../components/feedback';
import { Badge, Empty, Panel } from '../../../components/ui';
import { type Img, type Row } from '../vehicle.types';

export function Images({ row, reload }: { row: Row; reload: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [failed, setFailed] = useState<{ filename: string; reason: string }[]>([]);
  const [delImg, setDelImg] = useState<Img | null>(null);
  const { run, busy, error } = useAction();

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setFailed([]);
    await run(async () => {
      const form = new FormData();
      list.forEach((f) => form.append('file', f));
      const r = await api<{ saved: unknown[]; failed: { filename: string; reason: string }[] }>(`/vehicles/${row.id}/images`, { form });
      setFailed(r.failed);
      reload();
    });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); };
  const move = (i: number, d: number) => {
    const ids = row.images.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(async () => { await api(`/vehicles/${row.id}/images/order`, { method: 'PUT', body: { imageIds: ids } }); reload(); });
  };

  return (
    <Panel title="Images" hint="JPEG, PNG or WebP up to 8 MB. The cover image leads the listing.">
      <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
        <FiUploadCloud size={26} /><div>{busy ? 'Uploading…' : 'Drop images here or click to choose'}</div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files ?? []); e.target.value = ''; }} />
      </div>
      <ErrorBox error={error} />
      {failed.length ? <div className="error-box" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'flex-start' }}>{failed.map((f) => <div key={f.filename}><b>{f.filename}</b>: {f.reason}</div>)}</div> : null}
      {!row.images.length ? <Empty icon={FiUploadCloud} title="No images yet">A published car needs at least one image.</Empty> : (
        <div className="img-grid" style={{ marginTop: 18 }}>
          {row.images.map((im, i) => (
            <div className="img-card" key={im.id}>
              <img src={im.url} alt={`${row.make} ${row.model} photo ${i + 1}`} loading="lazy" />
              {im.isCover ? <span className="cover-tag"><Badge status="published" label="Cover" /></span> : null}
              <div className="bar">
                <button className="btn sm" aria-label="Move earlier" disabled={i === 0 || busy} onClick={() => move(i, -1)}><FiArrowLeft /></button>
                <button className="btn sm" aria-label="Move later" disabled={i === row.images.length - 1 || busy} onClick={() => move(i, 1)}><FiArrowRight /></button>
                {!im.isCover ? <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api(`/vehicles/${row.id}/images/${im.id}/cover`, { method: 'POST' }); reload(); }, 'Cover updated')}><FiStar /> Cover</button> : null}
                <button className="btn sm danger" aria-label="Delete image" disabled={busy} onClick={() => setDelImg(im)}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {delImg ? <ConfirmDialog title="Delete this image?" danger confirmLabel="Delete" message={delImg.isCover ? 'This is the cover image. The next image becomes the cover; with no images left the car is unpublished.' : undefined}
        onConfirm={async () => { await api(`/vehicles/${row.id}/images/${delImg.id}`, { method: 'DELETE' }); reload(); }} onClose={() => setDelImg(null)} /> : null}
    </Panel>
  );
}
