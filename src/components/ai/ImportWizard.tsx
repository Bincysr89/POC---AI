/* Start an import as full-width pages, one after the other (not a chat).
 *
 * From documents:  Upload → Check documents → Shipment details → Confirm fields → AI agents → Import journey
 * From containers: Enter containers → Shipment and documents → AI agents → Import journey
 *
 * Reading the documents / finding the shipment happens on its own page between
 * the first and second step. After "Confirm and start import journey" the
 * import journey takes the whole page, and the completion page follows it. */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHECKS, COMPANY, JOURNEY_AGENTS, LOW_CONF_FIELDS, REQUIRED_DOCS, SAMPLE_CONTAINERS, SAMPLE_DOCS,
  SHIPMENT_CONTAINERS, SHIPMENT_FIELDS, SHIPMENT_HS, lookupContainers,
  ACTIVE, CLEARANCE_DRAFTS, DEFAULT_CASE, DO_DRAFTS, DO_FEE, THC_PER_CONTAINER, WALLET_BALANCE, setActiveCase, sumFees,
} from './data';
import { DhAmount } from '../Dh';
import { caseDocs, DocTile, DocViewer, type CaseDoc } from './docs';
import { ContainerInput } from './containers';
import { AuditLogCard, CaseJourneyCard, type AuditEvent, type JourneyStart } from './journey';
import type { CompletionSummary } from './complete';
import { Btn, C, Field, Icon, Pill, SuccessBanner } from './ui';

export type ImportSource = 'documents' | 'containers' | 'do' | 'clearance';
type Page = 'pick' | 'pay' | 'upload' | 'reading' | 'docs' | 'details' | 'confirm' | 'containers' | 'lookup' | 'shipment' | 'agents' | 'journey' | 'complete';

