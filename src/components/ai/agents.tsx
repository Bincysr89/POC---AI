/* Build-your-own AI agents.
 * Plain-language description → generated agent (WHEN → IF → THEN → CHECK → TELL)
 * → test on a past case → switch on. Agents the user owns appear on AI home. */
import { createContext, useContext, useEffect, useState } from 'react';
import { DhAmount } from '../Dh';
import { AGENT_TEMPLATES, USER_NAME, pickTemplate, type AgentSpec, type MyAgent } from './data';
import type { Ask } from './flows';
import { Btn, C, Icon, Panel, Pill, SuccessBanner } from './ui';

type AgentsCtx = { agents: MyAgent[]; add: (a: MyAgent) => void; toggle: (id: string) => void };
export const AgentsContext = createContext<AgentsCtx>({ agents: [], add: () => {}, toggle: () => {} });
export const useAgents = () => useContext(AgentsContext);

const NODES: { k: keyof AgentSpec; kind: string; icon: string; tint: string }[] = [
  { k: 'trigger', kind: 'When', icon: 'bolt', tint: '#1360d2' },
  { k: 'condition', kind: 'Only if', icon: 'flow', tint: '#5b61e8' },
  { k: 'action', kind: 'Then', icon: 'sparkle', tint: '#0f8a8a' },
  { k: 'approval', kind: 'Check with', icon: 'shield', tint: '#b07a00' },
  { k: 'notify', kind: 'Tell', icon: 'bell', tint: '#40484f' },
];

const OPTIONS: Partial<Record<keyof AgentSpec, string[]>> = {
  trigger: Array.from(new Set(AGENT_TEMPLATES.map(t => t.trigger))),
  action: Array.from(new Set(AGENT_TEMPLATES.map(t => t.action))),
  approval: ['Ask me before paying', 'Ask me before filing the eToken', 'Ask me before every submission', 'No approval needed (read only)', 'My C&F agent approves and files'],
  notify: ['Tell me and my haulier', 'Email and app notification', 'Tell me, the haulier and drivers', 'Tell me when it is filed'],
};

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="w-[38px] h-[22px] rounded-full relative transition-colors flex-shrink-0" style={{ background: on ? 'linear-gradient(135deg,#1360d2,#5b61e8)' : '#c9d4ec' }}>
      <span className="absolute top-[3px] size-[16px] rounded-full bg-white transition-all shadow" style={{ left: on ? 19 : 3 }} />
    </button>
  );
}

