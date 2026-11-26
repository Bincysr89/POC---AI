/* Ship position on a map, from marine traffic (AIS) data.
 * Shows the last leg into Jebel Ali: the track sailed so far (solid), the
 * remaining route (dashed), the ship's current position and the port. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTIVE, VESSEL } from './data';
import { Btn, Field, Icon, Pill } from './ui';

const JEBEL_ALI: [number, number] = [25.012, 55.062];
// Arabian Sea → Gulf of Oman → Strait of Hormuz → Jebel Ali
const ROUTE: [number, number][] = [
  [21.2, 63.6], [22.6, 61.3], [23.9, 59.4], [24.9, 58.0], [25.6, 57.0], [26.35, 56.55], [26.2, 55.9], [25.55, 55.45], JEBEL_ALI,
];
const AT_SEA = 4;   // index of the ship's last AIS position before arrival (Gulf of Oman)

export function VesselMap({ vessel, arrived, delayed, discharged, total, onClose }: {
  vessel: string; arrived: boolean; delayed: boolean; discharged: number; total: number; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const here = arrived ? ROUTE.length - 1 : AT_SEA;
    const sailed = ROUTE.slice(0, here + 1);
    const ahead = ROUTE.slice(here);
    L.polyline(sailed, { color: '#1360d2', weight: 4, opacity: 0.9 }).addTo(map);
    if (ahead.length > 1) L.polyline(ahead, { color: '#1360d2', weight: 3, opacity: 0.7, dashArray: '8 8' }).addTo(map);

    // Port of Jebel Ali
    L.marker(JEBEL_ALI, {
      icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
        html: '<div style="width:34px;height:34px;border-radius:50%;background:#0e1b3d;border:3px solid #fff;box-shadow:0 4px 10px rgba(14,27,61,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px/1 sans-serif">JA</div>' }),
    }).addTo(map).bindTooltip('Jebel Ali Terminal 3', { direction: 'top', offset: [0, -16] });

    // Ship, pointing along its course
        // a ship icon, upright, so it reads as a vessel at a glance
    const pos = ROUTE[here];
    L.marker(pos, {
      zIndexOffset: 1000,
      icon: L.divIcon({ className: '', iconSize: [52, 52], iconAnchor: [26, 26],
        html: `<div style="position:relative;width:52px;height:52px">
          ${arrived ? '' : '<span class="ai-ship-ping"></span>'}
          <div style="position:absolute;inset:6px;border-radius:50%;background:${delayed && !arrived ? '#f2b200' : '#1360d2'};border:3px solid #fff;box-shadow:0 6px 14px rgba(14,27,61,.35);display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="8" width="4" height="4" rx=".6" fill="#fff"/><rect x="10.5" y="8" width="4" height="4" rx=".6" fill="#fff" opacity=".85"/><rect x="8.2" y="4" width="4" height="3.6" rx=".6" fill="#fff" opacity=".85"/><rect x="15" y="6" width="2.4" height="6" rx=".5" fill="#fff"/><path d="M2 13h20l-2.6 5.2a1.5 1.5 0 0 1-1.34.8H5.94a1.5 1.5 0 0 1-1.34-.8z" fill="#fff"/><path d="M3 21.2c1.5 0 1.5-.8 3-.8s1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/></svg>
          </div></div>` }),
    }).addTo(map).bindTooltip(vessel, { direction: 'top', offset: [0, -26], permanent: true });

    map.fitBounds(L.latLngBounds(ROUTE).pad(0.15));
    setTimeout(() => map.invalidateSize(), 60);
    return () => { map.remove(); };
  }, [arrived, delayed, vessel]);

  const rows: [string, React.ReactNode][] = arrived
    ? [['Position', 'Alongside, Jebel Ali T3'], ['Speed', '0 knots · moored'], ['Last AIS update', `30 Nov ${VESSEL.ataTime}`], ['Containers off', `${discharged} of ${total}`]]
    : [['Position', 'Gulf of Oman · 25.6° N, 57.0° E'], ['Speed / course', '11.2 knots · 302°'], ['Last AIS update', '2 min ago'], ['Distance to port', '186 nautical miles']];

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(14,27,61,.55)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${vessel} on the map`}>
      <div className="bg-white rounded-[16px] overflow-hidden w-full max-w-[1180px] h-[min(760px,92vh)] flex flex-col" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 24px 60px rgba(14,27,61,.35)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: '#0e1b3d' }}>
          <div className="min-w-0">
            <p className="text-[18px] text-white" style={{ fontWeight: 700 }}>{vessel} · live position</p>
            <p className="text-[14px] text-[#c9d6f2]">BL {ACTIVE.c.bl} · from the marine traffic system (AIS)</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close map" className="size-[40px] rounded-full flex items-center justify-center text-white hover:bg-white/10"><Icon name="x" size={20} /></button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div ref={box} className="min-h-[300px] lg:min-h-0 h-full" />
          <div className="overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 grid grid-cols-1 gap-4 content-start" style={{ borderColor: '#e6ebf3' }}>
            <div className="flex items-center gap-2 flex-wrap">
              {arrived ? <Pill tone="done">Arrived late</Pill> : delayed ? <Pill tone="you">Delayed</Pill> : <Pill tone="run">On the way</Pill>}
              <span className="text-[14px] text-[#4f5a78]">{arrived ? `ATA 30 Nov ${VESSEL.ataTime}` : delayed ? `Revised ETA ${VESSEL.revised}` : `ETA ${VESSEL.eta}`}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {rows.map(([l, v]) => <Field key={l} label={l} value={v} />)}
            </div>
            <div className="rounded-[12px] p-3 grid grid-cols-1 gap-2" style={{ background: '#f6f8fc' }}>
              <p className="text-[14px] text-[#111838]" style={{ fontWeight: 700 }}>Arrival times</p>
              <div className="flex justify-between gap-3 text-[14px]"><span className="text-[#4f5a78]">ETA from shipping agent</span><span className="text-[#111838]" style={{ fontWeight: 600 }}>{VESSEL.eta}</span></div>
              <div className="flex justify-between gap-3 text-[14px]"><span className="text-[#4f5a78]">Revised ETA (AIS)</span><span className="text-[#8a5a00]" style={{ fontWeight: 600 }}>{delayed ? VESSEL.revised : '—'}</span></div>
              <div className="flex justify-between gap-3 text-[14px]"><span className="text-[#4f5a78]">ATA</span><span className="text-[#8a5a00]" style={{ fontWeight: 600 }}>{arrived ? `30 Nov ${VESSEL.ataTime}` : 'Not arrived yet'}</span></div>
              {(delayed || arrived) && <div className="flex justify-between gap-3 text-[14px] border-t pt-2" style={{ borderColor: '#e3e8f0' }}><span className="text-[#4f5a78]">Delay</span><span className="text-[#8a5a00]" style={{ fontWeight: 700 }}>{arrived ? VESSEL.late : 'About 8 h 30 min'}</span></div>}
            </div>
            {(delayed || arrived) && (
              <p className="text-[14px] text-[#40484f] flex items-start gap-2 leading-snug">
                <Icon name="bot" size={16} className="mt-[2px] text-[#1360d2] flex-shrink-0" />
                The Status agent spotted the slowdown in AIS data on {VESSEL.found} and moved your delivery order, permit and haulage plans to the new time.
              </p>
            )}
            <div className="flex items-center gap-4 text-[14px] text-[#4f5a78] flex-wrap">
              <span className="inline-flex items-center gap-2"><span className="w-[22px] h-[3px] rounded-full" style={{ background: '#1360d2' }} />Sailed</span>
              <span className="inline-flex items-center gap-2"><span className="w-[22px] h-0 border-t-[3px] border-dashed" style={{ borderColor: '#1360d2' }} />Route ahead</span>
            </div>
            <Btn variant="secondary" onClick={onClose}>Close map</Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
