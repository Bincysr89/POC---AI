/* Start an import as full-width pages, one after the other (not a chat).
 *
 * Start import:  Choose (upload BL or enter containers)
 *   → Upload bill of lading → Bill of lading details → Import journey
 *   → Enter container numbers → Shipment details → Import journey
 * Create delivery order: Choose a drafted BL → Review and pay → Import journey
 *
 * Only the bill of lading is uploaded for now: it carries the BL and container
 * details, so there is nothing else to confirm before the journey starts. */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPANY, SAMPLE_CONTAINERS, SHIPMENT_CONTAINERS, lookupContainers,
  ACTIVE, DEFAULT_CASE, DO_DRAFTS, DO_FEE, THC_PER_CONTAINER, WALLET_BALANCE, setActiveCase,
} from './data';
import { DhAmount } from '../Dh';
import { caseDocs, DocTile, DocViewer, type CaseDoc } from './docs';
import { ContainerInput } from './containers';
import { AuditLogCard, CaseJourneyCard, type AuditEvent, type JourneyStart } from './journey';
import type { CompletionSummary } from './complete';
import { Btn, C, Field, Icon, Pill, SuccessBanner } from './ui';

export type ImportSource = 'documents' | 'containers' | 'start' | 'do';
type Path = 'documents' | 'containers' | 'do';
type Page = 'start' | 'pick' | 'pay' | 'upload' | 'reading' | 'bol' | 'containers' | 'lookup' | 'shipment' | 'journey' | 'complete';

