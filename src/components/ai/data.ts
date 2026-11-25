/* Sample data for the Dubai Trade AI layer. Mirrors the data structure of the
 * "Dubai Trade AI Layer" prototype (BCO account Al Noor Trading LLC, 3 active
 * imports, 12-step import journey, purpose-built agents). */

export const COMPANY = 'Al Noor Trading LLC';
export const USER_NAME = 'Rashed';
export const ROLE = 'BCO';
export const CF_AGENT = 'Gulf Clear Customs Brokers';
export const WALLET_BALANCE = '18,420.50';

export type CaseStatus = 'you' | 'run' | 'wait' | 'done';

export type ImportCase = {
  id: string;
  bl: string;
  vessel: string;
  route: string;
  containers: string;
  done: number; // of 12
  current: number; // index of current step, -1 when complete
  next: string;
  who: string;
  status: CaseStatus;
  eta: string;
};

export const CASES: ImportCase[] = [
  { id: 'IMP-2027-00418', bl: 'MEDU48210937', vessel: 'MV Sample Voyager · 027E', route: 'Shanghai → Jebel Ali T3', containers: "3 × 40' HC", done: 7, current: 5, next: 'Approve delivery order', who: 'You', status: 'you', eta: 'Discharged today' },
  { id: 'IMP-2027-00421', bl: 'MSCU70033124', vessel: 'MSC Aurora · 112W', route: 'Nhava Sheva → Jebel Ali T2', containers: "2 × 20' GP", done: 1, current: 1, next: 'Confirm 2 document fields', who: 'You', status: 'you', eta: 'ETA in 4 days' },
  { id: 'IMP-2027-00409', bl: 'CMAU55102876', vessel: 'CMA CGM Tigris · 0FE3', route: 'Busan → Jebel Ali T1', containers: "1 × 40' HC", done: 12, current: -1, next: 'Truck booked; gate out tomorrow', who: 'Haulier', status: 'done', eta: 'Collected' },
];

export type Step = { n: number; track: 'B' | 'A' | 'C'; t: string; agent: string; s: CaseStatus; did: string };

/* 12-step journey for IMP-2027-00418 */
export const JOURNEY: Step[] = [
  { n: 1, track: 'B', t: 'Read BL, PL, COO and CI', agent: 'Document AI', s: 'done', did: 'Read 4 documents and extracted the shipment fields.' },
  { n: 2, track: 'B', t: 'Validate cargo owner', agent: 'Cargo owner agent', s: 'done', did: 'Your trade licence matches the BL consignee.' },
  { n: 3, track: 'A', t: 'Vessel arrived', agent: 'Status agent', s: 'done', did: 'Arrived at Jebel Ali Terminal 3.' },
  { n: 4, track: 'A', t: 'Berthing, manifest, DL filed', agent: 'Status agent', s: 'done', did: 'Manifest and delivery list filed by the line.' },
  { n: 5, track: 'A', t: 'Containers discharged, no holds', agent: 'Status agent', s: 'done', did: '3 of 3 discharged. No customs or line holds.' },
  { n: 6, track: 'A', t: 'Approve and pay delivery order', agent: 'DO agent → you', s: 'you', did: 'Request prepared with line charges. Waiting for you.' },
  { n: 7, track: 'A', t: 'DO verification and issue', agent: 'DO agent', s: 'wait', did: 'Starts when you approve the DO.' },
  { n: 8, track: 'C', t: 'Existing declaration check', agent: 'Status agent', s: 'done', did: 'No declaration on file, a new one was drafted.' },
  { n: 9, track: 'C', t: 'C&F agent nominated', agent: 'You', s: 'done', did: `You confirmed ${CF_AGENT}.` },
  { n: 10, track: 'C', t: 'Draft import declaration', agent: 'Declaration agent', s: 'run', did: 'Draft ready. 2 fields routed to your C&F agent.' },
  { n: 11, track: 'C', t: 'C&F agent approves and files', agent: CF_AGENT, s: 'wait', did: 'Reviewing 2 fields before filing.' },
  { n: 12, track: 'C', t: 'Book truck and file eToken', agent: 'eToken agent', s: 'wait', did: 'Paused until customs clearance. 3 slots shortlisted.' },
];

