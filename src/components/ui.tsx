import { useEffect, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import type { IconType } from 'react-icons';

export function Panel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      {title || action ? (
        <div className="panel-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {hint ? <div className="hint">{hint}</div> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  delta,
  trend,
  feature,
}: {
  icon: IconType;
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down';
  feature?: boolean;
}) {
  return (
    <div className={'panel stat' + (feature ? ' feature' : '')}>
      <span className="label">
        <Icon size={16} /> {label}
      </span>
      <span className="value">{value}</span>
      {delta ? <span className={'delta ' + (trend ?? '')}>{delta}</span> : null}
    </div>
  );
}

const tone: Record<string, string> = {
  confirmed: 'good', driver_assigned: 'good', succeeded: 'good', paid: 'good', active: 'good', published: 'good', employee: 'mute', contractor: 'mute',
  completed: 'mute', inactive: 'bad', draft: 'mute', unpaid: 'mute', archived: 'mute',
  pending: 'warn', awaiting_payment: 'warn', partially_paid: 'warn', partially_refunded: 'warn', cancellation_requested: 'warn', maintenance: 'warn',
  in_progress: 'info', refunded: 'info', not_dispatched: 'mute', dispatched: 'info', en_route: 'info', arrived: 'info', service_started: 'info', service_complete: 'good',
  cancelled: 'bad', rejected: 'bad', failed: 'bad', payment_failed: 'bad', canceled: 'bad',
  deposit_paid: 'info', refund_pending: 'warn', void: 'mute',
};

const labels: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  cancellation_requested: 'Cancellation requested',
  paid: 'Paid in full',
  deposit_paid: 'Deposit paid',
  refund_pending: 'Refund pending',
  void: 'Replaced',
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const text = label ?? labels[status] ?? status.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
  return <span className={'badge ' + (tone[status] ?? 'mute')}>{text}</span>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={it.value === value}
          className={it.value === value ? 'active' : ''}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {it.count != null ? <span className="n">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: IconType; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={28} />
      <div className="strong" style={{ color: 'var(--text)', marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/** Green when on, red when off. Pass text to show "Active / Inactive" (or your own words) beside it. */
export function Switch({ checked, onChange, label, text, onText = 'Active', offText = 'Inactive', disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; text?: boolean; onText?: string; offText?: string; disabled?: boolean }) {
  return (
    <label className="switch-wrap">
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="track" />
      </span>
      {text ? <span className={'switch-text ' + (checked ? 'on' : 'off')}>{checked ? onText : offText}</span> : null}
    </label>
  );
}