const STEPS: Record<ImportSource, { t: string; pages: Page[] }[]> = {
  do: [
    { t: 'Choose a bill of lading', pages: ['pick'] },
    { t: 'Review and pay', pages: ['pay'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
  clearance: [
    { t: 'Choose a bill of lading', pages: ['pick'] },
    { t: 'Review and pay permits', pages: ['pay'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
  documents: [
    { t: 'Upload documents', pages: ['upload', 'reading'] },
    { t: 'Check documents', pages: ['docs'] },
    { t: 'Shipment details', pages: ['details'] },
    { t: 'Confirm fields', pages: ['confirm'] },
    { t: 'AI agents', pages: ['agents'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
  containers: [
    { t: 'Enter containers', pages: ['containers', 'lookup'] },
    { t: 'Shipment and documents', pages: ['shipment'] },
    { t: 'AI agents', pages: ['agents'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
};

const th = 'text-left text-[14px] text-[#4f5a78] px-[14px] py-[10px] whitespace-nowrap';
const td = 'px-[14px] py-[12px] text-[14px] text-[#111838] align-middle';
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

function Section({ title, sub, right, children }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-[16px] border min-w-0" style={{ borderColor: '#e1e7f2', boxShadow: '0 1px 2px rgba(14,27,61,.04)' }}>
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[17px] text-[#111838]" style={{ fontWeight: 700 }}>{title}</h2>
          {sub && <p className="text-[14px] text-[#4f5a78] mt-[2px]">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </section>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className="w-[42px] h-[24px] rounded-full relative transition-colors flex-shrink-0" style={{ background: on ? C.blue : '#c9d4ec' }}>
      <span className="absolute top-[3px] size-[18px] rounded-full bg-white transition-all" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

export default function ImportWizard({ source, files: initFiles, containers: initContainers, startAt, bl, onExit }: {
  source: ImportSource; files?: string[]; containers?: string[]; startAt?: 'journey'; bl?: string; onExit: () => void;
}) {
  const fromDraft = source === 'do' || source === 'clearance';
  const drafts = source === 'clearance' ? CLEARANCE_DRAFTS : DO_DRAFTS;
  const [pickIdx, setPickIdx] = useState(() => Math.max(0, drafts.findIndex(x => x.bl === bl)));
  const [validity, setValidity] = useState('2027-12-05');
  const [method, setMethod] = useState(0);
  const [start, setStart] = useState<JourneyStart | undefined>();
  useState(() => { if (!fromDraft) setActiveCase(DEFAULT_CASE); });   // a new import uses the sample BL
  const [page, setPage] = useState<Page>(() =>
    startAt === 'journey' ? 'journey'
      : fromDraft ? (bl && drafts.some(x => x.bl === bl) ? 'pay' : 'pick')
      : source === 'documents' ? (initFiles?.length ? 'reading' : 'upload')
      : (initContainers?.length ? 'lookup' : 'containers'));
  const [names, setNames] = useState<string[]>(initFiles?.length ? initFiles : SAMPLE_DOCS.map(d => d.name));
  const [list, setList] = useState<string[]>(initContainers ?? []);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(LOW_CONF_FIELDS.map(f => [f.id, f.value])));
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [view, setView] = useState<CaseDoc | null>(null);
  const [done, setDone] = useState<{ events: AuditEvent[]; containers: number; summary: CompletionSummary } | null>(null);
  const [created, setCreated] = useState(startAt !== 'journey');
  const inputRef = useRef<HTMLInputElement>(null);
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);   // the journey puts its page buttons here
  const barRef = useRef<HTMLOListElement>(null);

  const steps = STEPS[source];
  const stepIdx = steps.findIndex(s => s.pages.includes(page));
  const setup = page !== 'journey' && page !== 'complete';
  const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0, behavior: 'auto' }); };

  /* Keep the current step in view on narrow screens */
  useEffect(() => {
    const bar = barRef.current, cur = bar?.querySelector<HTMLElement>('[aria-current="step"]');
    if (bar && cur) bar.scrollLeft = Math.max(0, cur.offsetLeft - bar.clientWidth / 2 + cur.offsetWidth / 2);
  }, [page]);

  /* Automatic pages: reading the documents / finding the shipment */
  useEffect(() => {
    if (page !== 'reading' && page !== 'lookup') return;
    setProgress(0);
    const iv = setInterval(() => setProgress(p => Math.min(100, p + 4)), 90);
    const t = setTimeout(() => go(page === 'reading' ? 'docs' : 'shipment'), 2600);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [page]);

  const docs = useMemo(() => names.map((n, i) => ({ ...SAMPLE_DOCS[i % SAMPLE_DOCS.length], name: n })), [names]);
  const caseDocList = caseDocs(source === "documents" ? "documents" : "containers", source === 'documents' ? names : undefined, extra);
  const info = useMemo(() => lookupContainers(list.length ? list : SAMPLE_CONTAINERS.slice(0, 4)), [list]);
  const toConfirm = LOW_CONF_FIELDS.filter(f => !ok[f.id]).length;
  const permits = SHIPMENT_HS.filter(h => h.permit).length;
  const tracksOn = JOURNEY_AGENTS.filter(g => !off[g.plan]).length;
  const agentCount = JOURNEY_AGENTS.filter(g => !off[g.plan]).reduce((a, g) => a + g.agents.length, 0);
  const found = REQUIRED_DOCS.map(r => ({ ...r, file: docs.find(d => d.type === r.match)?.name }));
  const nContainers = source === 'containers' ? info.length : SHIPMENT_CONTAINERS.length;

  const startFiles = (l: string[]) => { setNames(l.length ? l : SAMPLE_DOCS.map(d => d.name)); go('reading'); };
  const confirm = () => { setCreated(true); go('journey'); };

  /* Delivery order / clearance started from a drafted BL */
  const draft = drafts[pickIdx];
  const doAmount = (DO_FEE + draft.containers.length * THC_PER_CONTAINER).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const clr = source === 'clearance' ? CLEARANCE_DRAFTS[pickIdx] : null;
  const payAmount = clr ? sumFees(clr.permits) : doAmount;
  const payMethods = [`Dubai Trade wallet · Dh ${WALLET_BALANCE}`, 'Credit facility · 30 days'];
  const payDraft = () => {
    const { containers: _c, size: _s, drafted: _d, ...meta } = draft as typeof draft & { goods?: string };
    setActiveCase(clr ? { ...meta, permits: clr.permits, hs: clr.hs, permitPay: payAmount } : meta);
    const how = ['wallet', 'credit facility'][method];
    setStart(clr ? {
      idx: { C: 3 },
      events: [
        { time: '24 Nov 09:36', track: 'Integrated Clearance', actor: 'HS agent', kind: 'agent', action: `Checked ${clr.hs.length} HS codes on BL ${clr.bl}: ${clr.permits.length} need a permit`, tool: 'tariff.lookup', outcome: 'Done' },
        ...clr.permits.map((p, i) => ({ time: `24 Nov 09:3${8 + i}`, track: 'Integrated Clearance', actor: p.agent, kind: 'agent' as const, action: `Drafted ${p.type.toLowerCase()} request with ${p.entity}`, tool: `${p.entity === 'SIRA' ? 'sira' : 'dm'}.permit.draft`, outcome: 'Draft ready' })),
        { time: '24 Nov 10:10', track: 'Integrated Clearance', actor: 'You', kind: 'you', action: `Checked the permit request${clr.permits.length > 1 ? 's' : ''} and paid to submit (${how})`, tool: 'tradepay.pay', outcome: `Paid Dh ${payAmount}` },
      ],
    } : {
      idx: { V: -1, D: 2 }, validity, method,
      events: [
        { time: '24 Nov 09:50', track: 'Vessel arrival', actor: 'Status agent', kind: 'agent', action: `All ${draft.containers.length} containers on BL ${draft.bl} discharged`, tool: 'container.status', outcome: 'Done' },
        { time: '24 Nov 09:52', track: 'Trade+ · DO', actor: 'DO agent', kind: 'agent', action: `Drafted the DO request with ${draft.line} charges`, tool: 'do.draft', outcome: 'Draft ready' },
        { time: '24 Nov 10:02', track: 'Trade+ · DO', actor: 'You', kind: 'you', action: `Reviewed the DO request, set validity to ${validity} and paid (${how})`, tool: 'tradepay.pay', outcome: `Paid Dh ${payAmount}` },
      ],
    });
    setCreated(true);
    go('journey');
  };

  /* The journey reports completion through ask('audit-log'); here that opens the next page */
  const journeyAsk = (intent: string, _u?: string, payload?: Record<string, unknown>) => {
    if (intent === 'audit-log' && payload) {
      setDone({ events: payload.events as AuditEvent[], containers: payload.containers as number, summary: payload.summary as CompletionSummary });
      go('complete');
    }
  };

  /* Page copy */
  const head: Record<Page, { title: string; sub: string }> = {
    pick: clr || source === 'clearance'
      ? { title: 'Create integrated clearance', sub: 'Permit agents have drafted the permit requests, and the declaration agent your declaration, for these bills of lading. Choose the one to continue.' }
      : { title: 'Create a delivery order', sub: 'The DO agent has drafted delivery order requests for these bills of lading. Choose the one you want to request.' },
    pay: source === 'clearance'
      ? { title: 'Review and pay the permit requests', sub: 'Check the permits the agents drafted for your goods and pay to submit them. The declaration goes to Dubai Customs once they are approved.' }
      : { title: 'Review and pay the delivery order', sub: `Check the request, choose how long the DO stays valid and pay. It goes to ${draft.line} straight away.` },
    upload: { title: 'Upload your shipping documents', sub: 'Document AI reads them and prepares your import case. Missing one? You can add it later.' },
    reading: { title: `Reading ${docs.length} document${docs.length > 1 ? 's' : ''}`, sub: 'Document AI is extracting the fields and checking the documents against each other.' },
    docs: { title: 'Check your documents', sub: 'Document AI matched each file to the documents an import needs and cross-checked them.' },
    details: { title: 'Shipment details', sub: 'Everything here was read from your documents. It pre-fills your delivery order, permits, declaration and haulage.' },
    confirm: { title: 'Confirm two fields', sub: 'These values were read with medium confidence. Confirm or correct them; nothing uses them until you do.' },
    containers: { title: 'Enter your container numbers', sub: 'Add one or more containers. The agents find the bill of lading and vessel, and fetch the documents from the shipping line.' },
    lookup: { title: `Finding the shipment for ${info.length} container${info.length > 1 ? 's' : ''}`, sub: 'Checking each container with the shipping line and the port.' },
    shipment: { title: 'Shipment and documents', sub: 'All your containers are on one bill of lading. The BL and cargo manifest were fetched from the line, so you don’t need to upload them.' },
    agents: { title: 'AI agents for this import', sub: 'These agents run the four tracks of your import journey. Switch off a track if you prefer to handle it yourself.' },
    journey: { title: 'Import journey', sub: '' },
    complete: { title: 'Import journey', sub: '' },
  };

  /* Footer actions per page */
  const nextOf: Partial<Record<Page, { label: React.ReactNode; to: () => void; icon?: string }>> = {
    pick: { label: 'Next: Review and pay', to: () => go('pay') },
    pay: { label: <>{source === 'clearance' ? 'Pay and submit' : 'Pay and send'}&nbsp;<DhAmount value={payAmount} /></>, to: payDraft },
    upload: { label: 'Continue with sample documents', to: () => startFiles([]) },
    docs: { label: 'Next: Shipment details', to: () => go('details') },
    details: { label: 'Next: Confirm fields', to: () => go('confirm') },
    confirm: { label: 'Next: AI agents', to: () => go('agents') },
    containers: { label: 'Find my shipment', to: () => { if (!list.length) setList(SAMPLE_CONTAINERS.slice(0, 4)); go('lookup'); }, icon: 'play' },
    shipment: { label: 'Next: AI agents', to: () => go('agents') },
    agents: { label: 'Confirm and start import journey', to: confirm, icon: 'check' },
  };
  const backOf: Partial<Record<Page, Page>> = { pay: 'pick', docs: 'upload', details: 'docs', confirm: 'details', shipment: 'containers', agents: source === 'documents' ? 'confirm' : 'shipment' };
  const next = nextOf[page];
  const back = backOf[page];

  return (
    <div className="min-h-[calc(100vh-88px)] flex flex-col" style={{ background: '#f6f8fc' }}>
      {/* Page header: where you are. During set-up a step bar; on the journey just the case title. */}
      <div className="bg-white border-b" style={{ borderColor: '#e1e7f2' }}>
        <div className={`px-4 sm:px-10 ${setup ? 'pt-4 pb-4' : 'py-3'}`}>
          <div className="flex items-center gap-2 text-[14px] text-[#4f5a78] flex-wrap">
            <button type="button" onClick={onExit} className="inline-flex items-center gap-1 text-[#1360d2] hover:underline underline-offset-2" style={{ fontWeight: 600 }}>
              <Icon name="chev" size={14} className="rotate-180" />AI home
            </button>
            <span aria-hidden>/</span>
            <span className={setup ? '' : 'text-[#111838]'} style={{ fontWeight: setup ? 400 : 600 }}>{setup ? ({ documents: 'Start import from documents', containers: 'Start import from container numbers', do: 'Create delivery order', clearance: 'Create integrated clearance' } as const)[source] : page === 'complete' ? 'Import journey · documents and audit log' : `Import journey · ${ACTIVE.c.caseId}`}</span>
          </div>

          {setup ? (
            <ol ref={barRef} className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 relative" aria-label="Import set-up steps">
              {steps.map((s, i) => {
                const st = i < stepIdx ? 'done' : i === stepIdx ? 'on' : 'todo';
                return (
                  <Fragment key={s.t}>
                    {i > 0 && <span aria-hidden className="flex-1 min-w-[16px] h-[2px] rounded-full" style={{ background: i <= stepIdx ? '#28a745' : '#dfe5ef' }} />}
                    <li className="flex items-center gap-2 flex-shrink-0" aria-current={st === 'on' ? 'step' : undefined}>
                      <span className="size-[30px] rounded-full flex items-center justify-center text-[14px] flex-shrink-0"
                        style={{ background: st === 'done' ? '#28a745' : st === 'on' ? C.blue : '#fff', color: st === 'todo' ? C.muted : '#fff', border: st === 'todo' ? '1.5px solid #c9d4ec' : 'none', fontWeight: 700, boxShadow: st === 'on' ? '0 0 0 4px rgba(19,96,210,.14)' : 'none' }}>
                        {st === 'done' ? <Icon name="check" size={15} strokeWidth={2.6} /> : i + 1}
                      </span>
                      <span className="text-[14px] whitespace-nowrap" style={{ color: st === 'todo' ? C.muted : C.text, fontWeight: st === 'on' ? 700 : 600 }}>{s.t}</span>
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          ) : null}
        </div>
      </div>

      {/* Page body */}
      <main className="flex-1 w-full px-4 sm:px-10 py-6 sm:py-8">
        {setup && (
          <div key={`h-${page}`} className="ai-page-in mb-6">
            <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Step {stepIdx + 1} of {steps.length}</p>
            <h1 className="text-[26px] sm:text-[30px] text-[#0e1b3d] leading-tight mt-1" style={{ fontWeight: 700 }}>{head[page].title}</h1>
            <p className="text-[15px] text-[#4f5a78] mt-2 max-w-[760px]">{head[page].sub}</p>
          </div>
        )}

        <div key={page === 'journey' || page === 'complete' ? 'case' : page} className="ai-page-in grid grid-cols-1 gap-5 min-w-0">
          {/* ── Choose a drafted bill of lading (delivery order / clearance) ── */}
          {page === 'pick' && (
            <div role="radiogroup" aria-label="Bills of lading with drafts ready" className="grid grid-cols-1 gap-3">
              {drafts.map((x, i) => {
                const on = i === pickIdx;
                const c = source === 'clearance' ? CLEARANCE_DRAFTS[i] : null;
                const amt = c ? sumFees(c.permits) : (DO_FEE + x.containers.length * THC_PER_CONTAINER).toLocaleString('en-US', { minimumFractionDigits: 2 });
                return (
                  <button key={x.bl} type="button" role="radio" aria-checked={on} onClick={() => setPickIdx(i)}
                    className="w-full text-left bg-white rounded-[16px] border-2 px-5 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center transition-colors"
                    style={{ borderColor: on ? C.blue : '#e1e7f2', boxShadow: on ? '0 10px 26px -18px rgba(19,96,210,.55)' : '0 1px 2px rgba(14,27,61,.04)' }}>
                    <span className="flex items-start gap-4 min-w-0">
                      <span className="size-[22px] rounded-full flex items-center justify-center flex-shrink-0 mt-[3px]" style={{ border: `2px solid ${on ? C.blue : '#b9c4d8'}` }}>
                        {on && <span className="size-[10px] rounded-full" style={{ background: C.blue }} />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[17px] text-[#0e1b3d]" style={{ fontWeight: 700, ...mono }}>BL {x.bl}</span>
                          <Pill tone="done">{c ? `${c.permits.length} permit${c.permits.length > 1 ? 's' : ''} drafted` : 'DO request drafted'}</Pill>
                        </span>
                        <span className="block text-[14px] text-[#4f5a78] mt-1">{x.caseId} · {x.line} · {x.vessel.replace(' · ', ' ')} · {x.origin} → Jebel Ali</span>
                        <span className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[14px] text-[#111838]">
                          <span className="inline-flex items-center gap-1"><Icon name="box" size={15} className="text-[#1360d2]" />{x.containers.length} × {x.size}</span>
                          {c
                            ? <span className="inline-flex items-center gap-1"><Icon name="decl" size={15} className="text-[#1360d2]" />{c.goods}</span>
                            : <span className="inline-flex items-center gap-1"><Icon name="ship" size={15} className="text-[#1360d2]" />{(x as typeof DO_DRAFTS[number]).status}</span>}
                          {c && <span className="inline-flex items-center gap-1"><Icon name="shield" size={15} className="text-[#1360d2]" />{c.permits.map(p => p.entity === 'Dubai Municipality' ? 'DM' : p.entity).join(' · ')}</span>}
                          <span className="inline-flex items-center gap-1 text-[#4f5a78]"><Icon name="clock" size={15} />Drafted {x.drafted.toLowerCase()}</span>
                        </span>
                      </span>
                    </span>
                    <span className="lg:text-right pl-[38px] lg:pl-0">
                      <span className="block text-[14px] text-[#4f5a78]">{c ? 'Permit fees' : 'Delivery order charges'}</span>
                      <span className="block text-[20px] text-[#0e1b3d]" style={{ fontWeight: 700 }}><DhAmount value={amt} /></span>
                    </span>
                  </button>
                );
              })}
              <p className="text-[14px] text-[#4f5a78] flex items-center gap-2"><Icon name="info" size={15} />Only bills of lading with a draft ready are listed. The agents add new ones as {source === 'clearance' ? 'shipping documents are read' : 'containers are discharged'}.</p>
            </div>
          )}

          {/* ── Review and pay ── */}
          {page === 'pay' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
              <div className="grid grid-cols-1 gap-5 min-w-0">
                <Section title={clr ? `Permit requests drafted for BL ${draft.bl}` : `Delivery order request · BL ${draft.bl}`} sub={`${draft.caseId} · ${draft.vessel.replace(' · ', ' ')} · ${draft.origin} → Jebel Ali`}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Shipping agent" value={draft.line} />
                    <Field label="Consignee" value={COMPANY} />
                    <Field label="Containers" value={`${draft.containers.length} × ${draft.size}`} />
                    <Field label="Terminal" value="Jebel Ali T3" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {draft.containers.map(n => <span key={n} className="inline-flex items-center gap-1 h-[30px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ background: '#eef4ff', fontWeight: 600, ...mono }}><Icon name="box" size={14} />{n}</span>)}
                  </div>
                </Section>

                {clr ? (
                  <>
                    <Section title={`${clr.permits.length} permit request${clr.permits.length > 1 ? 's' : ''}`} sub="Each permit agent filled the request from your invoice and packing list.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {clr.permits.map(p => (
                          <div key={p.ref} className="rounded-[14px] border p-4" style={{ borderColor: '#e3e8f3', background: '#fbfcff' }}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>{p.entity}</span>
                                <span className="block text-[14px] text-[#4f5a78]">{p.type}</span>
                              </span>
                              <Pill tone="you">Draft · pay to submit</Pill>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
                              <Field label="HS code" value={p.hs} />
                              <Field label="Quantity" value={p.qty} />
                              <Field label="Goods" value={p.item} />
                              <Field label="Fee" value={<DhAmount value={p.fee} />} />
                            </div>
                            <p className="text-[14px] text-[#4f5a78] mt-3 inline-flex items-center gap-2"><Icon name="bot" size={15} className="text-[#1360d2]" />Prepared by the {p.agent}</p>
                          </div>
                        ))}
                      </div>
                    </Section>
                    <Section title={`${clr.hs.length} HS codes on this BL`} sub="The declaration agent drafted your declaration with these lines. It is submitted after the permits are approved.">
                      <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                        <table className="w-full">
                          <thead><tr className="bg-[#f3f6fb]"><th className={th}>HS code</th><th className={th}>Goods</th><th className={th}>Permit</th></tr></thead>
                          <tbody>{clr.hs.map(l => (
                            <tr key={l.hs} className="border-t" style={{ borderColor: '#eef1f6' }}><td className={td} style={{ fontWeight: 600 }}>{l.hs}</td><td className={td}>{l.d}</td><td className={td}>{l.permit === 'None needed' ? <span className="text-[#4f5a78]">None needed</span> : <Pill tone="run">{l.permit === 'Dubai Municipality' ? 'DM' : l.permit}</Pill>}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </Section>
                  </>
                ) : (
                  <Section title="Charges" sub={`Fetched from the ${draft.line} tariff by the DO agent.`}>
                    <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                      <table className="w-full">
                        <tbody>
                          {[
                            ['Delivery order fee', <DhAmount key="f" value={DO_FEE.toLocaleString('en-US', { minimumFractionDigits: 2 })} />],
                            [`Terminal handling (${draft.containers.length} × ${THC_PER_CONTAINER.toFixed(2)})`, <DhAmount key="t" value={(draft.containers.length * THC_PER_CONTAINER).toLocaleString('en-US', { minimumFractionDigits: 2 })} />],
                            ['Container deposit', <span key="d" className="text-[#17703a]" style={{ fontWeight: 600 }}>Waived · guarantee on file</span>],
                          ].map(([l, v], i) => (
                            <tr key={i} className={i ? 'border-t' : ''} style={{ borderColor: '#eef1f6' }}><td className={td}>{l}</td><td className={`${td} text-right`}>{v}</td></tr>
                          ))}
                          <tr className="border-t" style={{ borderColor: '#dfe5ef', background: '#f6f8fc' }}><td className={td} style={{ fontWeight: 700 }}>Total</td><td className={`${td} text-right`} style={{ fontWeight: 700 }}><DhAmount value={doAmount} /></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </Section>
                )}
              </div>

              <div className="lg:sticky lg:top-[104px]">
                <Section title="What you need to do">
                  <div className="grid grid-cols-1 gap-4">
                    {!clr && (
                      <label className="block">
                        <span className="block text-[14px] text-[#111838] mb-1" style={{ fontWeight: 600 }}>1. Set the DO validity date</span>
                        <input type="date" value={validity} onChange={e => setValidity(e.target.value)} className="w-full h-[44px] rounded-[6px] px-3 text-[15px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} />
                        <span className="block text-[14px] text-[#4f5a78] mt-1">Covers free time at the terminal. You can extend it later.</span>
                      </label>
                    )}
                    <label className="block">
                      <span className="block text-[14px] text-[#111838] mb-1" style={{ fontWeight: 600 }}>{clr ? '1.' : '2.'} Choose how to pay</span>
                      <select value={method} onChange={e => setMethod(Number(e.target.value))} className="w-full h-[44px] rounded-[6px] px-3 text-[15px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }}>
                        {payMethods.map((m, i) => <option key={m} value={i}>{m}</option>)}
                      </select>
                    </label>
                    <div className="rounded-[12px] px-4 py-3 flex items-center justify-between gap-3" style={{ background: '#f6f8fc' }}>
                      <span className="text-[14px] text-[#4f5a78]">{clr ? 'Permit fees' : 'Total to pay'}</span>
                      <span className="text-[20px] text-[#0e1b3d]" style={{ fontWeight: 700 }}><DhAmount value={payAmount} /></span>
                    </div>
                    <Btn size="lg" onClick={payDraft}>{clr ? 'Pay and submit' : 'Pay and send'}&nbsp;<DhAmount value={payAmount} /></Btn>
                    <p className="text-[14px] text-[#4f5a78] flex items-start gap-2"><Icon name="shield" size={15} className="mt-[3px] text-[#1360d2]" />{clr ? `Goes to ${clr.permits.map(p => p.entity).join(' and ')} as soon as you pay. Then your import journey continues.` : `Goes to ${draft.line} for release as soon as you pay. Then your import journey continues.`}</p>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {/* ── Upload documents ── */}
          {page === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5">
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); startFiles(Array.from(e.dataTransfer.files).map(f => f.name)); }}
                className="rounded-[20px] border-2 border-dashed min-h-[380px] px-6 py-10 flex flex-col items-center justify-center text-center gap-4 transition-colors"
                style={{ borderColor: drag ? C.blue : '#b9cdf0', background: drag ? '#eef4ff' : 'linear-gradient(135deg,#ffffff,#f3f7ff)' }}>
                <span className="size-[76px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', color: '#fff', boxShadow: '0 14px 30px -12px rgba(19,96,210,.6)' }}><Icon name="upload" size={32} /></span>
                <div>
                  <p className="text-[20px] text-[#111838]" style={{ fontWeight: 700 }}>Drag your documents here</p>
                  <p className="text-[14px] text-[#4f5a78] mt-1">PDF, JPG or PNG · scans and phone photos are fine · English or Arabic</p>
                </div>
                <div className="flex gap-3 flex-wrap justify-center">
                  <Btn icon="clip" onClick={() => inputRef.current?.click()}>Choose files</Btn>
                  <Btn variant="secondary" onClick={() => startFiles([])}>Use sample documents</Btn>
                </div>
                <input ref={inputRef} type="file" multiple hidden onChange={e => startFiles(Array.from(e.target.files ?? []).map(f => f.name))} />
                <p className="text-[14px] text-[#66708c] inline-flex items-center gap-2"><Icon name="shield" size={14} />Files stay in the UAE and are stored with your case record.</p>
              </div>
              <Section title="Documents you need" sub="Upload them together; Document AI sorts them out.">
                <ol className="grid grid-cols-1 gap-3">
                  {REQUIRED_DOCS.map((d, i) => (
                    <li key={d.key} className="flex items-start gap-3">
                      <span className="size-[30px] rounded-full flex items-center justify-center text-[14px] text-white flex-shrink-0" style={{ background: C.navy, fontWeight: 700 }}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>{d.name}</span>
                          <span className="text-[14px] px-[10px] h-[24px] inline-flex items-center rounded-full" style={{ background: d.need === 'Required' ? '#e6f0ff' : '#f0f2f6', color: d.need === 'Required' ? C.blue : '#40484f', fontWeight: 600 }}>{d.need}</span>
                        </span>
                        <span className="block text-[14px] text-[#4f5a78] leading-snug mt-[2px]">{d.why}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>
          )}

          {/* ── Reading / finding (automatic) ── */}
          {(page === 'reading' || page === 'lookup') && (
            <Section title={page === 'reading' ? 'Document AI is at work' : 'The agents are looking up your shipment'} sub="This takes a few seconds. The next page opens by itself.">
              <div className="grid grid-cols-1 gap-4">
                {(page === 'reading' ? docs.map(d => ({ k: d.name, a: d.name, b: d.type })) : info.map(c => ({ k: c.no, a: c.no, b: `BL ${c.bl} · ${c.vessel}` }))).map((r, i, arr) => {
                  const p = Math.max(0, Math.min(100, progress * 1.5 - i * (60 / arr.length)));
                  return (
                    <div key={r.k} className="grid grid-cols-1 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)_150px] items-center gap-x-4 gap-y-1">
                      <span className="min-w-0 flex items-center gap-3">
                        <span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: p >= 100 ? '#28a745' : '#e6f0ff' }}>{p >= 100 ? <Icon name="check" size={14} strokeWidth={2.6} /> : <span className="ai-spin" />}</span>
                        <span className="min-w-0"><span className="block text-[14px] text-[#111838] truncate" style={{ fontWeight: 600, ...(page === 'lookup' ? mono : {}) }}>{r.a}</span><span className="block text-[14px] text-[#4f5a78] truncate">{p >= 60 ? r.b : page === 'reading' ? 'Identifying…' : 'Asking the line…'}</span></span>
                      </span>
                      <span className="h-[8px] rounded-full bg-[#edf0f4] overflow-hidden"><span className="block h-full rounded-full transition-all" style={{ width: `${p}%`, background: p >= 100 ? '#28a745' : C.blue }} /></span>
                      <span className="text-[14px] text-[#4f5a78] sm:text-right">{p >= 100 ? (page === 'reading' ? 'Fields extracted' : 'Found') : 'Working…'}</span>
                    </div>
                  );
                })}
                {page === 'lookup' && (
                  <p className="text-[14px] text-[#111838] flex items-center gap-3 mt-1">
                    <span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: progress >= 90 ? '#28a745' : '#e6f0ff' }}>{progress >= 90 ? <Icon name="check" size={14} strokeWidth={2.6} /> : <span className="ai-spin" />}</span>
                    Fetching the bill of lading and cargo manifest from Mediterranean Shipping
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── Check documents ── */}
          {page === 'docs' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                  ['doc', `${docs.length}`, 'documents read'],
                  ['box', `${SHIPMENT_CONTAINERS.length}`, "containers (40' HC)"],
                  ['decl', `${SHIPMENT_HS.length}`, 'HS codes'],
                  ['shield', `${permits}`, 'permits needed'],
                  ['ship', '48,600 kg', 'gross weight'],
                  ['wallet', 'USD 112,350', 'invoice value'],
                ].map(([ic, v, l]) => (
                  <div key={l} className="bg-white rounded-[14px] border px-4 py-3 flex items-center gap-3" style={{ borderColor: '#e1e7f2' }}>
                    <span className="size-[38px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name={ic} size={18} /></span>
                    <span className="min-w-0"><span className="block text-[18px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{v}</span><span className="block text-[14px] text-[#4f5a78] leading-tight truncate">{l}</span></span>
                  </div>
                ))}
              </div>
              <Section title="Documents matched" sub={`${found.filter(f => f.file).length} of ${found.length} documents found. Open any of them to see what was read.`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {caseDocList.map(d => <DocTile key={d.name} doc={d} onView={() => setView(d)} />)}
                  {found.filter(f => !f.file).map(f => (
                    <div key={f.key} className="flex items-center gap-3 rounded-[12px] px-3 py-[10px] border" style={{ borderColor: '#f2d98a', background: '#fffbef' }}>
                      <span className="w-[48px] h-[40px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 700 }}>{f.key}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{f.name}</span><span className="block text-[14px] text-[#4f5a78]">Not uploaded · {f.need.toLowerCase()}</span></span>
                      <Pill tone="you">Add later</Pill>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Cross-checks" sub={`${CHECKS.filter(c => c.ok).length} of ${CHECKS.length} checks passed. The tariff difference is passed to the declaration agent to resolve.`}>
                <div className="flex flex-wrap gap-2">
                  {CHECKS.map(c => (
                    <span key={c.label} className="inline-flex items-center gap-[6px] h-[34px] px-[14px] rounded-full text-[14px]" style={{ background: c.ok ? '#e3f5ea' : '#fff4d6', color: c.ok ? '#17703a' : '#8a5a00', fontWeight: 600 }}>
                      <Icon name={c.ok ? 'check' : 'info'} size={14} strokeWidth={2.4} />{c.label}
                    </span>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ── Shipment details ── */}
          {page === 'details' && (
            <>
              <Section title="From your documents" sub="BL MEDU48210937 · Shanghai → Jebel Ali">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  {SHIPMENT_FIELDS.map(([k, v]) => <Field key={k} label={k} value={v} />)}
                </div>
              </Section>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Section title={`${SHIPMENT_CONTAINERS.length} containers on this BL`}>
                  <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                    <table className="w-full">
                      <thead><tr className="bg-[#f3f6fb]"><th className={th}>Container</th><th className={th}>Packages</th><th className={th}>Weight</th></tr></thead>
                      <tbody>{SHIPMENT_CONTAINERS.map(ct => (
                        <tr key={ct.no} className="border-t" style={{ borderColor: '#eef1f6' }}><td className={td} style={{ fontWeight: 600, ...mono }}>{ct.no}</td><td className={td}>{ct.packages}</td><td className={td}>{ct.weight}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Section>
                <Section title={`${SHIPMENT_HS.length} HS codes · ${permits} need a permit`}>
                  <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                    <table className="w-full">
                      <thead><tr className="bg-[#f3f6fb]"><th className={th}>HS code</th><th className={th}>Goods</th><th className={th}>Permit</th></tr></thead>
                      <tbody>{SHIPMENT_HS.map(h => (
                        <tr key={h.hs} className="border-t" style={{ borderColor: '#eef1f6' }}>
                          <td className={td} style={{ fontWeight: 600 }}>{h.hs}</td>
                          <td className={td}>{h.goods}<span className="block text-[14px] text-[#4f5a78]">{h.qty} · {h.value}</span></td>
                          <td className={td}>{h.permit ? <Pill tone="run">{h.permit === 'Dubai Municipality' ? 'DM' : h.permit}</Pill> : <span className="text-[#4f5a78]">None</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Section>
              </div>
            </>
          )}

          {/* ── Confirm fields ── */}
          {page === 'confirm' && (
            <Section title={toConfirm ? `${toConfirm} field${toConfirm > 1 ? 's' : ''} to confirm` : 'All fields confirmed'} sub="You can also continue now and confirm them later from the import journey.">
              <div className="grid grid-cols-1 gap-3">
                {LOW_CONF_FIELDS.map(f => (
                  <div key={f.id} className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-5 py-4" style={{ background: ok[f.id] ? '#f3fbf6' : '#fffbef', border: `1px solid ${ok[f.id] ? '#cdebd8' : '#f6e3a8'}` }}>
                    <div>
                      <p className="text-[15px] text-[#111838]" style={{ fontWeight: 700 }}>{f.label}</p>
                      <p className="text-[14px]" style={{ color: ok[f.id] ? '#17703a' : '#8a5a00' }}>{ok[f.id] ? 'Confirmed by you' : `${f.confidence}% confidence`}</p>
                    </div>
                    <div className="min-w-0">
                      <input value={vals[f.id]} onChange={e => { setVals(v => ({ ...v, [f.id]: e.target.value })); setOk(o => ({ ...o, [f.id]: false })); }}
                        className="w-full h-[42px] rounded-[6px] px-3 text-[15px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} aria-label={f.label} />
                      <p className="text-[14px] text-[#4f5a78] mt-1">{f.alt}</p>
                    </div>
                    {ok[f.id]
                      ? <span className="inline-flex items-center gap-1 text-[14px] text-[#17703a]" style={{ fontWeight: 600 }}><Icon name="check" size={16} strokeWidth={2.4} />Confirmed</span>
                      : <Btn onClick={() => setOk(o => ({ ...o, [f.id]: true }))}>Confirm</Btn>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Enter containers ── */}
          {page === 'containers' && (
            <Section title="Container numbers" sub="Type, paste a column from Excel, or press Enter after each number.">
              <ContainerInput value={list} onChange={setList} />
              <div className="flex gap-3 mt-4 flex-wrap items-center">
                <Btn variant="secondary" onClick={() => setList(SAMPLE_CONTAINERS.slice(0, 4))}>Use sample containers</Btn>
                <span className="text-[14px] text-[#4f5a78]">{list.length ? `${list.length} container${list.length > 1 ? 's' : ''} added` : 'No containers added yet'}</span>
              </div>
            </Section>
          )}

          {/* ── Shipment and documents (containers) ── */}
          {page === 'shipment' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                  ['box', String(info.length), 'containers'],
                  ['doc', '1', 'bill of lading'],
                  ['ship', '30 Nov', 'vessel ETA'],
                  ['decl', String(SHIPMENT_HS.length), 'HS codes (manifest)'],
                  ['shield', String(permits), 'permits needed'],
                ].map(([ic, v, l]) => (
                  <div key={l} className="bg-white rounded-[14px] border px-4 py-3 flex items-center gap-3" style={{ borderColor: '#e1e7f2' }}>
                    <span className="size-[38px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name={ic} size={18} /></span>
                    <span className="min-w-0"><span className="block text-[18px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{v}</span><span className="block text-[14px] text-[#4f5a78] leading-tight truncate">{l}</span></span>
                  </div>
                ))}
              </div>
              <Section title={`BL ${info[0].bl} · Shanghai → Jebel Ali`} sub={`${COMPANY} · ${info.length} × 40' HC · ${info[0].vessel}`}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mb-5">
                  <Field label="Bill of lading" value={info[0].bl} />
                  <Field label="Shipping line" value={info[0].line} />
                  <Field label="Vessel / voyage" value={info[0].vessel} />
                  <Field label="Terminal" value={info[0].terminal} />
                </div>
                <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                  <table className="w-full">
                    <thead><tr className="bg-[#f3f6fb]"><th className={th}>Container</th><th className={th}>Size</th><th className={th}>Status</th></tr></thead>
                    <tbody>{info.map(c => (
                      <tr key={c.no} className="border-t" style={{ borderColor: '#eef1f6' }}><td className={td} style={{ fontWeight: 600, ...mono }}>{c.no}</td><td className={td}>40' HC</td><td className={td}><Pill tone="run">On board · ETA {c.eta}</Pill></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </Section>
              <Section title="Documents" sub="Invoice and packing list are optional now. The declaration agent asks for them before filing with Dubai Customs.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {caseDocList.map(d => (
                    <DocTile key={d.type} doc={d} onView={() => setView(d)}
                      onUpload={() => setExtra(x => ({ ...x, [d.type]: d.type === 'Commercial invoice' ? 'Invoice_INV-0931.pdf' : 'Packing_list.pdf' }))} />
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ── AI agents ── */}
          {page === 'agents' && (
            <>
              <div className="rounded-[14px] px-5 py-4 flex items-center gap-3 flex-wrap" style={{ background: '#f3fbf6', border: '1px solid #cdebd8' }}>
                <Pill tone="done">Done</Pill>
                <span className="text-[14px] text-[#111838]"><strong style={{ fontWeight: 600 }}>{source === 'documents' ? 'Document AI' : 'Lookup agent'}</strong> {source === 'documents' ? 'read your files' : 'found your shipment'} · <strong style={{ fontWeight: 600 }}>Cargo owner agent</strong> confirmed you are the consignee</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {JOURNEY_AGENTS.map((g, gi) => {
                  const on = !off[g.plan];
                  return (
                    <Section key={g.plan} title={`Track ${gi + 1} · ${g.track}`} sub={on ? `${g.agents.length} agent${g.agents.length > 1 ? 's' : ''} working for you` : 'Switched off · you handle this track'}
                      right={<Toggle on={on} onClick={() => setOff(o => ({ ...o, [g.plan]: !o[g.plan] }))} label={`${on ? 'Switch off' : 'Switch on'} ${g.track}`} />}>
                      <ul className="grid grid-cols-1 gap-3" style={{ opacity: on ? 1 : 0.6 }}>
                        {g.agents.map(a => (
                          <li key={a.name} className="flex items-start gap-3">
                            <span className="size-[36px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: on ? 'linear-gradient(135deg,#1360d2,#4f8ff7)' : '#aab4c8' }}><Icon name="bot" size={17} /></span>
                            <span className="min-w-0"><span className="block text-[15px] text-[#111838]" style={{ fontWeight: 600 }}>{a.name}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{a.job}</span></span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Import journey (kept mounted while the completion page shows) ── */}
          {(page === 'journey' || page === 'complete') && (
            <>
              {page === 'journey' && created && (
                fromDraft ? (
                <SuccessBanner>
                  {clr
                    ? <><strong>Success:</strong> {clr.permits.length} permit request{clr.permits.length > 1 ? 's' : ''} for BL <strong>{clr.bl}</strong> {clr.permits.length > 1 ? 'have' : 'has'} been paid (<DhAmount value={payAmount} />) and submitted to {clr.permits.map(p => p.entity).join(' and ')}. Your import journey for <strong>{clr.caseId}</strong> continues below.</>
                    : <><strong>Success:</strong> Delivery order request for BL <strong>{draft.bl}</strong> has been paid (<DhAmount value={payAmount} />) and sent to {draft.line}. Your import journey for <strong>{draft.caseId}</strong> continues below.</>}
                </SuccessBanner>
                ) : (
                <SuccessBanner>
                  <strong>Success:</strong> Import case <strong>IMP-2027-00422</strong> has been created for BL <strong>MEDU48210937</strong> with {nContainers} containers. {tracksOn} tracks are running with {agentCount} AI agents.{source === 'documents' && toConfirm > 0 && <> {toConfirm} field{toConfirm > 1 ? 's are' : ' is'} still waiting for your confirmation.</>}
                </SuccessBanner>
                )
              )}
              <div className={page === 'journey' ? '' : 'hidden'}>
                {fromDraft
                  ? <CaseJourneyCard barSlot={barSlot} ask={journeyAsk} source="containers" containers={draft.containers} uploaded={{ 'Commercial invoice': 'Invoice_INV-0931.pdf', 'Packing list': 'Packing_list.pdf' }} initial={start} />
                  : <CaseJourneyCard barSlot={barSlot} ask={journeyAsk} source={source === 'containers' ? 'containers' : 'documents'} files={source === 'documents' ? names : undefined} containers={source === 'containers' ? info.map(c => c.no) : undefined} uploaded={extra} />}
              </div>
              {page === 'complete' && done && <AuditLogCard events={done.events} containers={done.containers} summary={done.summary} />}
            </>
          )}
        </div>
      </main>

      {/* Sticky action bar, as in the other modules: back on the left, the next action on the right */}
      {page !== 'reading' && page !== 'lookup' && (
        <div className="sticky bottom-0 z-30 bg-white" style={{ boxShadow: '0px -4px 12px rgba(0,0,0,0.08)' }}>
          {setup && (
            <div className="px-4 sm:px-10 py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {back ? <Btn size="lg" variant="secondary" onClick={() => go(back)}>Back</Btn> : <Btn size="lg" variant="secondary" onClick={onExit}>Cancel</Btn>}
                <span className="text-[14px] text-[#4f5a78] hidden md:inline">Step {stepIdx + 1} of {steps.length} · {steps[stepIdx].t}</span>
              </div>
              {next && <Btn size="lg" icon={next.icon} onClick={next.to}>{next.label}</Btn>}
            </div>
          )}
          {page === 'complete' && (
            <div className="px-4 sm:px-10 py-4 flex items-center justify-between gap-3 flex-wrap">
              <Btn size="lg" variant="secondary" onClick={() => go('journey')}>Back to the journey</Btn>
              <Btn size="lg" onClick={onExit}>Back to AI home</Btn>
            </div>
          )}
          {page === 'journey' && <div ref={setBarSlot} className="px-4 sm:px-10 py-4 flex items-center justify-between gap-3 flex-wrap" />}
        </div>
      )}

      {view && <DocViewer doc={view} containers={nContainers} onClose={() => setView(null)} />}
    </div>
  );
}
