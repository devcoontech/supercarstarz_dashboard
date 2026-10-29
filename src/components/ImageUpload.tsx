import { useRef } from 'react';
import { FiUploadCloud, FiX } from 'react-icons/fi';
import { api } from '../api';
import { ErrorBox, Field, useAction } from './forms';

/** Uploads one image to the API and reports back the stored URL. */
export default function ImageUpload({ kind, value, onChange, label = 'Image' }: { kind: 'events' | 'offers'; value: string; onChange: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { run, busy, error } = useAction();
  const pick = async (file?: File) => {
    if (!file) return;
    const url = await run(async () => {
      const form = new FormData();
      form.append('file', file);
      return (await api<{ url: string }>(`/uploads/${kind}`, { form })).url;
    });
    if (url) onChange(url);
  };
  return (
    <Field label={label} hint="JPEG, PNG or WebP up to 8 MB">
      {value ? (
        <div className="row">
          <img src={value} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line-strong)' }} />
          <button type="button" className="btn sm" onClick={() => onChange('')}><FiX /> Remove</button>
        </div>
      ) : null}
      <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => input.current?.click()}><FiUploadCloud /> {busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <ErrorBox error={error} />
    </Field>
  );
}
