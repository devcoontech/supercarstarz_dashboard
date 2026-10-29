import { useState } from 'react';

type Point = { label: string; value: number; tip?: string };

const niceMax = (v: number) => {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Single-series column chart with a hover tooltip. Gold bars, 4px rounded
 * tops anchored to the baseline, recessive grid. */
export function ColumnChart({
  data,
  format,
  height = 260,
  highlightLast = true,
}: {
  data: Point[];
  format: (n: number) => string;
  height?: number;
  highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const pad = { l: 56, r: 8, t: 12, b: 30 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const step = iw / data.length;
  const bw = Math.min(36, step * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Column chart">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 10} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * step + (step - bw) / 2;
          const h = Math.max(0, (d.value / max) * ih);
          const r = Math.min(4, h);
          const top = y(d.value);
          const isLast = i === data.length - 1;
          const fill = hover === i || (highlightLast && isLast && hover == null) ? '#FFC41F' : 'rgba(255,196,31,0.45)';
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" />
              <path
                d={`M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`}
                fill={fill}
              />
              <text className="axis" x={x + bw / 2} y={height - 8} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null ? (
        <div
          className="tip"
          style={{
            left: `${((pad.l + hover * step + step / 2) / W) * 100}%`,
            top: `${(y(data[hover].value) / height) * 100}%`,
            marginTop: -8,
          }}
        >
          <span className="muted">{data[hover].tip ?? data[hover].label}</span>
          <b>{format(data[hover].value)}</b>
        </div>
      ) : null}
    </div>
  );
}

/** Ranked horizontal bars — values are labelled directly, so no axis needed. */
export function HBars({ data, format }: { data: Point[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbar">
      {data.map((d) => (
        <div className="hbar-row" key={d.label + d.value} title={`${d.label}: ${format(d.value)}`}>
          <span className="dim">{d.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="strong" style={{ textAlign: 'right' }}>
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
