import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBell, FiX } from 'react-icons/fi';
import { api } from '../../lib/api';
import { fmtDateTime, gbp } from '../../lib/format';
import { go } from '../../lib/nav';
import type { BookingRow } from '../bookings/Bookings';

/**
 * Watches for new customer bookings while the dashboard is open.
 * Each new order shows a pop-up card on the page, a browser notification (once allowed),
 * and stays in the bell list in the top bar until read.
 */

type Row = BookingRow & { createdAt: string; source: string };
type Alert = { orderId: string; bookingId: string; ref: string; customer: string; cars: string[]; startAt: string; totalPence: number; createdAt: string; read: boolean };

export const NEW_BOOKINGS_EVENT = 'scs:new-bookings';
const POLL_MS = 20_000;
const POPUP_MS = 12_000;
const SEEN_KEY = 'scs_bookings_seen_at';
const LIST_KEY = 'scs_booking_alerts';
const ASKED_KEY = 'scs_alerts_asked';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const hasBrowserAlerts = () => typeof window !== 'undefined' && 'Notification' in window;
const permission = () => (hasBrowserAlerts() ? Notification.permission : 'denied');

/** One alert per order; the order's first booking is the one opened. */
function toAlerts(rows: Row[]): Alert[] {
  const byOrder = new Map<string, Row[]>();
  for (const r of rows) byOrder.set(r.order.id, [...(byOrder.get(r.order.id) ?? []), r]);
  return [...byOrder.values()].map((g) => {
    const first = g.reduce((a, b) => (Date.parse(b.createdAt) < Date.parse(a.createdAt) ? b : a));
    return {
      orderId: first.order.id, bookingId: first.id, ref: g.length > 1 ? first.order.ref : first.ref, customer: first.customer.name,
      cars: g.map((b) => b.vehicle.name), startAt: first.startAt, totalPence: first.order.totalPence, createdAt: first.createdAt, read: false,
    };
  });
}

function browserNotify(a: Alert) {
  if (permission() !== 'granted') return;
  try {
    const n = new Notification(`New booking ${a.ref}`, {
      body: `${a.customer} · ${a.cars.join(', ')}\n${fmtDateTime(a.startAt)} · ${gbp(a.totalPence)}`,
      tag: 'booking-' + a.orderId, // several open tabs show it once
      icon: '/favicon.png',
    });
    n.onclick = () => { window.focus(); go('bookings/' + a.bookingId); n.close(); };
  } catch { /* some browsers only allow notifications from a service worker */ }
}

function useBookingAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(() => { try { return JSON.parse(store.get(LIST_KEY) ?? '[]'); } catch { return []; } });
  const [popups, setPopups] = useState<Alert[]>([]);
  const seenAt = useRef<number | null>(Number(store.get(SEEN_KEY)) || null);

  useEffect(() => store.set(LIST_KEY, JSON.stringify(alerts.slice(0, 20))), [alerts]);

  useEffect(() => {
    let stopped = false;
    let first = true;
    const check = async () => {
      try {
        const { items } = await api<{ items: Row[] }>('/bookings?sort=created_desc&limit=25');
        if (stopped || !items.length) return;
        const since = seenAt.current;
        seenAt.current = Math.max(since ?? 0, ...items.map((r) => Date.parse(r.createdAt)));
        store.set(SEEN_KEY, String(seenAt.current));
        if (since == null) return; // very first run on this browser: start counting from now
        // Bookings made by staff in this dashboard don't need an alert.
        const fresh = toAlerts(items.filter((r) => Date.parse(r.createdAt) > since && r.source !== 'admin'));
        if (!fresh.length) return;
        setAlerts((list) => [...fresh.filter((f) => !list.some((x) => x.orderId === f.orderId)), ...list].slice(0, 20));
        window.dispatchEvent(new Event(NEW_BOOKINGS_EVENT));
        // Ones that came in while the dashboard was closed go to the bell quietly; live ones pop up.
        if (!first) {
          setPopups((p) => [...fresh, ...p].slice(0, 3));
          fresh.forEach(browserNotify);
        }
      } catch { /* offline or signed out: try again next time */ } finally {
        first = false;
      }
    };
    check();
    const t = window.setInterval(check, POLL_MS);
    return () => { stopped = true; window.clearInterval(t); };
  }, []);

  const open = useCallback((a: Alert) => {
    setAlerts((list) => list.map((x) => (x.orderId === a.orderId ? { ...x, read: true } : x)));
    setPopups((p) => p.filter((x) => x.orderId !== a.orderId));
    go('bookings/' + a.bookingId);
  }, []);
  const dismiss = useCallback((orderId: string) => setPopups((p) => p.filter((x) => x.orderId !== orderId)), []);
  const markAllRead = useCallback(() => setAlerts((list) => list.map((x) => ({ ...x, read: true }))), []);
  const clear = useCallback(() => setAlerts([]), []);
  return { alerts, popups, open, dismiss, markAllRead, clear };
}