export type DeliveryOrder = { caseId: string; bl: string; line: string; containers: string; status: 'ready' | 'verifying' | 'issued'; date: string; amount: string; validTill: string };

export const DELIVERY_ORDERS: DeliveryOrder[] = [
  { caseId: 'IMP-2027-00418', bl: 'MEDU48210937', line: 'Mediterranean Shipping', containers: "3 × 40' HC", status: 'ready', date: 'Today, 11:43', amount: '4,085.00', validTill: '—' },
  { caseId: 'IMP-2027-00409', bl: 'CMAU55102876', line: 'CMA CGM', containers: "1 × 40' HC", status: 'issued', date: '19 Nov 2027', amount: '1,960.00', validTill: '26 Nov 2027' },
  { caseId: 'IMP-2027-00377', bl: 'HLCU21877450', line: 'Hapag-Lloyd', containers: "2 × 20' GP", status: 'issued', date: '06 Nov 2027', amount: '2,410.00', validTill: '13 Nov 2027' },
  { caseId: 'IMP-2027-00365', bl: 'ONEU60319928', line: 'Ocean Network Express', containers: "4 × 40' HC", status: 'issued', date: '28 Oct 2027', amount: '6,720.00', validTill: '04 Nov 2027' },
];

export const DO_CHARGES: { label: string; source: string; amount: string | null }[] = [
  { label: 'Delivery order fee', source: 'Line tariff via do.charges', amount: '1,250.00' },
  { label: 'Terminal handling (3 × 40\')', source: 'Line tariff via do.charges', amount: '2,835.00' },
  { label: 'Container deposit', source: 'Guarantee on file', amount: null },
];
export const DO_TOTAL = '4,085.00';

export type Declaration = { no: string; caseId: string; bl: string; type: string; status: 'cleared' | 'review'; date: string; value: string; duty: string; channel: 'Green' | 'Yellow' | '—' };

export const DECLARATIONS: Declaration[] = [
  { no: '101-27-0048712', caseId: 'IMP-2027-00409', bl: 'CMAU55102876', type: 'Import for local consumption', status: 'cleared', date: '20 Nov 2027', value: '184,650.00', duty: '9,232.50', channel: 'Green' },
  { no: '101-27-0046190', caseId: 'IMP-2027-00377', bl: 'HLCU21877450', type: 'Import for local consumption', status: 'cleared', date: '08 Nov 2027', value: '96,300.00', duty: '4,815.00', channel: 'Green' },
  { no: '101-27-0043355', caseId: 'IMP-2027-00365', bl: 'ONEU60319928', type: 'Import for re-export', status: 'cleared', date: '30 Oct 2027', value: '312,980.00', duty: '0.00', channel: 'Yellow' },
  { no: 'Draft', caseId: 'IMP-2027-00418', bl: 'MEDU48210937', type: 'Import for local consumption', status: 'review', date: 'Today, 12:15', value: '412,500.00', duty: '20,625.00', channel: '—' },
];

export const DECL_LINES = [
  { n: 1, hs: '8504.23', d: 'Liquid dielectric transformers', o: 'CN', q: '2 units' },
  { n: 2, hs: '8504.40', d: 'Rectifier units for transformer assembly', o: 'CN', q: '6 pcs' },
  { n: 3, hs: '8504.90', d: 'Transformer parts: bushings, gaskets', o: 'CN', q: '14 pcs' },
];

export const DECL_FLAGS = [
  { id: 'f1', field: 'Line 2 · HS code', short: 'Invoice and certificate of origin point to different headings',
    d1: 'Commercial invoice', e1: 'Rectifier units for transformer assembly, 6 pcs',
    d2: 'Certificate of origin', e2: 'Parts of electrical transformers', sug: '8504.40', alt: '8504.90' },
  { id: 'f2', field: 'Incoterm', short: 'Invoice and bill of lading disagree on freight terms',
    d1: 'Commercial invoice', e1: 'Terms: CFR Jebel Ali',
    d2: 'Bill of lading', e2: 'Freight collect', sug: 'FOB Shanghai', alt: 'CFR Jebel Ali' },
];

