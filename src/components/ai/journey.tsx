/* Import journey after the case is created: four tracks run in parallel.
 *   1 Vessel arrival      — ETA / ATA and container discharge for the BL
 *   2 Trade+              — AI-drafted delivery order; user sets validity, pays
 *   3 Integrated Clearance— HS codes → permit agents (DM, SIRA) draft permits;
 *                           user pays; approved permits → declaration to Customs
 *   4 CargoWaves          — haulage order with the contracted haulier; user
 *                           confirms slot; haulier accepts; delivery scheduled
 * Agents advance on their own and stop only where the user must review, pay or
 * confirm. When all four tracks finish, the audit log closes the journey. */
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DhAmount } from '../Dh';
import { ACTIVE, COMPANY, VESSEL, WALLET_BALANCE, type Permit } from './data';
import type { Ask } from './flows';
import { Btn, C, Field, Icon, Pill, SuccessBanner } from './ui';
import { CaseDocuments, caseDocs } from './docs';
import { ImportComplete, type CompletionSummary } from './complete';
import { VesselMap } from './vesselmap';

type Kind = 'agent' | 'you' | 'external' | 'signal';
export type AuditEvent = { time: string; track: string; actor: string; kind: Kind; action: string; tool: string; outcome: string };
type TrackKey = 'V' | 'D' | 'C' | 'H';

/* ── Case data: built from the containers on this case ──────────────── */
export const DEFAULT_CASE_CONTAINERS = ['MSKU0000001', 'MSKU0000002', 'MSKU0000003', 'MSKU0000004'];
const fmtDh = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PLATE_POOL = ['Dubai F 48213', 'Dubai F 48214', 'Dubai K 90127', 'Dubai K 90128', 'Dubai K 90131', 'Dubai F 48220', 'Dubai J 11804', 'Dubai J 11805'];
function caseData(nos: string[]) {
  const list = nos.length ? nos : DEFAULT_CASE_CONTAINERS;
  const n = list.length;
  const CONTAINERS = list.map((no, i) => {
    const mins = 15 * 60 + 50 + i * 45;   // discharge starts after the late arrival (ATA 14:40)
    return { no, size: "40' HC", at: `30 Nov ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
  });
  const thc = n * 945;
  return {
    n, CONTAINERS,
    HC: `${n} × 40' HC`,
    DO_LINES: [['Delivery order fee', '1,250.00'], [`Terminal handling (${n} × 945.00)`, fmtDh(thc)]] as [string, string][],
    DO_PAY: fmtDh(1250 + thc),
    PLATES: list.map((_, i) => PLATE_POOL[i % PLATE_POOL.length]),
  };
}
type CaseData = ReturnType<typeof caseData>;

const PERMITS = [
  { agent: 'DM agent', entity: 'Dubai Municipality', type: 'Food import permit', hs: '2106.90', item: 'Food preparations (instant noodles)', qty: '1,200 cartons', fee: '210.00', ref: 'DM-PRM-27-55120' },
  { agent: 'SIRA agent', entity: 'SIRA', type: 'Security equipment import permit', hs: '8525.89', item: 'IP CCTV cameras', qty: '180 units', fee: '520.00', ref: 'SIRA-27-08841' },
];
const PERMIT_PAY = '730.00';
const permitsOf = (): Permit[] => ACTIVE.c.permits ?? PERMITS;
const vesselShort = () => ACTIVE.c.vessel.replace(' · ', ' ');
const HS_LINES = [
  { hs: '2106.90', d: 'Food preparations', permit: 'Dubai Municipality' },
  { hs: '8525.89', d: 'IP CCTV cameras', permit: 'SIRA' },
  { hs: '8504.40', d: 'Power supply units', permit: 'None needed' },
];
const DUTY = '20,630.00', DECL_FEE = '120.00', DECL_PAY = '20,750.00';
/* Arrival: the line said 06:00, marine traffic showed the ship running late */
const ARR = 3;
export const AUTO_DO_KEY = 'dt-auto-do';
const FREE_DAYS = 5, FREE_UNTIL = '5 Dec 2027', AUTO_DO_CAP = '6,000.00';
const fullDate = (t: string) => t.replace(/^(\d+ \w+) /, '$1 2027, ');   // '30 Nov 06:00' → '30 Nov 2027, 06:00'   // vessel steps before discharge: ETA, delay check, arrival
const HAULIER = { name: 'Al Bahar Transport LLC', contract: 'Long-term contract until Jun 2028', rate: '650.00' };

/* ── Track scripts ──────────────────────────────────────────────────── */
type Step = {
  id: string; t: string; who: string; kind: Kind; show?: boolean;
  gate?: 'do' | 'permits' | 'declare' | 'slots';
  requires?: (idx: Record<TrackKey, number>) => string | null; // the reason it is waiting, if any
  log?: AuditEvent[];
  ticks?: number;   // clock ticks this step takes (default 1)
};

const T = (track: string) => (time: string, actor: string, kind: Kind, action: string, tool: string, outcome: string): AuditEvent => ({ time, track, actor, kind, action, tool, outcome });
const v = T('Vessel arrival'), d = T('Trade+ · DO'), c = T('Integrated Clearance'), h = T('CargoWaves');

function buildTracks(K: CaseData): Record<TrackKey, { name: string; short: string; icon: string; steps: Step[] }> {
  const { CONTAINERS, n } = K;
  const TRACKS: Record<TrackKey, { name: string; short: string; icon: string; steps: Step[] }> = {
  V: { name: 'Vessel arrival', short: 'Vessel arrival notice', icon: 'ship', steps: [
    { id: 'v1', t: 'ETA confirmed with the line', who: 'Status agent', kind: 'agent', log: [v('24 Nov 09:33', 'Status agent', 'agent', `ETA 30 Nov 06:00 confirmed for ${vesselShort()}`, 'portcall.eta', 'Done')] },
    { id: 'v1d', t: 'Delay found in marine traffic data', who: 'Status agent', kind: 'agent', log: [
      v('29 Nov 18:20', 'Status agent', 'agent', `Marine traffic (AIS) shows ${vesselShort()} about 8 h behind the line's ETA; revised ETA ${VESSEL.revised}`, 'marinetraffic.ais', 'Delay found'),
      v('29 Nov 18:22', 'Status agent', 'agent', 'Told you and moved the DO, permit and haulage plans to the new arrival time', 'notify.user', 'Sent'),
    ] },
    { id: 'v2', t: 'Vessel arrived (ATA)', who: 'Port · DP World', kind: 'external', ticks: 8, log: [v(`30 Nov ${VESSEL.ataTime}`, 'DP World', 'external', `Vessel arrived at Jebel Ali T3, ${VESSEL.late} after the line's ETA`, 'portcall.status', 'Arrived late')] },
    ...CONTAINERS.map((k, i) => ({ id: `v3-${i}`, t: 'Containers discharged', who: 'Status agent', kind: 'agent' as Kind, show: i === 0,
      log: [v(k.at, 'Status agent', 'agent', `${k.no} discharged, no holds`, 'container.status', 'Discharged')] })),
  ] },
  D: { name: 'Trade+', short: 'Delivery order', icon: 'do', steps: [
    { id: 'd1', t: 'Draft DO request created', who: 'DO agent', kind: 'agent', log: [d('24 Nov 09:35', 'DO agent', 'agent', `Drafted DO request for ${n} containers with line charges`, 'do.draft', 'Draft ready')] },
    { id: 'd2', t: 'Review, set validity date and pay', who: 'You', kind: 'you', gate: 'do' },
    { id: 'd3', t: 'Sent to the shipping agent', who: 'DO agent', kind: 'agent', log: [d('24 Nov 10:03', 'DO agent', 'agent', `Submitted the paid request to ${ACTIVE.c.line} via Trade+`, 'do.submit', 'Submitted')] },
    { id: 'd4', t: 'Delivery order released', who: 'Shipping agent', kind: 'external',
      requires: i => (i.V < TRACKS.V.steps.length ? 'Released once all containers are discharged' : null),
      log: [d('30 Nov 18:40', ACTIVE.c.line, 'external', `Released DO-27-41902 for ${n} containers`, 'do.status', 'Released')] },
  ] },
  C: { name: 'Integrated Clearance', short: 'Permits & declaration', icon: 'decl', steps: [
    { id: 'c1', t: 'HS codes checked for permits', who: 'HS agent', kind: 'agent', log: [c('24 Nov 09:36', 'HS agent', 'agent', `${(ACTIVE.c.hs ?? HS_LINES).length} lines classified: ${permitsOf().map(p => `${p.hs} needs ${p.entity === 'Dubai Municipality' ? 'DM' : p.entity}`).join(', ')}`, 'hs.classify', 'Done')] },
    { id: 'c2', t: 'Permit requests drafted', who: permitsOf().map(p => p.agent).join(' · '), kind: 'agent', log: [
      ...permitsOf().map((p, i) => c(`24 Nov 09:3${8 + i}`, p.agent, 'agent', `Drafted ${p.type.toLowerCase()} request with ${p.entity}`, `${p.entity === 'SIRA' ? 'sira' : 'dm'}.permit.draft`, 'Draft ready')),
    ] },
    { id: 'c3', t: 'Check and pay permit requests', who: 'You', kind: 'you', gate: 'permits' },
    { id: 'c4', t: 'Permits approved', who: permitsOf().map(p => p.entity).join(' · '), kind: 'external', log:
      permitsOf().map((p, i) => c(i ? '26 Nov 15:45' : '25 Nov 11:20', p.entity, 'external', `Approved ${p.ref}`, `${p.entity === 'SIRA' ? 'sira' : 'dm'}.permit.status`, 'Approved')) },
    { id: 'c5', t: 'Declaration drafted with permits', who: 'Declaration agent', kind: 'agent', log: [c('26 Nov 15:47', 'Declaration agent', 'agent', `Drafted import declaration with ${permitsOf().length > 1 ? 'both permits' : 'the permit'} attached`, 'declaration.draft', 'Draft ready')] },
    { id: 'c6', t: 'Submit declaration to Dubai Customs', who: 'You', kind: 'you', gate: 'declare' },
    { id: 'c7', t: 'Cleared by Dubai Customs', who: 'Dubai Customs', kind: 'external',
      requires: i => (i.D < TRACKS.D.steps.length ? 'Customs clears once the DO is released' : null),
      log: [c('30 Nov 19:10', 'Dubai Customs', 'external', 'Declaration 101-27-0049310 cleared · green channel', 'declaration.status', 'Cleared')] },
  ] },
  H: { name: 'CargoWaves', short: 'Haulage & delivery', icon: 'truck', steps: [
    { id: 'h1', t: 'Haulage order drafted', who: 'CargoWaves agent', kind: 'agent', log: [h('24 Nov 09:40', 'CargoWaves agent', 'agent', `Drafted order for ${n} containers with ${HAULIER.name} (contract rate)`, 'cargowaves.order.draft', 'Draft ready')] },
    { id: 'h2', t: 'Confirm preferred slot', who: 'You', kind: 'you', gate: 'slots' },
    { id: 'h3', t: 'Sent to the haulier', who: 'CargoWaves agent', kind: 'agent', log: [h('24 Nov 10:16', 'CargoWaves agent', 'agent', 'Sent the order to the haulier for acceptance', 'cargowaves.order.send', 'Sent')] },
    { id: 'h4', t: 'Haulier accepted the order', who: HAULIER.name, kind: 'external',
      requires: i => (i.C < TRACKS.C.steps.length || i.D < TRACKS.D.steps.length ? 'Haulier accepts once the DO is released and customs clears' : null),
      log: [h('30 Nov 19:25', HAULIER.name, 'external', `Accepted the order and assigned ${n} trucks`, 'cargowaves.order.status', 'Accepted')] },
    { id: 'h5', t: 'eToken generated, delivery scheduled', who: 'CargoWaves agent', kind: 'agent', log: [
      h('30 Nov 19:28', 'DP World', 'external', `Generated eToken ET-27-0091602 for ${n} trucks`, 'etoken.issue', 'Issued'),
      h('30 Nov 19:30', 'CargoWaves agent', 'agent', `Scheduled delivery of ${n} containers to your warehouse`, 'cargowaves.schedule', 'Scheduled'),
    ] },
  ] },
  };
  return TRACKS;
}
const KEYS: TrackKey[] = ['V', 'D', 'C', 'H'];
export type CaseSource = 'documents' | 'containers';
/* Start a journey part-way: e.g. after the DO or the permits were paid from their own page. idx -1 = track already done. */
export type JourneyStart = { idx?: Partial<Record<TrackKey, number>>; events?: AuditEvent[]; validity?: string; method?: number };
function seedFor(source: CaseSource, n: number): AuditEvent[] {
  if (source === 'containers') return [
    { time: '24 Nov 09:26', track: 'Documents', actor: 'Status agent', kind: 'agent', action: `Matched ${n} container numbers to BL ${ACTIVE.c.bl}`, tool: 'container.lookup', outcome: 'Done' },
    { time: '24 Nov 09:27', track: 'Documents', actor: 'DO agent', kind: 'agent', action: `Fetched the bill of lading and cargo manifest from ${ACTIVE.c.line}`, tool: 'line.documents', outcome: 'Done' },
    { time: '24 Nov 09:29', track: 'Documents', actor: 'Cargo owner agent', kind: 'agent', action: 'Matched consignee to your trade licence', tool: 'party.validate', outcome: 'Pass' },
    { time: '24 Nov 09:31', track: 'Documents', actor: 'You', kind: 'you', action: 'Created the import case from container numbers', tool: 'case.create', outcome: 'Approved' },
  ];
  return [
    { time: '24 Nov 09:28', track: 'Documents', actor: 'Document AI', kind: 'agent', action: 'Read 4 documents and extracted 72 fields', tool: 'docai.extract', outcome: 'Done' },
    { time: '24 Nov 09:29', track: 'Documents', actor: 'Cargo owner agent', kind: 'agent', action: 'Matched consignee to your trade licence', tool: 'party.validate', outcome: 'Pass' },
    { time: '24 Nov 09:31', track: 'Documents', actor: 'You', kind: 'you', action: 'Confirmed the documents and created the import case', tool: 'case.create', outcome: 'Approved' },
  ];
}
const TICK_MS = 1100;

/* ── Small UI bits ──────────────────────────────────────────────────── */
type DotSt = 'done' | 'run' | 'you' | 'wait' | 'blocked';
function Dot({ st }: { st: DotSt }) {
  if (st === 'done') return <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: '#28a745' }}><Icon name="check" size={12} strokeWidth={2.8} /></span>;
  if (st === 'you') return <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-white text-[14px] ai-attn" style={{ background: '#f2b200', fontWeight: 800 }}>!</span>;
  if (st === 'run') return <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e6f0ff' }}><span className="ai-spin" /></span>;
  if (st === 'blocked') return <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#edf0f4', color: C.muted }}><Icon name="clock" size={12} /></span>;
  return <span className="size-[24px] rounded-full flex-shrink-0 border-2 border-dashed" style={{ borderColor: '#c9d4ec' }} />;
}

