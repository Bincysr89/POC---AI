/* Documents on an import case: list + viewer.
 * Shows every document attached to the case — uploaded by the user or fetched
 * from the shipping line — with a preview and the fields the agents read. */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACTIVE, COMPANY, SAMPLE_DOCS } from './data';
import { Btn, C, Icon, Pill } from './ui';

export type CaseDoc = { name: string; type: string; source: string; status: 'read' | 'missing'; fields?: number };

const ABBR: Record<string, string> = { 'Bill of lading': 'BL', 'Commercial invoice': 'CI', 'Packing list': 'PL', 'Certificate of origin': 'COO', 'Cargo manifest': 'MAN' };

export function docFields(type: string, n: number): [string, string][] {
  switch (type) {
    case 'Bill of lading': return [['BL number', ACTIVE.c.bl], ['Shipper', 'Sinopower Electric Co., Shanghai'], ['Consignee', COMPANY], ['Vessel / voyage', ACTIVE.c.vessel], ['Port of loading', 'Shanghai, CN'], ['Port of discharge', 'Jebel Ali, AE'], ['Containers', `${n} × 40' HC`]];
    case 'Commercial invoice': return [['Invoice number', 'INV-0931'], ['Seller', 'Sinopower Electric Co.'], ['Buyer', COMPANY], ['Incoterm', 'CFR Jebel Ali'], ['Goods lines', '3 · HS 2106.90, 8525.89, 8504.40'], ['Total value', 'USD 112,350.00']];
    case 'Packing list': return [['Packages', '3,780 packages'], ['Gross weight', '48,600 kg'], ['Net weight', '45,920 kg'], ['Containers', String(n)]];
    case 'Certificate of origin': return [['Certificate number', 'CCPIT-27-118220'], ['Country of origin', 'China'], ['Issued by', 'CCPIT Shanghai'], ['Goods', 'As per invoice INV-0931']];
    default: return [['Manifest number', ACTIVE.c.manifest], ['Vessel', ACTIVE.c.vessel], ['Containers', String(n)], ['Cargo', 'Food preparations, CCTV cameras, power supplies'], ['HS codes (from shipper)', '2106.90 · 8525.89 · 8504.40']];
  }
}

/* Documents for a case, by how it was started */
export function caseDocs(source: 'documents' | 'containers', files: string[] | undefined, extra: Record<string, string>): CaseDoc[] {
  if (source === 'containers') {
    return [
      { name: `BL_${ACTIVE.c.bl} (e-BL)`, type: 'Bill of lading', source: `Fetched from ${ACTIVE.c.line}`, status: 'read', fields: 18 },
      { name: `Manifest ${ACTIVE.c.manifest}`, type: 'Cargo manifest', source: `Fetched from ${ACTIVE.c.line}`, status: 'read', fields: 14 },
      ...(['Commercial invoice', 'Packing list'] as const).map(t => extra[t]
        ? { name: extra[t], type: t, source: 'Uploaded by you', status: 'read' as const, fields: t === 'Commercial invoice' ? 21 : 24 }
        : { name: 'Not uploaded yet', type: t, source: 'Needed before the declaration is filed', status: 'missing' as const }),
    ];
  }
  const names = files?.length ? files : SAMPLE_DOCS.map(d => d.name);
  return names.map((name, i) => {
    const d = SAMPLE_DOCS[i % SAMPLE_DOCS.length];
    return { name, type: d.type, source: 'Uploaded by you', status: 'read', fields: d.fields };
  });
}

export function DocTile({ doc, onView, onUpload }: { doc: CaseDoc; onView: () => void; onUpload?: () => void }) {
  const missing = doc.status === 'missing';
  return (
    <div className="flex items-center gap-3 rounded-[12px] px-3 py-[10px] border min-w-0" style={{ borderColor: missing ? '#f2d98a' : '#e3e8f3', background: missing ? '#fffbef' : '#fff' }}>
      <span className="w-[48px] h-[40px] rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: '#eef4ff', color: C.blue, fontWeight: 700 }}>{ABBR[doc.type] ?? 'DOC'}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-[#111838] truncate" style={{ fontWeight: 600 }}>{doc.type}</span>
        <span className="block text-[14px] text-[#4f5a78] truncate">{missing ? doc.source : `${doc.name} · ${doc.source}`}</span>
      </span>
      {missing
        ? <Btn size="sm" variant="secondary" icon="upload" onClick={onUpload}>Upload</Btn>
        : <Btn size="sm" variant="ghost" icon="eye" onClick={onView}>View</Btn>}
    </div>
  );
}