function Popup({ a, onOpen, onClose }: { a: Alert; onOpen: () => void; onClose: () => void }) {
  // Close after a while; kept in a ref so re-renders of the page don't restart the timer.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { const t = window.setTimeout(() => close.current(), POPUP_MS); return () => window.clearTimeout(t); }, []);
  return (
    <div className="alert-card" role="status" onClick={onOpen}>
      <FiBell size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="strong">New booking {a.ref}</div>
        <div className="small">{a.customer} · {a.cars.join(', ')}</div>
        <div className="muted small">{fmtDateTime(a.startAt)} · {gbp(a.totalPence)}</div>
      </div>
      <button className="link-btn" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); onClose(); }}><FiX /></button>
    </div>
  );
}

/** Bell for the top bar, plus the pop-up cards in the corner of the page. */
export function BookingAlerts() {
  const { alerts, popups, open, dismiss, markAllRead, clear } = useBookingAlerts();
  const [menu, setMenu] = useState(false);
  const [perm, setPerm] = useState(permission);
  const [asked, setAsked] = useState(() => store.get(ASKED_KEY) === '1');
  const wrap = useRef<HTMLDivElement>(null);
  const unread = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  const enable = async () => {
    store.set(ASKED_KEY, '1'); setAsked(true);
    if (!hasBrowserAlerts()) return;
    setPerm(await Notification.requestPermission());
  };
  const notNow = () => { store.set(ASKED_KEY, '1'); setAsked(true); };
  const showAsk = hasBrowserAlerts() && perm === 'default' && !asked;

  return (
    <div className="bell-wrap" ref={wrap}>
      <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label={`New bookings${unread ? ` (${unread} unread)` : ''}`} aria-expanded={menu} title="New bookings">
        <FiBell size={18} />
        {unread ? <span className="dot" /> : null}
      </button>
      {menu ? (
        <div className="alerts-menu">
          <div className="alerts-head">
            <span className="strong">New bookings</span>
            {alerts.length ? <span className="row">{unread ? <button className="link-btn small" onClick={markAllRead}>Mark all read</button> : null}<button className="link-btn small" onClick={clear}>Clear</button></span> : null}
          </div>
          {alerts.length ? alerts.map((a) => (
            <button key={a.orderId} className={'alert-item' + (a.read ? '' : ' unread')} onClick={() => { setMenu(false); open(a); }}>
              <div className="strong">{a.ref} · {a.customer}</div>
              <div className="small">{a.cars.join(', ')}</div>
              <div className="muted small">For {fmtDateTime(a.startAt)} · {gbp(a.totalPence)} · booked {fmtDateTime(a.createdAt)}</div>
            </button>
          )) : <div className="alerts-foot">No new bookings yet. New customer bookings appear here as they come in.</div>}
          <div className="alerts-foot">
            {perm === 'granted' ? 'Browser notifications are on.'
              : perm === 'denied' ? 'Browser notifications are blocked. Allow them for this site in your browser’s site settings.'
              : hasBrowserAlerts() ? <button className="btn sm gold" onClick={enable}>Turn on browser notifications</button>
              : 'This browser does not support notifications.'}
          </div>
        </div>
      ) : null}
      {createPortal(
        <div className="alert-stack">
          {showAsk ? (
            <div className="alert-card" role="dialog" aria-label="Browser notifications">
              <FiBell size={18} />
              <div style={{ flex: 1 }}>
                <div className="strong">Get notified of new bookings?</div>
                <div className="muted small">Your browser will alert you even when this tab is in the background.</div>
                <div className="row" style={{ marginTop: 10 }}><button className="btn sm gold" onClick={enable}>Turn on</button><button className="btn sm" onClick={notNow}>Not now</button></div>
              </div>
            </div>
          ) : null}
          {popups.map((a) => <Popup key={a.orderId} a={a} onOpen={() => open(a)} onClose={() => dismiss(a.orderId)} />)}
        </div>,
        document.body,
      )}
    </div>
  );
}
