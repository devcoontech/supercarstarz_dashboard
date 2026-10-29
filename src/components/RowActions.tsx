import { useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { api } from '../api';
import { ConfirmDialog } from './forms';

/** Edit and delete icons stacked vertically. Used on every list so they behave the same everywhere. */
export function RowActions({ onEdit, onDelete, name, editLabel, deleteLabel }: { onEdit?: () => void; onDelete?: () => void; name: string; editLabel?: string; deleteLabel?: string }) {
  return (
    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
      {onEdit ? (
        <button className="icon-btn" aria-label={editLabel ?? `Edit ${name}`} title={editLabel ?? 'Edit'} onClick={onEdit}><FiEdit2 size={15} /></button>
      ) : null}
      {onDelete ? (
        <button className="icon-btn danger" aria-label={deleteLabel ?? `Delete ${name}`} title={deleteLabel ?? 'Delete'} onClick={onDelete}><FiTrash2 size={15} /></button>
      ) : null}
    </div>
  );
}

/** Confirms, then calls DELETE. The server's reason is shown if it refuses (e.g. "used on bookings, turn it off instead"). */
export function DeleteDialog({ what, path, note, onClose, onDone }: { what: string; path: string; note?: string; onClose: () => void; onDone: () => void }) {
  return (
    <ConfirmDialog title={`Delete ${what}?`} danger confirmLabel="Delete" onClose={onClose}
      message={note ?? 'This cannot be undone. Existing bookings are not changed.'}
      onConfirm={async () => { await api(path, { method: 'DELETE' }); onDone(); }} />
  );
}

/** Small helper so a page can keep "which row is being deleted" in one place. */
export function useDeleteTarget<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, ask: setTarget, close: () => setTarget(null) };
}
