/* Import journey complete: celebration, live delivery tracking and every
 * document produced on the journey, ready to download. */
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { DhAmount } from '../Dh';
import type { CaseDoc } from './docs';
import { ACTIVE } from './data';
import { Btn, C, Icon, Pill } from './ui';

export type CompletionSummary = {
  containers: string[];
  plates: string[];
  slot: string;
  doPaid: string;
  declNo: string;
  permits: { abbr: string; title: string; ref: string; from: string }[];
  docs: CaseDoc[];
};

type DL = { id: string; abbr: string; title: string; ref: string; from: string; meta?: React.ReactNode };

/* Real, scannable QR code rendered as SVG (4-module quiet zone) */
function QRCode({ text, size = 148 }: { text: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) path += `M${c},${r}h1v1h-1z`;
    return { n: count, d: path };
  }, [text]);
  return (
    <svg viewBox={`-4 -4 ${n + 8} ${n + 8}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR code: scan to download your documents on your phone">
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#0e1b3d" />
    </svg>
  );
}

function Confetti() {
  const colors = ['#1360d2', '#4f8ff7', '#8fbaff', '#28a745', '#f2b200', '#5fd17a'];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 26 }, (_, i) => (
        <span key={i} className="ai-confetti absolute top-[-12px] rounded-[2px]"
          style={{ left: `${(i * 37) % 100}%`, width: i % 3 ? 8 : 6, height: i % 3 ? 12 : 8, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.08}s`, ['--drift' as string]: `${((i % 7) - 3) * 18}px`, ['--spin' as string]: `${(i % 2 ? 1 : -1) * (240 + i * 13)}deg` }} />
      ))}
    </div>
  );
}

