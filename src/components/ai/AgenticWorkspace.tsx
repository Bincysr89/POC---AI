/* Agentic AI workspace — the AI-first landing experience below the header.
 * Home: greeting, prompt composer, suggested prompts, "needs your action",
 * active imports. Conversation: the assistant hands work to purpose-built
 * agents and answers with interactive cards; anything that submits or pays
 * waits for the user's approval. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DhAmount } from '../Dh';
import { CASES, DEFAULT_MY_AGENTS, DO_TOTAL, PILLS, USER_NAME, extractContainers, type MyAgent } from './data';
import { ContainerDOCard } from './containers';
import { AgentBuilderCard, AgentsContext, MyAgentsGrid } from './agents';
import { AuditLogCard, CaseJourneyCard, type AuditEvent } from './journey';
import type { CompletionSummary } from './complete';
import {
  DeclListCard, DeclReviewCard, DeclViewCard, DOApprovalCard, DOCostCard, DOListCard, ETokenCard, HandoffCard,
  RiskCard, ServiceCard, TrackCard, UploadCard, ConfirmFields, type Ask,
} from './flows';
import { C, Dot, Icon, Orb } from './ui';

type Follow = { label: string; intent: string; utter: string };
type Msg = {
  id: number;
  who: 'me' | 'ai';
  text?: string;
  agent?: string;
  intent?: string;
  payload?: Record<string, unknown>;
  follow?: Follow[];
  attachments?: string[];
};
type Pending = { agent: string; trace: string[]; step: number };

/* ── Intent routing for free text ─────────────────────────────────────── */
function route(t: string): { intent: string; payload?: Record<string, unknown> } {
  const x = t.toLowerCase();
  const ref = t.match(/\b(IMP-\d{4}-\d{5}|[A-Z]{4}\d{8})\b/i)?.[1]?.toUpperCase();
  const containers = extractContainers(t);
  if (/(build|create|make|new|design).{0,24}agent|automate|automation|workflow/.test(x)) return { intent: 'build-agent' };
  if (containers.length && !/track|where|status/.test(x)) return { intent: 'do-containers', payload: { containers } };
  if (/container numbers?/.test(x) && /(\bdo\b|\bdos\b|delivery order)/.test(x)) return { intent: 'do-containers' };
  if (/import journey|my journey|my import case/.test(x)) return { intent: 'case-journey', payload: { resume: true } };
  if (/upload|new import|start (a|an|the)? ?import|import process|from (my )?documents/.test(x)) return { intent: 'upload' };
  if (/risk|storage|free time|demurrage/.test(x)) return { intent: 'risk' };
  if (/(cost|charge|price|how much)/.test(x) && /(\bdo\b|delivery order)/.test(x)) return { intent: 'do-cost' };
  if (/(pay|approve|create|new|raise|request|make)/.test(x) && /(\bdo\b|delivery order)/.test(x)) return { intent: 'do-approve' };
  if (/(create|start|new|request|raise).{0,24}(integrated clearance|clearance|permits?)/.test(x)) return { intent: 'clearance-create' };
  if (/pending|in review/.test(x) && /declaration/.test(x)) return { intent: 'decl-review' };
  if (/declaration|cleared|clearance/.test(x)) return { intent: 'decl-list' };
  if (/\bdo\b|\bdos\b|delivery order/.test(x)) return { intent: 'do-list' };
  if (/truck|slot|etoken|e-token|haul|gate/.test(x)) return { intent: 'etoken' };
  if (/confirm|field/.test(x)) return { intent: 'confirm-fields' };
  if (/track|where|container|status|shipment|vessel/.test(x) || ref) return { intent: 'track', payload: ref ? { caseId: ref } : undefined };
  if (/service|need|permit|cosmetic|licen/.test(x)) return { intent: 'service' };
  if (/human|person|support|call|talk/.test(x)) return { intent: 'human' };
  return { intent: 'other' };
}

/* ── Assistant replies ────────────────────────────────────────────────── */
const F = (label: string, intent: string, utter?: string): Follow => ({ label, intent, utter: utter ?? label });

