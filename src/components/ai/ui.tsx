import React, { useState } from 'react';
import type { CaseStatus } from './data';

/* ── Tokens ─────────────────────────────────────────────────────────────── */
export const C = {
  navy: '#0e1b3d',
  blue: '#1360d2',
  red: '#ea2428',
  text: '#111838',
  muted: '#4f5a78',
  border: '#e3e8ef',
  soft: '#f0f5fc',
  page: '#f8fafd',
};

/* ── Icons (stroke, currentColor) ───────────────────────────────────────── */
const P: Record<string, React.ReactNode> = {
  upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></>,
  do: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  decl: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /><path d="M9 15l2 2 4-4" /></>,
  track: <><circle cx="12" cy="10" r="3" /><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" /></>,
  risk: <><path d="M12 3l9.5 16.5h-19z" /><path d="M12 10v4M12 17h.01" /></>,
  cost: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  service: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  send: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  clip: <path d="M20 11.5l-8.3 8.3a5 5 0 01-7.1-7.1l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chev: <path d="M9 6l6 6-6 6" />,
  chevDown: <path d="M6 9l6 6 6-6" />,
  arrow: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  doc: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  history: <><path d="M3 12a9 9 0 103-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  ship: <><path d="M3 17l2 4h14l2-4" /><path d="M5 17V9h14v8" /><path d="M9 9V5h6v4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  box: <><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M7 9v6M11 9v6M15 9v6M19 9v6" /></>,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" /><circle cx="12" cy="3.5" r="1" /></>,
  flow: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6 8l5 8M18 8l-5 8" /></>,
  play: <path d="M7 5l12 7-12 7z" />,
  download: <><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1" /></>,
    sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
};

export function Icon({ name, size = 18, className, style, strokeWidth = 1.8 }: { name: string; size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {P[name] ?? P.sparkle}
    </svg>
  );
}

/* ── AI orb ─────────────────────────────────────────────────────────────── */
export function Orb({ size = 40, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 ${pulse ? 'ai-orb-pulse' : ''}`}
      style={{ width: size, height: size, background: 'radial-gradient(circle at 32% 28%, #b9d6ff 0%, #4f8ff7 38%, #1360d2 62%, #0e1b3d 100%)', boxShadow: '0 6px 18px rgba(19,96,210,.28), inset 0 -4px 10px rgba(14,27,61,.35)' }}
    >
      <Icon name="bot" size={Math.round(size * 0.5)} className="text-white" strokeWidth={1.7} />
    </span>
  );
}

/* ── Status pill ────────────────────────────────────────────────────────── */
const TONE: Record<CaseStatus | 'ai', { bg: string; fg: string; dot: string }> = {
  you: { bg: '#fff4d6', fg: '#8a5a00', dot: '#f2b200' },
  run: { bg: '#e6f0ff', fg: '#0f4fab', dot: '#1360d2' },
  wait: { bg: '#edf0f4', fg: '#40484f', dot: '#66708c' },
  done: { bg: '#e3f5ea', fg: '#17703a', dot: '#28a745' },
  ai: { bg: '#eef0ff', fg: '#3a3fb8', dot: '#5b61e8' },
};

export function Pill({ tone, children, className = '' }: { tone: CaseStatus | 'ai'; children: React.ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-[6px] h-[28px] px-[11px] rounded-full text-[14px] whitespace-nowrap ${className}`} style={{ background: t.bg, color: t.fg, fontWeight: 600 }}>
      <span className="size-[6px] rounded-full" style={{ background: t.dot }} />
      {children}
    </span>
  );
}

