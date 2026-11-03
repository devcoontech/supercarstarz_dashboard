import { FiAlertTriangle, FiLoader } from 'react-icons/fi';

/** Loading and error states for pages and panels. */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="empty" role="status"><FiLoader className="spin" size={26} /><div>{label}…</div></div>;
}

export function ErrorBox({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <FiAlertTriangle size={18} />
      <div style={{ flex: 1 }}>{error.message}</div>
      {retry ? <button className="btn sm" onClick={retry}>Try again</button> : null}
    </div>
  );
}