function GateBox({ title, children, innerRef }: { title: string; children: React.ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={innerRef} className="rounded-[12px] p-4 ai-checkpoint">
      <p className="text-[14px] text-[#8a5a00] flex items-center gap-1" style={{ fontWeight: 700 }}><Icon name="person" size={12} />Your turn</p>
      <p className="text-[15px] text-[#111838] mt-1 mb-3" style={{ fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

/* ── Delivery slots (CargoWaves) ───────────────────────────────────── */
type Queue = 'Low' | 'Medium' | 'High';
type SlotPick = { d: number; t: number };
const SLOT_DAYS = Array.from({ length: 7 }, (_, i) => {
  const dt = new Date(2027, 11, 1 + i);
  return { wd: dt.toLocaleDateString('en-GB', { weekday: 'short' }), day: dt.getDate(), mon: 'Dec' };
});
const SLOT_TIMES = ['06:00–08:00', '08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00', '20:00–22:00'];
const QUEUE_BY_TIME: Queue[] = ['Low', 'Low', 'Medium', 'High', 'High', 'Medium', 'Low', 'Low'];
const slotInfo = (d: number, t: number, need = 4) => {
  const trucks = (d * 5 + t * 3 + 2) % 7 + Math.max(0, need - 4); // trucks the haulier has free
  const bump = (d + t) % 5 === 0;                    // some days are busier at the gate
  const q = QUEUE_BY_TIME[t];
  const queue: Queue = bump ? (q === 'Low' ? 'Medium' : 'High') : q;
  return { trucks, queue, open: trucks >= need };     // one truck per container
};
function slotPicks(need: number) {
  const all = SLOT_DAYS.flatMap((_, d) => SLOT_TIMES.map((__, t) => ({ d, t, ...slotInfo(d, t, need) })));
  const earliest: SlotPick = all.find(x => x.open) ?? { d: 0, t: 0 };
  const best: SlotPick = all.find(x => x.open && x.queue === 'Low') ?? earliest;
  const lowest: SlotPick = [...all].filter(x => x.open && x.queue === 'Low').sort((a, b) => b.trucks - a.trucks || a.d - b.d || a.t - b.t)[0] ?? best;
  return { earliest, best, lowest };
}
export const slotText = (p: SlotPick) => `${SLOT_DAYS[p.d].wd} ${SLOT_DAYS[p.d].day} Dec · ${SLOT_TIMES[p.t]}`;
const QCOLOR: Record<Queue, string> = { Low: '#28a745', Medium: '#f2b200', High: '#d03b3b' };

function SlotPicker({ value, onChange, need }: { value: SlotPick; onChange: (p: SlotPick) => void; need: number }) {
  const { earliest: EARLIEST, best: BEST, lowest: LOWEST } = useMemo(() => slotPicks(need), [need]);
  const same = (a: SlotPick, b: SlotPick) => a.d === b.d && a.t === b.t;
  const quick = [
    { label: 'Earliest available', icon: 'bolt', p: EARLIEST },
    { label: 'Lowest gate queue', icon: 'clock', p: LOWEST },
  ];
  const cur = slotInfo(value.d, value.t, need);
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Quick picks */}
      <div className="flex flex-wrap gap-2">
        {quick.map(q => (
          <button key={q.label} type="button" onClick={() => onChange(q.p)}
            className="inline-flex items-center gap-2 h-[40px] px-3 rounded-full border text-[14px] transition-colors"
            style={{ borderColor: same(value, q.p) ? C.blue : '#d5ddea', background: same(value, q.p) ? '#eef4ff' : '#fff', color: C.navy }}>
            <Icon name={q.icon} size={15} className="text-[#1360d2]" />
            <span style={{ fontWeight: 600 }}>{q.label}</span>
            <span className="text-[#4f5a78]">· {slotText(q.p)}</span>
          </button>
        ))}
      </div>

      {/* Date strip */}
      <div>
        <p className="text-[14px] text-[#40484f] mb-2" style={{ fontWeight: 600 }}>1. Pick a day</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {SLOT_DAYS.map((day, d) => {
            const free = SLOT_TIMES.filter((_, t) => slotInfo(d, t, need).open).length;
            const on = value.d === d;
            const best = BEST.d === d;
            return (
              <button key={d} type="button" disabled={!free} onClick={() => { const first = SLOT_TIMES.findIndex((_, t) => slotInfo(d, t, need).open); onChange({ d, t: first }); }}
                className="relative rounded-[12px] px-2 py-2 text-center border transition-all disabled:cursor-not-allowed"
                style={{ background: on ? C.navy : free ? '#fff' : '#f3f5f9', borderColor: on ? C.navy : '#dbe3f0', color: on ? '#fff' : free ? C.text : '#7a8399' }}>
                {best && <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 text-[14px] px-2 h-[20px] leading-[20px] rounded-full whitespace-nowrap" style={{ background: '#28a745', color: '#fff', fontWeight: 700 }}>Best</span>}
                <span className="block text-[14px]" style={{ opacity: on ? 0.85 : 0.75 }}>{day.wd}</span>
                <span className="block text-[20px] leading-tight" style={{ fontWeight: 700 }}>{day.day}</span>
                <span className="block text-[14px]" style={{ color: on ? '#cfe0ff' : free ? '#17703a' : '#7a8399', fontWeight: 600 }}>{free ? `${free} free` : 'Full'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots for the chosen day */}
      <div>
        <p className="text-[14px] text-[#40484f] mb-2" style={{ fontWeight: 600 }}>2. Pick a time on {SLOT_DAYS[value.d].wd} {SLOT_DAYS[value.d].day} Dec</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOT_TIMES.map((tm, t) => {
            const inf = slotInfo(value.d, t, need);
            const on = value.t === t;
            const best = same(BEST, { d: value.d, t });
            return (
              <button key={tm} type="button" disabled={!inf.open} onClick={() => onChange({ d: value.d, t })}
                className="relative rounded-[12px] px-3 py-2 text-left border transition-all disabled:cursor-not-allowed"
                style={{ background: on ? '#eef4ff' : inf.open ? '#fff' : '#f3f5f9', borderColor: on ? C.blue : '#dbe3f0', boxShadow: on ? 'inset 0 0 0 1px #1360d2' : 'none' }}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px]" style={{ color: inf.open ? C.text : '#7a8399', fontWeight: 700 }}>{tm}</span>
                  {on ? <Icon name="check" size={15} strokeWidth={2.6} className="text-[#1360d2]" /> : best ? <span className="text-[14px] px-[6px] rounded-full" style={{ background: '#e3f5ea', color: '#17703a', fontWeight: 700 }}>Best</span> : null}
                </span>
                {inf.open ? (
                  <>
                    <span className="flex items-center gap-[6px] text-[14px] text-[#40484f] mt-1"><span className="size-[8px] rounded-full" style={{ background: QCOLOR[inf.queue] }} />{inf.queue} queue</span>
                    <span className="block text-[14px] text-[#4f5a78]">{inf.trucks} trucks free</span>
                  </>
                ) : (
                  <span className="block text-[14px] text-[#7a8399] mt-1">Full · {inf.trucks} of {need} trucks</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-[12px] px-3 py-2 flex items-center gap-3 flex-wrap" style={{ background: '#f4f7fd' }}>
        <Icon name="truck" size={18} className="text-[#1360d2]" />
        <span className="text-[14px] text-[#111838] flex-1 min-w-[220px]"><strong style={{ fontWeight: 700 }}>{slotText(value)}</strong> · {cur.queue.toLowerCase()} gate queue · {need} trucks reserved</span>
      </div>
    </div>
  );
}

/* Track progress inside a card. Deliberately NOT a second stepper: the journey
 * stepper at the top is the only stepper. Cards show a slim progress bar and,
 * when opened, a numbered checklist of the steps. */
type FlowItem = { id: string; st: DotSt; kind: Kind; label: string };
const SEG: Record<DotSt, string> = { done: '#28a745', you: '#f2b200', run: '#1360d2', blocked: '#9aa6bf', wait: '#e3e8ef' };
function StepBar({ items }: { items: FlowItem[] }) {
  const done = items.filter(i => i.st === 'done').length;
  return (
    <div className="flex gap-[4px]" role="img" aria-label={`${done} of ${items.length} steps done`}>
      {items.map(it => (
        <span key={it.id} title={it.label} className={`h-[8px] flex-1 rounded-full ${it.st === 'run' ? 'ai-seg-run' : ''} ${it.st === 'you' ? 'ai-seg-you' : ''}`}
          style={it.st === 'run' ? undefined : { background: SEG[it.st] }} />
      ))}
    </div>
  );
}
const WHO = (k: Kind) => (k === 'you' ? { t: 'You', c: '#8a5a00' } : k === 'external' ? { t: 'Authority', c: '#0f4fab' } : { t: 'AI agent', c: '#1360d2' });
function StepChecklist({ items, cols }: { items: FlowItem[]; cols?: boolean }) {
  return (
    <ol className={cols ? 'sm:columns-2 gap-x-4' : ''}>
      {items.map((it, i) => {
        const cur = it.st === 'you' || it.st === 'run' || it.st === 'blocked';
        const who = WHO(it.kind);
        const dot = it.st === 'done' ? { bg: '#28a745', fg: '#fff', b: 'none' } : it.st === 'you' ? { bg: '#f2b200', fg: '#fff', b: 'none' } : it.st === 'run' ? { bg: '#e6f0ff', fg: C.blue, b: 'none' } : it.st === 'blocked' ? { bg: '#edf0f4', fg: C.muted, b: 'none' } : { bg: '#fff', fg: C.muted, b: '1.5px solid #c9d4ec' };
        return (
          <li key={it.id} className="break-inside-avoid flex items-center gap-[10px] rounded-[10px] px-[10px] py-[7px]"
            style={{ background: cur ? (it.st === 'you' ? '#fff6dc' : '#eef4ff') : 'transparent' }}>
            <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-[14px]" style={{ background: dot.bg, color: dot.fg, border: dot.b, fontWeight: 700 }}>
              {it.st === 'done' ? <Icon name="check" size={13} strokeWidth={2.8} /> : it.st === 'run' ? <span className="ai-spin" /> : it.st === 'blocked' ? <Icon name="clock" size={13} /> : it.st === 'you' ? <Icon name="person" size={13} /> : i + 1}
            </span>
            <span className="flex-1 min-w-0 text-[14px] leading-snug" style={{ color: it.st === 'wait' ? C.muted : C.text, fontWeight: cur ? 700 : 500 }}>{it.label}</span>
            <span className="text-[14px] whitespace-nowrap" style={{ color: who.c, fontWeight: 600 }}>{who.t}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── The journey card ───────────────────────────────────────────────── */
export function CaseJourneyCard({ ask, source = 'documents', files, containers, uploaded, barSlot, initial }: { ask: Ask; source?: CaseSource; files?: string[]; containers?: string[]; uploaded?: Record<string, string>; barSlot?: HTMLElement | null; initial?: JourneyStart }) {
  const K = useMemo(() => caseData(source === 'containers' ? containers ?? [] : DEFAULT_CASE_CONTAINERS), []); // eslint-disable-line react-hooks/exhaustive-deps
  const TRACKS = useMemo(() => buildTracks(K), [K]);
  const PERMS = permitsOf(), HSL = ACTIVE.c.hs ?? HS_LINES, PPAY = ACTIVE.c.permitPay ?? PERMIT_PAY;
  const { CONTAINERS, DO_LINES, DO_PAY, PLATES, HC, n: NC } = K;
  const [idx, setIdx] = useState<Record<TrackKey, number>>(() => {
    const o = { V: 0, D: 0, C: 0, H: 0, ...initial?.idx };
    KEYS.forEach(k => { if (o[k] < 0) o[k] = TRACKS[k].steps.length; });
    return o;
  });
  const [log, setLog] = useState<AuditEvent[]>(() => [...seedFor(source, K.n), ...(initial?.events ?? [])]);
  type View = TrackKey | 'OVERVIEW' | 'DOCS' | 'AUDIT';
  const [sel, setSel] = useState<View>('OVERVIEW');   // which journey page is open
  const [validity, setValidity] = useState(initial?.validity ?? '2027-12-05');
  const [method, setMethod] = useState(initial?.method ?? 0);
  const [openPermit, setOpenPermit] = useState<number | null>(null);
  const [slot, setSlot] = useState<SlotPick>(() => slotPicks(K.n).best);
  const announced = useRef(false);
  const [extra, setExtra] = useState<Record<string, string>>(uploaded ?? {});
  const userPicked = useRef(false);            // once the user picks a section, never switch it for them
  const [stuck, setStuck] = useState(false);   // stepper pinned under the page header
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevDone = useRef<Record<TrackKey, boolean>>({ V: false, D: false, C: false, H: false });
  const [flash, setFlash] = useState<TrackKey | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [autoDo, setAutoDo] = useState(() => { try { return sessionStorage.getItem(AUTO_DO_KEY) === '1'; } catch { return false; } });
  const gateRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(idx); idxRef.current = idx;
  const waitRef = useRef<Partial<Record<TrackKey, number>>>({});

  const len = (k: TrackKey) => TRACKS[k].steps.length;
  const doneTrack = (k: TrackKey) => idx[k] >= len(k);
  const gateOf = (k: TrackKey) => (idx[k] < len(k) ? TRACKS[k].steps[idx[k]].gate : undefined);
  const allDone = KEYS.every(doneTrack);
  const open = KEYS.filter(k => gateOf(k));

  // Pin the stepper under the page header once it scrolls up
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 100), { rootMargin: '-88px 0px 0px 0px', threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Clock: on each tick every track that is not waiting for the user moves one step
  useEffect(() => {
    if (allDone) return;
    const t = setInterval(() => {
      const cur = idxRef.current;
      const next = { ...cur };
      const add: AuditEvent[] = [];
      KEYS.forEach(k => {
        const s = TRACKS[k].steps[cur[k]];
        if (!s || s.gate) return;
        if (s.requires && s.requires(cur)) return;
        const w = (waitRef.current[k] ?? 0) + 1;
        if (w < (s.ticks ?? 1)) { waitRef.current[k] = w; return; }
        waitRef.current[k] = 0;
        if (s.log) add.push(...s.log);
        next[k] = cur[k] + 1;
      });
      if (KEYS.some(k => next[k] !== cur[k])) { setIdx(next); if (add.length) setLog(l => [...l, ...add]); }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [allDone]);

  // When the open track completes, move on: open the next unfinished track
  // (one that needs the user first, otherwise the next in order) and bring it into view.
  useEffect(() => {
    const nowDone = Object.fromEntries(KEYS.map(k => [k, idx[k] >= TRACKS[k].steps.length])) as Record<TrackKey, boolean>;
    const justDone = KEYS.filter(k => nowDone[k] && !prevDone.current[k]);
    prevDone.current = nowDone;
    if (sel === 'OVERVIEW' || sel === 'DOCS' || sel === 'AUDIT' || !justDone.includes(sel)) return;
    const remaining = KEYS.filter(k => !nowDone[k]);
    if (!remaining.length) return;                       // all done: the completion message takes over
    const i = KEYS.indexOf(sel);
    const inOrder = [...KEYS.slice(i + 1), ...KEYS.slice(0, i)].filter(k => !nowDone[k]);
    const next = inOrder.find(k => idx[k] < TRACKS[k].steps.length && TRACKS[k].steps[idx[k]].gate) ?? inOrder[0];
    const t = setTimeout(() => {
      setSel(next);
      setFlash(next);
      toTop();
      setTimeout(() => setFlash(f => (f === next ? null : f)), 4000);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (allDone && !announced.current) { announced.current = true; setTimeout(() => ask('audit-log', undefined, { events: log, containers: NC, summary: completion }), 900); }
  }, [allDone, log, ask]);

  const pass = (k: TrackKey, events: AuditEvent[]) => { userPicked.current = true; setLog(l => [...l, ...events]); setIdx(i => ({ ...i, [k]: i[k] + 1 })); };
  const payDo = () => pass('D', [d('24 Nov 10:02', 'You', 'you', `Reviewed the DO request, set validity to ${validity} and paid (${['wallet', 'credit facility'][method]})`, 'tradepay.pay', `Paid Dh ${DO_PAY}`)]);
  const payPermits = () => pass('C', [c('24 Nov 10:10', 'You', 'you', `Checked ${PERMS.length > 1 ? 'both permit requests' : 'the permit request'} and paid to submit ${PERMS.length > 1 ? 'them' : 'it'}`, 'tradepay.pay', `Paid Dh ${PPAY}`)]);
  const declare = () => pass('C', [c('26 Nov 16:05', 'You', 'you', 'Submitted the declaration to Dubai Customs; duty from your duty account', 'declaration.submit', `Paid Dh ${DECL_PAY}`)]);
  const confirmSlot = () => pass('H', [h('24 Nov 10:15', 'You', 'you', `Confirmed delivery slot ${slotText(slot)} for ${NC} containers`, 'cargowaves.order.confirm', 'Confirmed')]);

  /* Per-track derived status */
  const trackInfo = (k: TrackKey) => {
    const i = idx[k], s = TRACKS[k].steps[i];
    const blocked = s?.requires?.(idx) ?? null;
    const state: 'done' | 'you' | 'blocked' | 'run' = i >= len(k) ? 'done' : s?.gate ? 'you' : blocked ? 'blocked' : 'run';
    const pct = Math.round((Math.min(i, len(k)) / len(k)) * 100);
    const discharged = Math.min(NC, Math.max(0, idx.V - ARR));
    const line = {
      V: idx.V === 0 ? 'Confirming ETA…' : idx.V === 1 ? `ETA ${VESSEL.eta} · checking marine traffic…` : idx.V === 2 ? `Delayed · revised ETA ${VESSEL.revised}` : `ATA 30 Nov ${VESSEL.ataTime} (${VESSEL.late} late) · ${discharged} of ${NC} discharged`,
      D: ['Drafting DO request…', 'Draft ready · review and pay', 'Sending to shipping agent…', blocked ? 'Paid · waiting for discharge' : 'Releasing…', 'DO-27-41902 released'][Math.min(i, 4)],
      C: ['Checking HS codes…', 'Drafting DM and SIRA permits…', '2 permits ready · check and pay', 'Waiting for permit approvals…', 'Drafting declaration…', 'Declaration ready to submit', blocked ? 'Submitted · waiting for DO' : 'Clearing…', 'Cleared · green channel'][Math.min(i, 7)],
      H: ['Drafting haulage order…', 'Haulier nominated · confirm slot', 'Sending to haulier…', blocked ? 'Sent · waiting for DO and clearance' : 'Haulier reviewing…', 'Scheduling delivery…', `Delivery ${slotText(slot)}`][Math.min(i, 5)],
    }[k];
    return { state, pct, line, blocked };
  };

  const stepsFor = (k: TrackKey): { s: Step; st: DotSt }[] =>
    TRACKS[k].steps.map((s, i) => ({ s, i })).filter(({ s }) => s.show !== false).map(({ s, i }) => {
      if (k === 'V' && s.id.startsWith('v3')) {
        const n = Math.min(NC, Math.max(0, idx.V - ARR));
        return { s: { ...s, t: `Containers discharged · ${n} of ${NC}` }, st: n >= NC ? 'done' : idx.V >= ARR ? 'run' : 'wait' };
      }
      return { s, st: i < idx[k] ? 'done' : i === idx[k] ? (s.gate ? 'you' : s.requires?.(idx) ? 'blocked' : 'run') : 'wait' };
    });

  const doneTracks = KEYS.filter(doneTrack).length;
  const latest = useMemo(() => log.slice(-4).reverse(), [log]);
  const th = 'px-3 py-2 text-left text-[14px] text-[#4f5a78]';
  const sectionTitle = 'text-[14px] text-[#4f5a78]';
  const sectionStyle = { fontWeight: 700 } as const;

  /* Plain-language framing of each track */
  const META: Record<TrackKey, { title: string; product: string; what: string }> = {
    V: { title: 'Vessel Arrival Notice', product: '', what: 'We follow the ship and tell you when each container is off the vessel.' },
    D: { title: 'Trade+', product: 'Delivery order', what: 'The DO lets you collect your containers. The agent drafts it; you pay and it goes to the shipping agent.' },
    C: { title: 'Integrated Clearance', product: 'Permits & declaration', what: 'Permit agents request DM and SIRA permits, then the declaration goes to Dubai Customs.' },
    H: { title: 'Cargo Waves', product: 'Haulage & delivery', what: 'Your contracted haulier collects the containers and delivers them to your warehouse.' },
  };
  const STEPPER_NAME: Record<TrackKey, string> = { V: 'Vessel Operations', D: 'Trade+', C: 'Integrated Clearance', H: 'Cargo Waves' };
  const SHORT: Record<string, string> = {
    v1: 'ETA confirmed', v1d: 'Delay found', v2: 'Vessel arrived late', 'v3-0': 'Containers off the vessel',
    d1: 'DO drafted', d2: 'You pay', d3: 'Sent to shipping agent', d4: 'DO released',
    c1: 'HS codes checked', c2: 'Permits drafted', c3: 'You pay permits', c4: 'Permits approved', c5: 'Declaration drafted', c6: 'You submit', c7: 'Cleared',
    h1: 'Order drafted', h2: 'You pick a slot', h3: 'Sent to haulier', h4: 'Haulier accepts', h5: 'eToken & delivery',
  };

  /* To-do list: every open checkpoint, in plain words */
  const TODO: Record<NonNullable<Step['gate']>, { title: string; sub: string; amount: string | null; cta: string }> = {
    do: { title: 'Pay for the delivery order', sub: 'Trade+ · review it and set the validity date', amount: DO_PAY, cta: 'Review and pay' },
    permits: { title: `Pay for ${PERMS.length} permit request${PERMS.length > 1 ? 's' : ''}`, sub: `Integrated Clearance · ${PERMS.map(p => p.entity).join(' and ')}`, amount: PPAY, cta: 'Review and pay' },
    declare: { title: 'Submit your declaration to Dubai Customs', sub: 'Integrated Clearance · duty from your duty account', amount: DECL_PAY, cta: 'Review and submit' },
    slots: { title: 'Choose a delivery slot', sub: `CargoWaves · ${HAULIER.name}`, amount: null, cta: 'Choose slot' },
  };
  const todos = open.map(k => ({ k, item: TODO[gateOf(k)!] }));
  /* Each section is its own page: switch page, then bring the top of the journey into view */
  const toTop = () => {
    const el = cardRef.current; if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'auto' });
  };
  const goTo = (k: View) => { userPicked.current = true; setSel(k); toTop(); };
  const pick = (k: TrackKey) => goTo(k);
  const docsList = caseDocs(source, files, extra);
  const missingDocs = docsList.filter(d => d.status === 'missing').length;
  const completion: CompletionSummary = {
    containers: CONTAINERS.map(c => c.no), plates: PLATES, slot: slotText(slot),
    doPaid: DO_PAY, permitPaid: PPAY, dutyPaid: DECL_PAY, docs: docsList,
  };
  const NAV: { key: TrackKey | 'DOCS'; label: string; state: 'done' | 'you' | 'run' | 'blocked'; pct: number; icon: string; status: string }[] = [
    { key: 'DOCS', label: 'Documents', state: missingDocs ? 'you' : 'done', pct: Math.round(((docsList.length - missingDocs) / docsList.length) * 100), icon: 'doc', status: missingDocs ? `${missingDocs} to add` : 'Done' },
    ...KEYS.map(k => { const ti = trackInfo(k); return { key: k, label: STEPPER_NAME[k], state: ti.state, pct: ti.pct, icon: TRACKS[k].icon, status: ti.state === 'done' ? 'Done' : ti.state === 'you' ? 'Needs you' : ti.state === 'blocked' ? 'Waiting' : `${ti.pct}%` }; }),
  ];

  /* Steps of a track, in plain words */
  const flowItems = (k: TrackKey): FlowItem[] => stepsFor(k).map(({ s, st }) => ({
    id: s.id, st, kind: s.kind,
    label: s.id === 'v3-0' ? `${SHORT[s.id]} · ${Math.min(NC, Math.max(0, idx.V - ARR))}/${NC}` : SHORT[s.id] ?? s.t,
  }));

  /* Two-part body used by every checkpoint: what the agent prepared / what you do */
  const Checkpoint = ({ prepared, action, wide }: { prepared: React.ReactNode; action: React.ReactNode; wide?: boolean }) => (
    <div ref={gateRef} className={`grid grid-cols-1 ${wide ? '' : 'lg:grid-cols-[minmax(0,1fr)_300px]'} gap-4 rounded-[16px] p-4 sm:p-5 ai-checkpoint-v2 min-w-0`}>
      <div className="min-w-0">
        <p className="text-[14px] text-[#1360d2] mb-3 flex items-center gap-2" style={{ fontWeight: 700 }}><span className="size-[20px] rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#4f8ff7,#8fbaff)' }}><Icon name="sparkle" size={11} /></span>What the agent prepared</p>
        {prepared}
      </div>
      <div className="ai-action-panel rounded-[12px] p-4">
        <p className="text-[14px] text-[#0e1b3d] mb-3 flex items-center gap-2" style={{ fontWeight: 700 }}><span className="size-[20px] rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="person" size={11} /></span>What you need to do</p>
        {action}
      </div>
    </div>
  );
  const sum = (rows: [string, string | null][], total: string, totalLabel = 'Total') => (
    <div className="grid grid-cols-1 gap-[4px] text-[14px] mt-3">
      {rows.map(([l, a]) => <div key={l} className="flex justify-between gap-4"><span className="text-[#40484f]">{l}</span>{a ? <DhAmount value={a} /> : <span className="text-[#17703a]">Waived</span>}</div>)}
      <div className="flex justify-between gap-4 border-t pt-[4px] text-[14px]" style={{ borderColor: '#e2e6f8', fontWeight: 700 }}><span>{totalLabel}</span><DhAmount value={total} /></div>
    </div>
  );
  const inputCls = 'mt-1 w-full h-[38px] rounded-[6px] px-2 text-[14px] bg-white outline-none focus:border-[#1360d2]';

  /* AI suggestion on Trade+: automate future delivery orders */
  const payLabel = ['Dubai Trade wallet', 'Credit facility'][method];
  const payInText = method === 0 ? 'Dubai Trade wallet' : 'credit facility';
  const toggleAutoDo = () => {
    const on = !autoDo;
    setAutoDo(on);
    try { sessionStorage.setItem(AUTO_DO_KEY, on ? '1' : '0'); } catch { /* not stored */ }
    setLog(l => [...l, d('24 Nov 10:06', 'You', 'you', on ? `Turned on automatic delivery orders (${payInText}, valid for the free days)` : 'Turned off automatic delivery orders', 'agents.autodo', on ? 'Enabled' : 'Disabled')]);
  };
  const autoDoCard = (
    <div className="rounded-[16px] border p-4 sm:p-5" style={{ borderColor: autoDo ? '#bfe3cc' : '#cfe0fb', background: autoDo ? 'linear-gradient(180deg,#f2fbf5,#ffffff)' : 'linear-gradient(180deg,#f3f8ff,#ffffff)' }}>
      <div className="flex items-start gap-3">
        <span className="size-[40px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 6px 14px -8px rgba(19,96,210,.6)' }}><Icon name="bot" size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#1360d2] inline-flex items-center gap-1" style={{ fontWeight: 700 }}><Icon name="sparkle" size={14} />AI suggestion</p>
          <p className="text-[17px] text-[#0e1b3d] leading-snug" style={{ fontWeight: 700 }}>Automate your future delivery orders</p>
          <p className="text-[14px] text-[#40484f] mt-1 leading-snug">{idx.D >= 2 ? 'You paid this DO yourself. Next time, the' : 'Instead of reviewing and paying each delivery order yourself, the'} DO agent can request and pay it as soon as your containers are discharged.</p>
        </div>
        <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
          <span className="text-[14px] hidden sm:inline" style={{ color: autoDo ? '#17703a' : C.muted, fontWeight: 600 }}>{autoDo ? 'On' : 'Off'}</span>
          <button type="button" role="switch" aria-checked={autoDo} aria-label="Automate future delivery orders" onClick={toggleAutoDo}
            className="w-[46px] h-[26px] rounded-full relative transition-colors" style={{ background: autoDo ? '#28a745' : '#c9d4ec' }}>
            <span className="absolute top-[3px] size-[20px] rounded-full bg-white transition-all shadow" style={{ left: autoDo ? 23 : 3 }} />
          </button>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {[
          ['wallet', 'Same payment method', `${payLabel}, as you used today. Paid automatically, no review needed.`],
          ['clock', 'Validity from your free days', `${ACTIVE.c.line} gives ${FREE_DAYS} free days after discharge, so the DO is valid until the last free day (for this shipment, ${FREE_UNTIL}).`],
          ['shield', 'You stay in control', `Pays up to Dh ${AUTO_DO_CAP} per DO without asking; above that it waits for you. You're told after every payment.`],
        ].map(([ic, t, d2]) => (
          <div key={t} className="rounded-[12px] px-3 py-3 flex items-start gap-3" style={{ background: '#ffffff', border: '1px solid #e6ebf3' }}>
            <Icon name={ic} size={18} className="text-[#1360d2] mt-[2px] flex-shrink-0" />
            <span className="min-w-0"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>{t}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{d2}</span></span>
          </div>
        ))}
      </div>
      {autoDo && (
        <div className="mt-4"><SuccessBanner><strong>Success:</strong> Automatic delivery orders are on. From your next import, the DO agent requests and pays the DO with your {payInText}, valid for the free days. You'll find it under Your AI agents on the AI home, where you can switch it off anytime.</SuccessBanner></div>
      )}
    </div>
  );

  const detail = (k: TrackKey) => {
    if (k === 'V') return (
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-[12px] p-3" style={{ background: '#f7f9fd' }}>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <Field label="Vessel / voyage" value={ACTIVE.c.vessel} />
            <Btn size="sm" variant="secondary" icon="ship" onClick={() => setMapOpen(true)}>View ship on map</Btn>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            <Field label="ETA from shipping agent" value={idx.V >= 1 ? fullDate(VESSEL.eta) : 'Confirming…'} />
            <Field label="Revised ETA (marine traffic)" value={idx.V >= 2 ? <span className="text-[#8a5a00]">{fullDate(VESSEL.revised)}</span> : idx.V === 1 ? 'Checking…' : '—'} />
            <Field label="ATA (actual)" value={idx.V >= ARR ? <span className="text-[#8a5a00]">30 Nov 2027, {VESSEL.ataTime}</span> : 'Not arrived yet'} />
            <Field label="Delay against ETA" value={idx.V >= ARR ? <span className="text-[#8a5a00]">{VESSEL.late}</span> : idx.V === 2 ? <span className="text-[#8a5a00]">About 8 h 30 min</span> : '—'} />
          </div>
        </div>
        {idx.V >= 2 && (
          <div className="rounded-[12px] px-4 py-3 flex items-start gap-3" style={{ background: '#fff8e6', border: '1px solid #f2d98a' }}>
            <span className="size-[34px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="bot" size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>Delay found by the AI agent</p>
              <p className="text-[14px] text-[#40484f] leading-snug mt-[2px]">
                The shipping agent gave an ETA of {VESSEL.eta}. On {VESSEL.found} the Status agent checked the marine traffic system (AIS) and saw {vesselShort()} sailing at 11.2 knots after slowing for weather in the Gulf of Oman, about 8 hours behind schedule. It revised the arrival to {VESSEL.revised} and moved your delivery order, permit and haulage plans to match.
                {idx.V >= ARR && <> The vessel arrived at {VESSEL.ataTime}, {VESSEL.late} after the shipping agent's ETA.</>}
              </p>
              <button type="button" onClick={() => setMapOpen(true)} className="mt-2 text-[14px] text-[#1360d2] hover:underline underline-offset-2 inline-flex items-center gap-1" style={{ fontWeight: 600 }}><Icon name="ship" size={15} />Track the ship on the map</button>
            </div>
          </div>
        )}
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
          <table className="w-full">
            <thead><tr className="bg-[#f3f6fb]"><th className={th} style={{ fontWeight: 500 }}>Container</th><th className={th} style={{ fontWeight: 500 }}>Size</th><th className={th} style={{ fontWeight: 500 }}>Status</th><th className={`${th} hidden sm:table-cell`} style={{ fontWeight: 500 }}>Discharged at</th></tr></thead>
            <tbody>
              {CONTAINERS.map((ct, i) => {
                const dis = idx.V - ARR > i;
                return (
                  <tr key={ct.no} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                    <td className="px-3 py-[9px]" style={{ fontWeight: 600, ...mono }}>{ct.no}</td>
                    <td className="px-3 py-[9px]">{ct.size}</td>
                    <td className="px-3 py-[9px]">{dis ? <Pill tone="done">Discharged</Pill> : idx.V >= ARR ? <Pill tone="run">Discharging</Pill> : <Pill tone="wait">On board</Pill>}</td>
                    <td className="px-3 py-[9px] text-[#4f5a78] hidden sm:table-cell">{dis ? ct.at : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    if (k === 'D') return <div className="grid grid-cols-1 gap-4">{idx.D === 1 ? (
      <Checkpoint
        prepared={<>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Shipping agent" value={ACTIVE.c.line} />
            <Field label="Bill of lading" value={ACTIVE.c.bl} />
            <Field label="Consignee" value={COMPANY} />
            <Field label="Containers" value={HC} />
          </div>
          {sum([...DO_LINES, ['Container deposit (guarantee on file)', null]], DO_PAY)}
        </>}
        action={<div className="grid grid-cols-1 gap-2">
          <label className="text-[14px] text-[#40484f]">1. Set the DO validity date<input type="date" value={validity} onChange={e => setValidity(e.target.value)} className={inputCls} style={{ border: '1px solid #d5ddfb' }} /></label>
          <label className="text-[14px] text-[#40484f]">2. Choose how to pay
            <select value={method} onChange={e => setMethod(Number(e.target.value))} className={inputCls} style={{ border: '1px solid #d5ddfb' }}>
              <option value={0}>Dubai Trade wallet · Dh {WALLET_BALANCE}</option>
              <option value={1}>Credit facility · monthly statement</option>
            </select>
          </label>
          <Btn onClick={payDo} className="mt-1">Pay and send&nbsp;<DhAmount value={DO_PAY} /></Btn>
          <p className="text-[14px] text-[#4f5a78]">Goes to the shipping agent for release.</p>
        </div>}
      />
    ) : (
      <div className="rounded-[12px] p-3 grid gap-3" style={{ background: '#f7f9fd' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Field label="DO request" value={idx.D >= 1 ? 'DOR-27-118340' : 'Drafting…'} />
          <Field label="Shipping agent" value={ACTIVE.c.line} />
          <Field label="Valid until" value={idx.D >= 2 ? validity : '—'} />
          <Field label="Paid" value={idx.D >= 2 ? <DhAmount value={DO_PAY} /> : '—'} />
        </div>
        {idx.D >= 4 && <SuccessBanner><strong>Success:</strong> Delivery order <strong>DO-27-41902</strong> released by the shipping agent for {NC} containers.</SuccessBanner>}
      </div>
    )}{autoDoCard}</div>;

    if (k === 'C') return (
      <div className="grid grid-cols-1 gap-3">
        {idx.C === 2 ? (
          <Checkpoint
            prepared={<>
              <p className="text-[14px] text-[#40484f] mb-2">Your HS codes need {PERMS.length} permit{PERMS.length > 1 ? 's' : ''}. The {PERMS.map(p => p.agent).join(' and ')} drafted {PERMS.length > 1 ? 'them' : 'it'} for you.</p>
              <div className="grid grid-cols-1 gap-2">
                {PERMS.map((p, i) => (
                  <div key={p.ref} className="ai-glass-row rounded-[12px]">
                    <button type="button" onClick={() => setOpenPermit(o => (o === i ? null : i))} className="w-full flex items-center gap-3 px-3 py-[10px] text-left" aria-expanded={openPermit === i}>
                      <span className="w-[48px] h-[40px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 800 }}>{p.entity === 'SIRA' ? 'SIRA' : 'DM'}</span>
                      <span className="flex-1 min-w-0"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{p.entity}</span><span className="block text-[14px] text-[#4f5a78]">{p.type} · HS {p.hs}</span></span>
                      <DhAmount value={p.fee} className="text-[14px]" />
                      <Icon name="chevDown" size={14} className={`text-[#66708c] transition-transform ${openPermit === i ? 'rotate-180' : ''}`} />
                    </button>
                    {openPermit === i && <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 pb-3"><Field label="Goods" value={p.item} /><Field label="Quantity" value={p.qty} /><Field label="Importer" value={COMPANY} /><Field label="Origin" value="China" /></div>}
                  </div>
                ))}
              </div>
            </>}
            action={<div className="grid grid-cols-1 gap-2">
              <p className="text-[14px] text-[#40484f]">Check the two drafts (tap to open), then pay to submit them to the authorities.</p>
              {sum(PERMS.map(p => [p.entity, p.fee] as [string, string]), PPAY)}
              <Btn onClick={payPermits} className="mt-1">Pay and submit&nbsp;<DhAmount value={PPAY} /></Btn>
            </div>}
          />
        ) : idx.C === 5 ? (
          <Checkpoint
            prepared={<>
              <p className="text-[14px] text-[#40484f] mb-2">Both permits are approved and attached to your declaration.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Declaration type" value="Import for local consumption" />
                <Field label="Permits attached" value="DM · SIRA" />
                <Field label="Customs value" value={<DhAmount value="412,600.00" />} />
                <Field label="Goods lines" value="3" />
              </div>
            </>}
            action={<div className="grid grid-cols-1 gap-2">
              {sum([['Customs duty (5%)', DUTY], ['Declaration fee', DECL_FEE]], DECL_PAY, 'From duty account')}
              <Btn onClick={declare} className="mt-1">Submit to Dubai Customs</Btn>
            </div>}
          />
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
            <p className="px-3 pt-2 pb-1 text-[14px] text-[#4f5a78]" style={{ fontWeight: 600 }}>Goods and the permits they need</p>
            <table className="w-full">
              <tbody>
                {HSL.map(l => (
                  <tr key={l.hs} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                    <td className="px-3 py-[8px]" style={{ fontWeight: 600 }}>{l.hs}</td><td className="px-3 py-[8px]">{l.d}</td>
                    <td className="px-3 py-[8px] text-right">{l.permit === 'None needed' ? <span className="text-[#4f5a78]">No permit</span> : <span className="inline-flex items-center gap-1 text-[#1360d2]" style={{ fontWeight: 600 }}>{l.permit === 'Dubai Municipality' ? 'DM' : l.permit}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-2 content-start">
            {PERMS.map(p => {
              const st = idx.C >= 4 ? 'Approved' : idx.C >= 3 ? 'With the authority' : idx.C >= 2 ? 'Drafted · needs payment' : 'Being drafted';
              return (
                <div key={p.ref} className="rounded-[10px] px-3 py-[10px] flex items-center gap-3" style={{ background: '#f7f9fd' }}>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{p.entity} permit</span><span className="block text-[14px] text-[#4f5a78]">{idx.C >= 4 ? p.ref : p.type}</span></span>
                  <Pill tone={idx.C >= 4 ? 'done' : idx.C === 2 ? 'you' : idx.C >= 3 ? 'run' : 'wait'}>{st}</Pill>
                </div>
              );
            })}
            <div className="rounded-[10px] px-3 py-[10px] flex items-center gap-3" style={{ background: '#f7f9fd' }}>
              <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>Customs declaration</span><span className="block text-[14px] text-[#4f5a78]">{idx.C >= 7 ? '101-27-0049310 · green channel' : idx.C === 6 ? 'Clears once the DO is released' : 'Drafted after permits are approved'}</span></span>
              <Pill tone={idx.C >= 7 ? 'done' : idx.C === 5 ? 'you' : idx.C === 6 ? 'run' : 'wait'}>{idx.C >= 7 ? 'Cleared' : idx.C === 6 ? 'Submitted' : idx.C === 5 ? 'Ready to submit' : 'Not started'}</Pill>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 gap-3">
        {idx.H === 1 ? (
          <Checkpoint
            wide
            prepared={<>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="size-[38px] rounded-[10px] flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="truck" size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{HAULIER.name}</span><span className="block text-[14px] text-[#4f5a78]">{HAULIER.contract}</span></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-3">
                <Field label="Containers" value={HC} />
                <Field label="Contract rate" value={<><DhAmount value={HAULIER.rate} /> each</>} />
                <Field label="Pick up from" value="Jebel Ali T3" />
                <Field label="Deliver to" value="Your warehouse, Al Quoz 3" />
              </div>
            </>}
            action={<div className="grid grid-cols-1 gap-4">
              <SlotPicker value={slot} onChange={setSlot} need={NC} />
              <div className="flex items-center gap-3 flex-wrap">
                <Btn onClick={confirmSlot}>Confirm and send to haulier</Btn>
                <span className="text-[14px] text-[#4f5a78]">The haulier confirms within the day. You can change the slot until then.</span>
              </div>
            </div>}
          />
        ) : (
          <div className="rounded-[12px] p-3 flex items-center gap-3 flex-wrap" style={{ background: '#f7f9fd' }}>
            <span className="size-[38px] rounded-[10px] flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="truck" size={18} /></span>
            <span className="flex-1 min-w-[200px]"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{HAULIER.name}</span><span className="block text-[14px] text-[#4f5a78]">{HAULIER.contract} · <DhAmount value={HAULIER.rate} /> per container</span></span>
            <Pill tone="ai">Nominated by agent</Pill>
          </div>
        )}
        {idx.H >= 2 && (
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
            <table className="w-full">
              <thead><tr className="bg-[#f3f6fb]"><th className={th} style={{ fontWeight: 500 }}>Container</th><th className={th} style={{ fontWeight: 500 }}>Truck</th><th className={th} style={{ fontWeight: 500 }}>Delivery</th></tr></thead>
              <tbody>
                {CONTAINERS.map((ct, i) => (
                  <tr key={ct.no} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                    <td className="px-3 py-[8px]" style={{ fontWeight: 600, ...mono }}>{ct.no}</td>
                    <td className="px-3 py-[8px]">{idx.H >= 4 ? PLATES[i] : <span className="text-[#4f5a78]">Haulier to assign</span>}</td>
                    <td className="px-3 py-[8px]">{idx.H >= 5 ? <Pill tone="done">{slotText(slot)}</Pill> : <Pill tone="wait">{slotText(slot)} · pending</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const pillFor = (k: TrackKey) => { const st = trackInfo(k).state; return <Pill tone={st === 'done' ? 'done' : st === 'you' ? 'you' : st === 'blocked' ? 'wait' : 'run'}>{st === 'done' ? 'Done' : st === 'you' ? 'Needs you' : st === 'blocked' ? 'Waiting' : 'In progress'}</Pill>; };

  /* Progress summary of a track: slim bar, step count and what is happening now */
  const progress = (k: TrackKey, cta?: boolean) => {
    const ti = trackInfo(k);
    const items = flowItems(k);
    const doneN = items.filter(i => i.st === 'done').length;
    const cur = items.find(i => i.st !== 'done');
    const g = gateOf(k);
    const tone = ti.state === 'done' ? '#17703a' : ti.state === 'you' ? '#8a5a00' : ti.state === 'blocked' ? C.muted : C.blue;
    return (
      <div>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><StepBar items={items} /></div>
          <span className="text-[14px] text-[#4f5a78] whitespace-nowrap">{ti.state === 'done' ? `All ${items.length} steps done` : `Step ${doneN + 1} of ${items.length}`}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-[14px] flex items-center gap-2 flex-1 min-w-[220px]" style={{ color: tone }}>
            <Icon name={ti.state === 'done' ? 'check' : ti.state === 'you' ? 'person' : ti.state === 'blocked' ? 'clock' : 'sparkle'} size={15} strokeWidth={2.2} />
            <span>
              {cur && <strong className="text-[#111838]" style={{ fontWeight: 700 }}>{cur.label}</strong>}
              {cur && <span className="text-[#4f5a78]"> · </span>}
              {ti.blocked ?? ti.line}
            </span>
          </span>
          {cta && (g ? <Btn size="sm" onClick={() => goTo(k)}>{TODO[g].cta}</Btn> : <Btn size="sm" variant="secondary" onClick={() => goTo(k)}>Open track</Btn>)}
        </div>
      </div>
    );
  };

  const pageOrder: View[] = ['OVERVIEW', 'DOCS', ...KEYS];
  const pageName = (v: View) => (v === 'OVERVIEW' ? 'Overview' : v === 'DOCS' ? 'Documents' : v === 'AUDIT' ? 'Audit log' : META[v].title);
  const pi = pageOrder.indexOf(sel);
  const prevPage: View | null = sel === 'AUDIT' ? 'OVERVIEW' : pi > 0 ? pageOrder[pi - 1] : null;
  const nextPage: View | null = sel === 'AUDIT' ? null : pi < pageOrder.length - 1 ? pageOrder[pi + 1] : null;

  return (
    <div ref={cardRef} className="rounded-[16px] border overflow-clip" style={{ background: '#fff', borderColor: '#dde4f0', boxShadow: '0 8px 28px -16px rgba(14,27,61,.25)' }}>
      {/* ① Header: what this is and how far along */}
      <div className="px-5 sm:px-6 pt-5 pb-4" style={{ background: 'linear-gradient(180deg,#f6f9ff,#fff)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Import journey · {ACTIVE.c.caseId}</p>
            <p className="text-[19px] text-[#111838] leading-snug mt-[2px]" style={{ fontWeight: 600 }}>{allDone ? 'Your import journey is on track' : 'Your import is on its way'}</p>
            <p className="text-[14px] text-[#4f5a78] mt-[2px]">BL {ACTIVE.c.bl} · {vesselShort()} · {ACTIVE.c.origin} → Jebel Ali · {NC} containers</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 flex-wrap">
              {sel !== 'OVERVIEW' && <Btn size="sm" variant="secondary" icon="grid" onClick={() => goTo('OVERVIEW')}>Journey overview</Btn>}
              <Btn size="sm" variant={sel === 'AUDIT' ? 'primary' : 'secondary'} icon="history" onClick={() => goTo('AUDIT')}>View audit log</Btn>
            </span>
            <div className="text-right">
              <p className="text-[24px] text-[#0e1b3d] leading-none" style={{ fontWeight: 700 }}>{doneTracks}<span className="text-[15px] text-[#4f5a78]"> of 4</span></p>
              <p className="text-[14px] text-[#4f5a78] mt-1">tracks done</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper — sticky navigation: pins under the page header and shrinks while you scroll */}
      <div ref={sentinelRef} aria-hidden className="h-0" />
      <nav aria-label="Import journey steps" className={`sticky top-[88px] z-20 transition-[padding,box-shadow,background] duration-200 ${stuck ? 'border-b' : ''}`}
        style={{ background: stuck ? 'rgba(255,255,255,.96)' : '#fff', backdropFilter: stuck ? 'blur(10px)' : undefined, borderColor: '#dde4f0', boxShadow: stuck ? '0 10px 24px -16px rgba(14,27,61,.35)' : 'none' }}>
        <ol className={`flex items-start px-5 sm:px-6 ${stuck ? 'py-2' : 'pt-2 pb-4'}`} aria-label="Track progress">
          {NAV.map((it, n) => {
            const ring = it.state === 'done' ? '#28a745' : it.state === 'you' ? '#f2b200' : it.state === 'blocked' ? '#9aa6bf' : '#1360d2';
            const deg = Math.max(8, it.pct) * 3.6;
            const prevDone = n > 0 && NAV[n - 1].state === 'done';
            const size = stuck ? 32 : 44;
            const active = sel === it.key;
            return (
              <li key={it.key} className="flex-1 flex flex-col items-center relative min-w-0">
                {n > 0 && (
                  <span className="absolute right-1/2 w-full h-[3px] rounded-full overflow-hidden" style={{ top: size / 2 - 1, background: '#e3e8ef' }}>
                    <span className="block h-full rounded-full transition-all duration-700" style={{ width: prevDone && it.state === 'done' ? '100%' : prevDone ? '50%' : '0%', background: 'linear-gradient(90deg,#28a745,#5fd17a)' }} />
                  </span>
                )}
                <button type="button" onClick={() => goTo(it.key)} aria-current={active ? 'step' : undefined} title={`Go to ${it.label}`}
                  className="relative z-[1] rounded-full p-[3px] transition-all hover:scale-105"
                  style={{ width: size, height: size, background: it.state === 'done' ? '#28a745' : `conic-gradient(${ring} ${deg}deg, #e3e8ef ${deg}deg)`, boxShadow: active ? '0 0 0 4px rgba(19,96,210,.22)' : it.state === 'you' ? '0 0 0 6px rgba(242,178,0,.15)' : it.state === 'run' ? '0 0 0 6px rgba(19,96,210,.10)' : 'none' }}>
                  <span className={`size-full rounded-full flex items-center justify-center ${it.state === 'you' ? 'ai-attn' : ''}`}
                    style={{ background: it.state === 'done' ? '#28a745' : it.state === 'you' ? '#f2b200' : '#fff', color: it.state === 'done' || it.state === 'you' ? '#fff' : ring }}>
                    <Icon name={it.icon} size={stuck ? 15 : 17} strokeWidth={1.9} />
                  </span>
                </button>
                <button type="button" onClick={() => goTo(it.key)} className={`text-[14px] mt-[6px] text-center leading-tight px-1 hover:text-[#1360d2] ${stuck ? 'hidden sm:block' : ''}`}
                  style={{ fontWeight: active ? 700 : 600, color: active ? C.blue : C.text }}>{it.label}</button>
                {!stuck && (
                  <span className="text-[14px] mt-[2px] text-center" style={{ color: it.state === 'done' ? '#17703a' : it.state === 'you' ? '#8a5a00' : C.muted, fontWeight: 600 }}>{it.status}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div key={sel} className="ai-page-in border-t" style={{ borderColor: '#dde4f0' }}>
        {/* ── Overview page ── */}
        {sel === 'OVERVIEW' && (
          <>
      {/* ② Needs your action */}
      <section className="px-5 sm:px-6 py-4 ">
        <p className={`${sectionTitle} mb-3`} style={sectionStyle}>Needs your action {todos.length > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[24px] h-[24px] px-[6px] rounded-full text-[14px] text-white align-middle" style={{ background: '#f2b200' }}>{todos.length}</span>}</p>
        {todos.length === 0 ? (
          <p className="text-[14px] text-[#40484f] flex items-center gap-2 rounded-[12px] px-4 py-3 border" style={{ background: allDone ? '#e3f5ea' : '#f7f9fd', borderColor: allDone ? '#cdebd8' : '#e6ebf3' }}>
            <Icon name={allDone ? 'check' : 'sparkle'} size={16} className={allDone ? 'text-[#17703a]' : 'text-[#1360d2]'} />
            {allDone ? 'Nothing left to do. Every track is complete.' : 'Nothing right now. The agents are working and will ask when they need you.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {todos.map(t => (
              <li key={t.k} className="ai-todo flex items-center gap-3 rounded-[14px] px-4 py-3 flex-wrap">
                <span className="size-[36px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 6px 14px -6px rgba(19,96,210,.45)' }}><Icon name={TRACKS[t.k].icon} size={16} /></span>
                <span className="flex-1 min-w-[180px]">
                  <span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{t.item.title}</span>
                  <span className="block text-[14px] text-[#4f5a78]">{t.item.sub}</span>
                </span>
                {t.item.amount && <span className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}><DhAmount value={t.item.amount} /></span>}
                <Btn size="sm" onClick={() => goTo(t.k)}>{t.item.cta}</Btn>
              </li>
            ))}
          </ul>
        )}
      </section>


            {/* The four tracks: each opens as its own page */}
            <section className="px-5 sm:px-6 py-5 border-t" style={{ borderColor: '#dde4f0', background: '#eef2f9' }}>
              <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
                <p className={sectionTitle} style={sectionStyle}>Your four tracks · running at the same time</p>
                <button type="button" onClick={() => goTo('DOCS')} className="text-[14px] text-[#1360d2] hover:underline underline-offset-2 inline-flex items-center gap-1" style={{ fontWeight: 600 }}>
                  <Icon name="doc" size={15} />Documents on this case · {docsList.length - missingDocs} of {docsList.length}
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {KEYS.map((k, n) => {
                  const ti = trackInfo(k);
                  return (
                    <div key={k} className="min-w-0 rounded-[14px] border p-4 flex flex-col gap-3 transition-shadow hover:shadow-md" style={{ borderColor: ti.state === 'you' ? '#efd894' : ti.state === 'done' ? '#c8e6d2' : '#dde5f1', background: '#fff' }}>
                      <button type="button" onClick={() => goTo(k)} className="w-full text-left flex items-start gap-3">
                        <span className="size-[42px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 6px 14px -8px rgba(19,96,210,.6)' }}>
                          <Icon name={TRACKS[k].icon} size={19} strokeWidth={1.8} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[16px] text-[#111838]" style={{ fontWeight: 700 }}>{n + 1}. {META[k].title}</span>
                          <span className="block text-[14px] text-[#4f5a78] mt-[2px] leading-snug">{META[k].what}</span>
                        </span>
                        <span className="flex-shrink-0 hidden sm:inline-flex">{pillFor(k)}</span>
                      </button>
                      <span className="sm:hidden">{pillFor(k)}</span>
                      <div className="mt-auto">{progress(k, true)}</div>
                    </div>
                  );
                })}
              </div>
            </section>

      {/* ④ Recent activity */}
      <section className="px-5 sm:px-6 py-4 border-t" style={{ borderColor: '#dde4f0' }}>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <p className={sectionTitle} style={sectionStyle}>Recent activity</p>
        </div>
        <ul className="grid grid-cols-1 gap-[6px]">
          {latest.map((e, i) => (
            <li key={e.time + e.tool + i} className="text-[14px] flex items-start gap-3">
              <span className="text-[#66708c] w-[104px] flex-shrink-0">{e.time}</span>
              <span className="text-[#111838]"><strong style={{ fontWeight: 600 }}>{e.actor}</strong> · {e.action}</span>
            </li>
          ))}
        </ul>
      </section>
          </>
        )}

        {/* ── Documents page ── */}
        {sel === 'DOCS' && (() => {
          const discharged = idx.V >= len('V') ? NC : Math.max(0, idx.V - ARR);
          const agentsUsed: { k: TrackKey | 'DOCS'; title: string; agents: { name: string; job: string }[] }[] = [
            { k: 'DOCS', title: 'Documents', agents: [
              source === 'containers'
                ? { name: 'Lookup agent', job: `Found BL ${ACTIVE.c.bl} and fetched the documents from ${ACTIVE.c.line}` }
                : { name: 'Document AI', job: 'Read your documents and extracted the shipment fields' },
              { name: 'Cargo owner agent', job: 'Confirmed you are the consignee on the BL' },
            ] },
            { k: 'V', title: META.V.title, agents: [{ name: 'Status agent', job: 'Watches ETA, arrival and container discharge' }] },
            { k: 'D', title: META.D.title, agents: [{ name: 'DO agent', job: `Drafts the delivery order and sends it to ${ACTIVE.c.line}` }] },
            { k: 'C', title: META.C.title, agents: [
              { name: 'HS agent', job: `Checked ${HSL.length} HS codes and the permits they need` },
              ...PERMS.map(p => ({ name: p.agent, job: `${p.type} with ${p.entity} for HS ${p.hs}` })),
              { name: 'Declaration agent', job: 'Drafts the customs declaration with your permits attached' },
            ] },
            { k: 'H', title: META.H.title, agents: [
              { name: 'CargoWaves agent', job: `Books ${HAULIER.name}, your contracted haulier` },
              { name: 'eToken agent', job: 'Issues the eToken for the gate-out' },
            ] },
          ];
          const groupState = (k: TrackKey | 'DOCS') => (k === 'DOCS' ? 'done' : trackInfo(k).state);
          const acts = (name: string) => log.filter(e => e.actor === name || (name === 'Lookup agent' && e.tool === 'container.lookup')).length;
          const card = (icon: string, title: string, sub: React.ReactNode, right: React.ReactNode, body: React.ReactNode) => (
            <div className="bg-white rounded-[16px] border min-w-0 overflow-hidden" style={{ borderColor: '#e1e7f2', boxShadow: '0 2px 10px -6px rgba(14,27,61,.18)' }}>
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b flex-wrap" style={{ borderColor: '#eef1f6', background: 'linear-gradient(180deg,#f7faff,#ffffff)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-[42px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 6px 14px -8px rgba(19,96,210,.6)' }}><Icon name={icon} size={19} /></span>
                  <div className="min-w-0">
                    <h3 className="text-[19px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{title}</h3>
                    <p className="text-[14px] text-[#4f5a78] mt-[2px]">{sub}</p>
                  </div>
                </div>
                {right}
              </div>
              <div className="p-5 sm:p-6">{body}</div>
            </div>
          );
          return (
            <section className="px-5 sm:px-6 py-6 grid grid-cols-1 gap-5" style={{ background: '#eef2f9' }}>
              {card('doc', 'Documents uploaded', <>{docsList.length - missingDocs} of {docsList.length} documents on this case · open any of them to see what was read</>,
                missingDocs > 0 ? <Pill tone="you">{missingDocs} to add</Pill> : <Pill tone="done">All in</Pill>,
                <CaseDocuments hideTitle source={source} files={files} containers={NC} extra={extra}
                  onUpload={t => setExtra(x => ({ ...x, [t]: t === 'Commercial invoice' ? 'Invoice_INV-0931.pdf' : 'Packing_list.pdf' }))} />)}

              {card('ship', 'Shipment details', <>BL {ACTIVE.c.bl} · {ACTIVE.c.origin} → Jebel Ali · {HC}</>, null, <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <Field label="Bill of lading" value={ACTIVE.c.bl} />
                  <Field label="Import case" value={ACTIVE.c.caseId} />
                  <Field label="Shipping line" value={ACTIVE.c.line} />
                  <Field label="Vessel / voyage" value={ACTIVE.c.vessel} />
                  <Field label="Port of loading" value={ACTIVE.c.origin} />
                  <Field label="Port of discharge" value="Jebel Ali T3" />
                  <Field label="Consignee" value={COMPANY} />
                  <Field label="Containers" value={HC} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
                  <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                    <p className="px-3 pt-[10px] pb-2 text-[14px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}><Icon name="box" size={16} className="text-[#1360d2]" />{NC} containers · {discharged} discharged</p>
                    <table className="w-full">
                      <thead><tr className="bg-[#f3f6fb]"><th className={th}>Container</th><th className={th}>Size</th><th className={th}>Status</th></tr></thead>
                      <tbody>{CONTAINERS.map((ct, i) => (
                        <tr key={ct.no} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                          <td className="px-3 py-[9px]" style={{ fontWeight: 600, ...mono }}>{ct.no}</td>
                          <td className="px-3 py-[9px]">{ct.size}</td>
                          <td className="px-3 py-[9px]">{i < discharged ? <Pill tone="done">Discharged · {ct.at}</Pill> : idx.V >= ARR ? <Pill tone="run">Discharging</Pill> : <Pill tone="wait">On board</Pill>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                    <p className="px-3 pt-[10px] pb-2 text-[14px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}><Icon name="decl" size={16} className="text-[#1360d2]" />{HSL.length} HS codes · {HSL.filter(l => l.permit !== 'None needed').length} need a permit</p>
                    <table className="w-full">
                      <thead><tr className="bg-[#f3f6fb]"><th className={th}>HS code</th><th className={th}>Goods</th><th className={th}>Permit</th></tr></thead>
                      <tbody>{HSL.map(l => (
                        <tr key={l.hs} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                          <td className="px-3 py-[9px]" style={{ fontWeight: 600 }}>{l.hs}</td>
                          <td className="px-3 py-[9px]">{l.d}</td>
                          <td className="px-3 py-[9px]">{l.permit === 'None needed' ? <span className="text-[#4f5a78]">None needed</span> : <Pill tone="run">{l.permit === 'Dubai Municipality' ? 'DM' : l.permit}</Pill>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </>)}

              {card('bot', 'AI agents', <>{agentsUsed.reduce((a, g) => a + g.agents.length, 0)} agents across the documents and the four tracks · every action is in the audit log</>,
                <Btn size="sm" variant="secondary" icon="history" onClick={() => goTo('AUDIT')}>View audit log</Btn>,
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {agentsUsed.map(g => {
                    const st = groupState(g.k);
                    return (
                      <div key={g.k} className="rounded-[12px] border p-4" style={{ borderColor: '#e6ebf3', background: '#fbfcff' }}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>{g.title}</span>
                          <Pill tone={st === 'done' ? 'done' : st === 'you' ? 'you' : st === 'blocked' ? 'wait' : 'run'}>{st === 'done' ? 'Done' : st === 'you' ? 'Waiting for you' : st === 'blocked' ? 'Waiting' : 'Working'}</Pill>
                        </div>
                        <ul className="grid grid-cols-1 gap-3">
                          {g.agents.map(a => {
                            const n = acts(a.name);
                            return (
                              <li key={a.name} className="flex items-start gap-3">
                                <span className="size-[34px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="bot" size={16} /></span>
                                <span className="min-w-0">
                                  <span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{a.name}</span>
                                  <span className="block text-[14px] text-[#4f5a78] leading-snug">{a.job}</span>
                                  {n > 0 && <span className="block text-[14px] text-[#17703a] mt-[2px]" style={{ fontWeight: 600 }}>{n} action{n > 1 ? 's' : ''} so far</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>)}
            </section>
          );
        })()}

        {/* ── Audit log so far ── */}
        {sel === 'AUDIT' && (
          <section className="px-5 sm:px-6 py-5"><AuditTrail events={log} tracksDone={doneTracks} openAll /></section>
        )}

        {/* ── One full-width page per track ── */}
        {sel !== 'OVERVIEW' && sel !== 'DOCS' && sel !== 'AUDIT' && (() => {
          const k = sel;
          const n = KEYS.indexOf(k);
          return (
            <section className="px-5 sm:px-6 py-6">
              {flash === k && (
                <p className="ai-rise mb-4 rounded-[12px] px-4 py-3 text-[14px] text-white inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', fontWeight: 600 }}>
                  <Icon name="arrow" size={15} />Up next · the previous track is done, so we opened {META[k].title} for you
                </p>
              )}
              <div className="flex items-start gap-4">
                <span className="size-[52px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 8px 18px -8px rgba(19,96,210,.6)' }}>
                  <Icon name={TRACKS[k].icon} size={24} strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Track {n + 1} of 4</p>
                  <h2 className="text-[22px] sm:text-[24px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{META[k].title}</h2>
                  <p className="text-[15px] text-[#4f5a78] mt-1">{META[k].what}</p>
                </div>
                <span className="flex-shrink-0 hidden sm:inline-flex">{pillFor(k)}</span>
              </div>
              <div className="mt-5 rounded-[14px] px-4 py-4" style={{ background: '#f6f8fc' }}>{progress(k)}</div>

              <div className="mt-5 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
                <aside className="min-w-0 rounded-[14px] border p-3 self-start" style={{ borderColor: '#e3e8f3' }}>
                  <p className="text-[14px] text-[#4f5a78] mb-1 px-[10px]" style={{ fontWeight: 700 }}>Steps in this track</p>
                  <div className="xl:hidden"><StepChecklist items={flowItems(k)} cols /></div>
                  <div className="hidden xl:block"><StepChecklist items={flowItems(k)} /></div>
                </aside>
                <div className="min-w-0">{detail(k)}</div>
              </div>
            </section>
          );
        })()}

        {/* Page footer inside the card (only when no page-level action bar is given) */}
        {!barSlot && sel !== 'OVERVIEW' && (
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t flex-wrap" style={{ borderColor: '#dde4f0', background: '#fbfcfe' }}>
            {prevPage ? <Btn variant="secondary" onClick={() => goTo(prevPage)}>← {pageName(prevPage)}</Btn> : <span />}
            {nextPage && <Btn onClick={() => goTo(nextPage)}>{pageName(nextPage)} →</Btn>}
          </div>
        )}
      </div>
      {mapOpen && <VesselMap vessel={vesselShort()} arrived={idx.V >= ARR} delayed={idx.V >= 2} discharged={Math.min(NC, Math.max(0, idx.V - ARR))} total={NC} onClose={() => setMapOpen(false)} />}
      {barSlot && createPortal(
        <>
          <div className="flex items-center gap-3">
            {prevPage && <Btn size="lg" variant="secondary" onClick={() => goTo(prevPage)}>Back</Btn>}
            <span className="text-[14px] text-[#4f5a78] hidden md:inline">{sel === 'AUDIT' ? 'Audit log' : `Page ${pi + 1} of ${pageOrder.length} · ${pageName(sel)}`}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {allDone && <Btn size="lg" variant={nextPage ? 'secondary' : 'primary'} icon="doc" onClick={() => ask('audit-log', undefined, { events: log, containers: NC, summary: completion })}>Documents and audit log</Btn>}
            {nextPage && <Btn size="lg" onClick={() => goTo(nextPage)}>Next: {pageName(nextPage)}</Btn>}
            {!nextPage && !allDone && sel !== 'AUDIT' && <Btn size="lg" icon="grid" onClick={() => goTo('OVERVIEW')}>Journey overview</Btn>}
          </div>
        </>,
        barSlot,
      )}
    </div>
  );
}

/* ── Final step: the audit log ───────────────────────────────────────── */
export function AuditLogCard({ events, containers = 4, summary }: { events: AuditEvent[]; containers?: number; summary?: CompletionSummary }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {summary ? <ImportComplete summary={summary} /> : <SuccessBanner><strong>Success:</strong> Import <strong>{ACTIVE.c.caseId}</strong> is complete. DO released, declaration cleared and delivery of {containers} containers scheduled with {HAULIER.name}.</SuccessBanner>}
      <AuditTrail events={events} tracksDone={4} />
    </div>
  );
}

/* The audit trail itself: every action so far, filterable */
export function AuditTrail({ events, tracksDone, openAll }: { events: AuditEvent[]; tracksDone: number; openAll?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'agents' | 'you' | 'external'>('all');
  const [showAll, setShowAll] = useState(!!openAll);
  const key = (t: string) => { const [dd, m, hm] = t.split(' '); return `${m === 'Dec' ? 12 : 11}-${dd}-${hm}`; };
  const sorted = [...events].sort((a, b) => key(a.time).localeCompare(key(b.time)));
  const rows = sorted.filter(e => filter === 'all' ? true : filter === 'agents' ? e.kind === 'agent' : filter === 'you' ? e.kind === 'you' : e.kind === 'external' || e.kind === 'signal');
  const byAgents = events.filter(e => e.kind === 'agent').length;
  const byYou = events.filter(e => e.kind === 'you').length;
  const paid = events.reduce((a, e) => a + (e.outcome.startsWith('Paid Dh ') ? Number(e.outcome.slice(8).replace(/,/g, '')) : 0), 0);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const style = (k: Kind) => ({
    agent: { bg: '#eef0ff', fg: '#3a3fb8', icon: 'sparkle' },
    you: { bg: '#fff4d6', fg: '#8a5a00', icon: 'person' },
    external: { bg: '#e6f0ff', fg: '#0f4fab', icon: 'shield' },
    signal: { bg: '#edf0f4', fg: '#40484f', icon: 'bolt' },
  }[k]);
  const trackColor: Record<string, string> = { Documents: '#4f5a78', 'Vessel arrival': '#0f8a8a', 'Trade+ · DO': '#1360d2', 'Integrated Clearance': '#1360d2', CargoWaves: '#b45f06' };

  return (
      <div className="bg-white rounded-[14px] border overflow-hidden" style={{ borderColor: C.border }}>
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[17px] text-[#111838]" style={{ fontWeight: 600 }}>Audit log · {ACTIVE.c.caseId}</p>
            <p className="text-[14px] text-[#4f5a78]">Every step across the four tracks: who did it, the governed tool used, and the outcome</p>
          </div>
          <Btn size="sm" variant="secondary" icon="doc">Download PDF</Btn>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5">
          {[[`${tracksDone} of 4`, tracksDone === 4 ? 'tracks complete' : 'tracks done so far'], [String(byAgents), 'actions by AI agents'], [String(byYou), 'approvals by you'], [<DhAmount key="p" value={fmt(paid)} />, 'paid in total']].map(([val, l], i) => (
            <div key={i} className="rounded-[10px] px-3 py-2" style={{ background: '#f6f8fc' }}>
              <p className="text-[17px] text-[#0e1b3d]" style={{ fontWeight: 700 }}>{val}</p>
              <p className="text-[14px] text-[#4f5a78]">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 px-5 pt-4 pb-2 flex-wrap">
          {([['all', 'All'], ['agents', 'AI agents'], ['you', 'You'], ['external', 'Authorities & partners']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`h-[30px] px-3 rounded-full text-[14px] transition-colors ${filter === k ? 'bg-[#0e1b3d] text-white' : 'bg-[#f3f6fb] text-[#40484f] hover:bg-[#e8eef8]'}`} style={{ fontWeight: 600 }}>{l}</button>
          ))}
        </div>
        <ol className="px-5 pb-4">
          {(showAll ? rows : rows.slice(0, 6)).map((e, i) => {
            const a = style(e.kind);
            return (
              <li key={e.time + e.tool + i} className="grid grid-cols-[28px_1fr] gap-3 py-[10px] border-b last:border-b-0" style={{ borderColor: '#f0f3f8' }}>
                <span className="size-[28px] rounded-full flex items-center justify-center" style={{ background: a.bg, color: a.fg }}><Icon name={a.icon} size={14} /></span>
                <div className="min-w-0 grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-[14px] text-[#111838]"><strong style={{ fontWeight: 600 }}>{e.actor}</strong> <span className="text-[14px] px-[8px] py-[2px] rounded-full ml-1" style={{ background: '#f3f6fb', color: trackColor[e.track] ?? C.muted, fontWeight: 600 }}>{e.track}</span></p>
                    <p className="text-[14px] text-[#40484f] leading-snug">{e.action}</p>
                    <p className="text-[14px] text-[#66708c] mt-[2px]" style={mono}>{e.tool}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[14px] text-[#66708c] whitespace-nowrap">{e.time}</p>
                    <span className="inline-block mt-1 text-[14px] px-[10px] h-[26px] leading-[26px] rounded-full whitespace-nowrap" style={{ background: e.kind === 'you' ? '#fff4d6' : '#e3f5ea', color: e.kind === 'you' ? '#8a5a00' : '#17703a', fontWeight: 600 }}>
                      {e.outcome.startsWith('Paid Dh ') ? <>Paid <DhAmount value={e.outcome.slice(8)} /></> : e.outcome}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {rows.length > 6 && (
          <div className="px-5 pb-3"><Btn size="sm" variant="ghost" icon={showAll ? 'chevDown' : 'chevDown'} className={showAll ? '[&>svg]:rotate-180' : ''} onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${rows.length} entries`}</Btn></div>
        )}
        <p className="px-5 pb-4 text-[14px] text-[#4f5a78] flex items-center gap-2"><Icon name="shield" size={14} className="text-[#1360d2]" /> Agents acted only through governed Dubai Trade APIs. Every payment, submission and booking was approved by you.</p>
      </div>
  );
}