const STEPS: Record<Path, { t: string; pages: Page[] }[]> = {
  documents: [
    { t: 'Start import', pages: ['start'] },
    { t: 'Upload bill of lading', pages: ['upload', 'reading'] },
    { t: 'Bill of lading details', pages: ['bol'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
  containers: [
    { t: 'Start import', pages: ['start'] },
    { t: 'Enter container numbers', pages: ['containers', 'lookup'] },
    { t: 'Shipment details', pages: ['shipment'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
  do: [
    { t: 'Choose a bill of lading', pages: ['pick'] },
    { t: 'Review and pay', pages: ['pay'] },
    { t: 'Import journey', pages: ['journey', 'complete'] },
  ],
};

const SAMPLE_BL = 'BL_MEDU48210937.pdf';
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

export default function ImportWizard({ source, files: initFiles, containers: initContainers, startAt, bl, onExit }: {
  source: ImportSource; files?: string[]; containers?: string[]; startAt?: 'journey'; bl?: string; onExit: () => void;
}) {
  const fromDraft = source === 'do';
  const [path, setPath] = useState<Path>(source === 'do' ? 'do' : source === 'containers' ? 'containers' : 'documents');
  const [pickIdx, setPickIdx] = useState(() => Math.max(0, DO_DRAFTS.findIndex(x => x.bl === bl)));
  const [validity, setValidity] = useState('2027-12-05');
  const [method, setMethod] = useState(0);
  const [start, setStart] = useState<JourneyStart | undefined>();
  useState(() => { if (!fromDraft) setActiveCase(DEFAULT_CASE); });   // a new import uses the sample BL
  const [page, setPage] = useState<Page>(() =>
    startAt === 'journey' ? 'journey'
      : fromDraft ? (bl && DO_DRAFTS.some(x => x.bl === bl) ? 'pay' : 'pick')
      : initFiles?.length ? 'reading'
      : initContainers?.length ? 'lookup'
      : source === 'containers' ? 'containers'
      : source === 'documents' ? 'upload'
      : 'start');
  const [blFile, setBlFile] = useState<string>(initFiles?.[0] ?? SAMPLE_BL);
  const [list, setList] = useState<string[]>(initContainers ?? []);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<CaseDoc | null>(null);
  const [done, setDone] = useState<{ events: AuditEvent[]; containers: number; summary: CompletionSummary } | null>(null);
  const [created, setCreated] = useState(startAt !== 'journey');
  const inputRef = useRef<HTMLInputElement>(null);
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);   // the journey puts its page buttons here
  const barRef = useRef<HTMLOListElement>(null);

  const steps = STEPS[path];
  const stepIdx = Math.max(0, steps.findIndex(s => s.pages.includes(page)));
  const setup = page !== 'journey' && page !== 'complete';
  const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0, behavior: 'auto' }); };

  /* Keep the current step in view on narrow screens */
  useEffect(() => {
    const bar = barRef.current, cur = bar?.querySelector<HTMLElement>('[aria-current="step"]');
    if (bar && cur) bar.scrollLeft = Math.max(0, cur.offsetLeft - bar.clientWidth / 2 + cur.offsetWidth / 2);
  }, [page]);

  /* Automatic pages: reading the BL / finding the shipment */
  useEffect(() => {
    if (page !== 'reading' && page !== 'lookup') return;
    setProgress(0);
    const iv = setInterval(() => setProgress(p => Math.min(100, p + 5)), 90);
    const t = setTimeout(() => go(page === 'reading' ? 'bol' : 'shipment'), 2200);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [page]);

  const info = useMemo(() => lookupContainers(list.length ? list : SAMPLE_CONTAINERS.slice(0, 4)), [list]);
  const nContainers = path === 'containers' ? info.length : SHIPMENT_CONTAINERS.length;
  const blDoc: CaseDoc = caseDocs(path === 'containers' ? 'containers' : 'documents', [blFile], {})[0];

  const chooseFile = (l: string[]) => { setBlFile(l[0] ?? SAMPLE_BL); go('reading'); };
  const confirm = () => { setCreated(true); go('journey'); };

  /* Delivery order started from a drafted BL */
  const draft = DO_DRAFTS[pickIdx];
  const doAmount = (DO_FEE + draft.containers.length * THC_PER_CONTAINER).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const payMethods = [`Dubai Trade wallet · Dh ${WALLET_BALANCE}`, 'Credit facility · 30 days'];
  const payDraft = () => {
    const { containers: _c, size: _s, drafted: _d, status: _st, ...meta } = draft;
    setActiveCase(meta);
    const how = ['wallet', 'credit facility'][method];
    setStart({
      idx: { V: -1, D: 2 }, validity, method,
      events: [
        { time: '24 Nov 09:50', track: 'Vessel arrival', actor: 'Status agent', kind: 'agent', action: `All ${draft.containers.length} containers on BL ${draft.bl} discharged`, tool: 'container.status', outcome: 'Done' },
        { time: '24 Nov 09:52', track: 'Trade+ · DO', actor: 'DO agent', kind: 'agent', action: `Drafted the DO request with ${draft.line} charges`, tool: 'do.draft', outcome: 'Draft ready' },
        { time: '24 Nov 10:02', track: 'Trade+ · DO', actor: 'You', kind: 'you', action: `Reviewed the DO request, set validity to ${validity} and paid (${how})`, tool: 'tradepay.pay', outcome: `Paid Dh ${doAmount}` },
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
    start: { title: 'Start an import', sub: 'Tell us about your shipment. Upload the bill of lading, or type the container numbers if you don’t have it to hand.' },
    pick: { title: 'Create a delivery order', sub: 'The DO agent has drafted delivery order requests for these bills of lading. Choose the one you want to request.' },
    pay: { title: 'Review and pay the delivery order', sub: `Check the request, choose how long the DO stays valid and pay. It goes to ${draft.line} straight away.` },
    upload: { title: 'Upload your bill of lading', sub: 'Document AI reads the BL and the containers on it. That is all we need to start the import journey.' },
    reading: { title: 'Reading your bill of lading', sub: 'Document AI is extracting the BL and container details.' },
    bol: { title: 'Bill of lading details', sub: 'This is what Document AI read from your BL. If it looks right, start the import journey.' },
    containers: { title: 'Enter your container numbers', sub: 'Add one or more containers. The agents find the bill of lading and vessel with the shipping line.' },
    lookup: { title: `Finding the shipment for ${info.length} container${info.length > 1 ? 's' : ''}`, sub: 'Checking each container with the shipping line and the port.' },
    shipment: { title: 'Shipment details', sub: 'All your containers are on one bill of lading, fetched from the shipping line. If it looks right, start the import journey.' },
    journey: { title: 'Import journey', sub: '' },
    complete: { title: 'Import journey', sub: '' },
  };

  /* Footer actions per page */
  const nextOf: Partial<Record<Page, { label: React.ReactNode; to: () => void; icon?: string }>> = {
    pick: { label: 'Next: Review and pay', to: () => go('pay') },
    pay: { label: <>Pay and send&nbsp;<DhAmount value={doAmount} /></>, to: payDraft },
    upload: { label: 'Continue with the sample BL', to: () => chooseFile([]) },
    bol: { label: 'Confirm and start import journey', to: confirm, icon: 'check' },
    containers: { label: 'Find my shipment', to: () => { if (!list.length) setList(SAMPLE_CONTAINERS.slice(0, 4)); go('lookup'); }, icon: 'play' },
    shipment: { label: 'Confirm and start import journey', to: confirm, icon: 'check' },
  };
  const backOf: Partial<Record<Page, Page>> = { pay: 'pick', upload: 'start', bol: 'upload', containers: 'start', shipment: 'containers' };
  const next = nextOf[page];
  const back = backOf[page];
  const crumb = path === 'do' ? 'Create delivery order' : 'Start import';

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
            <span className={setup ? '' : 'text-[#111838]'} style={{ fontWeight: setup ? 400 : 600 }}>{setup ? crumb : page === 'complete' ? 'Import journey · documents and audit log' : `Import journey · ${ACTIVE.c.caseId}`}</span>
          </div>

          {setup && (
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
          )}
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
          {/* ── Start: upload the BL or enter container numbers ── */}
          {page === 'start' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {([
                { p: 'documents' as const, icon: 'upload', title: 'Upload bill of lading', sub: 'Document AI reads the BL number, vessel and every container on it.', cta: 'Upload BL', to: 'upload' as Page },
                { p: 'containers' as const, icon: 'box', title: 'Enter container numbers', sub: 'Type or paste your containers. The agents find the BL and vessel with the shipping line.', cta: 'Enter containers', to: 'containers' as Page },
              ]).map(o => (
                <button key={o.p} type="button" onClick={() => { setPath(o.p); go(o.to); }}
                  className="group text-left bg-white rounded-[20px] border-2 p-6 sm:p-8 flex flex-col gap-4 transition-all hover:-translate-y-[2px]"
                  style={{ borderColor: '#e1e7f2', boxShadow: '0 2px 10px -6px rgba(14,27,61,.18)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue)} onMouseLeave={e => (e.currentTarget.style.borderColor = '#e1e7f2')}>
                  <span className="size-[64px] rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', boxShadow: '0 12px 26px -12px rgba(19,96,210,.6)' }}><Icon name={o.icon} size={28} /></span>
                  <span>
                    <span className="block text-[22px] text-[#0e1b3d]" style={{ fontWeight: 700 }}>{o.title}</span>
                    <span className="block text-[15px] text-[#4f5a78] mt-1">{o.sub}</span>
                  </span>
                  <span className="mt-auto inline-flex items-center gap-2 text-[16px] text-[#1360d2]" style={{ fontWeight: 600 }}>{o.cta}<Icon name="arrow" size={16} /></span>
                </button>
              ))}
            </div>
          )}

          {/* ── Upload the bill of lading ── */}
          {page === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5">
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); chooseFile(Array.from(e.dataTransfer.files).map(f => f.name)); }}
                className="rounded-[20px] border-2 border-dashed min-h-[340px] px-6 py-10 flex flex-col items-center justify-center text-center gap-4 transition-colors"
                style={{ borderColor: drag ? C.blue : '#b9cdf0', background: drag ? '#eef4ff' : 'linear-gradient(135deg,#ffffff,#f3f7ff)' }}>
                <span className="size-[76px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', color: '#fff', boxShadow: '0 14px 30px -12px rgba(19,96,210,.6)' }}><Icon name="upload" size={32} /></span>
                <div>
                  <p className="text-[20px] text-[#111838]" style={{ fontWeight: 700 }}>Drag your bill of lading here</p>
                  <p className="text-[14px] text-[#4f5a78] mt-1">One file · PDF, JPG or PNG · scans and phone photos are fine</p>
                </div>
                <div className="flex gap-3 flex-wrap justify-center">
                  <Btn icon="clip" onClick={() => inputRef.current?.click()}>Choose file</Btn>
                  <Btn variant="secondary" onClick={() => chooseFile([])}>Use the sample BL</Btn>
                </div>
                <input ref={inputRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={e => chooseFile(Array.from(e.target.files ?? []).map(f => f.name))} />
                <p className="text-[14px] text-[#66708c] inline-flex items-center gap-2"><Icon name="shield" size={14} />Files stay in the UAE and are stored with your case record.</p>
              </div>
              <Section title="What we read from the BL" sub="Only the bill of lading is needed for now.">
                <ul className="grid grid-cols-1 gap-3">
                  {[
                    ['doc', 'BL number and shipping line'],
                    ['ship', 'Vessel, voyage and ports'],
                    ['box', 'Every container number and size'],
                    ['person', 'Shipper and consignee'],
                  ].map(([ic, t]) => (
                    <li key={t} className="flex items-center gap-3 text-[15px] text-[#111838]">
                      <span className="size-[34px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name={ic} size={16} /></span>{t}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          {/* ── Reading / finding (automatic) ── */}
          {(page === 'reading' || page === 'lookup') && (
            <Section title={page === 'reading' ? 'Document AI is at work' : 'The agents are looking up your shipment'} sub="This takes a few seconds. The next page opens by itself.">
              <div className="grid grid-cols-1 gap-4">
                {(page === 'reading'
                  ? [{ k: blFile, a: blFile, b: 'Bill of lading · BL and container details' }]
                  : info.map(c => ({ k: c.no, a: c.no, b: `BL ${c.bl} · ${c.vessel}` }))
                ).map((r, i, arr) => {
                  const p = Math.max(0, Math.min(100, progress * 1.4 - i * (60 / arr.length)));
                  return (
                    <div key={r.k} className="grid grid-cols-1 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)_150px] items-center gap-x-4 gap-y-1">
                      <span className="min-w-0 flex items-center gap-3">
                        <span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: p >= 100 ? '#28a745' : '#e6f0ff' }}>{p >= 100 ? <Icon name="check" size={14} strokeWidth={2.6} /> : <span className="ai-spin" />}</span>
                        <span className="min-w-0"><span className="block text-[14px] text-[#111838] truncate" style={{ fontWeight: 600, ...(page === 'lookup' ? mono : {}) }}>{r.a}</span><span className="block text-[14px] text-[#4f5a78] truncate">{p >= 60 ? r.b : page === 'reading' ? 'Reading pages…' : 'Asking the line…'}</span></span>
                      </span>
                      <span className="h-[8px] rounded-full bg-[#edf0f4] overflow-hidden"><span className="block h-full rounded-full transition-all" style={{ width: `${p}%`, background: p >= 100 ? '#28a745' : C.blue }} /></span>
                      <span className="text-[14px] text-[#4f5a78] sm:text-right">{p >= 100 ? (page === 'reading' ? 'Details extracted' : 'Found') : 'Working…'}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── Bill of lading details (from the upload) / Shipment details (from containers) ── */}
          {(page === 'bol' || page === 'shipment') && (() => {
            const fromBl = page === 'bol';
            const rows = fromBl
              ? SHIPMENT_CONTAINERS.map(c => ({ no: c.no, size: "40' HC", extra: `${c.packages} · ${c.weight}` }))
              : info.map(c => ({ no: c.no, size: "40' HC", extra: `On board · ETA ${c.eta}` }));
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['doc', '1', 'bill of lading'],
                    ['box', String(rows.length), "containers (40' HC)"],
                    ['ship', DEFAULT_CASE.vessel.replace(' · ', ' '), 'vessel / voyage'],
                    ['clock', '30 Nov', 'ETA from the line'],
                  ].map(([ic, v, l]) => (
                    <div key={l} className="bg-white rounded-[14px] border px-4 py-3 flex items-center gap-3 min-w-0" style={{ borderColor: '#e1e7f2' }}>
                      <span className="size-[38px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fd', color: C.blue }}><Icon name={ic} size={18} /></span>
                      <span className="min-w-0"><span className="block text-[17px] text-[#0e1b3d] leading-tight truncate" style={{ fontWeight: 700 }}>{v}</span><span className="block text-[14px] text-[#4f5a78] leading-tight truncate">{l}</span></span>
                    </div>
                  ))}
                </div>
                <Section title={`BL ${DEFAULT_CASE.bl}`} sub={`${DEFAULT_CASE.line} · ${DEFAULT_CASE.origin} → Jebel Ali`}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Bill of lading" value={DEFAULT_CASE.bl} />
                    <Field label="Shipping line" value={DEFAULT_CASE.line} />
                    <Field label="Vessel / voyage" value={DEFAULT_CASE.vessel} />
                    <Field label="Port of loading" value={DEFAULT_CASE.origin} />
                    <Field label="Port of discharge" value="Jebel Ali T3" />
                    <Field label="Shipper" value="Sinopower Electric Co." />
                    <Field label="Consignee" value={COMPANY} />
                    <Field label="Containers" value={`${rows.length} × 40' HC`} />
                  </div>
                </Section>
                <Section title={`${rows.length} containers on this BL`}>
                  <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: '#eef1f6' }}>
                    <table className="w-full">
                      <thead><tr className="bg-[#f3f6fb]"><th className={th}>Container</th><th className={th}>Size</th><th className={th}>{fromBl ? 'Packages · weight' : 'Status'}</th></tr></thead>
                      <tbody>{rows.map(r => (
                        <tr key={r.no} className="border-t" style={{ borderColor: '#eef1f6' }}>
                          <td className={td} style={{ fontWeight: 600, ...mono }}>{r.no}</td><td className={td}>{r.size}</td>
                          <td className={td}>{fromBl ? r.extra : <Pill tone="run">{r.extra}</Pill>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Section>
                <Section title="Bill of lading" sub={fromBl ? 'Uploaded by you' : `Fetched from ${DEFAULT_CASE.line}`}>
                  <div className="max-w-[560px]"><DocTile doc={blDoc} onView={() => setView(blDoc)} /></div>
                </Section>
              </>
            );
          })()}

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

          {/* ── Create delivery order: choose a drafted bill of lading ── */}
          {page === 'pick' && (
            <div role="radiogroup" aria-label="Bills of lading with drafts ready" className="grid grid-cols-1 gap-3">
              {DO_DRAFTS.map((x, i) => {
                const on = i === pickIdx;
                const amt = (DO_FEE + x.containers.length * THC_PER_CONTAINER).toLocaleString('en-US', { minimumFractionDigits: 2 });
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
                          <Pill tone="done">DO request drafted</Pill>
                        </span>
                        <span className="block text-[14px] text-[#4f5a78] mt-1">{x.caseId} · {x.line} · {x.vessel.replace(' · ', ' ')} · {x.origin} → Jebel Ali</span>
                        <span className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[14px] text-[#111838]">
                          <span className="inline-flex items-center gap-1"><Icon name="box" size={15} className="text-[#1360d2]" />{x.containers.length} × {x.size}</span>
                          <span className="inline-flex items-center gap-1"><Icon name="ship" size={15} className="text-[#1360d2]" />{x.status}</span>
                          <span className="inline-flex items-center gap-1 text-[#4f5a78]"><Icon name="clock" size={15} />Drafted {x.drafted.toLowerCase()}</span>
                        </span>
                      </span>
                    </span>
                    <span className="lg:text-right pl-[38px] lg:pl-0">
                      <span className="block text-[14px] text-[#4f5a78]">Delivery order charges</span>
                      <span className="block text-[20px] text-[#0e1b3d]" style={{ fontWeight: 700 }}><DhAmount value={amt} /></span>
                    </span>
                  </button>
                );
              })}
              <p className="text-[14px] text-[#4f5a78] flex items-center gap-2"><Icon name="info" size={15} />Only bills of lading with a draft ready are listed. The DO agent adds new ones as containers are discharged.</p>
            </div>
          )}

          {/* ── Create delivery order: review and pay ── */}
          {page === 'pay' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
              <div className="grid grid-cols-1 gap-5 min-w-0">
                <Section title={`Delivery order request · BL ${draft.bl}`} sub={`${draft.caseId} · ${draft.vessel.replace(' · ', ' ')} · ${draft.origin} → Jebel Ali`}>
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
              </div>
              <div className="lg:sticky lg:top-[104px]">
                <Section title="What you need to do">
                  <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                      <span className="block text-[14px] text-[#111838] mb-1" style={{ fontWeight: 600 }}>1. Set the DO validity date</span>
                      <input type="date" value={validity} onChange={e => setValidity(e.target.value)} className="w-full h-[44px] rounded-[6px] px-3 text-[15px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} />
                      <span className="block text-[14px] text-[#4f5a78] mt-1">Covers free time at the terminal. You can extend it later.</span>
                    </label>
                    <label className="block">
                      <span className="block text-[14px] text-[#111838] mb-1" style={{ fontWeight: 600 }}>2. Choose how to pay</span>
                      <select value={method} onChange={e => setMethod(Number(e.target.value))} className="w-full h-[44px] rounded-[6px] px-3 text-[15px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }}>
                        {payMethods.map((m, i) => <option key={m} value={i}>{m}</option>)}
                      </select>
                    </label>
                    <div className="rounded-[12px] px-4 py-3 flex items-center justify-between gap-3" style={{ background: '#f6f8fc' }}>
                      <span className="text-[14px] text-[#4f5a78]">Total to pay</span>
                      <span className="text-[20px] text-[#0e1b3d]" style={{ fontWeight: 700 }}><DhAmount value={doAmount} /></span>
                    </div>
                    <Btn size="lg" onClick={payDraft}>Pay and send&nbsp;<DhAmount value={doAmount} /></Btn>
                    <p className="text-[14px] text-[#4f5a78] flex items-start gap-2"><Icon name="shield" size={15} className="mt-[3px] text-[#1360d2]" />Goes to {draft.line} for release as soon as you pay. Then your import journey continues.</p>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {/* ── Import journey (kept mounted while the completion page shows) ── */}
          {(page === 'journey' || page === 'complete') && (
            <>
              {page === 'journey' && created && (
                <SuccessBanner>
                  {fromDraft
                    ? <><strong>Success:</strong> Delivery order request for BL <strong>{draft.bl}</strong> has been paid (<DhAmount value={doAmount} />) and sent to {draft.line}. Your import journey for <strong>{draft.caseId}</strong> continues below.</>
                    : <><strong>Success:</strong> Import case <strong>{ACTIVE.c.caseId}</strong> has been created for BL <strong>{ACTIVE.c.bl}</strong> with {nContainers} containers. Four tracks are now running.</>}
                </SuccessBanner>
              )}
              <div className={page === 'journey' ? '' : 'hidden'}>
                {fromDraft
                  ? <CaseJourneyCard barSlot={barSlot} ask={journeyAsk} source="containers" containers={draft.containers} initial={start} />
                  : <CaseJourneyCard barSlot={barSlot} ask={journeyAsk} source={path === 'containers' ? 'containers' : 'documents'} files={path === 'containers' ? undefined : [blFile]} containers={path === 'containers' ? info.map(c => c.no) : undefined} />}
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