export function DocViewer({ doc, containers, onClose }: { doc: CaseDoc; containers: number; onClose: () => void }) {
  const fields = docFields(doc.type, containers);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${doc.type} preview`}>
      <div className="absolute inset-0 bg-[#0e1b3d]/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] w-full max-w-[980px] max-h-[88vh] overflow-hidden flex flex-col" style={{ boxShadow: '0 30px 80px -20px rgba(14,27,61,.5)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: '#e6ebf3' }}>
          <div className="min-w-0">
            <p className="text-[18px] text-[#111838] truncate" style={{ fontWeight: 600 }}>{doc.type}</p>
            <p className="text-[14px] text-[#4f5a78] truncate">{doc.name} · {doc.source}</p>
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" icon="doc">Download</Btn>
            <button type="button" onClick={onClose} aria-label="Close preview" className="size-[38px] rounded-full flex items-center justify-center hover:bg-[#f0f5fc] text-[#0e1b3d]"><Icon name="x" size={18} /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] gap-0 overflow-auto">
          {/* Page preview */}
          <div className="p-5" style={{ background: '#eef2f8' }}>
            <div className="bg-white rounded-[6px] mx-auto max-w-[520px] p-6" style={{ boxShadow: '0 8px 24px -12px rgba(14,27,61,.3)', minHeight: 520 }}>
              <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: '#e6ebf3' }}>
                <span className="text-[16px] text-[#111838]" style={{ fontWeight: 700 }}>{doc.type}</span>
                <span className="text-[14px] text-[#4f5a78]">Page 1 of 2</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {fields.map(([k, v]) => (
                  <div key={k} className="rounded-[6px] px-3 py-2" style={{ background: 'rgba(19,96,210,.06)', border: '1px dashed rgba(19,96,210,.45)' }}>
                    <p className="text-[14px] text-[#4f5a78]">{k}</p>
                    <p className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{v}</p>
                  </div>
                ))}
                {Array.from({ length: 5 }, (_, i) => <span key={i} className="block h-[10px] rounded-full bg-[#eef1f6]" style={{ width: `${92 - i * 11}%` }} />)}
              </div>
            </div>
            <p className="text-[14px] text-[#4f5a78] text-center mt-3">Blue boxes show where each field was read</p>
          </div>
          {/* Extracted fields */}
          <div className="p-5 border-t md:border-t-0 md:border-l" style={{ borderColor: '#e6ebf3' }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[16px] text-[#111838]" style={{ fontWeight: 600 }}>Fields read by the agent</p>
              <Pill tone="done">{doc.fields ?? fields.length} fields</Pill>
            </div>
            <dl className="grid grid-cols-1 gap-3">
              {fields.map(([k, v]) => (
                <div key={k} className="border-b pb-2" style={{ borderColor: '#eef1f6' }}>
                  <dt className="text-[14px] text-[#4f5a78]">{k}</dt>
                  <dd className="text-[14px] text-[#111838]" style={{ fontWeight: 600 }}>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[14px] text-[#4f5a78] mt-4 flex items-start gap-2"><Icon name="shield" size={15} className="mt-[3px] text-[#1360d2]" />Stored with your case record in the UAE.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* Section used inside the import journey */
export function CaseDocuments({ source, files, containers, extra, onUpload, hideTitle }: { source: 'documents' | 'containers'; files?: string[]; containers: number; extra: Record<string, string>; onUpload: (type: string) => void; hideTitle?: boolean }) {
  const [view, setView] = useState<CaseDoc | null>(null);
  const docs = caseDocs(source, files, extra);
  const missing = docs.filter(d => d.status === 'missing').length;
  return (
    <>
      {!hideTitle && <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <p className="text-[16px] text-[#111838]" style={{ fontWeight: 600 }}>Documents on this case <span className="text-[#4f5a78]" style={{ fontWeight: 500 }}>· {docs.length - missing} of {docs.length}</span></p>
        {missing > 0 && <span className="text-[14px] text-[#8a5a00]">Upload the rest anytime; the declaration agent asks before filing.</span>}
      </div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {docs.map(d => (
          <DocTile key={d.type + d.name} doc={d} onView={() => setView(d)}
            onUpload={() => onUpload(d.type)} />
        ))}
      </div>
      {view && <DocViewer doc={view} containers={containers} onClose={() => setView(null)} />}
    </>
  );
}
