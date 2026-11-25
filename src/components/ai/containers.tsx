/* Start an import from container numbers.
 * The user types or pastes container numbers. The agents find the bill of
 * lading and vessel, fetch the BL and cargo manifest from the shipping line,
 * and prepare an import case draft. Creating the case starts the same
 * four-track import journey as the document upload flow. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { COMPANY, JOURNEY_AGENTS, SAMPLE_CONTAINERS, SHIPMENT_HS, extractContainers, lookupContainers } from './data';
import { caseDocs, DocTile, DocViewer, type CaseDoc } from './docs';
import type { Ask } from './flows';
import { Btn, C, Field, Icon, Panel, Pill, SuccessBanner } from './ui';

const VALID = /^[A-Z]{4}\d{7}$/;
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

/* Chip input for container numbers — typing, comma/space/enter and paste */
export function ContainerInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw.toUpperCase().split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])));
    setText('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 min-h-[54px] rounded-[12px] bg-white px-3 py-2" style={{ border: '1px solid #c9d6ee' }}>
      {value.map(c => {
        const ok = VALID.test(c);
        return (
          <span key={c} className="inline-flex items-center gap-1 h-[32px] pl-[10px] pr-[4px] rounded-full text-[14px]" style={{ background: ok ? '#eef4ff' : '#fff4d6', color: ok ? C.navy : '#8a5a00', fontWeight: 600, ...mono }} title={ok ? '' : 'Format looks unusual (4 letters + 7 digits); the agent will still try it'}>
            <Icon name="box" size={14} />{c}
            <button type="button" onClick={() => onChange(value.filter(v => v !== c))} className="size-[24px] rounded-full flex items-center justify-center hover:bg-black/5" aria-label={`Remove ${c}`}><Icon name="x" size={13} /></button>
          </span>
        );
      })}
      <input
        value={text}
        onChange={e => { const v = e.target.value; if (/[\s,;]$/.test(v)) add(v); else setText(v); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(text); } if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)); }}
        onPaste={e => { e.preventDefault(); add(e.clipboardData.getData('text')); }}
        onBlur={() => text && add(text)}
        placeholder={value.length ? 'Add more…' : 'Type or paste container numbers, e.g. MSKU0000001'}
        className="flex-1 min-w-[220px] h-[34px] outline-none text-[14px] bg-transparent text-[#111838] placeholder:text-[#66708c]"
        aria-label="Container numbers"
      />
    </div>
  );
}