export const SAMPLE_DOCS = [
  { name: 'BL_MEDU48210937.pdf', type: 'Bill of lading', fields: 18, check: 0 },
  { name: 'Packing_list.pdf', type: 'Packing list', fields: 24, check: 0 },
  { name: 'COO_scan.jpg', type: 'Certificate of origin', fields: 9, check: 0 },
  { name: 'Invoice_INV-0931.pdf', type: 'Commercial invoice', fields: 21, check: 2 },
];

export const SHIPMENT_FIELDS: [string, string][] = [
  ['Bill of lading', 'MEDU48210937'],
  ['Consignee', COMPANY],
  ['Vessel / voyage', 'MV Sample Voyager · 027E'],
  ['Route', 'Shanghai → Jebel Ali'],
  ['Containers', "4 × 40' high cube"],
  ['Port of discharge', 'Jebel Ali Terminal 3'],
  ['Invoice value', 'USD 112,350.00'],
  ['Shipper', 'Sinopower Electric Co.'],
];

export const LOW_CONF_FIELDS = [
  { id: 'gw', label: 'Gross weight', value: '48,600 kg', alt: 'Packing list reads 48,060 kg', confidence: 71 },
  { id: 'cd', label: 'Cargo description', value: 'Food preparations, CCTV cameras, power supplies', alt: 'Invoice reads "Instant noodles, IP cameras, PSU units"', confidence: 68 },
];

export const CHECKS: { label: string; ok: boolean }[] = [
  { label: 'You are the consignee', ok: true },
  { label: 'No existing case for this BL', ok: true },
  { label: 'Weights agree across documents', ok: true },
  { label: 'Tariff heading on invoice vs COO', ok: false },
];

export const PLAN = [
  { k: 'track', agent: 'Vessel arrival', what: 'Status agent watches ETA, arrival and container discharge' },
  { k: 'do', agent: 'Trade+ · Delivery order', what: 'DO agent drafts the DO request for you to pay' },
  { k: 'decl', agent: 'Integrated Clearance', what: 'Permit agents (DM, SIRA) and declaration agent draft your requests' },
  { k: 'etoken', agent: 'CargoWaves', what: 'Haulage agent books your contracted haulier for delivery' },
];

export const SLOTS = [
  { t: 'Tomorrow · 06:00–08:00', note: 'Recommended · lowest predicted queue', q: 'Low queue', tone: 'done' as CaseStatus },
  { t: 'Tomorrow · 10:00–12:00', note: 'Fits haulier availability', q: 'Medium queue', tone: 'you' as CaseStatus },
  { t: 'Tomorrow · 14:00–16:00', note: 'Peak gate hours', q: 'High queue', tone: 'wait' as CaseStatus },
];

export type AgentInfo = { key: string; name: string; job: string; status: string; tone: CaseStatus };

export const AGENTS: AgentInfo[] = [
  { key: 'doc', name: 'Document AI', job: 'Reads BL, PL, COO and CI', status: '2 fields to confirm', tone: 'you' },
  { key: 'status', name: 'Status agent', job: 'Vessel, discharge and holds', status: 'Watching 2 vessels', tone: 'run' },
  { key: 'do', name: 'DO agent', job: 'Delivery orders and charges', status: '1 ready to approve', tone: 'you' },
  { key: 'decl', name: 'Declaration agent', job: 'Customs declaration drafts', status: 'With C&F agent', tone: 'run' },
  { key: 'etoken', name: 'eToken agent', job: 'Trucks and gate slots', status: 'Paused · waits for clearance', tone: 'wait' },
];

