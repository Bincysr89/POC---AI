/* Agentic AI workspace — the AI-first landing experience below the header.
 * Home: greeting, prompt composer, suggested prompts, "needs your action",
 * active imports. Conversation: the assistant hands work to purpose-built
 * agents and answers with interactive cards; anything that submits or pays
 * waits for the user's approval. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DhAmount } from '../Dh';
import { CASES, DEFAULT_MY_AGENTS, DO_DRAFTS, DO_TOTAL, PILLS, USER_NAME, extractContainers, type MyAgent } from './data';
import { ContainerDOCard } from './containers';
import { AgentsContext } from './agents';
import { AgentsListCard, AutoDoQuestion, JourneyOpenedCard, CHAT_AUDIT, ShipMapCard, ChoiceCards, HistoryCard, JourneyStepper, OptionGrid, BlSummaryCard, BlUploadCard, ChatDOCard, ClearanceStatusCard, ContainerInfoCard, DeliveryDoneCard, DOPickCard, JourneyStartedCard, JourneyStatusCard, NavigatorCard, SlotChatCard } from './chat';
import { AUTO_DO_KEY, AuditLogCard, AuditTrail, CaseJourneyCard, type AuditEvent } from './journey';
import type { CompletionSummary } from './complete';
import {
  DeclListCard, DeclReviewCard, DeclViewCard, DOApprovalCard, DOCostCard, DOListCard, ETokenCard, HandoffCard,
  RiskCard, ServiceCard, TrackCard, UploadCard, ConfirmFields, type Ask,
} from './flows';
import { AgentOrb, C, Dot, Icon, Orb, SuccessBanner } from './ui';

type Follow = { label: string; intent: string; utter: string; payload?: Record<string, unknown>; desc?: string; icon?: string };
/* What a typed reply means while the assistant is waiting on a question */
type Expect = { yes?: string; no?: string; payload?: Record<string, unknown>; containers?: string };
type Msg = {
  id: number;
  who: 'me' | 'ai';
  text?: string;
  agent?: string;
  intent?: string;
  payload?: Record<string, unknown>;
  follow?: Follow[];
  attachments?: string[];
  expect?: Expect;
  then?: { intent: string; payload?: Record<string, unknown> };
};
type Pending = { agent: string; trace: string[]; step: number };

/* ── Intent routing for free text ─────────────────────────────────────── */
function route(t: string): { intent: string; payload?: Record<string, unknown> } {
  const x = t.toLowerCase();
  const ref = t.match(/\b(IMP-\d{4}-\d{5}|[A-Z]{4}\d{8})\b/i)?.[1]?.toUpperCase();
  const containers = extractContainers(t);
  if (containers.length) return { intent: 'container-info', payload: { containers } };
  if (/more details|view more|show (me )?more|full details|see more|view details/.test(x)) return { intent: 'more-details' };
  if (/import journey|my journey|my import case/.test(x)) return { intent: 'journey-status' };
  if (/upload|new import|start (a|an|the)? ?import|import process|bill of lading|\bbl\b|container numbers?/.test(x)) return { intent: 'start-import' };
  if (/clearance|permit status|declaration status|permits? (approved|status)/.test(x) && !/recent|cleared declarations/.test(x)) return { intent: 'clearance-status' };
  if (/risk|storage|free time|demurrage/.test(x)) return { intent: 'risk' };
  if (/(cost|charge|price|how much)/.test(x) && /(\bdo\b|delivery order)/.test(x)) return { intent: 'do-cost' };
  if (/(pay|approve|create|new|raise|request|make)/.test(x) && /(\bdo\b|delivery order)/.test(x)) return { intent: 'cv-do-pick' };
  if (/pending|in review/.test(x) && /declaration/.test(x)) return { intent: 'decl-review' };
  if (/declaration|cleared|clearance/.test(x)) return { intent: 'decl-list' };
  if (/\bdo\b|\bdos\b|delivery order/.test(x)) return { intent: 'do-list' };
  if (/slot|haul|cargo ?waves|deliver|truck|etoken|e-token|gate/.test(x)) return { intent: 'cv-slots' };
  if (/confirm|field/.test(x)) return { intent: 'confirm-fields' };
  if (/track|where|container|status|shipment|vessel/.test(x) || ref) return { intent: 'track', payload: ref ? { caseId: ref } : undefined };
  if (/service|need|permit|cosmetic|licen/.test(x)) return { intent: 'service' };
  if (/human|person|support|call|talk/.test(x)) return { intent: 'human' };
  return { intent: 'other' };
}