function reply(intent: string, payload?: Record<string, unknown>): Omit<Msg, 'id' | 'who'> & { trace: string[] } {
  const files = (payload?.files as string[] | undefined) ?? [];
  switch (intent) {
    case 'upload':
      return { agent: 'Document AI', trace: ['Opening a new import draft'], text: files.length
        ? `I'm reading your ${files.length} document${files.length > 1 ? 's' : ''} now. I'll extract the shipment fields, check you are the consignee and propose an import plan.`
        : 'Upload your bill of lading, packing list, certificate of origin and commercial invoice. I will read them, check you are the cargo owner and open the import case with agents ready for each step.',
        follow: [F('Which documents do I need?', 'service', 'Which documents and services do I need for an import?')] };
    case 'do-containers': {
      const list = (payload?.containers as string[] | undefined) ?? [];
      return { agent: 'DO agent', trace: list.length ? ['container.lookup', 'bl.match', 'line.documents'] : ['Opening the import assistant'], text: list.length
        ? `Got ${list.length} container number${list.length > 1 ? 's' : ''}. I'll find the bill of lading and vessel, fetch the documents from the shipping line and prepare your import case.`
        : "Give me your container numbers, one or many. I'll find the bill of lading and vessel, fetch the documents from the shipping line and prepare your import case." };
    }
    case 'build-agent':
      return { agent: 'Agent builder', trace: ['agents.templates', 'tools.registry · governed APIs'], text: payload?.template
        ? 'Here is an agent that drafts delivery orders the moment your containers are discharged. Check the steps, test it on a past case, then switch it on.'
        : "Describe the work you want off your plate. I'll turn it into an agent with a trigger, the steps it takes and the point where it stops for your approval." };
    case 'case-journey':
      if (payload?.resume) return { agent: 'Workflow manager', trace: ['workflow.get · IMP-2027-00422', 'tracks.status · 4 tracks'], text: 'Here is your import journey for IMP-2027-00422. The four tracks are running; the steps that need you are listed first.' };
      return { agent: 'Workflow manager', trace: ['workflow.start · BCO import journey', 'tracks.start · 4 tracks'], text: "Your import case is open. Four tracks now run in parallel: vessel arrival, the delivery order in Trade+, permits and declaration in Integrated Clearance, and haulage in CargoWaves. Agents prepare everything; I'll stop only when you need to review, pay or confirm." };
    case 'audit-log':
      return { agent: 'Audit', trace: ['audit.compile · IMP-2027-00422'], text: 'All four tracks are done and your eToken is issued. Your documents are ready to download, and the full audit trail is below.' };
    case 'do-list':
      return { agent: 'DO agent', trace: ['do.list · last 30 days', 'do.status'], text: 'Here are your recent delivery orders. One is prepared and waiting for your approval: IMP-2027-00418, with charges fetched from the shipping line.',
        follow: [F('What will my DO cost?', 'do-cost'), F('Shipments at risk of storage charges', 'risk')] };
    case 'do-approve':
      return { agent: 'DO agent', trace: ['container.status · 3 of 3 discharged', 'do.lookup · none on file', 'do.charges · line tariff', 'do.draft · stopped for approval'], text: 'I created a delivery order request for IMP-2027-00418. The containers are discharged, so I added the line charges. Review it and pay with TradePay to send it to the shipping agent.' };
    case 'do-cost':
      return { agent: 'DO agent', trace: ['do.charges · line tariff', 'guarantee.lookup'], text: 'Your delivery order for MEDU48210937 will cost about the amount below. The container deposit is waived because you have a guarantee on file.' };
    case 'decl-list':
      return { agent: 'Declaration agent', trace: ['declaration.search · cleared', 'declaration.status'], text: 'Here are your recently cleared declarations, with the duty paid on each.',
        follow: [F("What's pending on IMP-2027-00418?", 'decl-review'), F('Track MEDU48210937', 'track')] };
    case 'decl-view':
      return { agent: 'Declaration agent', trace: ['declaration.get'], text: 'Here is the declaration summary.' };
    case 'decl-review':
      return { agent: 'Declaration agent', trace: ['declaration.draft', 'nomination.status'], text: `The declaration for IMP-2027-00418 is drafted and with your C&F agent. Two fields are below the confidence threshold, so a person decides them. Nothing is needed from you, but you can send a reminder.` };
    case 'track': {
      const id = (payload?.caseId as string | undefined) ?? 'IMP-2027-00418';
      const c = CASES.find(x => x.id === id || x.bl === id);
      const text = id === 'IMP-2027-00422'
        ? 'IMP-2027-00422 was just created. The status agent is watching the vessel; the DO agent will prepare the delivery order as soon as containers are discharged.'
        : c?.status === 'done' ? `${c.id} is delivered. The truck is booked and gates out tomorrow.`
        : c?.id === 'IMP-2027-00421' ? 'IMP-2027-00421 has not arrived yet (ETA in 4 days). Document AI needs you to confirm 2 fields before the declaration can be drafted.'
        : 'All 3 containers for MEDU48210937 are discharged at Jebel Ali T3 with no holds. 7 of 12 steps are done. The delivery order is ready for your approval, and the declaration is with your C&F agent.';
      return { agent: 'Status agent', trace: ['portcall.status', 'container.status', 'do.status', 'declaration.status'], text, payload: { caseId: id },
        follow: [F('When can I book a truck?', 'etoken'), F('What documents are missing?', 'confirm-fields', 'What documents or fields are missing?')] };
    }
    case 'risk':
      return { agent: 'Status agent', trace: ['container.freetime', 'do.status', 'etoken.status'], text: 'IMP-2027-00418 is at risk: free time ends in 3 days and the delivery order is not approved yet. Approving it today keeps you clear of storage charges.' };
    case 'etoken':
      return { agent: 'eToken agent', trace: ['declaration.status · pending', 'gate.forecast', 'haulier.availability'], text: 'Truck booking for IMP-2027-00418 opens once customs clears the declaration. I have shortlisted 3 gate slots; the earliest has the lowest predicted queue.' };
    case 'service':
      return { agent: 'Knowledge base', trace: ['services.search · cosmetics', 'rules.lookup · Dubai Municipality'], text: 'Cosmetics need a product registration and an import permit from Dubai Municipality, on top of the standard sea import services.' };
    case 'confirm-fields':
      return { agent: 'Document AI', trace: ['docai.extract · MSCU70033124'], text: 'Two fields on the new bill of lading for IMP-2027-00421 were read with medium confidence. Check them below; edit a value if it is wrong.' };
    case 'human':
      return { agent: 'Support', trace: ['support.availability'], text: "I'll connect you to a Dubai Trade support agent and pass on this conversation, so you won't need to repeat yourself." };
    default:
      return { agent: 'Knowledge base', trace: ['kb.search', 'case.search'], text: "Here's what I can help with across your Dubai Trade account. Try one of these:",
        follow: PILLS.slice(0, 7).map(p => F(p.label, p.intent, p.utter)) };
  }
}