export const ACTIVITY = [
  { time: '12:15', agent: 'Declaration agent', text: 'Drafted declaration for IMP-…00418, sent 2 fields to Gulf Clear', tone: 'run' as CaseStatus },
  { time: '11:43', agent: 'DO agent', text: 'Prepared DO request for MEDU48210937 · stopped for your approval', tone: 'you' as CaseStatus },
  { time: '11:40', agent: 'Status agent', text: '3 of 3 containers discharged at Jebel Ali T3, no holds', tone: 'done' as CaseStatus },
  { time: '09:28', agent: 'Document AI', text: 'Read 4 documents for MSCU70033124 · 2 fields below threshold', tone: 'you' as CaseStatus },
  { time: 'Yesterday', agent: 'eToken agent', text: 'Booked gate slot for CMAU55102876 · gate out tomorrow 07:10', tone: 'done' as CaseStatus },
];

export const RECENT_CHATS = [
  'DO charges for MEDU48210937',
  'Why is IMP-2027-00421 waiting?',
  'Cleared declarations in October',
  'Free days with Hapag-Lloyd',
];

/* Suggested prompts shown as pills on the AI home */
export const PILLS: { intent: string; label: string; utter: string; icon: string; payload?: Record<string, unknown> }[] = [
  { intent: 'upload', label: 'Start import process by uploading documents', utter: 'Start the import process by uploading my documents', icon: 'upload' },
  { intent: 'do-containers', label: 'Start import with container numbers', utter: 'Start an import with my container numbers', icon: 'box' },
  { intent: 'case-journey', label: 'My import journey', utter: 'Show my import journey', icon: 'flow', payload: { resume: true } },
  { intent: 'do-approve', label: 'Create delivery order', utter: 'Create a delivery order', icon: 'do' },
  { intent: 'etoken', label: 'Create eToken', utter: 'Create an eToken', icon: 'truck' },
  { intent: 'build-agent', label: 'Build an AI agent', utter: 'Build an AI agent to automate my work', icon: 'bot' },
  { intent: 'do-list', label: 'Recent delivery orders', utter: 'Show my recent delivery orders', icon: 'do' },
  { intent: 'decl-list', label: 'Recent cleared declarations', utter: 'Show my recent cleared declarations', icon: 'decl' },
  { intent: 'track', label: 'Track MEDU48210937', utter: 'Track MEDU48210937', icon: 'track' },
  { intent: 'risk', label: 'Shipments at risk of storage charges', utter: 'Which of my shipments are at risk of storage charges this week?', icon: 'risk' },
  { intent: 'do-cost', label: 'What will my DO cost?', utter: 'What will my delivery order cost?', icon: 'cost' },
  { intent: 'service', label: 'Services to import cosmetics', utter: 'Which service do I need to import cosmetics?', icon: 'service' },
];

/* ── Container numbers → delivery orders ─────────────────────────────── */
export const SAMPLE_CONTAINERS = ['MSKU0000001', 'MSKU0000002', 'HLXU8812045', 'HLXU8812046', 'TGHU5521890'];

export function extractContainers(t: string): string[] {
  return Array.from(new Set(t.toUpperCase().match(/\b[A-Z]{4}\d{7}\b/g) ?? []));
}

const BL_POOL = [
  { bl: 'MEDU48210937', line: 'Mediterranean Shipping', terminal: 'Jebel Ali T3', vessel: 'MV Sample Voyager · 027E' },
  { bl: 'HLCU21990318', line: 'Hapag-Lloyd', terminal: 'Jebel Ali T2', vessel: 'Berlin Express · 045W' },
];
export const DO_FEE = 1250;
export const THC_PER_CONTAINER = 945;

export type ContainerInfo = { no: string; bl: string; line: string; terminal: string; vessel: string; discharged: boolean; eta?: string };

/* Sample lookup: the containers belong to one bill of lading on a vessel that
 * has not arrived yet, so the import journey can track them from ETA onwards. */
export function lookupContainers(list: string[]): ContainerInfo[] {
  return list.map(no => ({ no, ...BL_POOL[0], discharged: false, eta: '30 Nov 06:00' }));
}