/* ── Assistant replies ────────────────────────────────────────────────── */
const F = (label: string, intent: string, utter?: string, payload?: Record<string, unknown>, desc?: string): Follow => ({ label, intent, utter: utter ?? label, payload, desc });
/* Icons and a line of help for each answer option */
const OPT_ICON: Record<string, string> = {
  'cv-upload': 'upload', 'cv-containers': 'box', 'cv-bl': 'box', 'not-now': 'clock', 'clearance-status': 'decl', 'cv-slots': 'truck',
  'cv-do-pick': 'do', 'do-draft-chat': 'do', etoken: 'truck', 'journey-status': 'flow', 'start-import': 'play', service: 'service',
  'decl-review': 'decl', 'decl-list': 'decl', track: 'track', risk: 'risk', 'do-cost': 'cost', 'confirm-fields': 'doc', 'do-list': 'do', 'case-journey': 'flow',
  'container-info': 'ship', 'cv-map': 'track', 'cv-agents': 'bot', 'cv-help': 'chat', 'cv-audit': 'history', human: 'person',
};
const OPT_DESC: Record<string, string> = {
  'cv-upload': 'I read the BL and every container on it', 'cv-containers': 'I find the BL and vessel for you',
  'clearance-status': 'Declaration and permit status', 'cv-slots': 'Pick a delivery slot and I create the eToken', 'cv-do-pick': 'Drafted requests ready to pay',
  etoken: 'Gate pass for your trucks', 'journey-status': 'Where every track stands', 'start-import': 'Upload a BL or enter containers',
  'not-now': "I'll keep watching for you", 'do-draft-chat': 'Review the draft and pay',
};
const SAMPLE_NOS = ['MSKU0000001'];