function Card({ m, ask }: { m: Msg; ask: Ask }) {
  switch (m.intent) {
    case 'do-containers': return <ContainerDOCard ask={ask} containers={m.payload?.containers as string[] | undefined} />;
    case 'build-agent': return <AgentBuilderCard ask={ask} template={m.payload?.template as string | undefined} />;
    case 'case-journey': return <CaseJourneyCard ask={ask} source={(m.payload?.source as 'documents' | 'containers' | undefined) ?? 'documents'} files={m.payload?.files as string[] | undefined} containers={m.payload?.containers as string[] | undefined} uploaded={m.payload?.uploaded as Record<string, string> | undefined} />;
    case 'audit-log': return <AuditLogCard events={(m.payload?.events as AuditEvent[] | undefined) ?? []} containers={(m.payload?.containers as number | undefined) ?? 4} summary={m.payload?.summary as CompletionSummary | undefined} />;
    case 'upload': return <UploadCard ask={ask} files={m.payload?.files as string[] | undefined} />;
    case 'do-list': return <DOListCard ask={ask} />;
    case 'do-approve': return <DOApprovalCard ask={ask} />;
    case 'do-cost': return <DOCostCard ask={ask} />;
    case 'decl-list': return <DeclListCard ask={ask} />;
    case 'decl-view': return <DeclViewCard ask={ask} no={(m.payload?.no as string) ?? ''} />;
    case 'decl-review': return <DeclReviewCard />;
    case 'track': return <TrackCard ask={ask} caseId={m.payload?.caseId as string | undefined} />;
    case 'risk': return <RiskCard ask={ask} />;
    case 'etoken': return <ETokenCard />;
    case 'service': return <ServiceCard ask={ask} />;
    case 'confirm-fields': return <ConfirmFields ask={ask} />;
    case 'human': return <HandoffCard />;
    default: return null;
  }
}

