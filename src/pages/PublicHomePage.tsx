/* Public Dubai Trade website home, shown before login.
 * Only the home page is live in this prototype: the menu items, search and
 * "Read more" style links are shown for context but do nothing. "Login" goes to the login page. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import heroPoster from '../assets/background.jpg';

const CDN = 'https://dtcmsnew.cachefly.net/images';
const HERO_VIDEO = 'https://dubaitrade.cachefly.net/dt/cms/videos/your-success-is-our-achievement.mp4';

const NAV = ['Home', 'Explore', 'Service Center', 'Training', 'News & Announcements', 'Knowledge Hub'];

const ENTITIES = [
  { name: 'Dubai Trade', logo: `${CDN}/DT.png` },
  { name: 'DP World', logo: `${CDN}/DP_World_Logo.png` },
  { name: 'Dubai Customs', logo: `${CDN}/2026/02/18/Frame_1820547780.png` },
  { name: 'Dubai Ports Authority', logo: `${CDN}/Dubai-Ports-logo.png` },
  { name: 'Dubai Maritime Authority', logo: `${CDN}/dubai-maritime-logo.png` },
  { name: 'Trakhees', logo: `${CDN}/Trakhees-logo.png` },
  { name: 'Security', logo: `${CDN}/PCFC_Security3x.png` },
  { name: 'Jafza', logo: `${CDN}/2026/02/18/Jafza.png` },
];
const PERSONAS = [
  { name: 'Cargo Owner', logo: `${CDN}/explore/Cargo__Owner.png` },
  { name: 'Shipping Agent', logo: `${CDN}/explore/Shipping_Agent.png` },
  { name: 'Airline Agent', logo: `${CDN}/explore/Airline_Agent.png` },
  { name: 'Clearing Agent', logo: `${CDN}/explore/Clearing__Agents.png` },
  { name: 'Freight Forwarder', logo: `${CDN}/Freight_Forwarder.png` },
  { name: 'Haulier', logo: `${CDN}/explore/Haulier.png` },
  { name: 'Free Zone Company', logo: `${CDN}/explore/Freezone__company.png` },
];
const GROUPS = [
  { name: 'Registration', logo: `${CDN}/2026/02/Registraction.png` },
  { name: 'Letters, Reports & Certificates', logo: `${CDN}/2026/02/Reports.png` },
  { name: 'License and Permits', logo: `${CDN}/2026/02/18/Vector_3.png` },
  { name: 'Cargo Management', logo: `${CDN}/2026/02/18/CargoManagement.png` },
];

const DIFFERENT = [
  { title: 'Paperless Transactions', text: 'A paperless approach to trading operations and payments. Save time with hassle-free online procedures.', img: `${CDN}/What_Makes_Dubai_Trade_Different/paperless.jpg` },
  { title: 'Innovation & Advanced Processes', text: "Advanced technology and continuous improvement that keep Dubai the region's leading trade hub.", img: `${CDN}/What_Makes_Dubai_Trade_Different/innovation.jpg` },
  { title: 'Round-the-clock access', text: '24/7 access to over 700 e-services from key trade entities, in one seamless journey.', img: `${CDN}/What_Makes_Dubai_Trade_Different/clock-access.jpg` },
];

const STATS = [
  { value: '32', unit: 'Million', label: 'Physical visits eliminated', icon: `${CDN}/counter/user.png` },
  { value: '98', unit: 'Million', label: 'Paper documents saved', icon: `${CDN}/counter/document.png` },
  { value: '4', unit: 'K metric tonnes', label: 'CO2 emission saved', icon: `${CDN}/counter/emission.png` },
];

const NEWS = [
  { date: '16 Nov 2026', title: 'Jafza App Update | New Features Now Available', text: 'Manage Jafza services, get support and explore new business opportunities more easily in the latest app update.', tag: 'Jafza' },
  { date: '11 Nov 2026', title: 'Launch of Export Booking (BRN) and Gate Pass Services for Mina Hamriya', text: 'From 15 November 2026, Export Booking and Gate Pass services for Mina Hamriya move online on Dubai Trade.', tag: 'DP World' },
  { date: '06 Nov 2026', title: 'Online Submission and Clearance of Passenger Declarations', text: 'Mirsal 2 now supports submitting and clearing Passenger Declarations online, ahead of arrival or departure.', tag: 'Dubai Customs' },
];

const PARTNERS = [`${CDN}/our_patners/jafza_partner.png`, `${CDN}/our_patners/dubai_customs_partner.png`, `${CDN}/our_patners/dp_world_partner.png`];

const FOOTER = [
  { title: 'Channels', links: ['DubaiNow', 'Invest in Dubai', 'Visit Dubai', 'Dubai Justice', 'Dubai Transport', 'Dubai Trade', 'Build in Dubai'] },
  { title: 'Quick Links', links: ['Home', 'Explore', 'Service Center', 'Training', 'News & Announcements', 'Knowledge Hub'] },
  { title: 'Support', links: ['Complaints & Suggestions', 'Happiness Meter', 'Wizard Assistance', 'Knowledge Hub', 'Sitemap', 'Contact Us'] },
  { title: 'Legal', links: ['Terms and Conditions', 'Privacy Policy', 'DT Training Terms and Conditions', 'Client Services Code'] },
];

const NAVY = '#0e1b3d';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="relative inline-block text-[32px] sm:text-[40px] text-black pb-[13px]" style={{ fontWeight: 400, lineHeight: '48px' }}>
        {children}
        <span aria-hidden className="absolute left-0 bottom-[-5px] w-[164px] h-[2px]" style={{ background: '#dc3545' }} />
      </h2>
    </div>
  );
}

/* Shown for context only: in this prototype only the home page is live */
function Inert({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={`cursor-default ${className ?? ''}`} style={style}>{children}</span>;
}

export default function PublicHomePage() {
  const navigate = useNavigate();
  const [by, setBy] = useState<'entity' | 'persona' | 'group'>('entity');
  const tiles = by === 'entity' ? ENTITIES : by === 'persona' ? PERSONAS : GROUPS;

  return (
    <div className="min-h-screen" style={{ background: '#f6f8fc' }}>
      {/* Header */}
      <header className="sticky top-0 z-[50] bg-white" style={{ boxShadow: '0 2px 12px rgba(14,27,61,.08)' }}>
        <div className="max-w-[1186px] mx-auto h-[72px] px-4 flex items-center gap-6">
          <img src="https://dtcmsnew.cachefly.net/templates/dubai_trade/images/presets/preset1/logo.svg" alt="Government of Dubai" className="h-[40px] w-auto flex-shrink-0" />
          <nav aria-label="Main" className="hidden lg:flex items-center gap-1 flex-1 min-w-0">
            {NAV.map(n => n === 'Home'
              ? <span key={n} aria-current="page" className="h-[36px] px-4 rounded-full inline-flex items-center text-[15px] text-white" style={{ background: NAVY, fontWeight: 500 }}>{n}</span>
              : <Inert key={n} className="h-[36px] px-3 inline-flex items-center text-[15px] text-[#1b2240] whitespace-nowrap">{n}</Inert>)}
          </nav>
          <div className="flex items-center gap-4 ml-auto">
            <Inert className="hidden sm:inline-flex text-[#1b2240]" style={{}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Search"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            </Inert>
            <button type="button" onClick={() => navigate('/login')} className="h-[36px] px-3 rounded-full inline-flex items-center text-[15px] text-[#1b2240] whitespace-nowrap hover:bg-[#eef2f8] transition-colors" style={{ fontFamily: 'inherit', fontWeight: 400 }}>
              Login
            </button>
            <img src="https://www.dubaitrade.ae/images/dt.webp" alt="Dubai Trade" className="h-[30px] w-auto hidden sm:block" />
          </div>
        </div>
      </header>

      {/* Hero (sizes and type matched to dubaitrade.ae at 1440 wide) */}
      <section className="px-[14px] pt-[14px]">
        <div className="relative overflow-hidden rounded-[35px] flex items-start h-[520px] sm:h-[600px] lg:h-[682px]" style={{ background: NAVY }}>
          <video className="absolute inset-0 w-full h-full object-cover" src={HERO_VIDEO} poster={heroPoster} autoPlay muted loop playsInline aria-hidden />
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.17)' }} />
          <div className="relative w-full max-w-[1186px] mx-auto px-4 pt-12 sm:pt-[64px]">
            <h1 className="text-white text-[44px] sm:text-[68px] max-w-[450px]" style={{ fontWeight: 400, lineHeight: 1.17 }}>Welcome to Dubai Trade</h1>
            <p className="text-white text-[20px] sm:text-[24px] max-w-[450px] mt-2" style={{ lineHeight: 1.4 }}>UAE's Premier Digital Trade &amp; Logistics Platform</p>
            <div className="flex flex-col items-start gap-[29px] mt-4">
              <Inert className="rounded-full bg-white inline-flex items-center text-[20px] sm:text-[24px] text-black" style={{ padding: '10px 30px', lineHeight: '27px' }}>Explore our Services</Inert>
              <Inert className="rounded-full inline-flex items-center text-[20px] sm:text-[24px] text-white" style={{ background: '#000', padding: '11px 50px', lineHeight: '27px' }}>
                Products
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginLeft: '0.7em' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Inert>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1186px] mx-auto px-4">
        {/* Service Center (sizes matched to dubaitrade.ae) */}
        <section className="pt-16">
          <SectionTitle>Service Center</SectionTitle>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-[27px]">
            <div className="flex items-center gap-[11px]">
              <label className="h-[50px] w-[332px] max-w-full rounded-[50px] bg-white inline-flex items-center gap-[10px]" style={{ border: '0.5px solid #d1d5db', padding: '15px 20px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1b1b1f" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                <input disabled placeholder="Search by service name" aria-label="Search by service name" className="bg-transparent outline-none text-[17px] flex-1 min-w-0 placeholder:text-[#4f5a78]" />
              </label>
              <span aria-hidden className="w-px h-[34px]" style={{ background: '#d1d5db' }} />
              <Inert className="size-[50px] rounded-full inline-flex items-center justify-center" style={{ background: '#f0f5fc' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b1b1f" strokeWidth="2" strokeLinecap="round" aria-label="Filter"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
              </Inert>
            </div>
            <div role="tablist" aria-label="Browse services" className="inline-flex rounded-[30px] p-[4px] gap-[8px]" style={{ background: '#f0f5fc' }}>
              {([['entity', 'By Entity'], ['persona', 'By Persona'], ['group', 'By Group']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={by === id} onClick={() => setBy(id)}
                  className={`rounded-[50px] text-[16px] transition-all ${by === id ? 'bg-white text-black' : 'text-[#1b2240] hover:text-black'}`}
                  style={{ fontWeight: 500, padding: '9px 24px', lineHeight: '24px', boxShadow: by === id ? '0 1px 2px -2px #101828, 0 1px 3px rgba(16,24,40,.1)' : undefined }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[22px]">
            {tiles.map(t => (
              <div key={t.name} className="group relative bg-white rounded-[24px] h-[216px] p-6 flex flex-col items-center justify-center text-center transition-colors duration-500 hover:bg-[#eff6fe] cursor-default" style={{ border: '0.5px solid #d1d5db' }}>
                <div className="flex flex-col items-center gap-3 transition-transform duration-500 group-hover:-translate-y-4">
                  <img src={t.logo} alt={by === 'entity' ? t.name : ''} className="max-h-[100px] max-w-full object-contain" />
                  {by !== 'entity' && <span className="text-[20px] text-[#1b1b1f]" style={{ fontWeight: 500, lineHeight: '24px' }}>{t.name}</span>}
                </div>
                <span className="absolute left-0 right-0 bottom-6 inline-flex items-center justify-center gap-2 text-[17px] text-[#4f5a78] opacity-0 translate-y-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
                  View Services <span aria-hidden>→</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Inert className="h-[44px] px-7 rounded-full bg-white inline-flex items-center text-[16px] text-black" style={{ border: '0.5px solid #d1d5db', fontWeight: 500 }}>View All</Inert>
          </div>
        </section>

        {/* What makes Dubai Trade different */}
        <section className="pt-20">
          <SectionTitle>What Makes Dubai Trade Different</SectionTitle>
          <p className="text-[16px] text-[#40484f] -mt-4 mb-8 max-w-[900px]">Our featured services give you quick access to the tools people rely on every day, based on real user activity, so you find what you need faster.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DIFFERENT.map(d => (
              <article key={d.title} className="bg-white rounded-[20px] overflow-hidden border" style={{ borderColor: '#e6ebf3' }}>
                <img src={d.img} alt="" className="w-full h-[220px] object-cover" />
                <div className="p-5">
                  <h3 className="text-[20px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>{d.title}</h3>
                  <p className="text-[15px] text-[#40484f] mt-2 leading-relaxed">{d.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Inert className="h-[44px] px-7 rounded-full bg-white border inline-flex items-center text-[15px] text-[#0e1b3d]" style={{ borderColor: '#dfe5ef', fontWeight: 600 }}>Explore More</Inert>
          </div>
        </section>
      </main>

      {/* Sustainability */}
      <section className="bg-white mt-20">
        <div className="max-w-[1186px] mx-auto px-4 py-14 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-center">
          <h2 className="text-[28px] text-[#0e1b3d] leading-tight" style={{ fontWeight: 500 }}>Our Contribution to Sustainability</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STATS.map(s => (
              <div key={s.label}>
                <span className="size-[48px] rounded-full inline-flex items-center justify-center" style={{ background: '#eef2f8' }}><img src={s.icon} alt="" className="size-[24px] object-contain" /></span>
                <p className="text-[36px] sm:text-[40px] text-[#0e1b3d] mt-2 leading-none" style={{ fontWeight: 500 }}>{s.value} {s.unit}</p>
                <p className="text-[15px] text-[#4f5a78] mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-[1186px] mx-auto px-4">
        {/* News */}
        <section className="pt-20">
          <SectionTitle>What's Trending?</SectionTitle>
          <ul className="grid grid-cols-1">
            {NEWS.map(n => (
              <li key={n.title} className="py-6 border-b grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center" style={{ borderColor: '#e1e7f0' }}>
                <div className="min-w-0">
                  <p className="text-[14px] text-[#4f5a78]">{n.date}</p>
                  <h3 className="text-[20px] text-[#0e1b3d] mt-1" style={{ fontWeight: 600 }}>{n.title}</h3>
                  <p className="text-[15px] text-[#40484f] mt-1">{n.text}</p>
                </div>
                <span className="justify-self-start h-[28px] px-3 rounded-full inline-flex items-center text-[14px] text-[#1b2240]" style={{ background: '#e8edf6' }}>{n.tag}</span>
                <Inert className="justify-self-start h-[40px] px-5 rounded-full bg-white border inline-flex items-center text-[15px] text-[#0e1b3d]" style={{ borderColor: '#dfe5ef', fontWeight: 600 }}>Read more</Inert>
              </li>
            ))}
          </ul>
          <div className="flex justify-center mt-8">
            <Inert className="h-[44px] px-7 rounded-full bg-white border inline-flex items-center text-[15px] text-[#0e1b3d]" style={{ borderColor: '#dfe5ef', fontWeight: 600 }}>More News</Inert>
          </div>
        </section>

        {/* Trainings */}
        <section className="pt-16">
          <div className="rounded-[20px] overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] items-center" style={{ background: 'linear-gradient(110deg, #0e1b3d 0%, #1b3a7a 100%)' }}>
            <div className="p-8 sm:p-10">
              <h2 className="text-[26px] text-white" style={{ fontWeight: 500 }}>Internationally Recognised Trainings</h2>
              <p className="text-[16px] text-[#d6e0f5] mt-2 max-w-[720px]">Accredited trade and logistics trainings led by expert instructors, to help the trade community master end-to-end supply chain processes to global standards.</p>
              <Inert className="mt-5 h-[42px] px-6 rounded-full bg-white inline-flex items-center text-[15px] text-[#0e1b3d]" style={{ fontWeight: 600 }}>Explore Trainings</Inert>
            </div>
            <img src={`${CDN}/internationally-recognised-trainings.png`} alt="" className="hidden md:block w-full h-full max-h-[220px] object-contain p-4" />
          </div>
        </section>

        {/* Our Initiative */}
        <section className="pt-20">
          <SectionTitle>Our Initiative</SectionTitle>
          <div className="grid grid-cols-1 gap-6">
            {[
              { img: `${CDN}/all_product/trade-pay.jpg`, title: 'Access a highly secure and advanced digital platform trusted in the UAE.', text: 'TradePay is the payment gateway Dubai Trade customers trust for instant, secure payments across multiple channels.', extra: null },
              { img: `${CDN}/Manage_Your_Cargo/desktop_image.png`, title: 'Manage Your Cargo On the Move', text: 'Speed up cargo release, request and track delivery orders, make payments and more on the Dubai Trade App.', extra: 'app' },
              { img: `${CDN}/all_product/cargowaves_truck_og.png`, title: 'CargoWaves', text: 'A digital platform to advance and transform inland and container transportation.', extra: null },
            ].map(c => (
              <article key={c.title} className="bg-white rounded-[20px] border grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-6 p-4 items-center" style={{ borderColor: '#e6ebf3' }}>
                <img src={c.img} alt="" className="w-full h-[200px] object-cover rounded-[14px]" />
                <div className="pr-2">
                  <h3 className="text-[24px] text-[#0e1b3d] leading-snug" style={{ fontWeight: 500 }}>{c.title}</h3>
                  <p className="text-[16px] text-[#40484f] mt-2">{c.text}</p>
                  {c.extra === 'app' ? (
                    <div className="flex items-center gap-4 mt-4 flex-wrap">
                      <img src={`${CDN}/dt-qr-code/dt-mobile-qr-code.png`} alt="QR code to download the Dubai Trade app" className="size-[72px]" />
                      <span className="text-[14px] text-[#40484f]"><span className="block text-[#0e1b3d]" style={{ fontWeight: 600 }}>Scan to Download</span>Point your camera at the QR code</span>
                      <img src={`${CDN}/Manage_Your_Cargo/google_play.png`} alt="Get it on Google Play" className="h-[38px]" />
                      <img src={`${CDN}/Manage_Your_Cargo/app_store.png`} alt="Download on the App Store" className="h-[38px]" />
                    </div>
                  ) : (
                    <Inert className="mt-4 h-[40px] px-5 rounded-full bg-white border inline-flex items-center text-[15px] text-[#0e1b3d]" style={{ borderColor: '#dfe5ef', fontWeight: 600 }}>Read more</Inert>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Partners */}
        <section className="pt-20 pb-20">
          <SectionTitle>Our Partners</SectionTitle>
          <div className="bg-white rounded-[20px] border p-8 grid grid-cols-1 sm:grid-cols-3 gap-8 items-center justify-items-center" style={{ borderColor: '#e6ebf3' }}>
            {PARTNERS.map(p => <img key={p} src={p} alt="" className="max-h-[70px] max-w-[200px] object-contain" />)}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t" style={{ borderColor: '#e6ebf3' }}>
        <div className="max-w-[1186px] mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] gap-8">
          <div>
            <img src={`${CDN}/dt-logo.png`} alt="Dubai Trade" className="h-[40px] w-auto" />
            <p className="text-[14px] text-[#40484f] mt-4 max-w-[260px]">As premier trade facilitator in Dubai and the UAE, Dubai Trade brings over 700 e-services together under a single window.</p>
          </div>
          {FOOTER.map(col => (
            <div key={col.title}>
              <p className="text-[16px] text-[#0e1b3d] mb-3" style={{ fontWeight: 600 }}>{col.title}</p>
              <ul className="grid grid-cols-1 gap-2">
                {col.links.map(l => <li key={l}><Inert className="text-[14px] text-[#40484f]">{l}</Inert></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-[1186px] mx-auto px-4 py-5 border-t flex items-center justify-between gap-4 flex-wrap text-[14px] text-[#4f5a78]" style={{ borderColor: '#eef1f6' }}>
          <span>© 2026 Dubaitrade All Rights Reserved.</span>
          <span>Best with Chrome, Firefox, or Edge at 1920x1080.</span>
        </div>
      </footer>
    </div>
  );
}