/* ── AI agents the user owns ───────────────────────────────────────────── */
export type MyAgent = { id: string; name: string; desc: string; trigger: string; stat: string; on: boolean; icon: string; isNew?: boolean };

export const DEFAULT_MY_AGENTS: MyAgent[] = [
  { id: 'freetime', name: 'Free-time guard', desc: 'Warns you 3 days before storage charges start', trigger: 'Free time < 3 days', stat: '1 alert today', on: true, icon: 'clock' },
  { id: 'decl', name: 'Declaration drafter', desc: 'Drafts the import declaration when documents are uploaded', trigger: 'Documents uploaded', stat: '2 drafts this week', on: true, icon: 'decl' },
  { id: 'slot', name: 'Gate slot booker', desc: 'Holds the lowest-queue gate slot once customs clears', trigger: 'Declaration cleared', stat: 'Paused', on: false, icon: 'truck' },
];

export type AgentSpec = { key: string; name: string; prompt: string; trigger: string; condition: string; action: string; approval: string; notify: string; icon: string };

export const AGENT_TEMPLATES: AgentSpec[] = [
  { key: 'do', name: 'Auto delivery orders', prompt: 'When my containers are discharged, create the delivery order and ask me before paying', trigger: 'Container discharged at Jebel Ali', condition: 'No DO requested yet · no holds on the container', action: 'Draft DO request with line charges', approval: 'Ask me before paying', notify: 'Tell me and my haulier', icon: 'do' },
  { key: 'freetime', name: 'Free-time guard', prompt: 'Alert me 3 days before free time ends if the DO or eToken is not done', trigger: 'Daily check at 08:00', condition: 'Free time ends within 3 days · DO or eToken pending', action: 'Send alert with the blocking step', approval: 'No approval needed (read only)', notify: 'Email and app notification', icon: 'clock' },
  { key: 'truck', name: 'Gate slot booker', prompt: 'Book the lowest-queue truck slot as soon as customs clears the declaration', trigger: 'Declaration cleared by customs', condition: 'Haulier assigned · no holds', action: 'Hold lowest-queue gate slot and draft eToken', approval: 'Ask me before filing the eToken', notify: 'Tell me, the haulier and drivers', icon: 'truck' },
  { key: 'decl', name: 'Declaration drafter', prompt: 'When I upload documents, draft the import declaration and send it to my C&F agent', trigger: 'New documents uploaded', condition: 'BL, invoice and packing list present', action: 'Draft import declaration with HS codes', approval: 'My C&F agent approves and files', notify: 'Tell me when it is filed', icon: 'decl' },
];

export function pickTemplate(text: string): AgentSpec {
  const x = text.toLowerCase();
  if (/truck|slot|etoken|gate/.test(x)) return AGENT_TEMPLATES[2];
  if (/free ?time|storage|alert|warn|remind/.test(x)) return AGENT_TEMPLATES[1];
  if (/declaration|customs|document|upload/.test(x)) return AGENT_TEMPLATES[3];
  return AGENT_TEMPLATES[0];
}

/* ── Import from documents: what to upload and what Document AI finds ─── */
export const REQUIRED_DOCS = [
  { key: 'BL', name: 'Bill of lading', need: 'Required', why: 'Shows you own the cargo. We read the vessel, containers and consignee.', match: 'Bill of lading' },
  { key: 'CI', name: 'Commercial invoice', need: 'Required', why: 'Goods, HS codes and value. Used for permits and customs duty.', match: 'Commercial invoice' },
  { key: 'PL', name: 'Packing list', need: 'Required', why: 'Packages and weight in each container.', match: 'Packing list' },
  { key: 'COO', name: 'Certificate of origin', need: 'Recommended', why: 'Country of origin. Can lower your customs duty.', match: 'Certificate of origin' },
];