function DoneMark() {
  return (
    <span className="relative inline-flex size-[88px] items-center justify-center">
      <span className="ai-ring absolute inset-0 rounded-full" style={{ background: 'rgba(40,167,69,.18)' }} />
      <span className="ai-pop relative size-[72px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#28a745,#5fd17a)', boxShadow: '0 14px 30px -12px rgba(40,167,69,.6)' }}>
        <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path className="ai-draw" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}

/* How many documents the phone link opens for this import */
export function docCount(summary: CompletionSummary) {
  return 4 + summary.permits.length + 1 + summary.docs.filter(d => d.status === 'read').length;
}

/* Scan-to-download QR card, on its own so the chat can introduce it */
export function QrCard({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[14px] p-3 border bg-white" style={{ borderColor: '#dbe6f7', background: 'linear-gradient(135deg,#f6f9ff,#ffffff)' }}>
      <span className="rounded-[10px] p-[6px] bg-white border flex-shrink-0" style={{ borderColor: '#e3e8f3' }}>
        <QRCode text={`https://www.dubaitrade.ae/m/case/${ACTIVE.c.caseId}/documents?k=8F3K2Q`} size={120} />
      </span>
      <span className="max-w-[230px]">
        <span className="flex items-center gap-2 text-[14px] text-[#111838]" style={{ fontWeight: 700 }}><Icon name="download" size={15} className="text-[#1360d2]" />Scan to track and download</span>
        <span className="block text-[14px] text-[#4f5a78] mt-1 leading-snug">Track your cargo and open all {count} documents in the Dubai Trade app. Link valid for 7 days; sign in with UAE PASS.</span>
      </span>
    </div>
  );
}

export function ImportComplete({ summary, brief, tracks, onTracked }: { summary: CompletionSummary; brief?: boolean; tracks?: React.ReactNode; onTracked?: () => void }) {
  const { containers, plates, slot, doPaid, docs, declNo, permits } = summary;
  const [notify, setNotify] = useState({ whatsapp: true, email: true });
  const [got, setGot] = useState<Record<string, boolean>>({});
  const [zipping, setZipping] = useState(0); // 0 idle, 1..100 progress
  const live = !!onTracked;                  // chat mode: the tracker loads step by step
  const [stage, setStage] = useState(live ? 0 : 1);   // delivery stage shown live
  const loading = live && stage < 2;

  // Gentle "live" feel: the truck moves along slowly, one step at a time, then hands back to the chat
  useEffect(() => {
    if (!live) { const t = setTimeout(() => setStage(2), 1800); return () => clearTimeout(t); }
    const ts = [setTimeout(() => setStage(1), 2600), setTimeout(() => setStage(2), 5000), setTimeout(() => onTracked?.(), 6400)];
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issued: DL[] = [
    { id: 'do', abbr: 'DO', title: 'Delivery order', ref: 'DO-27-41902', from: ACTIVE.c.line, meta: `${containers.length} containers` },
    ...permits.map(p => ({ id: `pm-${p.ref}`, abbr: p.abbr, title: p.title, ref: p.ref, from: p.from, meta: 'Approved' })),
    { id: 'decl', abbr: 'DEC', title: 'Import declaration', ref: declNo, from: 'Dubai Customs', meta: 'Cleared · green channel' },
    { id: 'etoken', abbr: 'ET', title: 'eToken', ref: 'ET-27-0091602', from: 'DP World', meta: `${containers.length} truck${containers.length > 1 ? 's' : ''} · ${slot}` },
    { id: 'cw', abbr: 'CW', title: 'Haulage order and delivery schedule', ref: 'CW-27-55813', from: 'Cargo Waves · Al Bahar Transport', meta: slot },
  ];
  const receipts: DL[] = [
    { id: 'r-do', abbr: 'TP', title: 'TradePay receipt · delivery order', ref: 'TP-27114085', from: 'TradePay', meta: <DhAmount value={doPaid} /> },
  ];
  const shipping: DL[] = docs.filter(d => d.status === 'read').map((d, i) => ({ id: `s-${i}`, abbr: ({ 'Bill of lading': 'BL', 'Commercial invoice': 'CI', 'Packing list': 'PL', 'Certificate of origin': 'COO', 'Cargo manifest': 'MAN' } as Record<string, string>)[d.type] ?? 'DOC', title: d.type, ref: d.name, from: d.source }));
  const all = [...issued, ...receipts, ...shipping];
  const done = all.filter(d => got[d.id]).length;

  const zipAll = () => {
    setZipping(1);
    let p = 1;
    const iv = setInterval(() => {
      p = Math.min(100, p + 12);
      setZipping(p);
      if (p >= 100) { clearInterval(iv); setGot(Object.fromEntries(all.map(d => [d.id, true]))); setTimeout(() => setZipping(0), 600); }
    }, 120);
  };

  const Row = ({ d }: { d: DL }) => (
    <li className="flex items-center gap-3 rounded-[12px] px-3 py-[10px] border min-w-0" style={{ borderColor: got[d.id] ? '#cdebd8' : '#e3e8f3', background: got[d.id] ? '#f6fcf8' : '#fff' }}>
      <span className="w-[48px] h-[40px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 700 }}>{d.abbr}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-[#111838] truncate" style={{ fontWeight: 600 }}>{d.title}</span>
        <span className="block text-[14px] text-[#4f5a78] truncate">{d.ref} · {d.from}{d.meta ? <> · {d.meta}</> : null}</span>
      </span>
      {got[d.id]
        ? <span className="inline-flex items-center gap-1 text-[14px] text-[#17703a] whitespace-nowrap" style={{ fontWeight: 600 }}><Icon name="check" size={15} strokeWidth={2.6} />Downloaded</span>
        : <Btn size="sm" variant="secondary" icon="download" onClick={() => setGot(g => ({ ...g, [d.id]: true }))}>Download</Btn>}
    </li>
  );

  const stages = [
    { t: 'eToken issued', s: 'ET-27-0091602' },
    { t: plates.length > 1 ? 'Trucks booked' : 'Truck booked', s: `${plates.length} truck${plates.length > 1 ? 's' : ''} · Al Bahar Transport` },
    { t: 'At the port gate', s: slot },
    { t: 'Delivered', s: 'Your warehouse, Al Quoz 3' },
  ];

  return (
    <div id="import-complete" className="grid grid-cols-1 gap-3 scroll-mt-[110px]">
      {/* Celebration */}
      <div className="relative overflow-hidden rounded-[16px] px-5 py-6 text-center ai-complete">
        <Confetti />
        <div className="relative flex flex-col items-center">
          <DoneMark />
          <p className="ai-rise text-[22px] text-[#0e1b3d] mt-4" style={{ fontWeight: 700, animationDelay: '.35s' }}>Your import journey is on track</p>
          <p className="ai-rise text-[15px] text-[#40484f] mt-1 max-w-[620px]" style={{ animationDelay: '.5s' }}>
            DO released, permits approved, customs cleared and eToken issued for {brief ? `BL ${ACTIVE.c.bl}` : ACTIVE.c.caseId}. We'll keep tracking your delivery until the containers reach your warehouse.
          </p>
          {tracks ? <div className="ai-rise w-full max-w-[760px] mt-5" style={{ animationDelay: '.65s' }}>{tracks}</div> : <div className="ai-rise flex flex-wrap justify-center gap-2 mt-4" style={{ animationDelay: '.65s' }}>
            {['Vessel Operations', 'Trade+', 'Integrated Clearance', 'Cargo Waves'].map(t => (
              <span key={t} className="inline-flex items-center gap-[6px] h-[32px] px-3 rounded-full text-[14px] bg-white" style={{ border: '1px solid #cdebd8', color: '#17703a', fontWeight: 600 }}><Icon name="check" size={14} strokeWidth={2.6} />{t}</span>
            ))}
          </div>}
        </div>
      </div>

      {/* We'll keep tracking your delivery */}
      <div className="rounded-[16px] border bg-white p-4 sm:p-5" style={{ borderColor: C.border }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[16px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}><span className="size-[8px] rounded-full bg-[#28a745] ai-live" />{loading ? 'Getting the latest from Cargo Waves' : "We're tracking your delivery"}{loading && <span className="ai-dots ml-1"><i /><i /><i /></span>}</p>
            <p className="text-[14px] text-[#4f5a78]">Delivery window {slot} · we'll update you at every step</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] text-[#4f5a78]">Notify me by</span>
            {(['whatsapp', 'email'] as const).map(k => (
              <button key={k} type="button" role="switch" aria-checked={notify[k]} onClick={() => setNotify(n => ({ ...n, [k]: !n[k] }))}
                className="inline-flex items-center gap-[6px] h-[32px] px-3 rounded-full text-[14px] border transition-colors"
                style={{ borderColor: notify[k] ? C.blue : '#d5ddea', background: notify[k] ? '#eef4ff' : '#fff', color: notify[k] ? C.blue : '#4f5a78', fontWeight: 600 }}>
                {notify[k] && <Icon name="check" size={13} strokeWidth={2.6} />}{k === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>
        </div>

        {/* Animated route */}
        <div className="relative mt-5 mb-2 h-[44px]">
          <span className="absolute left-[18px] right-[18px] top-[21px] h-[3px] rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9d6ee 0 10px,transparent 10px 18px)' }} />
          <span className={`absolute left-[18px] top-[21px] h-[3px] rounded-full transition-all duration-[2000ms] ease-in-out ${loading ? 'ai-load-bar' : ''}`} style={{ width: `calc(${(stage / (stages.length - 1)) * 100}% - ${(stage / (stages.length - 1)) * 36}px)`, background: 'linear-gradient(90deg,#28a745,#5fd17a)' }} />
          <span className="absolute top-0 size-[44px] rounded-full flex items-center justify-center text-white transition-all duration-[2000ms] ease-in-out ai-bob"
            style={{ left: `calc(${(stage / (stages.length - 1)) * 100}% - ${(stage / (stages.length - 1)) * 44}px)`, background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 10px 22px -10px rgba(19,96,210,.7)' }}>
            <Icon name="truck" size={20} />
          </span>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stages.map((st, i) => (
            <li key={st.t} className="min-w-0 transition-opacity duration-700" style={{ opacity: live && i > stage + 1 ? 0.55 : 1 }}>
              <span className="flex items-center gap-2">
                <span className="size-[22px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: i <= stage ? '#28a745' : '#fff', border: i <= stage ? 'none' : '2px dashed #c9d4ec', color: '#fff' }}>{i <= stage && <Icon name="check" size={12} strokeWidth={2.8} />}</span>
                <span className="text-[14px] text-[#111838]" style={{ fontWeight: i === stage ? 700 : 600 }}>{st.t}</span>
              </span>
              <span className="block text-[14px] text-[#4f5a78] mt-[2px] pl-[30px]">{st.s}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 mt-4">
          {containers.map((c, i) => (
            <span key={c} className="inline-flex items-center gap-2 h-[32px] px-3 rounded-full text-[14px]" style={{ background: '#f4f7fd', border: '1px solid #e3e8f3' }}>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{c}</span>
              <span className="text-[#4f5a78]">· {plates[i]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Documents to download (in the chat, the agent introduces the QR card itself) */}
      {!live && <div className={`rounded-[16px] border bg-white p-4 sm:p-5 ${brief ? 'justify-self-start' : ''}`} style={{ borderColor: C.border }}>
        <div className={`grid grid-cols-1 ${brief ? '' : 'md:grid-cols-[minmax(0,1fr)_auto] mb-3'} gap-4 items-start`}>
        {!brief && <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[16px] text-[#111838]" style={{ fontWeight: 600 }}>Documents for this import</p>
            <p className="text-[14px] text-[#4f5a78]">{all.length} documents · {done ? `${done} downloaded` : 'all stored with your case record'}</p>
          </div>
          {zipping ? (
            <span className="inline-flex items-center gap-3 min-w-[220px]">
              <span className="flex-1 h-[8px] rounded-full bg-[#e3e8ef] overflow-hidden"><span className="block h-full rounded-full transition-all" style={{ width: `${zipping}%`, background: C.blue }} /></span>
              <span className="text-[14px] text-[#4f5a78]">{zipping >= 100 ? 'Ready' : 'Preparing ZIP…'}</span>
            </span>
          ) : (
            <Btn icon="download" onClick={zipAll}>{done === all.length ? 'Download all again' : 'Download all (ZIP)'}</Btn>
          )}
        </div>}
        {/* Scan to download on a phone */}
        <div className="flex items-center gap-3 rounded-[14px] p-3 border" style={{ borderColor: '#dbe6f7', background: 'linear-gradient(135deg,#f6f9ff,#ffffff)' }}>
          <span className="rounded-[10px] p-[6px] bg-white border flex-shrink-0" style={{ borderColor: '#e3e8f3' }}>
            <QRCode text={`https://www.dubaitrade.ae/m/case/${ACTIVE.c.caseId}/documents?k=8F3K2Q`} size={120} />
          </span>
          <span className="max-w-[190px]">
            <span className="flex items-center gap-2 text-[14px] text-[#111838]" style={{ fontWeight: 700 }}><Icon name="download" size={15} className="text-[#1360d2]" />Scan to download on your phone</span>
            <span className="block text-[14px] text-[#4f5a78] mt-1 leading-snug">Opens all {all.length} documents in the Dubai Trade app. Link valid for 7 days; sign in with UAE PASS.</span>
          </span>
        </div>
        </div>
        {!brief && <>
        <p className="text-[14px] text-[#111838] mb-2" style={{ fontWeight: 600 }}>Issued on this journey</p>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">{issued.map(d => <Row key={d.id} d={d} />)}</ul>
        <p className="text-[14px] text-[#111838] mt-4 mb-2" style={{ fontWeight: 600 }}>Payment receipts</p>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">{receipts.map(d => <Row key={d.id} d={d} />)}</ul>
        {shipping.length > 0 && <>
          <p className="text-[14px] text-[#111838] mt-4 mb-2" style={{ fontWeight: 600 }}>Your shipping documents</p>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">{shipping.map(d => <Row key={d.id} d={d} />)}</ul>
        </>}
        </>}
      </div>}
      {!brief && <Pill tone="ai" className="justify-self-start">Final step · audit log below</Pill>}
    </div>
  );
}