/* ── Composer (glass) ──────────────────────────────────────────────────── */
type Act = (intent: string, utter: string, payload?: Record<string, unknown>) => void;

function Composer({ onSend, onFiles, onAct, hero, autoFocus }: { onSend: (t: string) => void; onFiles: (names: string[]) => void; onAct: Act; hero?: boolean; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const found = useMemo(() => extractContainers(draft), [draft]);

  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [draft]);

  const send = () => { const t = draft.trim(); if (!t) return; onSend(t); setDraft(''); };
  const mic = () => {
    if (listening) { setListening(false); onSend('Where is my container MSKU0000002?'); }
    else setListening(true);
  };
  if (!hero) {
    /* Conversation view: one compact row so replies keep the screen */
    const ib = 'size-[36px] rounded-full flex items-center justify-center text-[#0e1b3d] hover:bg-[#f0f5fc] hover:text-[#1360d2] transition-colors flex-shrink-0';
    return (
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const n = Array.from(e.dataTransfer.files).map(f => f.name); if (n.length) onFiles(n); }}
        className={`ai-border-flow relative rounded-[18px] ai-glass-light px-2 py-[6px] ${drag ? 'is-drag' : ''}`}>
        {found.length > 0 && (
          <button type="button" onClick={() => { onAct('do-containers', draft.trim(), { containers: found }); setDraft(''); }} className="ai-detect ml-1 mb-1 mt-[2px] inline-flex items-center gap-2 h-[30px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>
            <Icon name="box" size={14} /> {found.length} container number{found.length > 1 ? 's' : ''} detected · Start import <Icon name="arrow" size={13} />
          </button>
        )}
        <div className="flex items-end gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} className={ib} title="Upload documents" aria-label="Upload documents"><Icon name="clip" size={17} /></button>
          <button type="button" onClick={() => onAct('do-containers', 'Start an import with my container numbers')} className={ib} title="Start an import with container numbers" aria-label="Container numbers"><Icon name="box" size={17} /></button>
          <button type="button" onClick={() => onAct('build-agent', 'Build an AI agent to automate my work')} className={ib} title="Build an agent" aria-label="Build an agent"><Icon name="bot" size={17} /></button>
          <input ref={fileRef} type="file" multiple hidden onChange={e => { const n = Array.from(e.target.files ?? []).map(f => f.name); if (n.length) onFiles(n); e.target.value = ''; }} />
          <span className="w-px h-[22px] bg-[#e3e8ef] mx-1 mb-[7px]" />
          {listening
            ? <div className="flex-1 flex items-center gap-3 h-[36px] px-1"><span className="ai-wave"><i /><i /><i /><i /><i /></span><span className="text-[14px] text-[#1360d2]">Listening…</span></div>
            : <textarea ref={taRef} value={draft} rows={1} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask a follow-up, paste container numbers…"
                className="flex-1 min-w-0 resize-none outline-none bg-transparent text-[15px] text-[#111838] placeholder:text-[#66708c] py-[7px] min-h-[36px] max-h-[120px]" aria-label="Message Dubai Trade AI" />}
          <button type="button" onClick={mic} className={`size-[36px] rounded-full flex items-center justify-center flex-shrink-0 ${listening ? 'bg-[#1360d2] text-white' : 'text-[#0e1b3d] hover:bg-[#f0f5fc]'}`} aria-label={listening ? 'Stop listening' : 'Speak'}><Icon name="mic" size={17} /></button>
          <button type="button" onClick={send} disabled={!draft.trim()} className="ai-send size-[36px] rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40" aria-label="Send"><Icon name="arrow" size={16} strokeWidth={2.2} /></button>
        </div>
      </div>
    );
  }

  const chip = `h-[34px] px-[12px] rounded-full inline-flex items-center gap-[6px] text-[14px] transition-colors ${hero ? 'ai-gchip' : 'border border-[#e3e8ef] text-[#0e1b3d] hover:bg-[#f0f5fc] bg-white/70'}`;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const n = Array.from(e.dataTransfer.files).map(f => f.name); if (n.length) onFiles(n); }}
      className={`ai-border-flow relative rounded-[22px] ${hero ? 'ai-glass ai-glass-input p-[16px]' : 'ai-glass-light p-[10px]'} ${drag ? 'is-drag' : ''}`}
    >
      {drag && <div className="absolute inset-0 rounded-[22px] flex items-center justify-center text-[15px] z-[2] pointer-events-none" style={{ fontWeight: 600, background: 'rgba(238,244,255,.92)', color: C.blue }}><Icon name="upload" size={20} className="mr-2" /> Drop documents to start an import</div>}
      {listening
        ? <div className={`flex items-center gap-3 px-2 ${hero ? 'min-h-[64px]' : 'min-h-[44px]'}`}><span className="ai-wave"><i /><i /><i /><i /><i /></span><span className="text-[15px] text-[#1360d2]">Listening… tap the mic again to finish</span></div>
        : <textarea
            ref={taRef}
            value={draft}
            rows={1}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={hero ? 'Ask anything, paste container numbers, or drop your documents…' : 'Ask a follow-up, paste container numbers…'}
            className={`w-full resize-none outline-none bg-transparent px-2 ${hero ? 'text-[#0e1b3d] placeholder:text-[#7d88a6] text-[18px] min-h-[60px] pt-[4px]' : 'text-[#111838] placeholder:text-[#66708c] text-[15px] min-h-[44px] pt-[10px]'}`}
            aria-label="Message Dubai Trade AI"
          />}

      {found.length > 0 && (
        <button type="button" onClick={() => { onAct('do-containers', draft.trim(), { containers: found }); setDraft(''); }}
          className="ai-detect mx-2 mb-2 inline-flex items-center gap-2 h-[34px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>
          <Icon name="box" size={15} /> {found.length} container number{found.length > 1 ? 's' : ''} detected · Start import <Icon name="arrow" size={14} />
        </button>
      )}

      <div className="flex items-center gap-2 mt-[6px] flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className={chip} title="Upload documents"><Icon name="clip" size={15} /> <span className="hidden sm:inline">Documents</span></button>
        <button type="button" onClick={() => onAct('do-containers', 'Start an import with my container numbers')} className={chip}><Icon name="box" size={15} /> <span className="hidden sm:inline">Container numbers</span></button>
        <button type="button" onClick={() => onAct('build-agent', 'Build an AI agent to automate my work')} className={chip}><Icon name="bot" size={15} /> <span className="hidden sm:inline">Build an agent</span></button>
        <input ref={fileRef} type="file" multiple hidden onChange={e => { const n = Array.from(e.target.files ?? []).map(f => f.name); if (n.length) onFiles(n); e.target.value = ''; }} />
        <span className="flex-1" />
        <button type="button" onClick={mic} className={`size-[40px] rounded-full flex items-center justify-center transition-colors ${listening ? 'bg-[#1360d2] text-white' : hero ? 'ai-gchip' : 'bg-[#f0f5fc] text-[#0e1b3d]'}`} aria-label={listening ? 'Stop listening' : 'Speak'}>
          <Icon name="mic" size={18} />
        </button>
        <button type="button" onClick={send} disabled={!draft.trim()} className="ai-send size-[42px] rounded-full flex items-center justify-center text-white transition-all disabled:opacity-40" aria-label="Send">
          <Icon name="arrow" size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

