/* Conversational cards: when the user types in the chat, the assistant answers
 * here and offers the next step, instead of jumping to another page.
 *  - ContainerInfoCard: vessel, arrival (with AIS delay) and map for typed containers,
 *    then asks whether to draft the delivery order request
 *  - ChatDOCard: the DO draft to review and pay, sent to the shipping agent
 *  - ClearanceStatusCard: declaration and permit status (read only)
 *  - NavigatorCard: buttons that take the user to the right page for a step */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DhAmount } from '../Dh';
import { CF_AGENT, COMPANY, DEFAULT_CASE, DO_FEE, THC_PER_CONTAINER, VESSEL, WALLET_BALANCE, lookupContainers } from './data';
import type { Ask } from './flows';
import { VesselMap } from './vesselmap';
import { SlotPicker, slotPicks, slotText, type AuditEvent, type SlotPick } from './journey';
import { ImportComplete, QrCard, docCount, type CompletionSummary } from './complete';
import { caseDocs } from './docs';
import { AgentOrb, Btn, C, Field, Icon, Pill, SuccessBanner } from './ui';

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const card = 'bg-white rounded-[14px] border overflow-hidden';
const cardStyle = { borderColor: '#e1e7f2', boxShadow: '0 8px 28px -18px rgba(14,27,61,.25)' };
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

/* An agent line inside a card's flow: the orb and a chat bubble, lined up with the other
 * replies. The text types itself out; the answer options (children) appear once it's written. */
export function AgentSays({ text, children }: { text: string; children?: React.ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = Date.now() + 450;   // a short pause after the card, like a new message
    const id = window.setInterval(() => setN(Math.max(0, Math.min(text.length, Math.floor((Date.now() - start) / 12)))), 24);
    return () => window.clearInterval(id);
  }, [text]);
  const done = n >= text.length;
  return (
    <>
      <div className="flex gap-3 items-start mb-3 -ml-[50px]">
        <span className="ai-avatar mt-[6px]"><AgentOrb size={38} /></span>
        <div className="ai-bubble px-5 py-4 max-w-[900px] flex-1 min-w-0">
          <p className="text-[16px] text-[#1b2240] leading-relaxed">{n === 0 ? <span className="ai-dots"><i /><i /><i /></span> : text.slice(0, n)}{n > 0 && !done && <span className="ai-caret" aria-hidden />}</p>
        </div>
      </div>
      {done && children && <div className="ai-reveal">{children}</div>}
    </>
  );
}

