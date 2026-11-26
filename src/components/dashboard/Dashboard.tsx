/* Dashboard tab — a conventional trade dashboard: KPIs, charts and tables. */
import React, { useMemo, useState } from 'react';
import Dh, { DhAmount } from '../Dh';
import { CASES, USER_NAME } from '../ai/data';
import { Icon, JourneyBar, Pill } from '../ai/ui';
import { AreaLine, Donut, HBars, Legend, StackedBars, VIZ } from './charts';

type Period = '6m' | '12m';
type Mode = 'all' | 'sea' | 'air';

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const SEA = [4, 5, 3, 6, 5, 7, 6, 8, 7, 6, 9, 8];
const AIR = [2, 1, 3, 2, 2, 3, 2, 3, 4, 3, 3, 4];
const SPEND_SEA = [29800, 33400, 24100, 37900, 31200, 43800, 38600, 49100, 44300, 40200, 51700, 47900];
const SPEND_AIR = [8200, 8600, 6900, 9100, 8800, 11200, 10400, 12900, 13700, 10800, 14300, 13340];
const STAGES = [
  { label: 'Documents read', value: 0.4 },
  { label: 'DO issued', value: 9.5 },
  { label: 'Declaration filed', value: 14.2 },
  { label: 'Customs cleared', value: 6.8 },
  { label: 'Truck & gate out', value: 18.6 },
];

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Card({ title, sub, right, children, className = '' }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-[12px] border border-[#e3e8ef] p-5 min-w-0 ${className}`} style={{ boxShadow: '0 1px 2px rgba(14,27,61,.04)' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-[16px] text-[#111838]" style={{ fontWeight: 600 }}>{title}</h3>
          {sub && <p className="text-[14px] text-[#4f5a78] mt-[2px]">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex bg-white border border-[#e3e8ef] rounded-[8px] p-[3px] gap-[2px]">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`h-[32px] px-3 rounded-[6px] text-[14px] transition-colors ${value === v ? 'bg-[#0e1b3d] text-white' : 'text-[#40484f] hover:bg-[#f3f6fb]'}`} style={{ fontWeight: 500 }}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, delta, good }: { icon: string; label: string; value: React.ReactNode; delta?: string; good?: boolean }) {
  return (
    <div className="bg-white rounded-[12px] border border-[#e3e8ef] p-5 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#4f5a78]">{label}</p>
        <span className="size-[32px] rounded-[8px] flex items-center justify-center bg-[#eef4ff] text-[#1360d2]"><Icon name={icon} size={16} /></span>
      </div>
      <p className="text-[28px] text-[#0e1b3d] mt-1 leading-tight" style={{ fontWeight: 700 }}>{value}</p>
      {delta && (
        <p className="text-[14px] mt-1 inline-flex items-center gap-1" style={{ color: good ? '#17703a' : '#a3341f', fontWeight: 600 }}>
          <span aria-hidden>{good ? '▼' : '▲'}</span>{delta}<span className="text-[#4f5a78]" style={{ fontWeight: 400 }}>vs previous period</span>
        </p>
      )}
    </div>
  );
}

export default function Dashboard({ onOpenAI, tabs, journeys }: { onOpenAI?: () => void; tabs?: React.ReactNode; journeys?: React.ReactNode }) {
  const [period, setPeriod] = useState<Period>('6m');
  const [mode, setMode] = useState<Mode>('all');

  const d = useMemo(() => {
    const n = period === '6m' ? 6 : 12;
    const sl = <T,>(a: T[]) => a.slice(12 - n);
    const sea = sl(SEA), air = sl(AIR);
    const spend = sl(SPEND_SEA).map((v, i) => (mode === 'air' ? 0 : v) + (mode === 'sea' ? 0 : sl(SPEND_AIR)[i]));
    const series = [
      ...(mode !== 'air' ? [{ name: 'Sea', color: VIZ.s1, data: sea }] : []),
      ...(mode !== 'sea' ? [{ name: 'Air', color: VIZ.s2, data: air }] : []),
    ];
    const shipments = series.reduce((a, s) => a + s.data.reduce((x, y) => x + y, 0), 0);
    const k = shipments / (SEA.reduce((a, b) => a + b, 0) + AIR.reduce((a, b) => a + b, 0));
    const channels = [
      { label: 'Green', value: Math.max(1, Math.round(34 * k)), color: VIZ.good },
      { label: 'Yellow', value: Math.max(1, Math.round(9 * k)), color: VIZ.warning },
      { label: 'Red', value: Math.max(0, Math.round(3 * k)), color: VIZ.critical },
    ];
    return { labels: sl(MONTHS), series, spend, shipments, channels, totalSpend: spend.reduce((a, b) => a + b, 0) };
  }, [period, mode]);

  const declTotal = d.channels.reduce((a, c) => a + c.value, 0);
  const periodLabel = period === '6m' ? 'last 6 months' : 'last 12 months';

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-[60px] py-8">
      {tabs && <div className="flex justify-center mb-6">{tabs}</div>}
      {/* Title + filters (one row above the charts) */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[26px] text-[#051937]" style={{ fontWeight: 500 }}>Dashboard</h1>
          <p className="text-[14px] text-[#4f5a78]">Welcome back, {USER_NAME} · Al Noor Trading LLC · data for the {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented<Mode> value={mode} onChange={setMode} options={[['all', 'All'], ['sea', 'Sea'], ['air', 'Air']]} />
          <Segmented<Period> value={period} onChange={setPeriod} options={[['6m', '6 months'], ['12m', '12 months']]} />
        </div>
      </div>

      {/* Journeys (Sea / Air · Import / Export), as on the classic home */}
      {journeys && <section className="bg-white rounded-[12px] border border-[#e3e8f3] px-5 sm:px-8 pt-6 pb-8 mb-6" style={{ boxShadow: '0 1px 3px rgba(14,27,61,.05)' }}>{journeys}</section>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon="ship" label="Shipments" value={d.shipments} delta="12%" good={false} />
        <Kpi icon="clock" label="Avg. time to clear" value={<>2.1 <span className="text-[16px] text-[#4f5a78]" style={{ fontWeight: 500 }}>days</span></>} delta="0.6 days" good />
        <Kpi icon="wallet" label="DO & duty spend" value={<DhAmount value={fmt(d.totalSpend)} />} delta="8%" good={false} />
        <Kpi icon="bolt" label="Waiting for your approval" value={2} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <Card className="xl:col-span-2" title="Shipments per month" sub="Import cases opened, by mode" right={d.series.length > 1 ? <Legend items={d.series.map(s => ({ label: s.name, color: s.color }))} /> : undefined}>
          <StackedBars labels={d.labels} series={d.series} height={250} unit="" />
        </Card>
        <Card title="Declarations by channel" sub={`Customs inspection channel · ${periodLabel}`}>
          <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-5">
            <Donut items={d.channels} center={<><span className="text-[26px] text-[#111838] leading-none" style={{ fontWeight: 700 }}>{declTotal}</span><span className="text-[14px] text-[#4f5a78] mt-1">declarations</span></>} />
            <div className="grid gap-2 w-full">
              {d.channels.map(c => (
                <div key={c.label} className="flex items-center gap-2 text-[14px]">
                  <span className="size-[10px] rounded-[3px]" style={{ background: c.color }} />
                  <span className="text-[#40484f] flex-1">{c.label} channel</span>
                  <span className="text-[#111838]" style={{ fontWeight: 600 }}>{c.value}</span>
                  <span className="text-[#4f5a78] w-[38px] text-right">{Math.round((c.value / declTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <Card title="DO and duty spend" sub={<span className="inline-flex items-center gap-1">Per month, in <Dh /> · {periodLabel}</span>}>
          <AreaLine labels={d.labels} data={d.spend} height={230} format={v => <DhAmount value={fmt(v)} />} />
        </Card>
        <Card title="Average time per journey stage" sub="Hours from the previous stage · last 30 cases">
          <HBars items={STAGES} format={v => `${v} h`} />
          <p className="text-[14px] text-[#4f5a78] mt-3 flex items-center gap-2"><Icon name="sparkle" size={14} className="text-[#1360d2]" /> Truck & gate out takes longest. The eToken agent can book slots as soon as customs clears.</p>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <Card className="xl:col-span-2" title="Active imports" sub="12-step import journey" right={onOpenAI && <button type="button" onClick={onOpenAI} className="text-[14px] text-[#1360d2] inline-flex items-center gap-1 hover:underline" style={{ fontWeight: 600 }}><Icon name="sparkle" size={14} />Ask AI</button>}>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-[#f3f6fb] text-left text-[14px] text-[#4f5a78]">
                  <th className="px-5 py-2" style={{ fontWeight: 500 }}>Case</th>
                  <th className="px-3 py-2" style={{ fontWeight: 500 }}>Route</th>
                  <th className="px-3 py-2 w-[180px]" style={{ fontWeight: 500 }}>Progress</th>
                  <th className="px-3 py-2" style={{ fontWeight: 500 }}>Next step</th>
                  <th className="px-5 py-2" style={{ fontWeight: 500 }}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {CASES.map(c => (
                  <tr key={c.id} className="border-t border-[#eef1f6] text-[14px] text-[#111838]">
                    <td className="px-5 py-3 whitespace-nowrap"><p style={{ fontWeight: 600 }}>{c.id}</p><p className="text-[14px] text-[#4f5a78]">{c.bl}</p></td>
                    <td className="px-3 py-3"><p>{c.route}</p><p className="text-[14px] text-[#4f5a78]">{c.containers}</p></td>
                    <td className="px-3 py-3"><JourneyBar done={c.done} current={c.current} /><p className="text-[14px] text-[#4f5a78] mt-1">{c.done} of 12</p></td>
                    <td className="px-3 py-3">{c.next}</td>
                    <td className="px-5 py-3"><Pill tone={c.status}>{c.who}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Upcoming deadlines" sub="Next 14 days">
          <ul className="grid grid-cols-1 gap-3">
            {[
              { d: '27', m: 'Nov', t: 'Free time ends', s: 'IMP-2027-00418 · storage charges after', tone: 'you' as const, tag: 'In 3 days' },
              { d: '26', m: 'Nov', t: 'DO validity ends', s: 'IMP-2027-00409 · collected', tone: 'done' as const, tag: 'Done' },
              { d: '28', m: 'Nov', t: 'Vessel ETA', s: 'IMP-2027-00421 · MSC Aurora · Jebel Ali T2', tone: 'run' as const, tag: 'Tracking' },
              { d: '05', m: 'Dec', t: 'Guarantee renewal', s: 'Duty account guarantee', tone: 'wait' as const, tag: 'Upcoming' },
            ].map(x => (
              <li key={x.t} className="flex items-center gap-3">
                <span className="w-[44px] h-[48px] rounded-[8px] bg-[#f3f6fb] flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[16px] text-[#0e1b3d] leading-none" style={{ fontWeight: 700 }}>{x.d}</span>
                  <span className="text-[14px] text-[#4f5a78]">{x.m}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{x.t}</span>
                  <span className="block text-[14px] text-[#4f5a78] truncate">{x.s}</span>
                </span>
                <Pill tone={x.tone}>{x.tag}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