/* ── Workspace ────────────────────────────────────────────────────────── */
export default function AgenticWorkspace({ onOpenDashboard, tabs }: { onOpenDashboard?: () => void; tabs?: React.ReactNode }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [myAgents, setMyAgents] = useState<MyAgent[]>(DEFAULT_MY_AGENTS);
  const agentsCtx = useMemo(() => ({
    agents: myAgents,
    add: (a: MyAgent) => setMyAgents(list => [a, ...list.map(x => ({ ...x, isNew: false }))]),
    toggle: (id: string) => setMyAgents(list => list.map(x => (x.id === id ? { ...x, on: !x.on } : x))),
  }), [myAgents]);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // New reply → bring its top into view (rich cards can be taller than the screen);
  // while an agent is working → keep the working indicator above the composer.
  useEffect(() => {
    if (pending) { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); return; }
    const all = document.querySelectorAll<HTMLElement>('[data-ai-msg]'); const last = all[all.length - 1];
    last?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [msgs.length, pending]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const navigate = useNavigate();
  const ask: Ask = (intent, utter, payload) => {
    // Starting an import is a full-page flow, not a chat card
    if (intent === 'upload') { navigate('/landing/trader/import?source=documents', { state: { files: payload?.files } }); return; }
    if (intent === 'do-containers') { navigate('/landing/trader/import?source=containers', { state: { containers: payload?.containers } }); return; }
    if (intent === 'do-approve') { navigate('/landing/trader/import?source=do', { state: { bl: payload?.bl } }); return; }
    if (intent === 'clearance-create') { navigate('/landing/trader/import?source=clearance'); return; }
    if (intent === 'case-journey' && payload?.resume) { navigate('/landing/trader/import?source=documents&start=journey'); return; }
    if (pending) return;
    const r = reply(intent, payload);
    const user: Msg | null = utter ? { id: idRef.current++, who: 'me', text: utter, attachments: payload?.files as string[] | undefined } : null;
    if (user) setMsgs(m => [...m, user]);
    const p: Pending = { agent: r.agent ?? 'Assistant', trace: r.trace, step: 0 };
    setPending(p);
    r.trace.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setPending(cur => (cur ? { ...cur, step: i + 1 } : cur)), 380 * (i + 1)));
    });
    timers.current.push(window.setTimeout(() => {
      setPending(null);
      setMsgs(m => [...m, { id: idRef.current++, who: 'ai', agent: r.agent, text: r.text, intent, payload: r.payload ?? payload, follow: r.follow }]);
    }, 380 * r.trace.length + 450));
  };

  const sendText = (t: string) => { const r = route(t); ask(r.intent, t, r.payload); };
  const sendFiles = (names: string[]) => ask('upload', `Uploaded ${names.length} document${names.length > 1 ? 's' : ''}`, { files: names });
  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setPending(null); setMsgs([]); };

  const inThread = msgs.length > 0 || !!pending;
  const needs = CASES.filter(c => c.status === 'you').length;
  const pills = PILLS.slice(0, 7);
  const act = (intent: string, utter: string, payload?: Record<string, unknown>) => ask(intent, utter, payload);
  const running = myAgents.filter(a => a.on).length;

  return (
    <AgentsContext.Provider value={agentsCtx}>
    <div className="ai-canvas">
        {!inThread ? (
          <>
          <section className="ai-hero">
            <div className="ai-hero-fx" aria-hidden>
              <span className="ai-blob b1" /><span className="ai-blob b2" /><span className="ai-blob b3" /><span className="ai-blob b4" />
            </div>
            <div className="relative w-full max-w-[860px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 flex flex-col items-center">
              {tabs && <div className="mb-8 sm:mb-10">{tabs}</div>}
              <span className="ai-glass-badge inline-flex items-center gap-2 h-[32px] px-[14px] rounded-full text-[14px] text-[#0e1b3d]">
                <span className="size-[7px] rounded-full bg-[#28a745] ai-live" /> {running} agents working for you · {needs} need you
              </span>
              <h1 className="text-[34px] sm:text-[48px] text-[#0e1b3d] leading-[1.1] mt-6 text-center" style={{ fontWeight: 500 }}>
                {greeting}, <span className="ai-name">{USER_NAME}</span>
              </h1>
              <p className="text-[16px] sm:text-[17px] text-[#5a6480] mt-3 text-center max-w-[560px]">Ask anything, paste container numbers or drop documents. Or build an agent to do it for you.</p>

              <div className="w-full mt-8"><Composer hero autoFocus onSend={sendText} onFiles={sendFiles} onAct={act} /></div>

              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {pills.map((p, i) => (
                  <button key={p.label} type="button" onClick={() => ask(p.intent, p.utter, p.payload)} className={`ai-gpill inline-flex items-center gap-[8px] h-[36px] px-[14px] rounded-full text-[14px] ${i === 0 ? 'is-primary' : ''}`}>
                    <Icon name={p.icon} size={15} />{p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="relative w-full max-w-[1120px] mx-auto px-4 sm:px-6 -mt-12 pb-16">
            {/* Waiting for you */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { agent: 'DO agent', title: 'Delivery order ready to approve', meta: <><DhAmount value={DO_TOTAL} /> · IMP-2027-00418</>, go: () => ask('do-approve', 'Review and pay the DO for MEDU48210937', { bl: 'MEDU48210937' }) },
                { agent: 'Document AI', title: 'Confirm 2 fields on a new BL', meta: 'IMP-2027-00421', go: () => ask('confirm-fields', 'Confirm the 2 fields on IMP-2027-00421') },
              ].map(a => (
                <button key={a.title} type="button" onClick={a.go} className="ai-wait group flex items-center gap-3 rounded-[16px] px-4 py-[14px] text-left">
                  <span className="relative"><Orb size={36} /><span className="absolute -top-[2px] -right-[2px] size-[10px] rounded-full bg-[#f2b200] border-2 border-white" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-[#b07a00]" style={{ fontWeight: 700 }}>Waiting for you · {a.agent}</span>
                    <span className="block text-[15px] text-[#111838] truncate" style={{ fontWeight: 600 }}>{a.title}</span>
                    <span className="block text-[14px] text-[#4f5a78] truncate">{a.meta}</span>
                  </span>
                  <span className="size-[34px] rounded-full flex items-center justify-center bg-[#0e1b3d] text-white transition-transform group-hover:translate-x-[2px]"><Icon name="arrow" size={15} /></span>
                </button>
              ))}
            </div>

            {/* Your AI agents */}
            <div className="flex items-end justify-between mt-10 mb-3">
              <div>
                <h2 className="text-[20px] text-[#051937]" style={{ fontWeight: 500 }}>Your AI agents</h2>
                <p className="text-[14px] text-[#4f5a78]">They prepare the work in the background for you.</p>
              </div>
            </div>
            <MyAgentsGrid ask={ask} />
          </div>
          </>
        ) : (
          <div className="w-full max-w-[860px] xl:max-w-[1040px] 2xl:max-w-[1160px] mx-auto px-4 sm:px-6 flex flex-col min-h-[calc(100vh-110px)] pt-5">
            {tabs && <div className="flex justify-center mb-4">{tabs}</div>}
            <div className="flex items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: C.border }}>
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-[14px] text-[#1360d2] hover:underline" style={{ fontWeight: 500 }}>
                <Icon name="chev" size={15} className="rotate-180" /> AI home
              </button>
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 h-[32px] px-3 rounded-full text-[14px] text-[#0e1b3d] border hover:border-[#1360d2]" style={{ borderColor: C.border, fontWeight: 500 }}>
                <Icon name="plus" size={14} /> New chat
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-6 py-5">
              {msgs.map(m => m.who === 'me' ? (
                <div key={m.id} data-ai-msg className="ai-msg self-end max-w-[78%] flex flex-col items-end gap-2">
                  <div className="px-4 py-[10px] text-[15px] text-white" style={{ background: C.navy, borderRadius: '16px 16px 4px 16px' }}>{m.text}</div>
                  {m.attachments && <div className="flex flex-wrap gap-2 justify-end">{m.attachments.map(a => <span key={a} className="inline-flex items-center gap-1 h-[28px] px-[10px] rounded-full bg-white border text-[14px] text-[#40484f]" style={{ borderColor: C.border }}><Icon name="doc" size={13} />{a}</span>)}</div>}
                </div>
              ) : (
                <div key={m.id} data-ai-msg className="ai-msg flex gap-3 items-start">
                  <Orb size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>Dubai Trade AI</span>
                      {m.agent && <span className="text-[14px] text-[#4f5a78]">· {m.agent}</span>}
                    </div>
                    {m.text && <p className="text-[15px] text-[#252b44] leading-relaxed mb-3 max-w-[780px]">{m.text}</p>}
                    <Card m={m} ask={ask} />
                    {m.follow && m.follow.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {m.follow.map(f => (
                          <button key={f.label} type="button" onClick={() => ask(f.intent, f.utter)} className="ai-pill inline-flex items-center gap-[6px] h-[30px] px-[12px] rounded-full text-[14px]">
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {pending && (
                <div className="ai-msg flex gap-3 items-start">
                  <Orb size={32} pulse />
                  <div className="pt-[6px]">
                    <p className="text-[14px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}>{pending.agent} is working <span className="ai-dots"><i /><i /><i /></span></p>
                    <p className="text-[14px] text-[#4f5a78] mt-1" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {pending.trace[Math.min(pending.step, pending.trace.length - 1)]}
                    </p>
                  </div>
                </div>
              )}
              <div ref={endRef} style={{ scrollMarginBottom: 150 }} />
            </div>

            <div className="sticky bottom-0 pt-3 pb-3 ai-composer-dock">
              <Composer onSend={sendText} onFiles={sendFiles} onAct={act} autoFocus />
            </div>
          </div>
        )}
    </div>
    </AgentsContext.Provider>
  );
}
