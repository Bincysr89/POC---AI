/* Rich, interactive reply cards the assistant drops into the conversation.
 * Each card is a simplified version of a screen from the AI Layer prototype
 * (Document AI, DO agent, TradePay, Declaration review, eToken agent, …). */
import { Fragment, useEffect, useRef, useState } from 'react';
import { DhAmount } from '../Dh';
import {
  CASES, CF_AGENT, CHECKS, COMPANY, DECLARATIONS, DECL_FLAGS, DECL_LINES, DELIVERY_ORDERS, DO_CHARGES, DO_TOTAL,
  JOURNEY, JOURNEY_AGENTS, LOW_CONF_FIELDS, PLAN, REQUIRED_DOCS, SAMPLE_DOCS, SHIPMENT_CONTAINERS, SHIPMENT_FIELDS, SHIPMENT_HS, SLOTS, WALLET_BALANCE,
} from './data';
import { Btn, C, Field, HowIWorked, Icon, InfoBanner, JourneyBar, Panel, Pill, SuccessBanner, Tracker } from './ui';

export type Ask = (intent: string, utter?: string, payload?: Record<string, unknown>) => void;

const th = 'text-left text-[14px] text-[#4f5a78] px-[12px] py-[8px] whitespace-nowrap';
const td = 'px-[12px] py-[10px] text-[14px] text-[#111838] align-middle';