/* ── Builder card (in the conversation) ───────────────────────────────── */
export function AgentBuilderCard({ ask, template }: { ask: Ask; template?: string }) {
  const { add } = useAgents();
  const preset = template ? AGENT_TEMPLATES.find(t => t.key === template) : undefined;
  const [stage, setStage] = useState<'describe' | 'designing' | 'plan' | 'testing' | 'tested' | 'live'>(preset ? 'designing' : 'describe');
  const [prompt, setPrompt] = useState(preset?.prompt ?? '');
  const [spec, setSpec] = useState<AgentSpec>(preset ?? AGENT_TEMPLATES[0]);

  useEffect(() => {
    if (stage === 'designing') { const t = setTimeout(() => setStage('plan'), 1300); return () => clearTimeout(t); }
    if (stage === 'testing') { const t = setTimeout(() => setStage('tested'), 1500); return () => clearTimeout(t); }
  }, [stage]);

  const generate = () => { const t = pickTemplate(prompt || AGENT_TEMPLATES[0].prompt); setSpec({ ...t, prompt: prompt || t.prompt }); setStage('designing'); };
  const activate = () => {
    add({ id: `${spec.key}-${Date.now()}`, name: spec.name, desc: spec.prompt, trigger: spec.trigger, stat: 'Live now', on: true, icon: spec.icon, isNew: true });
    setStage('live');
  };

  if (stage === 'describe') {
    return (
      <Panel title="Describe the work to automate" sub="Plain words are fine · I'll design the steps and where it stops for you">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="e.g. When my containers are discharged, create the delivery order and ask me before paying"
          className="w-full rounded-[10px] px-3 py-[10px] text-[15px] outline-none resize-none focus:border-[#1360d2]" style={{ border: '1px solid #d5ddfb' }} />
        <p className="text-[14px] text-[#4f5a78] mt-3 mb-2">Or start from a template</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AGENT_TEMPLATES.map(t => (
            <button key={t.key} type="button" onClick={() => setPrompt(t.prompt)} className="ai-template flex items-start gap-3 rounded-[10px] px-3 py-[10px] text-left border" style={{ borderColor: prompt === t.prompt ? C.blue : C.border, background: prompt === t.prompt ? '#eef4ff' : '#fff' }}>
              <span className="size-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0 text-white" style={{ background: 'linear-gradient(135deg,#1360d2,#5b61e8)' }}><Icon name={t.icon} size={15} /></span>
              <span><span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{t.name}</span><span className="block text-[14px] text-[#4f5a78] leading-snug">{t.prompt}</span></span>
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-4"><Btn icon="sparkle" onClick={generate}>Design my agent</Btn></div>
      </Panel>
    );
  }

  if (stage === 'designing') {
    return (
      <Panel title="Designing your agent…" sub="Choosing the trigger, the governed tools and the approval checkpoint">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {NODES.map((n, i) => <div key={n.k} className="ai-shimmer h-[86px] rounded-[10px]" style={{ animationDelay: `${i * 0.12}s` }} />)}
        </div>
      </Panel>
    );
  }

  if (stage === 'live') {
    return (
      <div className="grid grid-cols-1 gap-3">
        <SuccessBanner><strong>Success:</strong> Agent <strong>{spec.name}</strong> is live. It watches your 3 active imports and stops at the checkpoint ("{spec.approval.toLowerCase()}"). You can pause it any time from AI home.</SuccessBanner>
        <div className="flex gap-3 flex-wrap">
          <Btn variant="secondary" icon="plus" onClick={() => ask('build-agent', 'Build another AI agent')}>Build another agent</Btn>
        </div>
      </div>
    );
  }

  /* plan / testing / tested */
  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel
        title={<span className="inline-flex items-center gap-2"><span className="size-[28px] rounded-[8px] flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1360d2,#5b61e8)' }}><Icon name={spec.icon} size={14} /></span>
          <input value={spec.name} onChange={e => setSpec(s => ({ ...s, name: e.target.value }))} className="bg-transparent outline-none border-b border-dashed border-transparent hover:border-[#c9d4ec] focus:border-[#1360d2] min-w-[180px]" aria-label="Agent name" /></span>}
        sub={<>“{spec.prompt}”</>}
        right={<Pill tone={stage === 'tested' ? 'done' : 'ai'}>{stage === 'tested' ? 'Test passed' : 'Draft'}</Pill>}
      >
        {/* Flow */}
        <div className="ai-flow grid gap-2 sm:grid-cols-5 relative">
          {NODES.map((n, i) => (
            <div key={n.k} className="ai-node relative rounded-[12px] border bg-white p-3 flex flex-col gap-2" style={{ borderColor: C.border, ['--tint' as string]: n.tint }}>
              {i > 0 && <span className="ai-node-link hidden sm:block" aria-hidden />}
              <span className="inline-flex items-center gap-[6px] text-[14px]" style={{ color: n.tint, fontWeight: 700 }}><Icon name={n.icon} size={13} />{n.kind}</span>
              {OPTIONS[n.k] ? (
                <span className="relative block rounded-[6px] -mx-1 px-1 hover:bg-[#f3f6fb]">
                  <span className="flex items-start gap-1 text-[14px] text-[#111838] leading-snug" style={{ fontWeight: 600 }}>
                    <span className="flex-1">{spec[n.k]}</span><Icon name="chevDown" size={13} className="mt-[3px] text-[#66708c]" />
                  </span>
                  <select aria-label={`${n.kind}: change`} value={spec[n.k]} onChange={e => setSpec(s => ({ ...s, [n.k]: e.target.value }))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                    {Array.from(new Set([spec[n.k], ...OPTIONS[n.k]!])).map(o => <option key={o}>{o}</option>)}
                  </select>
                </span>
              ) : (
                <p className="text-[14px] text-[#111838] leading-snug" style={{ fontWeight: 600 }}>{spec[n.k]}</p>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-[14px]">
          <div className="rounded-[10px] bg-[#f6f8fc] px-3 py-2"><p className="text-[#4f5a78]">May prepare</p><p className="text-[#111838]" style={{ fontWeight: 600 }}>Drafts and holds only</p></div>
          <div className="rounded-[10px] bg-[#f6f8fc] px-3 py-2"><p className="text-[#4f5a78]">May submit or pay alone</p><p className="text-[#111838]" style={{ fontWeight: 600 }}>Never</p></div>
          <div className="rounded-[10px] bg-[#f6f8fc] px-3 py-2"><p className="text-[#4f5a78]">Approver</p><p className="text-[#111838]" style={{ fontWeight: 600 }}>{USER_NAME} (you)</p></div>
        </div>
      </Panel>

      {stage === 'testing' && (
        <Panel title="Testing on a past case · IMP-2027-00377" sub="Replaying the case's signals · no live action taken">
          <div className="ai-shimmer h-[6px] rounded-full" />
        </Panel>
      )}
      {stage === 'tested' && (
        <Panel title="Test run on IMP-2027-00377 · completed case" sub="The agent would have fired once, at the right step, and stopped at your checkpoint">
          <ol className="grid grid-cols-1 gap-2">
            {[
              ['06 Nov 10:12', `${spec.trigger}`, 'done'],
              ['06 Nov 10:12', `Checked: ${spec.condition}`, 'done'],
              ['06 Nov 10:13', spec.key === 'do' ? <>Drafted DO request · <DhAmount value="2,410.00" /></> : spec.action, 'done'],
              ['06 Nov 10:13', `Stopped: ${spec.approval}`, 'you'],
            ].map(([t, s, tone], i) => (
              <li key={i} className="flex items-center gap-3 text-[14px]">
                <span className="w-[96px] text-[#4f5a78] flex-shrink-0">{t}</span>
                <span className="size-[8px] rounded-full flex-shrink-0" style={{ background: tone === 'you' ? '#f2b200' : '#28a745' }} />
                <span className="text-[#111838]">{s}</span>
              </li>
            ))}
          </ol>
          <p className="text-[14px] text-[#4f5a78] mt-3">Saved you about 25 minutes on that case.</p>
        </Panel>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        {stage !== 'tested' && <Btn variant="secondary" icon="play" onClick={() => setStage('testing')} disabled={stage === 'testing'}>{stage === 'testing' ? 'Testing…' : 'Test on a past case'}</Btn>}
        <Btn icon="bolt" onClick={activate}>Switch on agent</Btn>
        <button type="button" onClick={() => setStage('describe')} className="text-[14px] text-[#1360d2] hover:underline">Start over</button>
      </div>
    </div>
  );
}

/* ── "Your AI agents" on AI home ─────────────────────────────────────── */
export function MyAgentsGrid({ ask }: { ask: Ask }) {
  const { agents, toggle } = useAgents();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {agents.map(a => (
        <div key={a.id} className={`ai-agent-card rounded-[16px] p-4 flex flex-col ${a.on ? '' : 'is-off'}`}>
          <div className="flex items-center justify-between">
            <span className="size-[36px] rounded-[10px] flex items-center justify-center text-white" style={{ background: a.on ? 'linear-gradient(135deg,#1360d2,#5b61e8)' : '#aab4c8' }}><Icon name={a.icon} size={17} /></span>
            <Switch on={a.on} onClick={() => toggle(a.id)} label={`${a.on ? 'Pause' : 'Resume'} ${a.name}`} />
          </div>
          <p className="text-[15px] text-[#111838] mt-3 flex items-center gap-2" style={{ fontWeight: 600 }}>{a.name}{a.isNew && <span className="text-[14px] px-[8px] h-[24px] inline-flex items-center rounded-full bg-[#e6f0ff] text-[#1360d2]" style={{ fontWeight: 700 }}>New</span>}</p>
          <p className="text-[14px] text-[#4f5a78] mt-1 leading-snug flex-1 line-clamp-2">{a.desc}</p>
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(14,27,61,.07)' }}>
            <span className="inline-flex items-center gap-1 text-[14px] text-[#40484f] truncate"><Icon name="bolt" size={12} className="text-[#1360d2]" />{a.trigger}</span>
            <span className="text-[14px] whitespace-nowrap" style={{ color: a.on ? '#17703a' : C.muted, fontWeight: 600 }}>{a.on ? a.stat : 'Paused'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
