import { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { api, qs, useApi } from '../api';
import { addDays, fmtTime, londonIso, ymd } from '../format';
import { go } from '../nav';
import { ConfirmDialog, ErrorBox, Loading, SelectField, TextField } from './forms';
import { Tabs, useToast } from './ui';

type Cal = {
  bookings: { id: string; ref: string; status: string; startAt: string; endAt: string; customer: string }[];
  blocks: { id: string; startAt: string; endAt: string; kind: string; reason: string | null }[];
};
type Settings = { settings: { 'booking.openHour': number; 'booking.closeHour': number } };

const dayLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monday = (d: Date) => { const x = new Date(d); const wd = (x.getUTCDay() + 6) % 7; return addDays(x, -wd); };

/** Single-car calendar. Week = hourly grid (click free hours to block them); Month = per-day overview. */
export default function AvailabilityCalendar({ vehicleId, onPickDay }: { vehicleId: string; onPickDay?: (day: string) => void }) {
  const [view, setView] = useState<'week' | 'day' | 'month'>('week');
  const [anchor, setAnchor] = useState(() => ymd(new Date()));
  const { data: s } = useApi<Settings>('/settings');
  const open = s?.settings['booking.openHour'] ?? 10;
  const close = s?.settings['booking.closeHour'] ?? 19;

  const days = useMemo(() => {
    const a = new Date(anchor + 'T12:00:00Z');
    if (view === 'day') return [anchor];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => ymd(addDays(monday(a), i)));
    const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1, 12));
    const start = monday(first);
    return Array.from({ length: 42 }, (_, i) => ymd(addDays(start, i)));
  }, [anchor, view]);

  const from = londonIso(days[0], 0), to = londonIso(ymd(addDays(new Date(days[days.length - 1] + 'T12:00:00Z'), 1)), 0);
  const { data, error, loading, reload } = useApi<Cal>(`/vehicles/${vehicleId}/calendar` + qs({ from, to }));
  const [sel, setSel] = useState<Set<string>>(new Set()); // "yyyy-mm-dd|hour"
  const [unblock, setUnblock] = useState<Cal['blocks'][number] | null>(null);
  const [form, setForm] = useState<{ kind: 'blocked' | 'maintenance'; reason: string } | null>(null);
  const toast = useToast();

  const hours = Array.from({ length: Math.max(0, close - open) }, (_, i) => open + i);
  const cell = (day: string, h: number) => {
    const a = new Date(londonIso(day, h)).getTime(), b = a + 3600000;
    const bk = data?.bookings.find((x) => new Date(x.startAt).getTime() < b && new Date(x.endAt).getTime() > a);
    if (bk) return { type: 'booked' as const, bk };
    const bl = data?.blocks.find((x) => new Date(x.startAt).getTime() < b && new Date(x.endAt).getTime() > a);
    if (bl) return { type: 'blocked' as const, bl };
    return { type: 'free' as const };
  };

  const step = (dir: number) => {
    const a = new Date(anchor + 'T12:00:00Z');
    if (view === 'month') setAnchor(ymd(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir, 1, 12))));
    else setAnchor(ymd(addDays(a, dir * (view === 'week' ? 7 : 1))));
    setSel(new Set());
  };

  const toggle = (key: string) => setSel((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const blockSelected = async () => {
    if (!form) return;
    // Merge contiguous selected hours on the same day into single blocks.
    const byDay = new Map<string, number[]>();
    for (const k of sel) { const [d, h] = k.split('|'); byDay.set(d, [...(byDay.get(d) ?? []), Number(h)]); }
    const ranges: { day: string; start: number; end: number }[] = [];
    for (const [day, hs] of byDay) {
      hs.sort((x, y) => x - y);
      let start = hs[0], prev = hs[0];
      for (const h of hs.slice(1)) { if (h === prev + 1) { prev = h; continue; } ranges.push({ day, start, end: prev + 1 }); start = prev = h; }
      ranges.push({ day, start, end: prev + 1 });
    }
    for (const r of ranges) await api(`/vehicles/${vehicleId}/blocks`, { method: 'POST', body: { startAt: londonIso(r.day, r.start), endAt: londonIso(r.day, r.end), kind: form.kind, reason: form.reason || undefined } });
    setSel(new Set());
    reload();
    toast('Time blocked');
  };

  const blockDay = (day: string) => setSel(new Set(hours.filter((h) => cell(day, h).type === 'free').map((h) => `${day}|${h}`)));

  const title = view === 'month'
    ? new Date(anchor + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : view === 'day' ? dayLabel(anchor) : `${dayLabel(days[0])} – ${dayLabel(days[6])}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row between wrap">
        <Tabs value={view} onChange={(v) => { setView(v); setSel(new Set()); }} items={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        <div className="row">
          <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => step(-1)} aria-label="Previous"><FiChevronLeft /></button>
          <strong style={{ minWidth: 170, textAlign: 'center' }}>{title}</strong>
          <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => step(1)} aria-label="Next"><FiChevronRight /></button>
          <button className="btn sm" onClick={() => setAnchor(ymd(new Date()))}>Today</button>
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--gold-soft)' }} />Booked</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--line-strong) 0 4px, transparent 4px 8px)' }} />Blocked / maintenance</span>
        <span><i />Free (click to select)</span>
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}

      {data && view !== 'month' ? (
        <div className="cal" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))`, overflowX: 'auto' }}>
          <div />
          {days.map((d) => (
            <div className="head" key={d}>{dayLabel(d).split(' ')[0]}<b>{d.slice(8)}</b>
              <button className="link-btn small muted" onClick={() => blockDay(d)}>Select day</button>
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} style={{ display: 'contents' }}>
              <div className="time">{String(h).padStart(2, '0')}:00</div>
              {days.map((d) => {
                const c = cell(d, h);
                const key = `${d}|${h}`;
                if (c.type === 'booked') return <button key={key} className="slot booked" title={`${c.bk.ref} · ${c.bk.customer} · ${fmtTime(c.bk.startAt)}–${fmtTime(c.bk.endAt)}`} onClick={() => go('bookings/' + c.bk.id)}>{c.bk.ref}</button>;
                if (c.type === 'blocked') return <button key={key} className="slot blocked" title={c.bl.reason ?? c.bl.kind} onClick={() => setUnblock(c.bl)}>{c.bl.kind === 'maintenance' ? 'Maintenance' : 'Blocked'}</button>;
                return <button key={key} className={'slot' + (sel.has(key) ? ' sel' : '')} aria-pressed={sel.has(key)} onClick={() => toggle(key)}>{sel.has(key) ? '✓' : ''}</button>;
              })}
            </div>
          ))}
        </div>
      ) : null}

      {data && view === 'month' ? (
        <div className="month">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="head muted small">{d}</div>)}
          {days.map((d) => {
            const a = new Date(londonIso(d, 0)).getTime(), b = new Date(londonIso(ymd(addDays(new Date(d + 'T12:00:00Z'), 1)), 0)).getTime();
            const bn = data.bookings.filter((x) => new Date(x.startAt).getTime() < b && new Date(x.endAt).getTime() > a).length;
            const kn = data.blocks.filter((x) => new Date(x.startAt).getTime() < b && new Date(x.endAt).getTime() > a).length;
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <button key={d} className={'day' + (inMonth ? '' : ' out')} onClick={() => { setAnchor(d); setView('week'); onPickDay?.(d); }}>
                <b>{Number(d.slice(8))}</b>
                {bn ? <span className="badge warn" style={{ height: 20 }}>{bn} booked</span> : null}
                {kn ? <span className="badge mute" style={{ height: 20 }}>{kn} blocked</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {sel.size ? (
        <div className="row wrap note">
          <span>{sel.size} hour{sel.size > 1 ? 's' : ''} selected</span>
          <button className="btn gold sm" onClick={() => setForm({ kind: 'blocked', reason: '' })}>Block selected</button>
          <button className="btn sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      ) : null}

      {form ? (
        <ConfirmDialog title="Block selected hours" confirmLabel="Block time" onClose={() => setForm(null)}
          onConfirm={blockSelected}
          extra={<>
            <SelectField label="Type" value={form.kind} onChange={(v) => setForm({ ...form, kind: v as 'blocked' | 'maintenance' })} options={[{ value: 'blocked', label: 'Unavailable' }, { value: 'maintenance', label: 'Maintenance' }]} />
            <TextField label="Reason (optional)" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
          </>} message="The car will not be bookable at these times. Existing bookings in the way will stop this." />
      ) : null}
      {unblock ? (
        <ConfirmDialog title="Remove this block?" confirmLabel="Remove block" danger
          message={<>{unblock.kind === 'maintenance' ? 'Maintenance' : 'Unavailable'} from {fmtTime(unblock.startAt)} to {fmtTime(unblock.endAt)}{unblock.reason ? ` (${unblock.reason})` : ''}. The car becomes bookable again.</>}
          onConfirm={async () => { await api(`/blocks/${unblock.id}`, { method: 'DELETE' }); reload(); }} onClose={() => setUnblock(null)} />
      ) : null}
    </div>
  );
}