export const SHIPMENT_CONTAINERS = [
  { no: 'MSKU0000001', size: "40' HC", packages: '600 cartons', weight: '12,150 kg' },
  { no: 'MSKU0000002', size: "40' HC", packages: '600 cartons', weight: '12,150 kg' },
  { no: 'MSKU0000003', size: "40' HC", packages: '90 boxes', weight: '12,150 kg' },
  { no: 'MSKU0000004', size: "40' HC", packages: '2,490 pcs', weight: '12,150 kg' },
];

export const SHIPMENT_HS = [
  { hs: '2106.90', goods: 'Food preparations (instant noodles)', qty: '1,200 cartons', value: 'USD 18,400.00', permit: 'Dubai Municipality' },
  { hs: '8525.89', goods: 'IP CCTV cameras', qty: '180 units', value: 'USD 52,650.00', permit: 'SIRA' },
  { hs: '8504.40', goods: 'Power supply units', qty: '2,400 pcs', value: 'USD 41,300.00', permit: '' },
];

/* AI agents that support the import journey, grouped by track (PLAN keys) */
export const JOURNEY_AGENTS: { plan: string; track: string; agents: { name: string; job: string }[] }[] = [
  { plan: 'track', track: 'Vessel Operations', agents: [{ name: 'Status agent', job: 'Watches ETA, arrival and container discharge' }] },
  { plan: 'do', track: 'Trade+', agents: [{ name: 'DO agent', job: 'Drafts the delivery order for you to review and pay' }] },
  { plan: 'decl', track: 'Integrated Clearance', agents: [
    { name: 'DM permit agent', job: 'Food import permit for HS 2106.90' },
    { name: 'SIRA permit agent', job: 'Security equipment permit for HS 8525.89' },
    { name: 'Declaration agent', job: 'Drafts the customs declaration with your permits' },
  ] },
  { plan: 'etoken', track: 'Cargo Waves', agents: [{ name: 'CargoWaves agent', job: 'Books Al Bahar Transport, your contracted haulier' }] },
];

/* ── Active import case ──────────────────────────────────────────────
 * The journey, documents and completion screens read the case they show
 * from here, so a delivery order or clearance started from another BL
 * shows that BL throughout. */
export type Permit = { agent: string; entity: string; type: string; hs: string; item: string; qty: string; fee: string; ref: string };
export type HsLine = { hs: string; d: string; permit: string };
export type CaseMeta = { caseId: string; bl: string; vessel: string; origin: string; line: string; manifest: string; permits?: Permit[]; hs?: HsLine[]; permitPay?: string };
export const DEFAULT_CASE: CaseMeta = { caseId: 'IMP-2027-00422', bl: 'MEDU48210937', vessel: 'MV Sample Voyager · 027E', origin: 'Shanghai', line: 'Mediterranean Shipping', manifest: 'MSC-027E-JEA-118' };
export const ACTIVE: { c: CaseMeta } = { c: DEFAULT_CASE };
export const setActiveCase = (m: CaseMeta) => { ACTIVE.c = m; };

/* Bills of lading whose delivery order request the DO agent has drafted */
export type DoDraft = CaseMeta & { containers: string[]; size: string; status: string; drafted: string };
export const DO_DRAFTS: DoDraft[] = [
  { caseId: 'IMP-2027-00418', bl: 'MEDU48210937', line: 'Mediterranean Shipping', vessel: 'MV Sample Voyager · 027E', origin: 'Shanghai', manifest: 'MSC-027E-JEA-118', containers: ['MSKU0000001', 'MSKU0000002', 'MSKU0000003'], size: "40' HC", status: 'Discharged today', drafted: 'Today, 11:43' },
  { caseId: 'IMP-2027-00425', bl: 'HLCU21904416', line: 'Hapag-Lloyd', vessel: 'Al Nefud · 041W', origin: 'Hamburg', manifest: 'HLC-041W-JEA-207', containers: ['HLXU8812045', 'HLXU8812046'], size: "40' HC", status: 'Discharged yesterday', drafted: 'Yesterday, 17:20' },
  { caseId: 'IMP-2027-00427', bl: 'ONEU60442190', line: 'Ocean Network Express', vessel: 'ONE Harmony · 088E', origin: 'Singapore', manifest: 'ONE-088E-JEA-031', containers: ['TGHU5521890', 'TGHU5521891', 'TGHU5521892', 'TGHU5521893'], size: "40' HC", status: 'Discharged this morning', drafted: 'Today, 08:05' },
];