export function Dot({ tone, size = 8 }: { tone: CaseStatus; size?: number }) {
  return <span className="rounded-full flex-shrink-0" style={{ width: size, height: size, background: TONE[tone].dot }} />;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
export function Btn({ children, onClick, variant = 'primary', size = 'md', icon, disabled, className = '' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'dark'; size?: 'sm' | 'md' | 'lg'; icon?: string; disabled?: boolean; className?: string;
}) {
  const h = size === 'sm' ? 'h-[34px] px-[14px] text-[14px]' : size === 'lg' ? 'h-[48px] px-[24px] text-[16px]' : 'h-[42px] px-[20px] text-[15px]';
  const v = {
    primary: 'bg-[#1360d2] text-white hover:bg-[#0f4fab] border border-[#1360d2]',
    secondary: 'bg-white text-[#1360d2] border border-[#1360d2] hover:bg-[#f0f5fc]',
    ghost: 'bg-transparent text-[#1360d2] border border-transparent hover:bg-[#f0f5fc]',
    dark: 'bg-[#0e1b3d] text-white border border-[#0e1b3d] hover:bg-[#1b2a55]',
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-[8px] ${size === 'lg' ? 'rounded-[4px]' : 'rounded-[6px]'} whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${h} ${v} ${className}`} style={{ fontWeight: 500 }}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/* ── Card shell used inside chat replies ────────────────────────────────── */
export function Panel({ title, sub, right, children, className = '' }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[12px] border ${className}`} style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(14,27,61,.04)' }}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 px-[18px] pt-[14px] pb-[10px] border-b" style={{ borderColor: '#eef1f6' }}>
          <div className="min-w-0">
            {title && <p className="text-[15px] text-[#111838]" style={{ fontWeight: 600 }}>{title}</p>}
            {sub && <p className="text-[14px] text-[#4f5a78] mt-[2px]">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="p-[18px]">{children}</div>
    </div>
  );
}

/* Label / value pair used in 4-per-row detail grids */
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[14px] text-[#4f5a78]">{label}</p>
      <p className="text-[14px] text-[#111838] break-words" style={{ fontWeight: 500 }}>{value}</p>
    </div>
  );
}

/* "How I worked this out" — collapsible explanation of data and confidence */
export function HowIWorked({ rows }: { rows: [string, string][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-[10px]">
      <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-[6px] text-[14px] text-[#1360d2] hover:underline" style={{ fontWeight: 500 }}>
        <Icon name="info" size={14} />
        How I worked this out
        <Icon name="chevDown" size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-[8px] rounded-[8px] px-[14px] py-[10px] grid gap-[6px]" style={{ background: '#f6f8fc', border: '1px dashed #d5ddfb' }}>
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-3 text-[14px]">
              <span className="text-[#4f5a78]">{k}</span>
              <span className="text-[#111838]">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Claims-style green success banner */
export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[12px] rounded-[8px] px-[16px] py-[14px]" style={{ background: '#d4edda', border: '1px solid #c3e6cb' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#155724" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-[2px]"><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg>
      <p className="text-[14px] text-[#155724]" style={{ lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[10px] rounded-[8px] px-[14px] py-[10px]" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
      <Icon name="info" size={16} className="mt-[3px] text-[#856404]" />
      <p className="text-[14px] text-[#856404]" style={{ lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}

/* 12-segment journey bar */
export function JourneyBar({ done, current, total = 12 }: { done: number; current: number; total?: number }) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-[6px] flex-1 rounded-full" style={{ background: i < done ? C.navy : i === current ? '#f2b200' : '#e3e8ef' }} />
      ))}
    </div>
  );
}

/* Step tracker (Prepared → Approved → Verifying → Issued) */
export function Tracker({ steps, active }: { steps: { t: string; s: string }[]; active: number }) {
  return (
    <div className="grid grid-cols-1 gap-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
      {steps.map((st, i) => {
        const done = i < active;
        const cur = i === active;
        return (
          <div key={st.t} className="relative flex flex-col items-center text-center px-1">
            {i > 0 && <span className="absolute top-[13px] right-1/2 w-full h-[2px]" style={{ background: i <= active ? C.navy : '#e3e8ef' }} />}
            <span className="relative z-[1] size-[28px] rounded-full flex items-center justify-center border-2" style={{ background: done ? '#28a745' : '#fff', borderColor: done ? '#28a745' : cur ? C.navy : '#d5ddfb', color: done ? '#fff' : C.navy }}>
              {done ? <Icon name="check" size={14} strokeWidth={2.4} /> : <span className="text-[14px]" style={{ fontWeight: 600 }}>{i + 1}</span>}
            </span>
            <p className="text-[14px] text-[#111838] mt-[6px] leading-tight" style={{ fontWeight: cur ? 600 : 500 }}>{st.t}</p>
            <p className="text-[14px] text-[#4f5a78] leading-tight mt-[2px]">{st.s}</p>
          </div>
        );
      })}
    </div>
  );
}
