/* Lightweight SVG charts for the Dashboard — no chart library.
 * Mark specs: thin bars with 4px rounded data-ends, 2px surface gap between
 * stacked segments, 2px lines, ≥8px markers, recessive grid, hover tooltips. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const VIZ = {
  s1: '#1360d2', // DT blue  — series 1
  s2: '#eb6834', // orange   — series 2
  s3: '#1baf7a', // aqua     — series 3
  good: '#0ca30c', warning: '#fab219', critical: '#d03b3b',
  grid: '#eef1f6', axis: '#d5ddea', text: '#111838', muted: '#4f5a78', surface: '#ffffff',
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => { if (ref.current) setW(ref.current.clientWidth); }, []);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* Rect with rounded top corners only (data-end), anchored to the baseline */
function topRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
function rightRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => n <= x) ?? 10;
  return step * p;
}

export function Tooltip({ x, y, children, containerW }: { x: number; y: number; children: React.ReactNode; containerW: number }) {
  const left = Math.min(Math.max(x, 70), containerW - 70);
  return (
    <div className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full rounded-[8px] bg-[#0e1b3d] text-white text-[14px] px-3 py-2 shadow-lg whitespace-nowrap" style={{ left, top: y - 10 }}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: React.ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-[6px] text-[14px] text-[#40484f]">
          <span className="size-[10px] rounded-[3px]" style={{ background: i.color }} />
          {i.label}{i.value !== undefined && <span className="text-[#111838]" style={{ fontWeight: 600 }}>{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/* ── Stacked column chart ─────────────────────────────────────────────── */
export function StackedBars({ labels, series, height = 240, unit = '' }: {
  labels: string[]; series: { name: string; color: string; data: number[] }[]; height?: number; unit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 8, t: 12, b: 30 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.data[i], 0));
  const max = Math.ceil(niceMax(Math.max(1, ...totals)) / 4) * 4; // 4 even integer steps
  const band = iw / labels.length;
  const bw = Math.min(28, band * 0.55);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={`Stacked columns: ${series.map(s => s.name).join(', ')}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="14" fill={VIZ.muted}>{Math.round(t)}</text>
          </g>
        ))}
        {labels.map((lb, i) => {
          const cx = pad.l + band * i + band / 2;
          let acc = 0;
          const visible = series.filter(s => s.data[i] > 0);
          return (
            <g key={lb}>
              {hover === i && <rect x={cx - band / 2 + 2} y={pad.t} width={band - 4} height={ih} rx={6} fill="#f3f6fb" />}
              {visible.map((s, k) => {
                const v = s.data[i];
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                const gap = k > 0 ? 2 : 0; // 2px surface gap between stacked segments
                const h = Math.max(0, y0 - y1 - gap);
                const top = k === visible.length - 1;
                return top
                  ? <path key={s.name} d={topRounded(cx - bw / 2, y1, bw, h)} fill={s.color} />
                  : <rect key={s.name} x={cx - bw / 2} y={y1} width={bw} height={h} fill={s.color} />;
              })}
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="14" fill={VIZ.muted}>{lb}</text>
              <rect x={cx - band / 2} y={pad.t} width={band} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={pad.l + band * hover + band / 2} y={y(totals[hover])} containerW={w}>
          <p style={{ fontWeight: 600 }}>{labels[hover]} · {totals[hover]}{unit}</p>
          {series.map(s => <p key={s.name} className="flex items-center gap-2"><span className="size-[8px] rounded-[2px]" style={{ background: s.color }} />{s.name}: {s.data[hover]}{unit}</p>)}
        </Tooltip>
      )}
    </div>
  );
}

/* ── Area / line chart with crosshair ─────────────────────────────────── */
export function AreaLine({ labels, data, color = VIZ.s1, height = 220, format }: {
  labels: string[]; data: number[]; color?: string; height?: number; format: (v: number) => React.ReactNode;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 46, r: 14, t: 14, b: 30 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data));
  const x = (i: number) => pad.l + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.5, 1].map(f => f * max);
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round((px / r.width) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id="ai-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="14" fill={VIZ.muted}>{t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}</text>
          </g>
        ))}
        <path d={area} fill="url(#ai-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {labels.map((lb, i) => <text key={lb} x={x(i)} y={height - 8} textAnchor="middle" fontSize="14" fill={VIZ.muted}>{lb}</text>)}
        {/* end-point marker + direct label */}
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={4} fill={color} stroke={VIZ.surface} strokeWidth={2} />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke={VIZ.axis} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover])} r={5} fill={color} stroke={VIZ.surface} strokeWidth={2} />
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} />
      </svg>
      {hover !== null && (
        <Tooltip x={x(hover)} y={y(data[hover])} containerW={w}>
          <p style={{ fontWeight: 600 }}>{labels[hover]}</p>
          <p>{format(data[hover])}</p>
        </Tooltip>
      )}
    </div>
  );
}

/* ── Donut ────────────────────────────────────────────────────────────── */
export function Donut({ items, size = 168, center }: { items: { label: string; value: number; color: string }[]; size?: number; center: React.ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const r = size / 2 - 12, stroke = 22, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }} onMouseLeave={() => setHover(null)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={VIZ.grid} strokeWidth={stroke} />
        {items.map((it, i) => {
          const len = (it.value / total) * c;
          const gap = items.length > 1 ? 2 : 0; // 2px surface gap between segments
          const el = (
            <circle key={it.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color}
              strokeWidth={hover === i ? stroke + 4 : stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc}
              onMouseEnter={() => setHover(i)} style={{ transition: 'stroke-width .15s', cursor: 'default' }} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        {hover === null ? center : (
          <>
            <span className="text-[22px] text-[#111838] leading-none" style={{ fontWeight: 700 }}>{Math.round((items[hover].value / total) * 100)}%</span>
            <span className="text-[14px] text-[#4f5a78] mt-1">{items[hover].label} · {items[hover].value}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Horizontal bars (single series, direct value labels) ─────────────── */
export function HBars({ items, color = VIZ.s1, format }: { items: { label: string; value: number }[]; color?: string; format: (v: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = 160, valueW = 70, rowH = 38, bh = 14;
  const max = Math.max(1, ...items.map(i => i.value));
  const iw = Math.max(10, w - labelW - valueW);
  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={items.length * rowH} role="img" aria-label="Horizontal bar chart">
        {items.map((it, i) => {
          const y = i * rowH + (rowH - bh) / 2;
          const bwid = (it.value / max) * iw;
          return (
            <g key={it.label} onMouseEnter={() => setHover(i)}>
              <rect x={0} y={i * rowH} width={w} height={rowH} fill={hover === i ? '#f3f6fb' : 'transparent'} rx={6} />
              <text x={0} y={y + bh - 2} fontSize="14" fill={VIZ.text}>{it.label}</text>
              <rect x={labelW} y={y} width={iw} height={bh} rx={4} fill={VIZ.grid} />
              <path d={rightRounded(labelW, y, Math.max(2, bwid), bh)} fill={color} />
              <text x={labelW + iw + 10} y={y + bh - 2} fontSize="14" fill={VIZ.text} fontWeight={600}>{format(it.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