/* Bills of lading whose permit requests and declaration the agents have drafted */
export type ClearanceDraft = CaseMeta & { containers: string[]; size: string; goods: string; drafted: string; permits: Permit[]; hs: HsLine[] };
export const CLEARANCE_DRAFTS: ClearanceDraft[] = [
  {
    caseId: 'IMP-2027-00418', bl: 'MEDU48210937', line: 'Mediterranean Shipping', vessel: 'MV Sample Voyager · 027E', origin: 'Shanghai', manifest: 'MSC-027E-JEA-118',
    containers: ['MSKU0000001', 'MSKU0000002', 'MSKU0000003'], size: "40' HC", goods: 'Food preparations, CCTV cameras, power supplies', drafted: 'Today, 11:50',
    permits: [
      { agent: 'DM agent', entity: 'Dubai Municipality', type: 'Food import permit', hs: '2106.90', item: 'Food preparations (instant noodles)', qty: '1,200 cartons', fee: '210.00', ref: 'DM-PRM-27-55120' },
      { agent: 'SIRA agent', entity: 'SIRA', type: 'Security equipment import permit', hs: '8525.89', item: 'IP CCTV cameras', qty: '180 units', fee: '520.00', ref: 'SIRA-27-08841' },
    ],
    hs: [{ hs: '2106.90', d: 'Food preparations', permit: 'Dubai Municipality' }, { hs: '8525.89', d: 'IP CCTV cameras', permit: 'SIRA' }, { hs: '8504.40', d: 'Power supply units', permit: 'None needed' }],
  },
  {
    caseId: 'IMP-2027-00421', bl: 'MSCU70033124', line: 'MSC', vessel: 'MSC Aurora · 112W', origin: 'Nhava Sheva', manifest: 'MSC-112W-JEA-064',
    containers: ['MSCU7003312', 'MSCU7003313'], size: "20' GP", goods: 'Mixed spices, dried chillies', drafted: 'Today, 09:12',
    permits: [
      { agent: 'DM agent', entity: 'Dubai Municipality', type: 'Food import permit', hs: '0910.99', item: 'Mixed spices and dried chillies', qty: '640 bags', fee: '210.00', ref: 'DM-PRM-27-55188' },
    ],
    hs: [{ hs: '0910.99', d: 'Mixed spices', permit: 'Dubai Municipality' }, { hs: '0904.21', d: 'Dried chillies', permit: 'Dubai Municipality' }],
  },
  {
    caseId: 'IMP-2027-00426', bl: 'CMAU55210334', line: 'CMA CGM', vessel: 'CMA CGM Tigris · 0FE3', origin: 'Busan', manifest: 'CMA-0FE3-JEA-119',
    containers: ['CMAU5521033'], size: "40' HC", goods: 'Skin care products, smart door locks', drafted: 'Yesterday, 15:40',
    permits: [
      { agent: 'DM agent', entity: 'Dubai Municipality', type: 'Cosmetics product registration', hs: '3304.99', item: 'Skin care products', qty: '2,400 units', fee: '350.00', ref: 'DM-COS-27-10442' },
      { agent: 'SIRA agent', entity: 'SIRA', type: 'Security equipment import permit', hs: '8301.40', item: 'Smart door locks', qty: '300 units', fee: '520.00', ref: 'SIRA-27-08907' },
    ],
    hs: [{ hs: '3304.99', d: 'Skin care products', permit: 'Dubai Municipality' }, { hs: '8301.40', d: 'Smart door locks', permit: 'SIRA' }],
  },
];
export const sumFees = (p: Permit[]) => p.reduce((a, x) => a + Number(x.fee.replace(/,/g, '')), 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