function Head({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b flex-wrap" style={{ borderColor: '#eef1f6', background: 'linear-gradient(180deg,#f7faff,#fff)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="size-[38px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name={icon} size={18} /></span>
        <span className="min-w-0"><span className="block text-[17px] text-[#0e1b3d]" style={{ fontWeight: 700 }}>{title}</span>{sub && <span className="block text-[14px] text-[#4f5a78]">{sub}</span>}</span>
      </div>
      {right}
    </div>
  );
}

/* Track header, as on the journey's track pages: icon circle, track name, what it does, status */
export function TrackHead({ n, icon, title, what, pill, tone, bar, now }: {
  n: number; icon: string; title: string; what: string; pill: string; tone: 'run' | 'you' | 'done' | 'wait';
  bar?: ('done' | 'you' | 'run' | 'wait')[]; now?: React.ReactNode;
}) {
  const seg = { done: '#28a745', you: '#f2b200', run: '#1360d2', wait: '#e3e8ef' };
  return (
    <div className="px-5 sm:px-6 pt-5 pb-4 border-b" style={{ borderColor: '#eef1f6', background: 'linear-gradient(180deg,#f7faff,#fff)' }}>
      <div className="flex items-start gap-4">
        <span className="size-[52px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 8px 18px -8px rgba(19,96,210,.6)' }}><Icon name={icon} size={24} strokeWidth={1.8} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Track {n} of 4</p>
          <p className="text-[21px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{title}</p>
          <p className="text-[15px] text-[#4f5a78] mt-1">{what}</p>
        </div>
        <span className="flex-shrink-0 hidden sm:inline-flex"><Pill tone={tone}>{pill}</Pill></span>
      </div>
      {bar && (
        <div className="mt-4 rounded-[12px] px-4 py-3" style={{ background: '#f6f8fc' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-[4px]">{bar.map((b, i) => <span key={i} className={`h-[8px] flex-1 rounded-full ${b === 'run' ? 'ai-seg-run' : ''}`} style={b === 'run' ? undefined : { background: seg[b] }} />)}</div>
            <span className="text-[14px] text-[#4f5a78] whitespace-nowrap">Step {Math.min(bar.length, bar.filter(b => b === 'done').length + 1)} of {bar.length}</span>
          </div>
          {now && <p className="text-[14px] mt-2 flex items-center gap-2" style={{ color: tone === 'you' ? '#8a5a00' : tone === 'done' ? '#17703a' : C.blue }}>{now}</p>}
        </div>
      )}
    </div>
  );
}

/* "View more details" toggle used by the short cards */
function More({ open, onClick, label = 'View more details' }: { open: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[14px] text-[#1360d2] hover:underline underline-offset-2" style={{ fontWeight: 600 }}>
      <Icon name="chevDown" size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />{open ? 'Show less' : label}
    </button>
  );
}
/* Short card header: icon, title, one line, status */
function Mini({ icon, title, sub, pill, tone }: { icon: string; title: string; sub: string; pill?: string; tone?: 'run' | 'you' | 'done' | 'wait' }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4">
      <span className="size-[42px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 6px 14px -8px rgba(19,96,210,.6)' }}><Icon name={icon} size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[17px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{title}</span><span className="block text-[14px] text-[#4f5a78] truncate">{sub}</span></span>
      {pill && tone && <Pill tone={tone}>{pill}</Pill>}
    </div>
  );
}
const ONE = ['MSKU0000001'];

/* A small cargo ship, drawn in white */
function ShipGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="6" y="8" width="4" height="4" rx=".6" fill="#fff" />
      <rect x="10.5" y="8" width="4" height="4" rx=".6" fill="#fff" opacity=".85" />
      <rect x="8.2" y="4" width="4" height="3.6" rx=".6" fill="#fff" opacity=".85" />
      <rect x="15" y="6" width="2.4" height="6" rx=".5" fill="#fff" />
      <path d="M2 13h20l-2.6 5.2a1.5 1.5 0 0 1-1.34.8H5.94a1.5 1.5 0 0 1-1.34-.8z" fill="#fff" />
    </svg>
  );
}

/* The vessel at a glance, compact: route with the ship on it, how late, and the times on one line */
export function VesselRoute({ title }: { title?: boolean }) {
  return (
    <div className="rounded-[14px] px-4 py-3 border max-w-[640px]" style={{ background: '#f7f9fd', borderColor: '#e6ebf3' }}>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        {title ? <span className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>MV Sample Voyager 027E</span> : <span />}
        <span className="inline-flex items-center gap-1 h-[24px] px-2 rounded-full text-[14px]" style={{ background: '#fff4d6', color: '#8a5a00', fontWeight: 700 }}><Icon name="clock" size={13} />8 h 30 min late</span>
      </div>
      <div className="flex items-center gap-2">
        <Flag code="CN" /><span className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{DEFAULT_CASE.origin}</span>
        <div className="relative flex-1 h-[30px] mx-1" aria-label="Ship position on the route">
          <span className="absolute left-0 right-0 top-[14px] h-[3px] rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9d4ec 0 7px,transparent 7px 12px)' }} />
          <span className="absolute left-0 top-[14px] h-[3px] rounded-full" style={{ width: '78%', background: 'linear-gradient(90deg,#1360d2,#4f8ff7)' }} />
          <span className="absolute top-[15px] -translate-x-1/2 -translate-y-1/2 size-[28px] rounded-full flex items-center justify-center ai-vessel-dot" style={{ left: '78%', background: '#f2b200' }}><ShipGlyph size={16} /></span>
        </div>
        <span className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>Jebel Ali</span><Flag code="AE" />
      </div>
      <p className="text-[14px] text-[#4f5a78] mt-1">
        ETA <span className="line-through decoration-[#9aa6bf]">{VESSEL.eta}</span> <span aria-hidden>→</span> now <strong className="text-[#8a5a00]" style={{ fontWeight: 700 }}>{VESSEL.revised}</strong> · not arrived yet
      </p>
    </div>
  );
}

/* Small country flags (drawn, so they look the same on every system) */
function Flag({ code }: { code: 'CN' | 'AE' }) {
  const label = code === 'CN' ? 'China' : 'United Arab Emirates';
  return (
    <svg viewBox="0 0 30 20" width="24" height="16" role="img" aria-label={label} className="rounded-[3px] flex-shrink-0" style={{ boxShadow: '0 0 0 1px rgba(14,27,61,.12)' }}>
      {code === 'CN' ? (
        <>
          <rect width="30" height="20" fill="#de2910" />
          <polygon points="5,2.2 5.9,4.9 8.8,4.9 6.5,6.6 7.4,9.3 5,7.7 2.6,9.3 3.5,6.6 1.2,4.9 4.1,4.9" fill="#ffde00" />
          {[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#ffde00" />)}
        </>
      ) : (
        <>
          <rect width="30" height="20" fill="#fff" />
          <rect width="30" height="6.67" fill="#00732f" />
          <rect y="13.33" width="30" height="6.67" fill="#000" />
          <rect width="8" height="20" fill="#ff0000" />
        </>
      )}
    </svg>
  );
}

/* ── Vessel Information: short by default, full details on request ── */
export function ContainerInfoCard({ ask, containers, full, more }: { ask: Ask; containers: string[]; full?: boolean; more?: boolean }) {
  const info = lookupContainers(containers.length ? containers : ONE);
  const [map, setMap] = useState(false);
  const [open, setOpen] = useState(!!full);
  const c0 = info[0];
  const fd = (t: string) => t.replace(/^(\d+ \w+) /, '$1 2027, ');
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={card} style={cardStyle}>
        <Mini icon="ship" title="Vessel Information" sub={`${c0.vessel.replace(' · ', ' ')} · BL ${c0.bl}`} pill="Delayed" tone="you" />
        <div className="px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
          <VesselRoute />
          <p className="text-[14px] text-[#40484f] flex items-start gap-2 rounded-[10px] px-3 py-2" style={{ background: '#fff8e6', border: '1px solid #f2d98a' }}><Icon name="bot" size={16} className="text-[#1360d2] mt-[2px] flex-shrink-0" />Delay found by the AI agent from marine traffic (AIS) data.</p>
          {open && (
            <div className="ai-reveal grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[12px] p-3" style={{ background: '#f7f9fd' }}>
                <Field label="ETA from shipping agent" value={fd(VESSEL.eta)} />
                <Field label="Revised ETA (marine traffic)" value={<span className="text-[#8a5a00]">{fd(VESSEL.revised)}</span>} />
                <Field label="ATA (actual)" value="Not arrived yet" />
                <Field label="Shipping line" value={c0.line} />
              </div>
              <p className="text-[14px] text-[#40484f] leading-snug">On {VESSEL.found} the Status agent saw the vessel sailing at 11.2 knots after slowing for weather in the Gulf of Oman. It moved your delivery order, permit and haulage plans to the new time.</p>
              <div className="flex flex-wrap gap-2">{info.map(c => <span key={c.no} className="inline-flex items-center gap-1 h-[30px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ background: '#eef4ff', fontWeight: 600, ...mono }}><Icon name="box" size={14} />{c.no} · 40' HC · on board</span>)}</div>
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <Btn size="sm" variant="secondary" icon="ship" onClick={() => setMap(true)}>View ship on map</Btn>
            <More open={open} onClick={() => setOpen(o => !o)} />
          </div>
        </div>
      </div>
      {!more && (
        <div>
          <AgentSays text={`Shall I prepare the delivery order request for you? You review and pay, and I'll send it straight to the shipping agent.`}>
            <OptionGrid options={[
            { label: 'Yes, request the delivery order', desc: "I'll draft it with the line charges for you to review and pay", icon: 'do', tone: 'primary', onPick: () => ask('do-draft-chat', 'Yes, create the delivery order draft', { containers: info.map(c => c.no) }) },
            { label: 'Not now', icon: 'clock', onPick: () => ask('not-now', 'Not now') },
          ]} />
          </AgentSays>
        </div>
      )}
      {map && <VesselMap vessel={c0.vessel.replace(' · ', ' ')} arrived={false} delayed discharged={0} total={info.length} onClose={() => setMap(false)} />}
    </div>
  );
}

/* Trade+: would you like future delivery orders automated? */
export function AutoDoSuggestion({ line = 'Mediterranean Shipping' }: { line?: string }) {
  const [on, setOn] = useState(() => { try { return sessionStorage.getItem('dt-auto-do') === '1'; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const toggle = () => { const v = !on; setOn(v); try { sessionStorage.setItem('dt-auto-do', v ? '1' : '0'); } catch { /* not stored */ } };
  return (
    <div className="rounded-[14px] border p-4" style={{ borderColor: on ? '#bfe3cc' : '#cfe0fb', background: on ? 'linear-gradient(180deg,#f2fbf5,#ffffff)' : 'linear-gradient(180deg,#f3f8ff,#ffffff)' }}>
      <div className="flex items-center gap-3">
        <span className="size-[40px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="bot" size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#1360d2] inline-flex items-center gap-1" style={{ fontWeight: 700 }}><Icon name="sparkle" size={14} />AI suggestion</p>
          <p className="text-[16px] text-[#0e1b3d] leading-snug" style={{ fontWeight: 700 }}>Automate future delivery orders?</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label="Automate future delivery orders" onClick={toggle} className="w-[46px] h-[26px] rounded-full relative transition-colors flex-shrink-0" style={{ background: on ? '#28a745' : '#c9d4ec' }}>
          <span className="absolute top-[3px] size-[20px] rounded-full bg-white transition-all shadow" style={{ left: on ? 23 : 3 }} />
        </button>
      </div>
      <p className="text-[14px] text-[#40484f] mt-2">Pay future DOs automatically with your Dubai Trade wallet, valid for the free days.</p>
      {open && (
        <div className="ai-reveal grid grid-cols-1 gap-2 mt-3">
          {[
            ['wallet', 'Same payment method', 'Dubai Trade wallet, as you used today. No review needed.'],
            ['clock', 'Validity from your free days', `${line} gives 5 free days after discharge; the DO is valid until the last free day.`],
            ['shield', 'You stay in control', 'Up to Dh 6,000.00 per DO without asking; above that it waits for you.'],
          ].map(([ic, t, d]) => (
            <div key={t} className="rounded-[10px] px-3 py-2 flex items-start gap-3 bg-white" style={{ border: '1px solid #e6ebf3' }}>
              <Icon name={ic} size={17} className="text-[#1360d2] mt-[2px] flex-shrink-0" />
              <span className="min-w-0"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>{t}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{d}</span></span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2"><More open={open} onClick={() => setOpen(o => !o)} label="View details" /></div>
      {on && <div className="mt-3"><SuccessBanner><strong>Success:</strong> Automatic delivery orders are on for your next imports.</SuccessBanner></div>}
    </div>
  );
}

/* ── Trade+: the DO draft, short with the pay action; charges on request ── */
export function ChatDOCard({ ask, containers, bl, line: lineIn, full }: { ask: Ask; containers: string[]; bl?: string; line?: string; full?: boolean }) {
  const info = lookupContainers(containers.length ? containers : ONE);
  const n = info.length;
  const total = money(DO_FEE + n * THC_PER_CONTAINER);
  const [validity, setValidity] = useState('2027-12-05');
  const [method, setMethod] = useState(0);
  const [paid, setPaid] = useState(false);
  const [open, setOpen] = useState(!!full);
  const line = lineIn ?? info[0].line;
  const blNo = bl ?? info[0].bl;
  const pay = () => { setPaid(true); setTimeout(() => ask('do-sent', undefined, { line, total }), 600); };
  return (
    <div className={card} style={cardStyle}>
      <Mini icon="do" title="Trade+ · Delivery order" sub={`BL ${blNo} · ${n} container${n > 1 ? 's' : ''} · ${line}`} pill={paid ? 'Paid · sent' : 'Needs you'} tone={paid ? 'done' : 'you'} />
      <div className="px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
        <p className="text-[15px] text-[#111838]">Total to pay <strong className="text-[20px]" style={{ fontWeight: 700 }}><DhAmount value={total} /></strong></p>
        {open && (
          <div className="ai-reveal grid grid-cols-1 gap-[6px] text-[14px] rounded-[12px] p-3" style={{ background: '#f7f9fd' }}>
            <div className="flex justify-between gap-4"><span className="text-[#40484f]">Delivery order fee</span><DhAmount value={money(DO_FEE)} /></div>
            <div className="flex justify-between gap-4"><span className="text-[#40484f]">Terminal handling ({n} × {THC_PER_CONTAINER.toFixed(2)})</span><DhAmount value={money(n * THC_PER_CONTAINER)} /></div>
            <div className="flex justify-between gap-4"><span className="text-[#40484f]">Container deposit</span><span className="text-[#17703a]">Waived · guarantee on file</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#40484f]">Consignee</span><span>{COMPANY}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#40484f]">Containers</span><span style={mono}>{info.map(c => c.no).join(', ')}</span></div>
          </div>
        )}
        {paid ? (
          <SuccessBanner><strong>Success:</strong> Paid <DhAmount value={total} /> and sent to {line} for release.</SuccessBanner>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>Valid until
              <input type="date" value={validity} onChange={e => setValidity(e.target.value)} className="mt-1 w-full h-[40px] rounded-[6px] px-3 text-[14px] bg-white outline-none focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb', fontWeight: 400 }} />
            </label>
            <label className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>Pay with
              <select value={method} onChange={e => setMethod(Number(e.target.value))} className="mt-1 w-full h-[40px] rounded-[6px] px-3 text-[14px] bg-white outline-none focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb', fontWeight: 400 }}>
                <option value={0}>Wallet · Dh {WALLET_BALANCE}</option>
                <option value={1}>Credit facility</option>
              </select>
            </label>
            <Btn onClick={pay}>Pay and send</Btn>
          </div>
        )}
        <More open={open} onClick={() => setOpen(o => !o)} />
      </div>
    </div>
  );
}

/* ── Integrated Clearance: status only, short; permits and fields on request ── */
export function ClearanceStatusCard({ full }: { full?: boolean }) {
  const [view, setView] = useState(false);
  const [open, setOpen] = useState(!!full);
  const permits = [
    { abbr: 'DM', title: 'Food import permit', ref: 'DM-PRM-27-55120', from: 'Dubai Municipality' },
    { abbr: 'SIRA', title: 'Security equipment import permit', ref: 'SIRA-27-08841', from: 'SIRA' },
  ];
  return (
    <div className={card} style={cardStyle}>
      <Mini icon="decl" title="Integrated Clearance" sub={`Declaration 101-27-0049310 · filed by ${CF_AGENT}`} pill="Cleared" tone="done" />
      <div className="px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
        <p className="text-[15px] text-[#111838]">Cleared through the <strong style={{ fontWeight: 700 }}>green channel</strong> · <strong style={{ fontWeight: 700 }}>2 permits</strong> approved</p>
        {open && (
          <div className="ai-reveal grid grid-cols-1 gap-2">
            {permits.map(p => (
              <div key={p.ref} className="rounded-[10px] px-3 py-[10px] flex items-center gap-3" style={{ background: '#f7f9fd' }}>
                <span className="w-[48px] h-[38px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 800 }}>{p.abbr}</span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{p.title}</span><span className="block text-[14px] text-[#4f5a78]">{p.from} · {p.ref}</span></span>
                <Pill tone="done">Approved</Pill>
              </div>
            ))}
            <p className="text-[14px] text-[#4f5a78]">I only check status. Your C&F agent files the declaration and pays the duty.</p>
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <Btn size="sm" variant="secondary" icon="eye" onClick={() => setView(true)}>View declaration</Btn>
          <More open={open} onClick={() => setOpen(o => !o)} />
        </div>
      </div>
      {view && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(14,27,61,.55)' }} onClick={() => setView(false)} role="dialog" aria-modal="true" aria-label="Declaration details">
          <div className="bg-white rounded-[16px] overflow-hidden w-full max-w-[900px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#0e1b3d' }}>
              <span><span className="block text-[18px] text-white" style={{ fontWeight: 700 }}>Import declaration 101-27-0049310</span><span className="block text-[14px] text-[#c9d6f2]">From Dubai Customs · read only</span></span>
              <button type="button" onClick={() => setView(false)} aria-label="Close" className="size-[40px] rounded-full flex items-center justify-center text-white hover:bg-white/10"><Icon name="x" size={20} /></button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {([
                ['Status', 'Cleared · green channel'], ['Type', 'Import for local consumption'], ['Filed by', CF_AGENT], ['Importer', COMPANY],
                ['Bill of lading', DEFAULT_CASE.bl], ['Vessel / voyage', DEFAULT_CASE.vessel], ['Port of discharge', 'Jebel Ali T3'], ['Containers', "1 × 40' HC"],
                ['Submitted', '24 Nov 2027, 08:50'], ['Cleared', '30 Nov 2027, 19:10'], ['Customs value', <DhAmount key="v" value="103,150.00" />], ['Permits attached', 'DM-PRM-27-55120, SIRA-27-08841'],
              ] as [string, React.ReactNode][]).map(([l, v]) => <Field key={l} label={l} value={v} />)}
            </div>
            <div className="px-5 py-4 border-t flex justify-end" style={{ borderColor: '#eef1f6' }}><Btn variant="secondary" onClick={() => setView(false)}>Close</Btn></div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Smart navigator: takes the user to the right page for a step ── */
export function NavigatorCard({ items }: { items: { icon: string; title: string; sub: string; go: () => void }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(it => (
        <button key={it.title} type="button" onClick={it.go} className="text-left bg-white rounded-[14px] border px-4 py-4 flex items-start gap-3 transition-all hover:-translate-y-[1px]"
          style={cardStyle} onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue)} onMouseLeave={e => (e.currentTarget.style.borderColor = '#e1e7f2')}>
          <span className="size-[40px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name={it.icon} size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-[#0e1b3d]" style={{ fontWeight: 700 }}>{it.title}</span>
            <span className="block text-[14px] text-[#4f5a78] leading-snug">{it.sub}</span>
          </span>
          <Icon name="arrow" size={16} className="text-[#1360d2] mt-[3px]" />
        </button>
      ))}
    </div>
  );
}

/* ── Conversational import flow ─────────────────────────────────────────── */
const SAMPLE_BL = 'BL_MEDU48210937.pdf';
const SAMPLE_NOS = ['MSKU0000001'];
export const CHAT_SLOTS = [
  { k: 'earliest', label: 'Earliest available', when: 'Wed 1 Dec · 08:00–10:00', note: 'Medium gate queue · 4 trucks ready' },
  { k: 'lowest', label: 'Lowest gate queue', when: 'Wed 1 Dec · 18:00–20:00', note: 'Short queue · fastest gate-out' },
  { k: 'next', label: 'Next morning', when: 'Thu 2 Dec · 06:00–08:00', note: 'Low queue · within free time' },
];

/* Upload the bill of lading inside the chat */
export function BlUploadCard({ ask }: { ask: Ask }) {
  const [drag, setDrag] = useState(false);
  const [sent, setSent] = useState(false);
  const send = (name?: string) => { if (sent) return; setSent(true); ask('cv-bl', `Uploaded ${name ?? SAMPLE_BL}`, { files: [name ?? SAMPLE_BL] }); };
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]?.name); }}
      className="rounded-[14px] border-2 border-dashed px-5 py-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
      style={{ borderColor: drag ? C.blue : '#b9cdf0', background: drag ? '#eef4ff' : 'linear-gradient(135deg,#ffffff,#f3f7ff)', opacity: sent ? 0.6 : 1 }}>
      <span className="size-[52px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="upload" size={22} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] text-[#111838]" style={{ fontWeight: 700 }}>Drop your bill of lading here</span>
        <span className="block text-[14px] text-[#4f5a78]">One file · PDF, JPG or PNG · or use the paperclip in the chat box</span>
      </span>
      <span className="flex gap-2 flex-wrap justify-center">
        <label className={`inline-flex items-center gap-2 h-[34px] px-[14px] rounded-[6px] text-[14px] text-white ${sent ? 'pointer-events-none' : 'cursor-pointer'}`} style={{ background: C.blue, fontWeight: 500 }}>
          <Icon name="clip" size={15} />Choose file
          <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={e => send(e.target.files?.[0]?.name)} />
        </label>
        <Btn size="sm" variant="secondary" onClick={() => send()} disabled={sent}>Use the sample BL</Btn>
      </span>
    </div>
  );
}

/* What Document AI read from the BL (or what the line returned for the container) */
export function BlSummaryCard({ ask, source, file, containers, full, more }: { ask: Ask; source: 'documents' | 'containers'; file?: string; containers?: string[]; full?: boolean; more?: boolean }) {
  const nos = containers?.length ? containers : SAMPLE_NOS;
  const rows = lookupContainers(nos);
  const [open, setOpen] = useState(!!full);
  const go = (yes: boolean) => ask(yes ? 'cv-start' : 'not-now', yes ? 'Yes, start the import journey' : 'Not now', { containers: nos, source });
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={card} style={cardStyle}>
        <Mini icon="doc" title={`BL ${DEFAULT_CASE.bl}`} sub={source === 'documents' ? `Read from ${file ?? SAMPLE_BL}` : `Fetched from ${DEFAULT_CASE.line}`} pill={source === 'documents' ? 'Read' : 'Found'} tone="done" />
        <div className="px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-[15px] text-[#111838]">
            <span className="inline-flex items-center gap-2"><span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name="ship" size={15} /></span><span style={{ fontWeight: 600 }}>{DEFAULT_CASE.vessel.replace(' · ', ' ')}</span></span>
            <span className="inline-flex items-center gap-2">
              <Flag code="CN" /><span>{DEFAULT_CASE.origin}</span>
              <Icon name="arrow" size={15} className="text-[#4f5a78]" />
              <Flag code="AE" /><span>Jebel Ali</span>
            </span>
            <span className="inline-flex items-center gap-2"><span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name="box" size={15} /></span><span style={{ fontWeight: 700, ...mono }}>{rows.map(c => c.no).join(', ')}</span></span>
          </div>
          {open && (
            <div className="ai-reveal grid grid-cols-2 gap-x-6 gap-y-3 rounded-[12px] p-3" style={{ background: '#f7f9fd' }}>
              <Field label="Shipping line" value={DEFAULT_CASE.line} />
              <Field label="Consignee" value={COMPANY} />
              <Field label="Shipper" value="Sinopower Electric Co." />
              <Field label="Container" value={`${rows.length} × 40' HC`} />
            </div>
          )}
          <More open={open} onClick={() => setOpen(o => !o)} />
        </div>
      </div>
      {!more && (
        <div>
          <AgentSays text={`Everything looks in order. Shall I open the import case? I'll take you through it one step at a time, starting with the vessel.`}>
            <OptionGrid options={[
            { label: 'Yes, start the journey', desc: 'Open the case and let the agents begin', icon: 'flow', onPick: () => go(true) },
            { label: 'Not now', desc: 'Keep the BL; start later', icon: 'clock', tone: 'quiet', onPick: () => go(false) },
          ]} />
          </AgentSays>
        </div>
      )}
    </div>
  );
}

/* The import case is open */
export function JourneyStartedCard({ open }: { open: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <SuccessBanner><strong>Success:</strong> Import case <strong>IMP-2027-00422</strong> has been created for BL <strong>{DEFAULT_CASE.bl}</strong>.</SuccessBanner>
    </div>
  );
}

/* Create delivery order: the BLs the DO agent has drafted, to pick one in the chat */
export function DOPickCard({ ask, drafts }: { ask: Ask; drafts: { caseId: string; bl: string; line: string; containers: string[]; status: string }[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-2">
      {drafts.map(x => {
        const amt = money(DO_FEE + x.containers.length * THC_PER_CONTAINER);
        const on = picked === x.bl;
        return (
          <div key={x.bl} className="bg-white rounded-[14px] border px-4 py-3 flex items-center gap-3 flex-wrap" style={{ ...cardStyle, borderColor: on ? C.blue : '#e1e7f2' }}>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-[#0e1b3d]" style={{ fontWeight: 700, ...mono }}>BL {x.bl}</span>
              <span className="block text-[14px] text-[#4f5a78]">{x.caseId} · {x.line} · {x.containers.length} containers · {x.status}</span>
            </span>
            <span className="text-[15px] text-[#0e1b3d]" style={{ fontWeight: 700 }}><DhAmount value={amt} /></span>
            <Btn size="sm" variant={on ? 'primary' : 'secondary'} disabled={!!picked} onClick={() => { setPicked(x.bl); ask('do-draft-chat', `Review the DO for BL ${x.bl}`, { containers: x.containers, bl: x.bl, line: x.line }); }}>{on ? 'Chosen' : 'Review this DO'}</Btn>
          </div>
        );
      })}
    </div>
  );
}

/* Cargo Waves: three quick slot picks; the full slot picker on request */
export function SlotChatCard({ ask, full }: { ask: Ask; full?: boolean }) {
  const picks = slotPicks(1);
  const quick: [string, SlotPick][] = [['Earliest available', picks.earliest], ['Lowest gate queue', picks.lowest], ['Recommended', picks.best]];
  const [slot, setSlot] = useState<SlotPick>(picks.best);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(!!full);
  const same = (a: SlotPick, b: SlotPick) => a.d === b.d && a.t === b.t;
  const create = () => { setDone(true); ask('cv-booked', `Create the eToken for ${slotText(slot)}`, { slot: slotText(slot) }); };
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={card} style={cardStyle}>
        <Mini icon="truck" title="Create eToken" sub="Cargo Waves · pick a delivery slot with Al Bahar Transport LLC" pill={done ? 'eToken requested' : 'Needs you'} tone={done ? 'done' : 'you'} />
        <div className="px-4 pb-4 pt-3 grid grid-cols-1 gap-3">
          {done ? <SuccessBanner><strong>Success:</strong> Slot <strong>{slotText(slot)}</strong> sent to Al Bahar Transport and the eToken requested from DP World.</SuccessBanner> : (
            <>
              {!open && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {quick.filter((q, i, a) => a.findIndex(x => same(x[1], q[1])) === i).map(([label, p]) => (
                    <button key={label} type="button" onClick={() => setSlot(p)} className="text-left rounded-[12px] px-3 py-3 border transition-colors"
                      style={{ borderColor: same(slot, p) ? C.blue : '#e3e8f3', background: same(slot, p) ? '#f3f8ff' : '#fff' }}>
                      <span className="block text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>{label}</span>
                      <span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{slotText(p)}</span>
                    </button>
                  ))}
                </div>
              )}
              {open && <div className="ai-reveal"><SlotPicker value={slot} onChange={setSlot} need={1} /></div>}
              <div className="flex items-center gap-3 flex-wrap">
                <Btn variant="secondary" icon={open ? 'chevDown' : 'grid'} className={open ? '[&>svg]:rotate-180' : ''} onClick={() => setOpen(o => !o)}>{open ? 'Show fewer slots' : 'View more slots'}</Btn>
                <span className="text-[14px] text-[#4f5a78]">Selected: <strong className="text-[#111838]" style={{ fontWeight: 700 }}>{slotText(slot)}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>
      <div>
        <AgentSays text={`Would you like me to create the eToken with these details? I'll send the order to Al Bahar Transport for your chosen slot and ask DP World for the eToken.`}>
          <OptionGrid options={[
            { label: 'Create eToken', desc: `For ${slotText(slot)} · Al Bahar Transport`, icon: 'truck', tone: 'primary', onPick: create },
            { label: 'Not now', icon: 'clock', onPick: () => ask('not-now', 'Not now') },
          ]} />
        </AgentSays>
      </div>
    </div>
  );
}

/* Delivery booked: the celebration, the truck on its way and the QR code; then what's next */
export function DeliveryDoneCard({ ask, slot }: { ask: Ask; slot: string; open?: () => void; full?: boolean }) {
  const summary: CompletionSummary = {
    containers: ONE, plates: ['Dubai F 48213'],
    slot, doPaid: money(DO_FEE + THC_PER_CONTAINER), declNo: '101-27-0049310',
    docs: caseDocs('documents', [SAMPLE_BL], {}),
    permits: [
      { abbr: 'DM', title: 'Food import permit', ref: 'DM-PRM-27-55120', from: 'Dubai Municipality' },
      { abbr: 'SIRA', title: 'Security equipment import permit', ref: 'SIRA-27-08841', from: 'SIRA' },
    ],
  };
  const [tracked, setTracked] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-3">
      <ImportComplete summary={summary} brief tracks={<JourneyStepper stage={4} bare />} onTracked={() => setTracked(true)} />
      {tracked && <div className="max-w-[820px] ai-reveal">
        <AgentSays text={`We're sharing a QR code with you. Scan it to track your cargo and download the documents you need, like the delivery order, eToken and permits.`}>
          <div className="mb-5"><QrCard count={docCount(summary)} /></div>
          <AgentSays text={`Is there anything else I can help you with, or would you like to view the audit log for this import?`}>
            <OptionGrid options={[
            { label: 'View the audit log', desc: 'Every step, who did it and the outcome', icon: 'history', onPick: () => ask('cv-audit', 'Show me the audit log') },
            { label: 'I need other help', desc: 'Start another import or ask a question', icon: 'chat', onPick: () => ask('cv-help', 'I need some other help') },
          ]} />
          </AgentSays>
        </AgentSays>
      </div>}
    </div>
  );
}

/* The audit log for the chat journey */
export const CHAT_AUDIT: AuditEvent[] = [
  { time: '24 Nov 09:20', track: 'Documents', actor: 'Document AI', kind: 'agent', action: 'Read BL MEDU48210937 and container MSKU0000001', tool: 'docai.read', outcome: 'Done' },
  { time: '24 Nov 09:22', track: 'Documents', actor: 'You', kind: 'you', action: 'Opened import case IMP-2027-00422', tool: 'case.create', outcome: 'Approved' },
  { time: '24 Nov 09:33', track: 'Vessel arrival', actor: 'Status agent', kind: 'agent', action: `ETA ${VESSEL.eta} confirmed with the shipping line`, tool: 'portcall.eta', outcome: 'Done' },
  { time: VESSEL.found, track: 'Vessel arrival', actor: 'Status agent', kind: 'agent', action: `Marine traffic (AIS) shows the vessel about 8 h late; revised ETA ${VESSEL.revised}`, tool: 'marinetraffic.ais', outcome: 'Delay found' },
  { time: '24 Nov 09:52', track: 'Trade+ · DO', actor: 'DO agent', kind: 'agent', action: 'Drafted the delivery order request with Mediterranean Shipping charges', tool: 'do.draft', outcome: 'Draft ready' },
  { time: '24 Nov 10:02', track: 'Trade+ · DO', actor: 'You', kind: 'you', action: 'Reviewed and paid the delivery order (wallet)', tool: 'tradepay.pay', outcome: `Paid Dh ${money(DO_FEE + THC_PER_CONTAINER)}` },
  { time: '24 Nov 10:03', track: 'Trade+ · DO', actor: 'DO agent', kind: 'agent', action: 'Sent the paid request to Mediterranean Shipping', tool: 'do.submit', outcome: 'Submitted' },
  { time: '24 Nov 10:06', track: 'Integrated Clearance', actor: 'Clearance agent', kind: 'agent', action: `Declaration 101-27-0049310 filed by ${CF_AGENT}: cleared, green channel`, tool: 'declaration.status', outcome: 'Cleared' },
  { time: '24 Nov 10:07', track: 'Integrated Clearance', actor: 'Clearance agent', kind: 'agent', action: 'DM and SIRA permits checked: both approved', tool: 'permit.status', outcome: 'Approved' },
  { time: '24 Nov 10:15', track: 'CargoWaves', actor: 'You', kind: 'you', action: 'Chose the delivery slot and asked for the eToken', tool: 'cargowaves.order.confirm', outcome: 'Confirmed' },
  { time: '30 Nov 19:28', track: 'CargoWaves', actor: 'DP World', kind: 'external', action: 'Generated eToken ET-27-0091602 for 1 truck', tool: 'etoken.issue', outcome: 'Issued' },
];

/* My import journey, as a status summary in the chat */
export function JourneyStatusCard({ open }: { open: () => void }) {
  const rows: [string, string, string, 'run' | 'you' | 'done' | 'wait'][] = [
    ['ship', 'Vessel Arrival Notice', `Delayed · revised ETA ${VESSEL.revised} (shipping agent said ${VESSEL.eta})`, 'run'],
    ['do', 'Trade+', 'Delivery order draft ready · needs your payment', 'you'],
    ['decl', 'Integrated Clearance', 'Declaration in review · both permits approved', 'run'],
    ['truck', 'Cargo Waves', 'Delivery slot to choose once the DO is released', 'wait'],
  ];
  return (
    <div className={card} style={cardStyle}>
      <Head icon="flow" title="Import journey · IMP-2027-00422" sub={`BL ${DEFAULT_CASE.bl} · ${DEFAULT_CASE.vessel} · 1 container`} />
      <div className="p-5 grid grid-cols-1 gap-2">
        {rows.map(([ic, t, s, st]) => (
          <div key={t} className="rounded-[12px] px-3 py-3 flex items-center gap-3" style={{ background: '#f7f9fd' }}>
            <span className="size-[34px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name={ic} size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>{t}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{s}</span></span>
            <Pill tone={st}>{st === 'you' ? 'Needs you' : st === 'run' ? 'In progress' : 'Later'}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Home: the three ways in, styled like the Permits & Certificates assistant ── */
const CHOICES = [
  { key: 'recent', label: 'Previously Applied', desc: 'Quickly repeat an import from your history', grad: 'linear-gradient(145deg, #1e3a8a 0%, #1360d2 100%)', glow: 'rgba(19,96,210,0.45)',
    icon: (<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></svg>) },
  { key: 'assistant', label: 'Find with Assistant', desc: "Answer a few questions and I'll guide your import", grad: 'linear-gradient(145deg, #1560a8 0%, #0ea5e9 100%)', glow: 'rgba(14,165,233,0.45)',
    icon: (<svg viewBox="0 0 24 12" width="30" height="15" fill="none"><circle cx="1.5" cy="9" r="1.8" fill="rgba(255,255,255,0.9)" /><circle cx="5.5" cy="4" r="1.8" fill="rgba(255,255,255,0.9)" /><circle cx="9.5" cy="1.5" r="1.8" fill="rgba(255,255,255,0.9)" /><circle cx="13.5" cy="4" r="1.8" fill="rgba(255,255,255,0.9)" /><circle cx="17.5" cy="9" r="1.8" fill="rgba(255,255,255,0.9)" /><circle cx="21.5" cy="4" r="1.8" fill="rgba(255,255,255,0.9)" /><polyline points="1.5,9 5.5,4 9.5,1.5 13.5,4 17.5,9 21.5,4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" strokeDasharray="1.5 2" /></svg>) },
  { key: 'search', label: 'Search by Name', desc: 'Know the exact service? Search it directly', grad: 'linear-gradient(145deg, #0c4a6e 0%, #0369a1 100%)', glow: 'rgba(3,105,161,0.45)',
    icon: (<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>) },
];

export function ChoiceCards({ ask }: { ask: Ask }) {
  const [hov, setHov] = useState('');
  const go = (k: string) => {
    if (k === 'recent') ask('cv-history', 'Show my previous imports');
    else if (k === 'assistant') ask('start-import', 'Help me start an import');
    else ask('cv-search', 'I want to search for a service');
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[820px] mx-auto w-full">
      {CHOICES.map((c, i) => {
        const h = hov === c.key;
        return (
          <button key={c.key} type="button" onClick={() => go(c.key)} onMouseEnter={() => setHov(c.key)} onMouseLeave={() => setHov('')}
            className="ai-choice flex flex-col items-center justify-center gap-[10px] min-h-[150px] rounded-[18px] px-4 py-5 text-center"
            style={{ background: c.grad, animationDelay: `${i * 80}ms`, boxShadow: h ? `0 12px 36px ${c.glow}, 0 4px 12px ${c.glow}` : `0 4px 20px ${c.glow.replace('0.45', '0.25')}`, transform: h ? 'translateY(-5px) scale(1.03)' : 'none', transition: 'all .22s cubic-bezier(0.34,1.4,0.64,1)' }}>
            <span className="size-[48px] rounded-[12px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', boxShadow: h ? '0 0 20px rgba(255,255,255,0.2)' : 'none' }}>{c.icon}</span>
            <span>
              <span className="block text-[16px] text-white leading-tight" style={{ fontWeight: 700 }}>{c.label}</span>
              <span className="block text-[14px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Previously applied: recent imports to repeat */
export function HistoryCard({ ask, cases }: { ask: Ask; cases: { id: string; bl: string; vessel: string; route: string; containers: string; next: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {cases.map(c => (
        <div key={c.id} className="bg-white rounded-[14px] border px-4 py-3 flex items-center gap-3 flex-wrap" style={cardStyle}>
          <span className="size-[38px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="history" size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-[#0e1b3d]" style={{ fontWeight: 700 }}>{c.id} · BL {c.bl}</span>
            <span className="block text-[14px] text-[#4f5a78]">{c.vessel} · {c.route} · {c.containers}</span>
          </span>
          <Btn size="sm" variant="secondary" icon="play" onClick={() => ask('start-import', `Repeat ${c.id} with the same line and haulier`)}>Repeat this import</Btn>
        </div>
      ))}
    </div>
  );
}

/* ── Answer options: bigger boxes with an icon, a label and a line of help ── */
export type Option = { label: string; desc?: string; icon: string; onPick: () => void; tone?: 'primary' | 'quiet' };
export function OptionGrid({ options }: { options: Option[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: Option) => { if (picked) return; setPicked(o.label); o.onPick(); };
  const main = options.filter(o => o.tone === 'primary');
  /* When one option matters most (requesting the delivery order), it is the big action and the rest are text links */
  if (main.length) {
    const rest = options.filter(o => o.tone !== 'primary');
    return (
      <div className="grid grid-cols-1 gap-3 max-w-[780px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {main.map(o => {
            const chosen = picked === o.label;
            return (
              <button key={o.label} type="button" disabled={picked !== null} onClick={() => pick(o)}
                className={`ai-opt group text-left rounded-[16px] px-4 py-[14px] flex items-center gap-3 border ${chosen ? 'is-chosen' : ''}`}
                style={{ opacity: picked !== null && !chosen ? 0.45 : 1 }}>
                <span className="ai-opt-icon size-[46px] rounded-[12px] flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(145deg,#1560a8,#0ea5e9)' }}>
                  <Icon name={chosen ? 'check' : o.icon} size={21} strokeWidth={chosen ? 2.4 : 1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-[#111838] leading-snug" style={{ fontWeight: 700 }}>{o.label}</span>
                  {o.desc && <span className="block text-[14px] text-[#4f5a78] leading-snug mt-[2px]">{o.desc}</span>}
                </span>
                <Icon name="chev" size={16} className="ai-opt-chev text-[#9aa6bf] flex-shrink-0" />
              </button>
            );
          })}
        </div>
        {rest.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] text-[#4f5a78] mr-1">Or</span>
            {rest.map(o => (
              <button key={o.label} type="button" disabled={picked !== null} onClick={() => pick(o)}
                className={`ai-opt-alt inline-flex items-center gap-2 h-[38px] px-[14px] rounded-full text-[14px] ${picked === o.label ? 'is-chosen' : ''}`}
                style={{ opacity: picked !== null && picked !== o.label ? 0.45 : 1 }}>
                <Icon name={picked === o.label ? 'check' : o.icon} size={15} className="text-[#4f5a78]" />{o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`grid grid-cols-1 ${options.length > 1 ? 'sm:grid-cols-2' : ''} gap-3 max-w-[780px]`}>
      {options.map((o, i) => {
        const chosen = picked === o.label;
        const dim = picked !== null && !chosen;
        return (
          <button key={o.label} type="button" disabled={picked !== null} onClick={() => pick(o)}
            className={`ai-opt group text-left rounded-[16px] px-4 py-[14px] flex items-center gap-3 border ${chosen ? 'is-chosen' : ''}`}
            style={{ animationDelay: `${i * 60}ms`, opacity: dim ? 0.45 : 1 }}>
            <span className="ai-opt-icon size-[46px] rounded-[12px] flex items-center justify-center text-white flex-shrink-0"
              style={{ background: o.tone === 'quiet' ? 'linear-gradient(145deg,#6b7a99,#97a3b8)' : 'linear-gradient(145deg,#1560a8,#0ea5e9)' }}>
              <Icon name={chosen ? 'check' : o.icon} size={21} strokeWidth={chosen ? 2.4 : 1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-[#111838] leading-snug" style={{ fontWeight: 700 }}>{o.label}</span>
              {o.desc && <span className="block text-[14px] text-[#4f5a78] leading-snug mt-[2px]">{o.desc}</span>}
            </span>
            <Icon name="chev" size={16} className="ai-opt-chev text-[#9aa6bf] flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

/* ── The journey stepper, shown in the chat: the step the conversation has reached is highlighted ── */
const STEPS = [
  { k: 'V', label: 'Vessel Information', icon: 'ship' },
  { k: 'D', label: 'Trade+', icon: 'do' },
  { k: 'C', label: 'Integrated Clearance', icon: 'decl' },
  { k: 'H', label: 'Cargo Waves', icon: 'truck' },
];
/* stage = index of the current step (0–3); 4 = all done */
export function JourneyStepper({ stage, bare }: { stage: number; bare?: boolean }) {
  const state = (i: number) => (i < stage ? 'done' : i === stage ? 'now' : 'next');
  return (
    <div className={bare ? '' : 'rounded-[14px] border bg-white px-3 sm:px-4 pt-3 pb-3 mb-3'} style={bare ? undefined : { borderColor: '#e1e7f2', boxShadow: '0 1px 3px rgba(14,27,61,.05)' }}>
      {!bare && <div className="flex items-center justify-between gap-2 mb-2 px-1 flex-wrap">
        <span className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Import journey · IMP-2027-00422</span>
        <span className="text-[14px] text-[#4f5a78]">{Math.min(stage, 4)} of 4 done</span>
      </div>}
      <ol className="flex items-start" aria-label="Import journey progress">
        {STEPS.map((s, i) => {
          const st = state(i);
          return (
            <li key={s.k} className="flex-1 flex flex-col items-center relative min-w-0" aria-current={st === 'now' ? 'step' : undefined}>
              {i > 0 && <span className="absolute right-1/2 w-full h-[3px] rounded-full" style={{ top: 17, background: i <= stage ? '#28a745' : '#e3e8ef' }} />}
              <span className="relative z-[1] size-[36px] rounded-full flex items-center justify-center"
                style={{ background: st === 'done' ? '#28a745' : st === 'now' ? C.blue : '#fff', color: st === 'next' ? '#9aa6bf' : '#fff', border: st === 'next' ? '2px solid #d5ddea' : 'none', boxShadow: st === 'now' ? '0 0 0 6px rgba(19,96,210,.16)' : 'none' }}>
                <Icon name={s.icon} size={16} strokeWidth={1.9} />
              </span>
              <span className="text-[14px] mt-[6px] text-center leading-tight px-1 hidden sm:block" style={{ fontWeight: st === 'now' ? 700 : 600, color: st === 'now' ? C.blue : st === 'done' ? '#111838' : C.muted }}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* Only on request: which agents are on this import */
export function AgentsListCard() {
  const rows: [string, string, string, string][] = [
    ['ship', 'Vessel Information', 'Status agent', 'Following the ship and the container discharge'],
    ['do', 'Trade+', 'DO agent', 'Drafts the delivery order when you are ready'],
    ['decl', 'Integrated Clearance', 'Clearance agent', 'Checks the declaration and permit status'],
    ['truck', 'Cargo Waves', 'CargoWaves agent', 'Offers delivery slots with your haulier'],
  ];
  return (
    <div className="grid grid-cols-1 gap-2">
      {rows.map(([ic, track, agent, job]) => (
        <div key={track} className="bg-white rounded-[12px] border px-4 py-3 flex items-center gap-3" style={cardStyle}>
          <span className="size-[36px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name={ic} size={16} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>{agent} <span className="text-[#4f5a78]" style={{ fontWeight: 500 }}>· {track}</span></span><span className="block text-[14px] text-[#4f5a78]">{job}</span></span>
        </div>
      ))}
    </div>
  );
}

/* Track the ship: opens the live map straight away */
export function ShipMapCard() {
  const [open, setOpen] = useState(true);
  return (
    <div className={card} style={cardStyle}>
      <Mini icon="ship" title="MV Sample Voyager 027E · live position" sub={`Gulf of Oman · 186 nm from Jebel Ali · revised ETA ${VESSEL.revised}`} pill="Delayed" tone="you" />
      <div className="px-4 pb-4 pt-3"><Btn size="sm" variant="secondary" icon="ship" onClick={() => setOpen(true)}>Open the map</Btn></div>
      {open && <VesselMap vessel="MV Sample Voyager 027E" arrived={false} delayed discharged={0} total={1} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* Trade+ follow-up, asked as its own chat question: automate future delivery orders? */
export function AutoDoQuestion({ ask }: { ask: Ask }) {
  return (
    <div>
      <AgentSays text={`Would you like me to automate your future delivery orders? Next time I'd request and pay the DO with your Dubai Trade wallet as soon as the containers are discharged, valid for the free days. Anything over Dh 6,000.00 still waits for you.`}>
        <OptionGrid options={[
          { label: 'Yes, automate future DOs', desc: 'Same wallet, validity from the free days', icon: 'bolt', tone: 'primary', onPick: () => ask('cv-autodo', 'Yes, automate my future delivery orders', { on: true }) },
          { label: 'No, thanks', icon: 'x', onPick: () => ask('cv-autodo', "No thanks, I'll pay them myself", { on: false }) },
        ]} />
      </AgentSays>
    </div>
  );
}

/* Journey start: the case number first (with copy), then the vessel check, then the DO question */
export function JourneyOpenedCard({ ask, containers }: { ask: Ask; containers: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard?.writeText('IMP-2027-00422'); } catch { /* clipboard not available */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-[14px] px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: '#e3f5ea', border: '1px solid #bfe3cc' }}>
        <Icon name="check" size={18} strokeWidth={2.4} className="text-[#17703a] flex-shrink-0" />
        <span className="flex-1 min-w-[220px] text-[15px] text-[#14532d]">
          <strong style={{ fontWeight: 700 }}>Success:</strong> Import case <strong style={{ fontWeight: 700 }}>IMP-2027-00422</strong> has been created for BL <strong style={{ fontWeight: 700 }}>{DEFAULT_CASE.bl}</strong>.
          <span className="block text-[14px] text-[#17703a]">Keep this number handy to track your import later.</span>
        </span>
        <button type="button" onClick={copy} aria-label="Copy the import case number" className="inline-flex items-center gap-2 h-[36px] px-3 rounded-[8px] bg-white text-[14px] text-[#17703a] border transition-colors hover:bg-[#f2fbf5]" style={{ borderColor: '#bfe3cc', fontWeight: 600 }}>
          <Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? 'Copied' : 'Copy number'}
        </button>
      </div>
      <div>
        <AgentSays text={`I've checked the vessel information for you. MV Sample Voyager 027E is running late: it's now expected at Jebel Ali on 30 Nov at 14:30 instead of 06:00.`}>
          <div className="grid grid-cols-1 gap-3">
            <VesselRoute title />
            <AgentSays text={`Shall I request the delivery order for you now? You review and pay, and I'll send it to the shipping agent.`}>
              <OptionGrid options={[
                { label: 'Request the delivery order', desc: "I'll draft it now; you review, pay and I send it to the shipping agent", icon: 'do', tone: 'primary', onPick: () => ask('do-draft-chat', 'Request the delivery order', { containers }) },
                { label: 'See the vessel details', icon: 'ship', onPick: () => ask('container-info', 'Show me the vessel details', { containers, inJourney: true }) },
                { label: 'Track the ship', icon: 'track', onPick: () => ask('cv-map', 'Track the ship') },
                { label: 'Which agents are working?', icon: 'bot', onPick: () => ask('cv-agents', 'Which agents are working on my import?') },
              ]} />
            </AgentSays>
          </div>
        </AgentSays>
      </div>
    </div>
  );
}