function reply(intent: string, payload?: Record<string, unknown>): Omit<Msg, 'id' | 'who'> & { trace: string[] } {
  const files = (payload?.files as string[] | undefined) ?? [];
  if (payload?.more) return { agent: 'Import assistant', trace: ['Fetching the full details'], text: 'Of course. Here are the full details.' };
  if (intent === 'more-details') return { agent: 'Import assistant', trace: ['Looking for details'], text: "There's nothing to expand just yet. Ask me about your vessel, delivery order, clearance or delivery and I'll show you everything." };
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
    case 'start-import':
      return { agent: 'Import assistant', trace: ['Opening a new import'], text: `Happy to help you get this import moving, ${USER_NAME}. How would you like to begin? If you have the bill of lading handy, that's the quickest way.`,
        follow: [F('Upload bill of lading', 'cv-upload'), F('Enter container numbers', 'cv-containers')] };
    case 'cv-upload':
      return { agent: 'Document AI', trace: ['docai.ready'], text: "Great. Drop your bill of lading below, or use the paperclip in the chat box. I'll read it and pick out every container for you." };
    case 'cv-containers':
      return { agent: 'Status agent', trace: ['container.lookup.ready'], text: "No problem. Type or paste your container numbers in the chat box below, one or many, and I'll track down the bill of lading and vessel with the shipping line.",
        follow: [F('Use the sample container', 'cv-bl', 'MSKU0000001', { containers: SAMPLE_NOS })], expect: { containers: 'cv-bl' } };
    case 'cv-bl': {
      const nos = (payload?.containers as string[] | undefined) ?? SAMPLE_NOS;
      const fromBl = !payload?.containers;
      return { agent: fromBl ? 'Document AI' : 'Status agent', trace: fromBl ? ['docai.read · bill of lading', 'bl.containers', 'party.validate'] : ['container.lookup', 'bl.match', 'line.documents'],
        text: fromBl ? "Thanks, got it. Your bill of lading is BL MEDU48210937, with 1 container on MV Sample Voyager 027E, and you're listed as the consignee." : `Good news: I found your container on bill of lading BL MEDU48210937 and fetched it from Mediterranean Shipping for you.`,
        expect: { yes: 'cv-start', no: 'not-now', payload: { containers: nos } } };
    }
    case 'cv-start': {
      const nos = (payload?.containers as string[] | undefined) ?? SAMPLE_NOS;
      return { agent: 'Import assistant', trace: ['case.create · IMP-2027-00422', 'vessel.status · marine traffic'], text: "Your import case is open. Here's your case number.",
        expect: { yes: 'do-draft-chat', no: 'not-now', payload: { containers: nos } } };
    }
    case 'cv-map':
      return { agent: 'Status agent', trace: ['marinetraffic.ais · live position'], text: "Here's the ship right now. It's in the Gulf of Oman, about 186 nautical miles from Jebel Ali, and should arrive around 30 Nov 14:30. Shall I request the delivery order while we wait?",
        follow: [F('Request the delivery order', 'do-draft-chat', 'Request the delivery order', { containers: SAMPLE_NOS }, "I'll draft it now; you review and pay"), F('See the vessel details', 'container-info', 'Show me the vessel details', { containers: SAMPLE_NOS, inJourney: true })],
        expect: { yes: 'do-draft-chat', no: 'not-now', payload: { containers: SAMPLE_NOS } } };
    case 'cv-agents':
      return { agent: 'Import assistant', trace: ['agents.list · IMP-2027-00422'], text: "These are the agents on your import. They take one step at a time, and I'll check with you before anything is paid or sent. Where would you like to go next?",
        follow: [F('See the vessel details', 'container-info', 'Show me the vessel details', { containers: SAMPLE_NOS, inJourney: true }), F('Request the delivery order', 'do-draft-chat', 'Request the delivery order', { containers: SAMPLE_NOS }, "I'll draft it now; you review and pay")] };
    case 'cv-audit':
      return { agent: 'Import assistant', trace: ['audit.compile · IMP-2027-00422'], text: "Here's everything that happened on IMP-2027-00422: who did each step, the system they used and the outcome.",
        follow: [F('I need other help', 'cv-help', 'I need some other help')] };
    case 'cv-help':
      return { agent: 'Import assistant', trace: ['Listening'], text: 'Of course. What else can I help you with? Pick one below or just type your question.',
        follow: [F('Start another import', 'start-import', 'Start another import', undefined, 'Upload a BL or enter a container'), F('Recent delivery orders', 'do-list', 'Show my recent delivery orders', undefined, 'Your DOs from the last 30 days'), F('Recent cleared declarations', 'decl-list', 'Show my recent cleared declarations', undefined, 'With the duty paid on each'), F('Talk to a person', 'human', 'I want to talk to a person', undefined, 'A Dubai Trade support agent')] };
    case 'cv-history':
      return { agent: 'Import assistant', trace: ['case.history · last 90 days'], text: "Here are your recent imports. Pick one and I'll set up a new import with the same shipping line and haulier." };
    case 'cv-search':
      return { agent: 'Import assistant', trace: ['services.index'], text: "Sure. Which service are you looking for? Type its name in the chat box, or pick one below.",
        follow: [F('Delivery order', 'cv-do-pick', 'Create a delivery order'), F('Integrated Clearance status', 'clearance-status', 'What is the status of my integrated clearance?'), F('Create eToken', 'cv-slots', 'Create an eToken'), F('My import journey', 'journey-status', 'Show my import journey'), F('Start an import', 'start-import', 'Start the import process')] };
    case 'cv-do-pick':
      return { agent: 'DO agent', trace: ['do.drafts · ready to request'], text: "I've already drafted delivery order requests for these bills of lading. Which one would you like to go ahead with?" };
    case 'cv-slots':
      return { agent: 'CargoWaves agent', trace: ['haulier.contract · Al Bahar Transport', 'gate.forecast'], text: "Almost there. Pick a slot with Al Bahar Transport, your contracted haulier, and I'll send the order and create the eToken." };
    case 'cv-booked':
      return { agent: 'CargoWaves agent', trace: ['cargowaves.order.send', 'haulier.accept', 'etoken.issue · DP World'], text: `That's everything, ${USER_NAME}. Your import journey is on track, and I'll keep an eye on the delivery and let you know when the truck leaves the port.` };
    case 'journey-status':
      return { agent: 'Workflow manager', trace: ['workflow.get · IMP-2027-00422', 'tracks.status'], text: "Here's where IMP-2027-00422 stands. Most of it is moving along nicely; the delivery order is just waiting for you. Shall I open the draft?",
        follow: [F('Request the delivery order', 'do-draft-chat', 'Yes, open the DO draft', { containers: SAMPLE_NOS }, 'The draft is ready; review and pay'), F('Check clearance status', 'clearance-status', 'What is the status of my integrated clearance?')],
        expect: { yes: 'do-draft-chat', no: 'not-now', payload: { containers: SAMPLE_NOS } } };
    case 'container-info': {
      const n = ((payload?.containers as string[] | undefined) ?? []).length;
      return { agent: 'Status agent', trace: ['container.lookup', 'bl.match', 'marinetraffic.ais'], text: `${n > 1 ? `Your ${n} containers are` : 'Your container is'} on BL MEDU48210937, on board MV Sample Voyager 027E. Here's the vessel and arrival information. The ship is running late, so I've included its live position.`,
        expect: { yes: 'do-draft-chat', no: 'not-now', payload: { containers: payload?.containers } } };
    }
    case 'do-draft-chat':
      return { agent: 'DO agent', trace: ['do.draft', 'do.charges · line tariff'], text: "Here's your delivery order request, with the line charges already added. Just set the validity date and how you'd like to pay, and I'll send it to the shipping agent the moment it's paid." };
    case 'do-sent':
      return { agent: 'DO agent', trace: ['tradepay.pay', 'do.submit'], text: `Done. The delivery order request is with ${(payload?.line as string) ?? 'the shipping agent'}, and I'll tell you when it's released.`,
        expect: { yes: 'cv-autodo', no: 'cv-autodo', payload: { on: true } } };
    case 'cv-autodo': {
      const on = !!payload?.on;
      if (on) { try { sessionStorage.setItem(AUTO_DO_KEY, '1'); } catch { /* not stored */ } }
      return { agent: 'DO agent', trace: on ? ['agents.autodo · enabled'] : ['agents.autodo · not now'],
        text: `${on ? "Done, automatic delivery orders are on for your next imports." : "No problem, you'll review and pay each delivery order yourself."} Next is Integrated Clearance: your C&F agent has filed the declaration. Shall I check its status and your permits?`,
        follow: [F('Check clearance status', 'clearance-status', 'Yes, check the clearance status', undefined, 'Declaration and permit status'), F('Not now', 'not-now')],
        expect: { yes: 'clearance-status', no: 'not-now' } };
    }
    case 'not-now':
      return { agent: 'Import assistant', trace: ['watch.case'], text: "No problem at all. The agents will keep watching, and I'll let you know when something needs you. You can pick up from here anytime.",
        follow: [F('My import journey', 'journey-status', 'Show my import journey'), F('Check clearance status', 'clearance-status', 'What is the status of my integrated clearance?')] };
    case 'clearance-status':
      return { agent: 'Clearance agent', trace: ['declaration.status · Dubai Customs', 'dm.permit.status', 'sira.permit.status'], text: 'Your declaration 101-27-0049310 is cleared through the green channel, and both permits are approved. Last step is delivery. Shall I create the eToken? You pick a slot with your haulier and I will handle the rest.',
        follow: [F('Create eToken', 'cv-slots', 'Yes, create the eToken', undefined, 'Pick a delivery slot and I create the eToken'), F('Not now', 'not-now')], expect: { yes: 'cv-slots', no: 'not-now' } };
    case 'journey-nav':
      return { agent: 'Workflow manager', trace: ['workflow.get · IMP-2027-00422'], text: 'Your import journey for IMP-2027-00422 is running on four tracks: vessel arrival, Trade+, Integrated Clearance and Cargo Waves. Open it to follow each one.' };
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

const FULL_VIEW = '/landing/trader/import?source=documents&start=journey';
const DETAIL_INTENTS = ['container-info', 'do-draft-chat', 'clearance-status', 'cv-bl', 'cv-slots', 'cv-booked'];

/* An agent reply in a chat bubble. The text types itself out first; the
 * result cards and answer options appear once the reply is written. */
function AIMessage({ m, card, follow, onTyped }: { m: Msg; card: React.ReactNode; follow: React.ReactNode; onTyped?: () => void }) {
  const text = m.text ?? '';
  const [n, setN] = useState(0);
  const done = n >= text.length;
  useEffect(() => {
    if (!text) return;
    const start = Date.now();   // time-based, so a hidden tab catches up instead of crawling
    const id = window.setInterval(() => setN(Math.min(text.length, Math.floor((Date.now() - start) / 12))), 24);
    return () => window.clearInterval(id);
  }, [text]);
  useEffect(() => { if (done && text) onTyped?.(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-ai-msg className="ai-msg flex gap-3 items-start">
      <span className="ai-avatar mt-[6px]"><AgentOrb size={38} /></span>
      <div className={`flex-1 min-w-0 ${m.intent === 'cv-booked' || m.intent === 'cv-audit' ? '' : 'max-w-[900px]'}`}>
        <div className="flex items-center gap-2 mb-[6px]">
          <span className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>Dubai Trade AI</span>
          {m.agent && <span className="text-[14px] text-[#4f5a78]">· {m.agent}</span>}
        </div>
        {text && (
          <div className="ai-bubble px-5 py-4 mb-3 max-w-[900px]">
            <p className="text-[16px] text-[#1b2240] leading-relaxed">{text.slice(0, n)}{!done && <span className="ai-caret" aria-hidden />}</p>
          </div>
        )}
        {done && <div className="ai-reveal grid grid-cols-1 gap-3">{card}{follow && <div>{follow}</div>}</div>}
      </div>
    </div>
  );
}

function Card({ m, ask, go }: { m: Msg; ask: Ask; go: (to: string) => void }) {
  switch (m.intent) {
    case 'journey-nav': return <NavigatorCard items={[
      { icon: 'flow', title: 'Open my import journey', sub: 'IMP-2027-00422 · four tracks, documents and audit log', go: () => go('/landing/trader/import?source=documents&start=journey') },
      { icon: 'do', title: 'Create delivery order', sub: 'Choose a drafted BL, review and pay', go: () => go('/landing/trader/import?source=do') },
    ]} />;
    case 'cv-upload': return <BlUploadCard ask={ask} />;
    case 'cv-history': return <HistoryCard ask={ask} cases={CASES} />;
    case 'cv-bl': return <BlSummaryCard ask={ask} source={m.payload?.containers ? 'containers' : 'documents'} file={(m.payload?.files as string[] | undefined)?.[0]} containers={m.payload?.containers as string[] | undefined} full={!!m.payload?.full} more={!!m.payload?.more} />;
    case 'cv-start': return <JourneyOpenedCard ask={ask} containers={(m.payload?.containers as string[] | undefined) ?? SAMPLE_NOS} />;
    case 'cv-map': return <ShipMapCard />;
    case 'cv-audit': return <AuditTrail events={CHAT_AUDIT} tracksDone={4} openAll />;
    case 'cv-agents': return <AgentsListCard />;
    case 'do-sent': return <AutoDoQuestion ask={ask} />;
    case 'cv-autodo': return <>{m.payload?.on ? <SuccessBanner><strong>Success:</strong> Automatic delivery orders are on for your next imports. You can switch this off anytime.</SuccessBanner> : null}<JourneyStepper stage={2} /></>;
    case 'cv-do-pick': return <DOPickCard ask={ask} drafts={DO_DRAFTS} />;
    case 'cv-slots': return <SlotChatCard ask={ask} full={!!m.payload?.full} />;
    case 'cv-booked': return <><DeliveryDoneCard ask={ask} slot={(m.payload?.slot as string) ?? 'Wed 1 Dec · 08:00–10:00'} /></>;
    case 'journey-status': return <><JourneyStepper stage={1} /><JourneyStatusCard open={() => go(FULL_VIEW)} /></>;
    case 'container-info': return <>{m.payload?.inJourney && !m.payload?.more ? <JourneyStepper stage={0} /> : null}<ContainerInfoCard ask={ask} containers={(m.payload?.containers as string[] | undefined) ?? []} full={!!m.payload?.full} more={!!m.payload?.more} /></>;
    case 'do-draft-chat': return <>{m.payload?.more ? null : <JourneyStepper stage={1} />}<ChatDOCard full={!!m.payload?.full} ask={ask} containers={(m.payload?.containers as string[] | undefined) ?? []} bl={m.payload?.bl as string | undefined} line={m.payload?.line as string | undefined} /></>;
    case 'clearance-status': return <>{m.payload?.more ? null : <JourneyStepper stage={3} />}<ClearanceStatusCard full={!!m.payload?.full} /></>;
    case 'do-containers': return <ContainerDOCard ask={ask} containers={m.payload?.containers as string[] | undefined} />;
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
          <button type="button" onClick={() => { onSend(draft.trim()); setDraft(''); }} className="ai-detect ml-1 mb-1 mt-[2px] inline-flex items-center gap-2 h-[30px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>
            <Icon name="box" size={14} /> {found.length} container number{found.length > 1 ? 's' : ''} detected · Look them up <Icon name="arrow" size={13} />
          </button>
        )}
        <div className="flex items-end gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} className={ib} title="Upload bill of lading" aria-label="Upload bill of lading"><Icon name="clip" size={17} /></button>
          <button type="button" onClick={() => onAct('cv-containers', 'I want to enter container numbers')} className={ib} title="Start an import with container numbers" aria-label="Container numbers"><Icon name="box" size={17} /></button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={e => { const n = Array.from(e.target.files ?? []).map(f => f.name); if (n.length) onFiles(n); e.target.value = ''; }} />
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
            placeholder={hero ? 'Ask anything, paste container numbers, or drop your bill of lading…' : 'Ask a follow-up, paste container numbers…'}
            className={`w-full resize-none outline-none bg-transparent px-2 ${hero ? 'text-[#0e1b3d] placeholder:text-[#7d88a6] text-[18px] min-h-[60px] pt-[4px]' : 'text-[#111838] placeholder:text-[#66708c] text-[15px] min-h-[44px] pt-[10px]'}`}
            aria-label="Message Dubai Trade AI"
          />}

      {found.length > 0 && (
        <button type="button" onClick={() => { onSend(draft.trim()); setDraft(''); }}
          className="ai-detect mx-2 mb-2 inline-flex items-center gap-2 h-[34px] px-3 rounded-full text-[14px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>
          <Icon name="box" size={15} /> {found.length} container number{found.length > 1 ? 's' : ''} detected · Look them up <Icon name="arrow" size={14} />
        </button>
      )}

      <div className="flex items-center gap-2 mt-[6px] flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className={chip} title="Upload bill of lading"><Icon name="clip" size={15} /> <span className="hidden sm:inline">Bill of lading</span></button>
        <button type="button" onClick={() => onAct('cv-containers', 'I want to enter container numbers')} className={chip}><Icon name="box" size={15} /> <span className="hidden sm:inline">Container numbers</span></button>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={e => { const n = Array.from(e.target.files ?? []).map(f => f.name); if (n.length) onFiles(n); e.target.value = ''; }} />
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
  const [myAgents, setMyAgents] = useState<MyAgent[]>(() => {
    let auto = false;
    try { auto = sessionStorage.getItem(AUTO_DO_KEY) === '1'; } catch { /* not stored */ }
    return auto
      ? [{ id: 'autodo', name: 'Auto delivery orders', desc: 'Requests and pays the DO when containers are discharged, valid for the free days', trigger: 'Containers discharged', stat: 'Turned on from IMP-2027-00422', on: true, icon: 'do', isNew: true }, ...DEFAULT_MY_AGENTS]
      : DEFAULT_MY_AGENTS;
  });
  const agentsCtx = useMemo(() => ({
    agents: myAgents,
    add: (a: MyAgent) => setMyAgents(list => [a, ...list.map(x => ({ ...x, isNew: false }))]),
    toggle: (id: string) => setMyAgents(list => list.map(x => (x.id === id ? { ...x, on: !x.on } : x))),
  }), [myAgents]);
  const idRef = useRef(1);
  const expectRef = useRef<Expect | null>(null);
  const lastDetailRef = useRef<{ intent: string; payload?: Record<string, unknown> } | null>(null);
  const askRef = useRef<Ask>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Follow the conversation with a slow, steady glide towards the bottom as replies type
  // out and cards load, instead of jumping. Scrolling up pauses it; a new message resumes it.
  const followRef = useRef(true);
  useEffect(() => { followRef.current = true; }, [msgs.length, pending]);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pause = (e: WheelEvent | KeyboardEvent | TouchEvent) => {
      if (e instanceof WheelEvent && e.deltaY >= 0) return;
      if (e instanceof KeyboardEvent && !['ArrowUp', 'PageUp', 'Home'].includes(e.key)) return;
      followRef.current = false;
    };
    const onScroll = () => {   // reaching the bottom by hand turns following back on
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) followRef.current = true;
    };
    let raf = 0, y = window.scrollY, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(250, now - last) / 1000; last = now;          // time-based, so it keeps pace in a busy tab
      const target = document.documentElement.scrollHeight - window.innerHeight;
      if (followRef.current && msgs.length && target - window.scrollY > 1) {
        if (Math.abs(window.scrollY - y) > 2) y = window.scrollY;      // someone else moved the page
        const gap = target - y;
        const speed = Math.min(380, Math.max(90, gap * 1.6));          // px a second: unhurried, eases in near the end
        y += reduce ? gap : Math.min(gap, speed * dt);
        window.scrollTo(0, y);
      } else y = window.scrollY;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('wheel', pause, { passive: true });
    window.addEventListener('touchmove', pause, { passive: true });
    window.addEventListener('keydown', pause);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('wheel', pause); window.removeEventListener('touchmove', pause); window.removeEventListener('keydown', pause); window.removeEventListener('scroll', onScroll); };
  }, [msgs.length]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const navigate = useNavigate();
  const ask: Ask = (intent, utter, payload) => {
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
      expectRef.current = r.expect ?? null;
      if (DETAIL_INTENTS.includes(intent) && !payload?.more) lastDetailRef.current = { intent, payload };
      if (r.then) { const nxt = r.then; timers.current.push(window.setTimeout(() => askRef.current(nxt.intent, undefined, nxt.payload), 900 + (r.text?.length ?? 0) * 13)); }
    }, 380 * r.trace.length + 450));
  };

  const sendText = (t: string) => {
    const ex = expectRef.current;
    const nos = extractContainers(t);
    if (ex?.containers && nos.length) { ask(ex.containers, t, { containers: nos, typed: true }); return; }
    if (ex?.yes && /^\s*(yes|yeah|yep|sure|ok|okay|go ahead|please|do it|start|proceed|confirm)\b/i.test(t)) { ask(ex.yes, t, { ...ex.payload, typed: true }); return; }
    if (ex && /^\s*(no|nope|not now|later|skip|stop)\b/i.test(t)) { ask(ex.no ?? 'not-now', t, { typed: true, on: false }); return; }
    const r = route(t);
    if (r.intent === 'more-details' && lastDetailRef.current) { const l = lastDetailRef.current; ask(l.intent, t, { ...l.payload, full: true, more: true, typed: true }); return; }
    ask(r.intent, t, { ...r.payload, typed: true });
  };
  askRef.current = ask;
  const sendFiles = (names: string[]) => ask('cv-bl', `Uploaded ${names[0]}`, { files: names.slice(0, 1) });
  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setPending(null); setMsgs([]); };

  const inThread = msgs.length > 0 || !!pending;
  const needs = CASES.filter(c => c.status === 'you').length;
  const pills = PILLS.slice(0, 7);
  const act = (intent: string, utter: string, payload?: Record<string, unknown>) => ask(intent, utter, payload);
  const running = myAgents.filter(a => a.on).length;
  useEffect(() => {   // keep the Trade+ suggestion toggle in step with this agent
    const a = myAgents.find(x => x.id === 'autodo');
    if (a) try { sessionStorage.setItem(AUTO_DO_KEY, a.on ? '1' : '0'); } catch { /* not stored */ }
  }, [myAgents]);

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
              <span className="my-4 inline-flex"><AgentOrb size={124} label={`${running} agents working for you · ${needs} need you`} /></span>
              <h1 className="text-[34px] sm:text-[48px] text-[#0e1b3d] leading-[1.1] mt-6 text-center" style={{ fontWeight: 500 }}>
                {greeting}, <span className="ai-name">{USER_NAME}</span>
              </h1>
              <p className="text-[16px] sm:text-[17px] text-[#4f5a78] mt-3 text-center max-w-[600px]">Ask anything or paste your container numbers. I'll answer, then guide you through each step of your import.</p>

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
            {/* Ways in, as on the Permits & Certificates assistant */}
            <div className="mt-4 mb-4 text-center">
              <h2 className="text-[20px] text-[#051937]" style={{ fontWeight: 500 }}>How would you like to start today?</h2>
            </div>
            <ChoiceCards ask={ask} />
          </div>
          </>
        ) : (
          <div className="w-full lg:w-[70%] mx-auto px-4 sm:px-6 flex flex-col min-h-[calc(100vh-110px)] pt-5">
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
                <div key={m.id} data-ai-msg className="ai-msg self-end max-w-[78%] flex items-start gap-3 xl:-mr-[50px]">
                  <div className="flex flex-col items-end gap-2 min-w-0">
                    <div className="px-4 py-[10px] text-[15px] text-white" style={{ background: C.navy, borderRadius: '16px 4px 16px 16px' }}>{m.text}</div>
                    {m.attachments && <div className="flex flex-wrap gap-2 justify-end">{m.attachments.map(a => <span key={a} className="inline-flex items-center gap-1 h-[28px] px-[10px] rounded-full bg-white border text-[14px] text-[#40484f]" style={{ borderColor: C.border }}><Icon name="doc" size={13} />{a}</span>)}</div>}
                  </div>
                  <span aria-label="You" role="img" className="size-[38px] rounded-full flex items-center justify-center flex-shrink-0 bg-white border text-[#0e1b3d]" style={{ borderColor: '#cfd9ea', boxShadow: '0 4px 12px -6px rgba(14,27,61,.3)' }}><Icon name="person" size={19} strokeWidth={1.8} /></span>
                </div>
              ) : (
                <AIMessage key={m.id} m={m} card={<Card m={m} ask={ask} go={to => navigate(to)} />} follow={m.follow && m.follow.length > 0 ? (
                  <OptionGrid options={m.follow.map(f => ({
                    label: f.label, desc: f.desc ?? OPT_DESC[f.intent], icon: f.icon ?? OPT_ICON[f.intent] ?? 'sparkle',
                    tone: ['do-draft-chat', 'clearance-status', 'cv-slots'].includes(f.intent) ? 'primary' as const : f.intent === 'not-now' ? 'quiet' as const : undefined,
                    onPick: () => ask(f.intent, f.utter, f.payload),
                  }))} />
                ) : null} />
              ))}

              {pending && (
                <div className="ai-msg flex gap-3 items-start">
                  <span className="ai-avatar mt-[2px]"><AgentOrb size={38} /></span>
                  <div className="ai-bubble px-5 py-3">
                    <p className="text-[15px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}>{pending.agent} is working <span className="ai-dots"><i /><i /><i /></span></p>
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