export function ContainerDOCard({ ask, containers: initial }: { ask: Ask; containers?: string[] }) {
  const [list, setList] = useState<string[]>(initial ?? []);
  const [stage, setStage] = useState<'input' | 'lookup' | 'review' | 'created'>(initial?.length ? 'lookup' : 'input');
  const [found, setFound] = useState(0);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [view, setView] = useState<CaseDoc | null>(null);
  const timer = useRef<number>();
  const handedOff = useRef(false);

  const info = useMemo(() => lookupContainers(list), [list]);
  const docs = caseDocs('containers', undefined, extra);
  const permits = SHIPMENT_HS.filter(h => h.permit).length;

  useEffect(() => {
    if (stage !== 'lookup') return;
    setFound(0);
    timer.current = window.setInterval(() => setFound(f => f + 1), 420);
    return () => window.clearInterval(timer.current);
  }, [stage]);
  useEffect(() => {
    if (stage === 'lookup' && found > info.length + 1) { window.clearInterval(timer.current); setStage('review'); }
  }, [found, stage, info.length]);

  if (stage === 'input') {
    return (
      <Panel title="Start an import with container numbers" sub="Enter one or more containers. The agents find the bill of lading and prepare your import case.">
        <ContainerInput value={list} onChange={setList} />
        <div className="flex gap-3 mt-4 flex-wrap items-center">
          <Btn icon="play" onClick={() => setStage('lookup')} disabled={!list.length}>Find my shipment</Btn>
          <Btn variant="secondary" onClick={() => setList(SAMPLE_CONTAINERS.slice(0, 4))}>Use sample containers</Btn>
          <span className="text-[14px] text-[#4f5a78]">Tip: paste a column straight from Excel.</span>
        </div>
      </Panel>
    );
  }

  if (stage === 'lookup') {
    return (
      <Panel title={`Finding the shipment for ${info.length} container${info.length > 1 ? 's' : ''}`} sub="Checking each container with the shipping line and the port">
        <div className="grid grid-cols-1 gap-2">
          {info.map((c, i) => {
            const done = i < found;
            return (
              <div key={c.no} className="flex items-center gap-3 text-[14px] flex-wrap">
                <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: done ? '#28a745' : '#edf0f4' }}>
                  {done ? <Icon name="check" size={13} strokeWidth={2.6} /> : <span className="ai-spin" />}
                </span>
                <span className="w-[130px] text-[#111838]" style={{ fontWeight: 600, ...mono }}>{c.no}</span>
                <span className={`transition-opacity ${done ? 'opacity-100' : 'opacity-0'} text-[#4f5a78]`}>BL {c.bl} · {c.vessel}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 text-[14px] mt-1">
            <span className="size-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: found > info.length ? '#28a745' : '#edf0f4' }}>
              {found > info.length ? <Icon name="check" size={13} strokeWidth={2.6} /> : <span className="ai-spin" />}
            </span>
            <span className="text-[#111838]">Fetching the bill of lading and cargo manifest from Mediterranean Shipping</span>
          </div>
        </div>
      </Panel>
    );
  }

  if (stage === 'created') {
    if (!handedOff.current) { handedOff.current = true; setTimeout(() => ask('case-journey', undefined, { source: 'containers', containers: list, uploaded: extra }), 500); }
    return (
      <div className="grid grid-cols-1 gap-3">
        <SuccessBanner><strong>Success:</strong> Import case <strong>IMP-2027-00422</strong> has been created for BL <strong>MEDU48210937</strong> with {list.length} containers. 4 tracks are now running.</SuccessBanner>
        <p className="text-[14px] text-[#4f5a78] flex items-center gap-2"><span className="ai-dots"><i /><i /><i /></span> Handing the case to the agents…</p>
      </div>
    );
  }

  /* review: import case draft, same structure as the document flow */
  const first = info[0];
  return (
    <div className="bg-white rounded-[14px] border overflow-hidden" style={{ borderColor: C.border, boxShadow: '0 8px 28px -16px rgba(14,27,61,.25)' }}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-wrap" style={{ background: 'linear-gradient(180deg,#f5f8ff,#fff)' }}>
        <div className="min-w-0">
          <p className="text-[14px] text-[#1360d2]" style={{ fontWeight: 700 }}>Import case draft · from container numbers</p>
          <p className="text-[17px] text-[#111838] leading-snug" style={{ fontWeight: 600 }}>BL {first.bl} · Shanghai → Jebel Ali</p>
          <p className="text-[14px] text-[#4f5a78]">{COMPANY} · {info.length} × 40' HC · {first.vessel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStage('input')} className="text-[14px] text-[#4f5a78] hover:text-[#1360d2] px-2">Edit containers</button>
          <Btn icon="check" onClick={() => setStage('created')}>Confirm and start import journey</Btn>
        </div>
      </div>

      {/* What the agents found */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
          {[
            ['box', String(info.length), 'containers'],
            ['doc', '1', 'bill of lading'],
            ['ship', '30 Nov', 'vessel ETA'],
            ['decl', String(SHIPMENT_HS.length), 'HS codes (manifest)'],
            ['shield', String(permits), 'permits needed'],
          ].map(([ic, v, l]) => (
            <div key={l} className="rounded-[12px] px-3 py-2 flex items-center gap-3" style={{ background: '#f4f7fd' }}>
              <span className="size-[32px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#e3edfd', color: C.blue }}><Icon name={ic} size={16} /></span>
              <span className="min-w-0"><span className="block text-[16px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 700 }}>{v}</span><span className="block text-[14px] text-[#4f5a78] leading-tight truncate">{l}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 border-t grid grid-cols-1 gap-4" style={{ borderColor: '#eef1f6' }}>
        <p className="text-[14px] text-[#40484f] flex items-start gap-2"><Icon name="sparkle" size={14} className="mt-[3px] text-[#1360d2]" />All your containers are on one bill of lading. The agents fetched the BL and cargo manifest from the line, so you don't need to upload them.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 rounded-[12px] p-3" style={{ background: '#f7f9fd' }}>
          <Field label="Bill of lading" value={first.bl} />
          <Field label="Shipping line" value={first.line} />
          <Field label="Vessel / voyage" value={first.vessel} />
          <Field label="Terminal" value={first.terminal} />
        </div>

        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: '#eef1f6' }}>
          <table className="w-full">
            <thead><tr className="bg-[#f3f6fb] text-left text-[14px] text-[#4f5a78]"><th className="px-3 py-2" style={{ fontWeight: 500 }}>Container</th><th className="px-3 py-2" style={{ fontWeight: 500 }}>Size</th><th className="px-3 py-2" style={{ fontWeight: 500 }}>Status</th></tr></thead>
            <tbody>
              {info.map(c => (
                <tr key={c.no} className="border-t text-[14px] text-[#111838]" style={{ borderColor: '#eef1f6' }}>
                  <td className="px-3 py-[9px]" style={{ fontWeight: 600, ...mono }}>{c.no}</td>
                  <td className="px-3 py-[9px]">40' HC</td>
                  <td className="px-3 py-[9px]"><Pill tone="run">On board · ETA {c.eta}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="text-[14px] text-[#111838] mb-2" style={{ fontWeight: 600 }}>Documents</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {docs.map(d => (
              <DocTile key={d.type} doc={d} onView={() => setView(d)}
                onUpload={() => setExtra(x => ({ ...x, [d.type]: d.type === 'Commercial invoice' ? 'Invoice_INV-0931.pdf' : 'Packing_list.pdf' }))} />
            ))}
          </div>
          <p className="text-[14px] text-[#4f5a78] mt-2">Invoice and packing list are optional now. The declaration agent asks for them before filing with Dubai Customs.</p>
        </div>

        <div>
          <p className="text-[14px] text-[#111838] mb-2" style={{ fontWeight: 600 }}>AI agents that will support this import</p>
          <div className="flex flex-wrap gap-2">
            {JOURNEY_AGENTS.flatMap(g => g.agents.map(a => (
              <span key={a.name} className="inline-flex items-center gap-2 h-[34px] pl-1 pr-3 rounded-full text-[14px] text-[#111838]" style={{ background: '#f4f7fd', border: '1px solid #e3e8f3' }}>
                <span className="size-[26px] rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1360d2,#4f8ff7)' }}><Icon name="bot" size={13} /></span>
                {a.name} <span className="text-[#4f5a78]">· {g.track}</span>
              </span>
            )))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-3 border-t flex-wrap" style={{ borderColor: '#eef1f6', background: '#fbfcfe' }}>
        <Btn size="sm" icon="check" onClick={() => setStage('created')}>Confirm and start import journey</Btn>
      </div>
      {view && <DocViewer doc={view} containers={info.length} onClose={() => setView(null)} />}
    </div>
  );
}

export { extractContainers };