/* ── 1. Start an import from documents ─────────────────────────────────── */
export function UploadCard({ ask, files: initial }: { ask: Ask; files?: string[] }) {
  const [stage, setStage] = useState<'empty' | 'reading' | 'review' | 'created'>(initial?.length ? 'reading' : 'empty');
  const [names, setNames] = useState<string[]>(initial?.length ? initial : SAMPLE_DOCS.map(d => d.name));
  const [progress, setProgress] = useState(0);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState(false);
  const [tab, setTab] = useState(2); // open on the step that needs the user
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(LOW_CONF_FIELDS.map(f => [f.id, f.value])));
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const handedOff = useRef(false);

  useEffect(() => {
    if (stage !== 'reading') return;
    setProgress(0);
    const iv = setInterval(() => setProgress(p => (p >= 100 ? 100 : p + 5)), 90);
    const t = setTimeout(() => setStage('review'), 2000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [stage]);

  const start = (list: string[]) => { setNames(list.length ? list : SAMPLE_DOCS.map(d => d.name)); setStage('reading'); };
  const docs = names.map((n, i) => ({ ...SAMPLE_DOCS[i % SAMPLE_DOCS.length], name: n }));

  if (stage === 'empty') {
    return (
      <div className="bg-white rounded-[14px] border overflow-hidden" style={{ borderColor: C.border, boxShadow: '0 8px 28px -16px rgba(14,27,61,.25)' }}>
        <div className="px-5 pt-4 pb-3" style={{ background: 'linear-gradient(180deg,#f3f7ff,#fff)' }}>
          <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Start an import</p>
          <p className="text-[18px] text-[#111838]" style={{ fontWeight: 600 }}>Upload your shipping documents</p>
          <p className="text-[14px] text-[#4f5a78]">Document AI reads them and opens your import case. Missing one? You can add it later.</p>
        </div>

        <div className="px-5 pb-2">
          <p className="text-[14px] text-[#40484f] mb-2" style={{ fontWeight: 600 }}>Documents you need</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {REQUIRED_DOCS.map((d, i) => (
              <li key={d.key} className="rounded-[12px] p-3 border flex flex-col gap-2" style={{ borderColor: '#e3e8f3', background: '#fbfcff' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-[28px] rounded-full flex items-center justify-center text-[14px] text-white flex-shrink-0" style={{ background: C.navy, fontWeight: 700 }}>{i + 1}</span>
                    <span className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>{d.name}</span>
                  </span>
                </div>
                <span className="self-start text-[14px] px-[10px] h-[26px] inline-flex items-center rounded-full" style={{ background: d.need === 'Required' ? '#e6f0ff' : '#f0f2f6', color: d.need === 'Required' ? C.blue : '#40484f', fontWeight: 600 }}>{d.need}</span>
                <p className="text-[14px] text-[#4f5a78] leading-snug">{d.why}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 pt-3">
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); start(Array.from(e.dataTransfer.files).map(f => f.name)); }}
            className="rounded-[14px] border-2 border-dashed px-6 py-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left transition-colors"
            style={{ borderColor: drag ? C.blue : '#b9cdf0', background: drag ? '#eef4ff' : 'linear-gradient(135deg,#f6f9ff,#fdfdff)' }}
          >
            <span className="size-[56px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)', color: '#fff', boxShadow: '0 10px 24px -10px rgba(19,96,210,.6)' }}><Icon name="upload" size={24} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] text-[#111838]" style={{ fontWeight: 600 }}>Drag all four files here, or choose them</span>
              <span className="block text-[14px] text-[#4f5a78]">PDF, JPG or PNG · scans and phone photos are fine · English or Arabic</span>
            </span>
            <span className="flex gap-2 flex-wrap justify-center">
              <Btn icon="clip" onClick={() => inputRef.current?.click()}>Choose files</Btn>
              <Btn variant="secondary" onClick={() => start([])}>Use sample documents</Btn>
            </span>
            <input ref={inputRef} type="file" multiple hidden onChange={e => start(Array.from(e.target.files ?? []).map(f => f.name))} />
          </div>
          <p className="text-[14px] text-[#66708c] mt-3 inline-flex items-center gap-2"><Icon name="shield" size={14} /> Files stay in the UAE and are stored with your case record.</p>
        </div>
      </div>
    );
  }

  if (stage === 'reading') {
    return (
      <Panel title={`Document AI is reading ${docs.length} document${docs.length > 1 ? 's' : ''}`} sub="Extracting fields and checking them against each other">
        <div className="grid grid-cols-1 gap-[10px]">
          {docs.map((d, i) => {
            const p = Math.max(0, Math.min(100, progress * 1.6 - i * 22));
            return (
              <div key={d.name + i} className="flex items-center gap-3">
                <Icon name="doc" size={18} className="text-[#4f5a78]" />
                <span className="w-[220px] min-w-0"><span className="block text-[14px] text-[#111838] truncate">{d.name}</span><span className="block text-[14px] text-[#4f5a78]">{p >= 60 ? d.type : 'Identifying…'}</span></span>
                <span className="flex-1 h-[6px] rounded-full bg-[#edf0f4] overflow-hidden"><span className="block h-full rounded-full transition-all" style={{ width: `${p}%`, background: C.blue }} /></span>
                <span className="text-[14px] text-[#4f5a78] w-[130px] text-right">{p >= 100 ? 'Fields extracted' : 'Reading pages…'}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  const toConfirm = LOW_CONF_FIELDS.filter(f => !ok[f.id]).length;
  const agentsOn = PLAN.filter(p => !off[p.k]).length; // tracks switched on
  const passed = CHECKS.filter(c => c.ok).length;
  const agentCount = JOURNEY_AGENTS.filter(g => !off[g.plan]).reduce((a, g) => a + g.agents.length, 0);
  const found = REQUIRED_DOCS.map(r => ({ ...r, file: docs.find(d => d.type === r.match)?.name }));
  const permitsNeeded = SHIPMENT_HS.filter(h => h.permit).length;

  if (stage === 'created') {
    if (!handedOff.current) { handedOff.current = true; setTimeout(() => ask('case-journey', undefined, { source: 'documents', files: names }), 500); }
    return (
      <div className="grid grid-cols-1 gap-3">
        <SuccessBanner>
          <strong>Success:</strong> Import case <strong>IMP-2027-00422</strong> has been created for BL <strong>MEDU48210937</strong>. {agentsOn} tracks are now running with {agentCount} AI agents.{toConfirm > 0 && <> {toConfirm} field{toConfirm > 1 ? 's are' : ' is'} still waiting for your confirmation.</>}
        </SuccessBanner>
        <p className="text-[14px] text-[#4f5a78] flex items-center gap-2"><span className="ai-dots"><i /><i /><i /></span> Handing the case to the agents…</p>
      </div>
    );
  }

  /* Review: one compact draft with four short steps in tabs; the primary
     action stays visible in the header and footer, so no long scroll. */
  const steps = [
    { t: 'Documents', s: `${docs.length} read`, done: true },
    { t: 'Shipment details', s: `${SHIPMENT_FIELDS.length} fields`, done: true },
    { t: 'Confirm fields', s: toConfirm ? `${toConfirm} need you` : 'All confirmed', done: toConfirm === 0, attention: toConfirm > 0 },
    { t: 'AI agents', s: `${agentCount} agents · ${agentsOn} tracks`, done: true },
  ];
  const intro = [
    'Document AI recognised each file, matched it to the documents an import needs, and cross-checked them.',
    'Everything below was read from your documents. It pre-fills your delivery order, permits, declaration and haulage.',
    'Two values were read with medium confidence. Confirm or correct them; nothing uses them until you do.',
    'These AI agents will support this import once you start the import journey. Switch off a track if you prefer to handle it yourself.',
  ][tab];

  return (
    <div className="bg-white rounded-[14px] border overflow-hidden" style={{ borderColor: C.border, boxShadow: '0 8px 28px -16px rgba(14,27,61,.25)' }}>
      {/* Header: what this is + primary action */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-wrap" style={{ background: 'linear-gradient(180deg,#f5f8ff,#fff)' }}>
        <div className="min-w-0">
          <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Import case draft</p>
          <p className="text-[17px] text-[#111838] leading-snug" style={{ fontWeight: 600 }}>BL MEDU48210937 · Shanghai → Jebel Ali</p>
          <p className="text-[14px] text-[#4f5a78]">{COMPANY} · 4 × 40' HC · MV Sample Voyager 027E</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStage('empty')} className="text-[14px] text-[#4f5a78] hover:text-[#1360d2] px-2">Start over</button>
          <Btn onClick={() => setStage('created')} icon="check">Confirm and start import journey</Btn>
        </div>
      </div>

      {/* What Document AI found */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {[
            ['doc', `${docs.length}`, 'documents read'],
            ['box', `${SHIPMENT_CONTAINERS.length}`, "containers (40' HC)"],
            ['decl', `${SHIPMENT_HS.length}`, 'HS codes'],
            ['shield', `${permitsNeeded}`, 'permits needed'],
            ['ship', '48,600 kg', 'gross weight'],
            ['wallet', 'USD 112,350', 'invoice value'],
          ].map(([ic, v, l]) => (
            <div key={l} className="rounded-[12px] px-3 py-2 flex items-center gap-3" style={{ background: '#f4f7fd' }}>
              <span className="size-[32px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e3edfd', color: C.blue }}><Icon name={ic} size={16} /></span>
              <span className="min-w-0"><span className="block text-[16px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{v}</span><span className="block text-[14px] text-[#4f5a78] leading-tight truncate">{l}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Step tabs */}
      <div role="tablist" aria-label="Review steps" className="grid grid-cols-2 gap-1 xl:flex xl:items-center xl:gap-0 px-3 pb-3 border-b" style={{ borderColor: '#eef1f6', background: '#fff' }}>
        {steps.map((st, i) => {
          const on = tab === i;
          return (
            <Fragment key={st.t}>
              {i > 0 && <span aria-hidden className="hidden xl:block flex-1 min-w-[20px] h-[2px] mx-1 rounded-full" style={{ background: steps[i - 1].done && st.done ? '#28a745' : steps[i - 1].done ? 'linear-gradient(90deg,#28a745,#d5ddea)' : '#d5ddea' }} />}
              <button role="tab" aria-selected={on} type="button" onClick={() => setTab(i)}
                className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-colors xl:flex-shrink-0"
                style={{ background: on ? '#eef4ff' : 'transparent', boxShadow: on ? 'inset 0 0 0 1.5px #1360d2' : 'none' }}>
                <span className="size-[28px] rounded-full flex items-center justify-center flex-shrink-0 text-[14px]"
                  style={{ background: st.attention ? '#f2b200' : st.done ? '#28a745' : '#e3e8ef', color: '#fff', fontWeight: 700 }}>
                  {st.attention ? '!' : st.done ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] text-[#111838] whitespace-nowrap" style={{ fontWeight: on ? 700 : 600 }}>{st.t}</span>
                  <span className="block text-[14px] whitespace-nowrap" style={{ color: st.attention ? '#8a5a00' : C.muted }}>{st.s}</span>
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Step body */}
      <div className="px-5 py-4 min-h-[230px]">
        <p className="text-[14px] text-[#40484f] mb-3 flex items-start gap-2"><Icon name="sparkle" size={14} className="mt-[3px] text-[#1360d2]" />{intro}</p>

        {tab === 0 && (
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {found.map(d => (
                <div key={d.key} className="flex items-center gap-3 rounded-[12px] px-3 py-[10px] border" style={{ borderColor: d.file ? '#e3e8f3' : '#f6e3a8', background: d.file ? '#fff' : '#fffbef' }}>
                  <span className="w-[48px] h-[40px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 700 }}>{d.key}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{d.name}</span>
                    <span className="block text-[14px] text-[#4f5a78] truncate">{d.file ?? `Not uploaded · ${d.need.toLowerCase()}`}</span>
                  </span>
                  {d.file ? (docs.find(x => x.name === d.file)?.check ? <Pill tone="you">Check {docs.find(x => x.name === d.file)?.check}</Pill> : <Pill tone="done">Read</Pill>) : <Pill tone="you">Add later</Pill>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {CHECKS.map(c => (
                <span key={c.label} className="inline-flex items-center gap-[6px] h-[30px] px-[12px] rounded-full text-[14px]" style={{ background: c.ok ? '#e3f5ea' : '#fff4d6', color: c.ok ? '#17703a' : '#8a5a00', fontWeight: 600 }}>
                  <Icon name={c.ok ? 'check' : 'info'} size={13} strokeWidth={2.4} />{c.label}
                </span>
              ))}
            </div>
            <p className="text-[14px] text-[#4f5a78]">{passed} of {CHECKS.length} checks passed. The tariff difference is passed to the declaration agent to resolve.</p>
          </div>
        )}

        {tab === 1 && (
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              {SHIPMENT_FIELDS.map(([k, v]) => <Field key={k} label={k} value={v} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
                <p className="px-3 pt-[10px] pb-2 text-[14px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}><Icon name="box" size={16} className="text-[#1360d2]" />{SHIPMENT_CONTAINERS.length} containers on this BL</p>
                <table className="w-full">
                  <thead><tr className="bg-[#f3f6fb]"><th className={th}>Container</th><th className={th}>Packages</th><th className={th}>Weight</th></tr></thead>
                  <tbody>
                    {SHIPMENT_CONTAINERS.map(ct => (
                      <tr key={ct.no} className="border-t" style={{ borderColor: '#eef1f6' }}>
                        <td className={td} style={{ fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{ct.no}</td>
                        <td className={td}>{ct.packages}</td><td className={td}>{ct.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
                <p className="px-3 pt-[10px] pb-2 text-[14px] text-[#111838] flex items-center gap-2" style={{ fontWeight: 600 }}><Icon name="decl" size={16} className="text-[#1360d2]" />{SHIPMENT_HS.length} HS codes · {permitsNeeded} need a permit</p>
                <table className="w-full">
                  <thead><tr className="bg-[#f3f6fb]"><th className={th}>HS code</th><th className={th}>Goods</th><th className={th}>Permit</th></tr></thead>
                  <tbody>
                    {SHIPMENT_HS.map(h => (
                      <tr key={h.hs} className="border-t" style={{ borderColor: '#eef1f6' }}>
                        <td className={td} style={{ fontWeight: 600 }}>{h.hs}</td>
                        <td className={td}>{h.goods}<span className="block text-[14px] text-[#4f5a78]">{h.qty} · {h.value}</span></td>
                        <td className={td}>{h.permit ? <Pill tone="run">{h.permit === 'Dubai Municipality' ? 'DM' : h.permit}</Pill> : <span className="text-[#4f5a78]">None</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="grid grid-cols-1 gap-2">
            {LOW_CONF_FIELDS.map(f => (
              <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] items-center gap-3 rounded-[10px] px-3 py-[10px]" style={{ background: ok[f.id] ? '#f3fbf6' : '#fffbef', border: `1px solid ${ok[f.id] ? '#cdebd8' : '#f6e3a8'}` }}>
                <div>
                  <p className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{f.label}</p>
                  <p className="text-[14px]" style={{ color: ok[f.id] ? '#17703a' : '#8a5a00' }}>{ok[f.id] ? 'Confirmed by you' : `${f.confidence}% confidence`}</p>
                </div>
                <div>
                  <input value={vals[f.id]} onChange={e => { setVals(v => ({ ...v, [f.id]: e.target.value })); setOk(o => ({ ...o, [f.id]: false })); }}
                    className="w-full h-[36px] rounded-[6px] px-3 text-[14px] outline-none bg-white focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} aria-label={f.label} />
                  <p className="text-[14px] text-[#4f5a78] mt-1">{f.alt}</p>
                </div>
                {ok[f.id]
                  ? <span className="inline-flex items-center gap-1 text-[14px] text-[#17703a]" style={{ fontWeight: 600 }}><Icon name="check" size={15} strokeWidth={2.4} />Done</span>
                  : <Btn size="sm" onClick={() => setOk(o => ({ ...o, [f.id]: true }))}>Confirm</Btn>}
              </div>
            ))}
          </div>
        )}

        {tab === 3 && (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-[12px] px-3 py-[10px] flex items-center gap-3 flex-wrap" style={{ background: '#f3fbf6', border: '1px solid #cdebd8' }}>
              <Pill tone="done">Done</Pill>
              <span className="text-[14px] text-[#111838]"><strong style={{ fontWeight: 600 }}>Document AI</strong> read your files · <strong style={{ fontWeight: 600 }}>Cargo owner agent</strong> confirmed you are the consignee</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {JOURNEY_AGENTS.map((g, gi) => {
                const on = !off[g.plan];
                return (
                  <div key={g.plan} className="rounded-[14px] border p-3 transition-opacity" style={{ borderColor: on ? '#d7e3f8' : '#e6ebf3', background: on ? '#fbfdff' : '#f7f8fb', opacity: on ? 1 : 0.7 }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>Track {gi + 1} · {g.track}</span>
                      <button type="button" role="switch" aria-checked={on} aria-label={`${on ? 'Switch off' : 'Switch on'} ${g.track}`} onClick={() => setOff(o => ({ ...o, [g.plan]: !o[g.plan] }))}
                        className="w-[38px] h-[22px] rounded-full relative transition-colors flex-shrink-0" style={{ background: on ? C.blue : '#c9d4ec' }}>
                        <span className="absolute top-[3px] size-[16px] rounded-full bg-white transition-all" style={{ left: on ? 19 : 3 }} />
                      </button>
                    </div>
                    <ul className="grid grid-cols-1 gap-2">
                      {g.agents.map(a => (
                        <li key={a.name} className="flex items-start gap-3">
                          <span className="size-[32px] rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: on ? 'linear-gradient(135deg,#1360d2,#4f8ff7)' : '#aab4c8' }}><Icon name="bot" size={15} /></span>
                          <span className="min-w-0"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{a.name}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{on ? a.job : 'Switched off · you handle this track'}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer: step navigation + primary action, always in view */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t flex-wrap" style={{ borderColor: '#eef1f6', background: '#fbfcfe' }}>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={() => setTab(t => Math.max(0, t - 1))} disabled={tab === 0}>Back</Btn>
          <span className="text-[14px] text-[#4f5a78]">Step {tab + 1} of 4</span>
          {tab < 3 && <Btn size="sm" variant="secondary" onClick={() => setTab(t => Math.min(3, t + 1))}>Next: {steps[tab + 1].t}</Btn>}
        </div>
        <div className="flex items-center gap-3">
          <Btn size="sm" icon="check" onClick={() => setStage('created')}>Confirm and start import journey</Btn>
        </div>
      </div>
    </div>
  );
}

/* Low-confidence field confirmation (used in upload flow and for IMP-2027-00421) */
export function ConfirmFields({ compact, ask }: { compact?: boolean; ask?: Ask }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(LOW_CONF_FIELDS.map(f => [f.id, f.value])));
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="grid grid-cols-1 gap-3">
        <SuccessBanner><strong>Success:</strong> 2 fields confirmed{compact ? '' : <> for <strong>IMP-2027-00421</strong>. Document AI has passed them to the declaration agent</>}. Your choices are recorded in the audit trail.</SuccessBanner>
        {!compact && ask && <div className="flex gap-3"><Btn onClick={() => ask('track', 'Track IMP-2027-00421')}>See the import journey</Btn></div>}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-[10px]">
      {LOW_CONF_FIELDS.map(f => (
        <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] items-center gap-3 rounded-[8px] px-3 py-[10px]" style={{ background: '#fbfcfe', border: `1px solid ${C.border}` }}>
          <div>
            <p className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{f.label}</p>
            <p className="text-[14px] text-[#8a5a00]">{f.confidence}% confidence</p>
          </div>
          <div>
            <input value={vals[f.id]} onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))} className="w-full h-[38px] rounded-[6px] px-3 text-[14px] outline-none focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} />
            <p className="text-[14px] text-[#4f5a78] mt-1">{f.alt}</p>
          </div>
          <Pill tone={vals[f.id] !== f.value ? 'run' : 'you'}>{vals[f.id] !== f.value ? 'Edited' : 'To confirm'}</Pill>
        </div>
      ))}
      <div><Btn size="sm" icon="check" onClick={() => setDone(true)}>Confirm fields</Btn></div>
    </div>
  );
}

/* ── 2. Delivery orders ─────────────────────────────────────────────────── */
export function DOListCard({ ask }: { ask: Ask }) {
  const tone = { ready: 'you', verifying: 'run', issued: 'done' } as const;
  const label = { ready: 'Ready to approve', verifying: 'Line verifying', issued: 'Issued' };
  return (
    <Panel title="Recent delivery orders" sub={`${DELIVERY_ORDERS.length} in the last 30 days · 1 needs you`}>
      <div className="overflow-x-auto -mx-[18px] -my-[18px]">
        <table className="w-full min-w-[620px]">
          <thead><tr className="bg-[#f3f6fb]"><th className={th}>Import case</th><th className={th}>BL / line</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th}></th></tr></thead>
          <tbody>
            {DELIVERY_ORDERS.map(d => (
              <tr key={d.bl} className="border-t" style={{ borderColor: '#eef1f6' }}>
                <td className={td}><span className="whitespace-nowrap" style={{ fontWeight: 600 }}>{d.caseId}</span><br /><span className="text-[14px] text-[#4f5a78]">{d.date}</span></td>
                <td className={td}>{d.bl}<br /><span className="text-[14px] text-[#4f5a78]">{d.line} · {d.containers}</span></td>
                <td className={td}><Pill tone={tone[d.status]}>{label[d.status]}</Pill>{d.status === 'issued' && <p className="text-[14px] text-[#4f5a78] mt-1">Valid till {d.validTill}</p>}</td>
                <td className={td}><DhAmount value={d.amount} /></td>
                <td className={`${td} text-right`}>
                  {d.status === 'ready'
                    ? <Btn size="sm" onClick={() => ask('do-approve', `Review and pay the DO for ${d.bl}`)}>Review and pay</Btn>
                    : <Btn size="sm" variant="ghost" icon="doc">View DO</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function DOApprovalCard({ ask }: { ask: Ask }) {
  const [method, setMethod] = useState(0);
  const [paid, setPaid] = useState(false);
  const methods = [
    ['Dubai Trade wallet', <>Balance <DhAmount value={WALLET_BALANCE} /> covers this payment</>],
    ['Credit facility', 'Settled on your monthly statement'],
    ['Card or bank transfer', 'Opens the secure TradePay page'],
  ] as const;

  if (paid) {
    return (
      <div className="grid grid-cols-1 gap-3">
        <SuccessBanner><strong>Success:</strong> Delivery order request for BL <strong>MEDU48210937</strong> has been approved and paid. TradePay reference <strong>TP-27114085</strong>. Amount paid <strong><DhAmount value={DO_TOTAL} /></strong>.</SuccessBanner>
        <Panel title="Step 7 · Verification and issue" sub="The DO agent now tracks the line and tells you and your haulier when the DO is issued">
          <Tracker active={2} steps={[{ t: 'Prepared', s: 'DO agent' }, { t: 'Approved & paid', s: 'You, just now' }, { t: 'Line verifying', s: 'Tracked by do.status' }, { t: 'DO issued', s: 'You and haulier told' }]} />
        </Panel>
        <div className="flex gap-3 flex-wrap">
          <Btn onClick={() => ask('etoken', 'When can I book a truck?')}>Plan the truck booking</Btn>
          <Btn variant="secondary" onClick={() => ask('track', 'Track MEDU48210937')}>Back to the case</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel title="Delivery order request · IMP-2027-00418" sub="Drafted by the DO agent · not yet submitted" right={<Pill tone="you">Needs your approval</Pill>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Field label="Shipping line" value="Mediterranean Shipping" />
          <Field label="Bill of lading" value="MEDU48210937" />
          <Field label="Consignee" value={COMPANY} />
          <Field label="Containers" value="3 × 40' high cube" />
          <Field label="DO valid until" value="5 days after discharge" />
          <Field label="Collect by" value="Haulier from eToken step" />
          <Field label="Terminal" value="Jebel Ali T3" />
          <Field label="Discharged" value="Today, 11:40" />
        </div>
        <div className="mt-4 rounded-[8px] overflow-hidden border" style={{ borderColor: '#eef1f6' }}>
          <table className="w-full">
            <thead><tr className="bg-[#f3f6fb]"><th className={th}>Charge</th><th className={`${th} hidden sm:table-cell`}>Source</th><th className={`${th} text-right`}>Amount</th></tr></thead>
            <tbody>
              {DO_CHARGES.map(c => (
                <tr key={c.label} className="border-t" style={{ borderColor: '#eef1f6' }}>
                  <td className={td}>{c.label}</td>
                  <td className={`${td} text-[#4f5a78] text-[14px] hidden sm:table-cell`}>{c.source}</td>
                  <td className={`${td} text-right`}>{c.amount ? <DhAmount value={c.amount} /> : <span className="text-[#17703a]">Waived</span>}</td>
                </tr>
              ))}
              <tr className="border-t bg-[#fbfcfe]" style={{ borderColor: '#eef1f6' }}>
                <td className={td} style={{ fontWeight: 600 }}>Total to pay</td><td className="hidden sm:table-cell" />
                <td className={`${td} text-right text-[16px]`} style={{ fontWeight: 700 }}><DhAmount value={DO_TOTAL} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Pay with TradePay">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px]">
          {methods.map(([n, s], i) => (
            <button key={n} type="button" onClick={() => setMethod(i)} className="flex items-start gap-3 rounded-[8px] px-3 py-[10px] text-left" style={{ border: `1.5px solid ${method === i ? C.navy : C.border}`, background: method === i ? C.soft : '#fff' }}>
              <span className="mt-[3px] size-[16px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: C.navy }}>{method === i && <span className="size-[8px] rounded-full" style={{ background: C.navy }} />}</span>
              <span><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{n}</span><span className="block text-[14px] text-[#4f5a78]">{s}</span></span>
            </button>
          ))}
        </div>
        <p className="text-[14px] text-[#4f5a78] mt-3 flex items-start gap-2"><Icon name="shield" size={15} className="mt-[2px] text-[#1360d2]" /> This request includes a payment, so the agent cannot submit it on its own. Paying approves the DO request for BL MEDU48210937; your name and this approval are recorded in the audit trail.</p>
        <div className="flex gap-3 mt-4 flex-wrap">
          <Btn onClick={() => setPaid(true)}>Approve and pay&nbsp;<DhAmount value={DO_TOTAL} /></Btn>
          <Btn variant="secondary">Edit request</Btn>
        </div>
      </Panel>
    </div>
  );
}

export function DOCostCard({ ask }: { ask: Ask }) {
  return (
    <Panel title="Delivery order estimate · IMP-2027-00418" sub="Fetched from the shipping line tariff · Mediterranean Shipping">
      <div className="grid grid-cols-1 gap-[8px]">
        {DO_CHARGES.map(c => (
          <div key={c.label} className="flex items-center justify-between text-[14px]">
            <span className="text-[#111838]">{c.label}</span>
            {c.amount ? <DhAmount value={c.amount} /> : <span className="text-[#17703a]">Waived · guarantee on file</span>}
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-[8px] mt-[2px] text-[16px]" style={{ borderColor: '#eef1f6', fontWeight: 700 }}>
          <span>Total</span><DhAmount value={DO_TOTAL} />
        </div>
      </div>
      <HowIWorked rows={[['Data', 'do.charges · container.status'], ['Containers', "3 × 40' HC, discharged today"], ['Confidence', 'High · line tariff published today']]} />
      <div className="flex gap-3 mt-4"><Btn onClick={() => ask('do-approve', 'Review and pay the DO for MEDU48210937')}>Review and pay</Btn></div>
    </Panel>
  );
}

/* ── 3. Declarations ────────────────────────────────────────────────────── */
export function DeclListCard({ ask }: { ask: Ask }) {
  const cleared = DECLARATIONS.filter(d => d.status === 'cleared');
  const review = DECLARATIONS.find(d => d.status === 'review');
  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel title="Recent cleared declarations" sub={`${cleared.length} cleared in the last 30 days`}>
        <div className="overflow-x-auto -mx-[18px] -my-[18px]">
          <table className="w-full min-w-[640px]">
            <thead><tr className="bg-[#f3f6fb]"><th className={th}>Declaration</th><th className={th}>Case / BL</th><th className={th}>Channel</th><th className={th}>Duty paid</th><th className={th}></th></tr></thead>
            <tbody>
              {cleared.map(d => (
                <tr key={d.no} className="border-t" style={{ borderColor: '#eef1f6' }}>
                  <td className={td}><span className="whitespace-nowrap" style={{ fontWeight: 600 }}>{d.no}</span><br /><span className="text-[14px] text-[#4f5a78]">Cleared {d.date}</span></td>
                  <td className={td}>{d.caseId}<br /><span className="text-[14px] text-[#4f5a78]">{d.bl}</span></td>
                  <td className={td}><Pill tone={d.channel === 'Green' ? 'done' : 'you'}>{d.channel}</Pill></td>
                  <td className={td}><DhAmount value={d.duty} /></td>
                  <td className={`${td} text-right`}><Btn size="sm" variant="ghost" onClick={() => ask('decl-view', `Show declaration ${d.no}`, { no: d.no })}>View</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {review && (
        <div className="flex items-center gap-3 rounded-[10px] px-4 py-3 flex-wrap" style={{ background: '#f6f8fc', border: `1px solid ${C.border}` }}>
          <Pill tone="run">In review</Pill>
          <span className="text-[14px] text-[#111838] flex-1 min-w-[200px]">1 declaration is with {CF_AGENT}: <strong>{review.caseId}</strong>, 2 fields to review.</span>
          <Btn size="sm" variant="secondary" onClick={() => ask('decl-review', 'What is pending on the IMP-2027-00418 declaration?')}>See what's pending</Btn>
        </div>
      )}
    </div>
  );
}

export function DeclViewCard({ no, ask }: { no: string; ask: Ask }) {
  const d = DECLARATIONS.find(x => x.no === no) ?? DECLARATIONS[0];
  return (
    <Panel title={`Declaration ${d.no}`} sub={d.type} right={<Pill tone="done">Cleared · {d.channel}</Pill>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        <Field label="Import case" value={d.caseId} />
        <Field label="Bill of lading" value={d.bl} />
        <Field label="Cleared on" value={d.date} />
        <Field label="Port of entry" value="Jebel Ali" />
        <Field label="Importer" value={COMPANY} />
        <Field label="C&F agent" value={CF_AGENT} />
        <Field label="Customs value" value={<DhAmount value={d.value} />} />
        <Field label="Duty paid" value={<DhAmount value={d.duty} />} />
      </div>
      <div className="flex gap-3 mt-4 flex-wrap">
        <Btn size="sm" icon="doc">Download declaration</Btn>
        <Btn size="sm" variant="secondary" onClick={() => ask('track', `Track ${d.caseId}`)}>Open import case</Btn>
      </div>
    </Panel>
  );
}

export function DeclReviewCard() {
  const [sel, setSel] = useState('f1');
  const [nudged, setNudged] = useState(false);
  const f = DECL_FLAGS.find(x => x.id === sel)!;
  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel title="Import declaration draft · IMP-2027-00418" sub={`Drafted by the declaration agent from BL, PL, COO, CI and DO · with ${CF_AGENT}`} right={<Pill tone="run">In review</Pill>}>
        <Tracker active={2} steps={[{ t: 'Nominated', s: 'You confirmed' }, { t: 'Drafted', s: 'Declaration agent' }, { t: 'C&F review', s: '2 fields' }, { t: 'Filed', s: 'Dubai Customs' }]} />
        <div className="mt-4 rounded-[8px] overflow-hidden border" style={{ borderColor: '#eef1f6' }}>
          <table className="w-full">
            <thead><tr className="bg-[#f3f6fb]"><th className={th}>#</th><th className={th}>HS code</th><th className={th}>Description</th><th className={`${th} hidden sm:table-cell`}>Qty</th><th className={th}>Confidence</th></tr></thead>
            <tbody>
              {DECL_LINES.map(l => (
                <tr key={l.n} className="border-t" style={{ borderColor: '#eef1f6' }}>
                  <td className={td}>{l.n}</td><td className={td} style={{ fontWeight: 600 }}>{l.hs}</td><td className={td}>{l.d}</td><td className={`${td} hidden sm:table-cell`}>{l.q}</td>
                  <td className={td}>{l.n === 2 ? <Pill tone="you">Low</Pill> : <Pill tone="done">High</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Fields below the confidence threshold" sub="Your C&F agent decides these; here is the evidence the agent used">
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
          <div className="grid grid-cols-1 gap-2 content-start">
            {DECL_FLAGS.map(x => (
              <button key={x.id} type="button" onClick={() => setSel(x.id)} className="text-left rounded-[8px] px-3 py-[10px]" style={{ border: `1.5px solid ${sel === x.id ? C.navy : C.border}`, background: sel === x.id ? C.soft : '#fff' }}>
                <p className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{x.field}</p>
                <p className="text-[14px] text-[#4f5a78] leading-snug">{x.short}</p>
              </button>
            ))}
          </div>
          <div className="rounded-[8px] p-3 grid gap-2" style={{ background: '#fbfcfe', border: `1px solid ${C.border}` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-[6px] bg-white p-[10px] border" style={{ borderColor: '#eef1f6' }}><p className="text-[14px] text-[#4f5a78]">{f.d1}</p><p className="text-[14px] text-[#111838]">"{f.e1}"</p></div>
              <div className="rounded-[6px] bg-white p-[10px] border" style={{ borderColor: '#eef1f6' }}><p className="text-[14px] text-[#4f5a78]">{f.d2}</p><p className="text-[14px] text-[#111838]">"{f.e2}"</p></div>
            </div>
            <div className="flex gap-4 flex-wrap text-[14px]">
              <span>Agent suggests <strong>{f.sug}</strong></span>
              <span className="text-[#4f5a78]">Alternative {f.alt}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4 flex-wrap items-center">
          {nudged
            ? <SuccessBanner><strong>Success:</strong> Reminder sent to <strong>{CF_AGENT}</strong>. You'll be notified as soon as the declaration is filed.</SuccessBanner>
            : <><Btn size="sm" icon="bell" onClick={() => setNudged(true)}>Remind C&amp;F agent</Btn><Btn size="sm" variant="secondary">Open full draft</Btn></>}
        </div>
      </Panel>
    </div>
  );
}

/* ── 4. Tracking / import journey ──────────────────────────────────────── */
export function TrackCard({ ask, caseId }: { ask: Ask; caseId?: string }) {
  const c = CASES.find(x => x.id === caseId || x.bl === caseId) ?? CASES[0];
  const isMain = c.id === 'IMP-2027-00418' || caseId === 'IMP-2027-00422';
  const groups: [string, 'B' | 'A' | 'C'][] = [['Clearance preparation', 'B'], ['Cargo release', 'A'], ['File and deliver', 'C']];
  const tone = { done: 'done', you: 'you', run: 'run', wait: 'wait' } as const;
  const label = { done: 'Done', you: 'Needs you', run: 'In progress', wait: 'Waiting' };
  const isNew = caseId === 'IMP-2027-00422';
  // A just-created case: documents read, cargo owner checked, C&F nominated; status agent watching the vessel
  const journey = isNew
    ? JOURNEY.map(st => ({ ...st, s: (st.n <= 2 || st.n === 9 ? 'done' : st.n === 3 ? 'run' : 'wait') as typeof st.s,
        agent: st.n === 6 ? 'DO agent' : st.agent,
        did: st.n === 3 ? 'Watching the vessel; ETA in 6 days.' : st.did }))
    : JOURNEY;
  const status = isNew ? 'run' as const : c.status;
  return (
    <Panel
      title={<>Import case {caseId === 'IMP-2027-00422' ? 'IMP-2027-00422' : c.id}</>}
      sub={caseId === 'IMP-2027-00422' ? 'BL MEDU48210937 · just created · agents are starting' : `BL ${c.bl} · ${c.vessel} · ${c.route}`}
      right={<Pill tone={status}>{isNew ? '3 of 12 done' : c.status === 'done' ? 'Delivered' : `${c.done} of 12 done`}</Pill>}
    >
      <JourneyBar done={isNew ? 2 : c.done} current={isNew ? 2 : c.current} />
      {isMain ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {groups.map(([g, k]) => (
            <div key={k} className="rounded-[10px] p-3" style={{ background: '#fbfcfe', border: `1px solid ${C.border}` }}>
              <p className="text-[14px] text-[#4f5a78] mb-2" style={{ fontWeight: 600 }}>{g}</p>
              <div className="grid grid-cols-1 gap-[8px]">
                {journey.filter(s => s.track === k).map(s => (
                  <div key={s.n} className="flex items-start gap-2" title={s.did}>
                    <span className="size-[26px] rounded-full text-[14px] flex items-center justify-center flex-shrink-0 mt-[1px]" style={{ background: s.s === 'done' ? '#28a745' : s.s === 'you' ? '#f2b200' : s.s === 'run' ? '#dbe8ff' : '#e3e8ef', color: s.s === 'done' || s.s === 'you' ? '#fff' : s.s === 'run' ? C.blue : C.navy, fontWeight: 700, boxShadow: s.s === 'run' ? '0 0 0 2px #1360d2 inset' : 'none' }}>{s.s === 'done' ? <Icon name="check" size={12} strokeWidth={2.6} /> : s.n}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] text-[#111838] leading-tight" style={{ fontWeight: s.s === 'you' ? 600 : 500 }}>{s.t}</p>
                      <p className="text-[14px] text-[#4f5a78] leading-tight">{s.agent} · {label[s.s]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
          <Field label="Status" value={c.eta} />
          <Field label="Containers" value={c.containers} />
          <Field label="Next step" value={c.next} />
          <Field label="Who" value={c.who} />
        </div>
      )}
      {isNew && (
        <div className="mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 flex-wrap" style={{ background: '#eef4ff', border: '1px solid #d5e3fb' }}>
          <Icon name="eye" size={18} className="text-[#1360d2]" />
          <span className="text-[14px] text-[#111838] flex-1 min-w-[200px]"><strong>Nothing needed from you right now.</strong> The DO agent prepares the delivery order when containers are discharged and asks you before paying.</span>
        </div>
      )}
      {!isNew && c.status === 'you' && (
        <div className="mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 flex-wrap" style={{ background: '#fff8e6', border: '1px solid #f6dc8c' }}>
          <Icon name="bolt" size={18} className="text-[#b07a00]" />
          <span className="text-[14px] text-[#111838] flex-1 min-w-[200px]"><strong>Next for you:</strong> {c.next}</span>
          {c.id === 'IMP-2027-00418'
            ? <Btn size="sm" onClick={() => ask('do-approve', 'Review and pay the DO for MEDU48210937')}>Review and pay DO</Btn>
            : <Btn size="sm" onClick={() => ask('confirm-fields', 'Confirm the 2 fields on IMP-2027-00421')}>Check fields</Btn>}
        </div>
      )}
      <HowIWorked rows={[['Data', 'portcall.status · container.status · do.status · declaration.draft'], ['As of', 'Latest terminal event, 11:40 today'], ['Confidence', 'High · all sources agree']]} />
    </Panel>
  );
}

/* ── 5. Storage-charge risk ─────────────────────────────────────────────── */
export function RiskCard({ ask }: { ask: Ask }) {
  const [taught, setTaught] = useState<null | string>(null);
  const [days, setDays] = useState('');
  const rows = [
    { c: 'IMP-2027-00418', ft: 'In 3 days', b: 'DO approval', risk: true },
    { c: 'IMP-2027-00421', ft: 'Not arrived', b: 'None', risk: false },
    { c: 'IMP-2027-00409', ft: 'Collected', b: 'None', risk: false },
  ];
  return (
    <Panel title="1 of your 3 active imports is at risk" sub="Free time ends this week and the DO or eToken is not done">
      <div className="rounded-[8px] overflow-hidden border" style={{ borderColor: '#eef1f6' }}>
        <table className="w-full">
          <thead><tr className="bg-[#f3f6fb]"><th className={th}>Case</th><th className={th}>Free time ends</th><th className={th}>Blocker</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.c} className="border-t" style={{ borderColor: '#eef1f6' }}>
                <td className={td} style={{ fontWeight: 600 }}>{r.c}</td>
                <td className={td}>{r.risk ? <Pill tone="you">{r.ft}</Pill> : <span className="text-[#4f5a78]">{r.ft}</span>}</td>
                <td className={td}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HowIWorked rows={[['Window', 'Next 7 days'], ['At risk means', 'Free time ends in the window and the DO or eToken is not done'], ['Data', 'container.freetime · do.status · etoken.status'], ['Confidence', 'Medium · free time can differ under your line agreement']]} />
      <div className="mt-4 rounded-[10px] p-3" style={{ background: '#eef0ff', border: '1px solid #d9dcff' }}>
        {taught ? (
          <p className="text-[14px] text-[#3a3fb8] flex items-center gap-2"><Icon name="check" size={16} /> Got it, {taught}. I'll use this for every future answer.</p>
        ) : (
          <>
            <p className="text-[14px] text-[#111838]"><strong>Teach me:</strong> does your agreement with this line give extra free days?</p>
            <div className="flex gap-2 mt-2 flex-wrap items-center">
              <input value={days} onChange={e => setDays(e.target.value)} placeholder="Extra free days" className="h-[34px] w-[140px] rounded-[6px] px-3 text-[14px] outline-none bg-white" style={{ border: '1px solid #d5ddfb' }} />
              <Btn size="sm" variant="dark" onClick={() => setTaught(`${days || '0'} extra free days with this line`)}>Set free days</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setTaught('no line agreement')}>No agreement</Btn>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-3 mt-4 flex-wrap">
        <Btn onClick={() => ask('do-approve', 'Open the prepared DO for MEDU48210937')}>Open prepared DO</Btn>
        <Btn variant="secondary" onClick={() => ask('track', 'Track IMP-2027-00418')}>Open case</Btn>
      </div>
    </Panel>
  );
}

/* ── 6. Truck and eToken ───────────────────────────────────────────────── */
export function ETokenCard() {
  const [mode, setMode] = useState<'paused' | 'cleared' | 'booked'>('paused');
  const [slot, setSlot] = useState(0);
  const head = {
    paused: { tone: 'wait' as const, pill: 'Paused', title: 'Paused until customs clears the declaration.', body: 'Slots are shortlisted and held lightly. The eToken agent books as soon as the clearance signal arrives.' },
    cleared: { tone: 'you' as const, pill: 'Needs you', title: 'Customs cleared. Your slot is ready to confirm.', body: 'Approve to file the eToken; the haulier and drivers are told at once.' },
    booked: { tone: 'done' as const, pill: 'eToken filed', title: 'eToken filed. Your haulier and drivers have the slot.', body: 'Gate pass details went to the haulier. The case closes when the trucks gate out.' },
  }[mode];
  return (
    <div className="grid grid-cols-1 gap-3">
      {mode === 'booked' && <SuccessBanner><strong>Success:</strong> eToken <strong>ET-27-0091534</strong> filed for {SLOTS[slot].t} · 3 trucks. Haulier and drivers have been notified.</SuccessBanner>}
      <Panel title="Truck and eToken · IMP-2027-00418" sub="eToken agent · step 12" right={<Pill tone={head.tone}>{head.pill}</Pill>}>
        <p className="text-[15px] text-[#111838]" style={{ fontWeight: 600 }}>{head.title}</p>
        <p className="text-[14px] text-[#4f5a78] mt-1">{head.body}</p>
        <p className="text-[14px] text-[#4f5a78] mt-4 mb-2" style={{ fontWeight: 600 }}>Gate slot · gate queue forecast</p>
        <div className="grid grid-cols-1 gap-2">
          {SLOTS.map((s, i) => (
            <button key={s.t} type="button" disabled={mode === 'booked'} onClick={() => setSlot(i)} className="flex items-center gap-3 rounded-[8px] px-3 py-[10px] text-left" style={{ border: `1.5px solid ${slot === i ? C.navy : C.border}`, background: slot === i ? C.soft : '#fff' }}>
              <span className="size-[16px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: C.navy }}>{slot === i && <span className="size-[8px] rounded-full" style={{ background: C.navy }} />}</span>
              <span className="flex-1 min-w-0"><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{s.t}</span><span className="block text-[14px] text-[#4f5a78]">{s.note}</span></span>
              <Pill tone={s.tone}>{s.q}</Pill>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
          <Field label="Haulier" value="Al Bahar Transport" />
          <Field label="Trucks" value="3 assigned" />
          <Field label="Containers" value="MSKU0000001–03" />
          <Field label="Terminal" value="Jebel Ali T3" />
        </div>
        <div className="flex gap-3 mt-4 flex-wrap items-center">
          {mode === 'paused' && <><Btn icon="bell" variant="secondary">Notify me when cleared</Btn><button type="button" onClick={() => setMode('cleared')} className="text-[14px] text-[#4f5a78] underline decoration-dotted hover:text-[#1360d2]">Prototype: simulate "customs cleared" signal</button></>}
          {mode === 'cleared' && <Btn onClick={() => setMode('booked')}>Approve and file eToken</Btn>}
          {mode === 'booked' && <Btn variant="secondary" onClick={() => { setMode('paused'); setSlot(0); }}>Reset demo</Btn>}
        </div>
      </Panel>
    </div>
  );
}

/* ── 7. Service finder ─────────────────────────────────────────────────── */
export function ServiceCard({ ask }: { ask: Ask }) {
  const list = [
    ['Cosmetic product registration', 'Dubai Municipality · Montaji+', 'Register each product before the first shipment'],
    ['Import permit', 'Dubai Municipality · Permits & Certificates', 'Needed per consignment for cosmetics'],
    ['Delivery order', 'Shipping line · DO agent can prepare it', 'Request, pay and track'],
    ['Import declaration', 'Dubai Customs · Integrated Clearance', 'Drafted by the declaration agent, filed by your C&F agent'],
    ['eToken and gate slot', 'DP World · eToken agent', 'Truck booking after clearance'],
  ];
  return (
    <Panel title="Importing cosmetics by sea into Jebel Ali" sub="You'll usually need these services, in this order">
      <ol className="grid grid-cols-1 gap-2">
        {list.map(([n, who, d], i) => (
          <li key={n} className="flex items-start gap-3 rounded-[8px] px-3 py-[10px] border" style={{ borderColor: '#eef1f6' }}>
            <span className="size-[28px] rounded-full text-[14px] flex items-center justify-center flex-shrink-0" style={{ background: C.navy, color: '#fff', fontWeight: 700 }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{n}</p>
              <p className="text-[14px] text-[#4f5a78]">{who} · {d}</p>
            </div>
            <Btn size="sm" variant="ghost">Open</Btn>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 flex-wrap" style={{ background: '#eef4ff', border: '1px solid #d5e3fb' }}>
        <Icon name="sparkle" size={18} className="text-[#1360d2]" />
        <span className="text-[14px] text-[#111838] flex-1 min-w-[200px]"><strong>Or skip the forms:</strong> upload your documents and the agents prepare the DO, declaration and eToken for you.</span>
        <Btn size="sm" onClick={() => ask('upload', 'Start an import from my documents')}>Upload documents</Btn>
      </div>
    </Panel>
  );
}

/* ── 8. Talk to a person ───────────────────────────────────────────────── */
export function HandoffCard() {
  const [sent, setSent] = useState(false);
  return sent ? (
    <SuccessBanner><strong>Success:</strong> Support request <strong>SR-27-118204</strong> created. An agent will join this chat in about 4 minutes with the full conversation, so you won't need to repeat yourself.</SuccessBanner>
  ) : (
    <Panel title="Talk to a Dubai Trade support agent">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px]">
        {[['chat', 'Live chat', 'About 4 min wait'], ['person', 'Call me back', 'Within 30 min'], ['doc', 'Raise a ticket', 'Reply within 1 day']].map(([i, t, s]) => (
          <button key={t} type="button" onClick={() => setSent(true)} className="flex items-center gap-3 rounded-[8px] px-3 py-[10px] text-left border hover:border-[#1360d2]" style={{ borderColor: C.border }}>
            <span className="size-[34px] rounded-full flex items-center justify-center" style={{ background: '#eef4ff', color: C.blue }}><Icon name={i} size={17} /></span>
            <span><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{t}</span><span className="block text-[14px] text-[#4f5a78]">{s}</span></span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
