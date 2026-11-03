export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="row between" style={{ paddingTop: 18 }}>
      <span className="muted small">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div className="row">
        <button className="btn sm" disabled={page <= 1} onClick={() => onChange(offset - limit)}>Previous</button>
        <span className="muted small">Page {page} of {pages}</span>
        <button className="btn sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </div>
  );
}
