import { Monitor, AppleLogo } from '@/components/ui/icons'
import InstallCard from '@/components/pwa/InstallCard'

export const metadata = { title: 'Get the App', description: 'Install Dramatique on your phone, tablet or desktop.' }

const FEATURES = [
  { icon: '📺', title: 'Watch Anywhere', desc: 'Stream on your phone, tablet, or desktop' },
  { icon: '🔔', title: 'New Episode Alerts', desc: 'Never miss a drop with push notifications' },
  { icon: '🌙', title: 'Dark Mode', desc: 'Easy on the eyes, day or night' },
  { icon: '🌍', title: '12 Languages', desc: 'Watch in your preferred language' },
  { icon: '⚡', title: 'Fast Loading', desc: 'Optimised for mobile data' },
  { icon: '🔒', title: 'Secure Payments', desc: 'Razorpay & Stripe protected' },
]

// Google Play's four-colour mark
function GooglePlayMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00A0FF" d="M3.6 2.3 13.4 12l-9.8 9.7c-.2-.2-.3-.5-.3-.9V3.2c0-.4.1-.7.3-.9z" />
      <path fill="#00E475" d="M3.6 2.3c.3-.2.7-.2 1.2.1l11.8 6.4-3.2 3.2z" />
      <path fill="#FFD500" d="m16.6 8.8 3.8 2.2c.8.5.8 1.5 0 2l-3.8 2.2-3.2-3.2z" />
      <path fill="#FF3A44" d="m13.4 12 3.2 3.2-11.8 6.4c-.5.3-.9.3-1.2.1z" />
    </svg>
  )
}

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-brand-black pt-20 pb-24 md:pb-12">
      <div className="max-w-2xl mx-auto px-5 md:px-8 text-center">

        {/* HEADER */}
        <div className="mb-10">
          <div className="bg-brand-red px-3 py-1.5 rounded-xl inline-block mb-5">
            <span className="font-display text-white font-black text-3xl tracking-tight leading-none block">DRAMA</span>
            <span className="font-display text-white font-black text-3xl tracking-tight leading-none block -mt-1">TIQUE</span>
          </div>
          <h1 className="text-white font-bold text-3xl mb-3">Get the App</h1>
          <p className="text-brand-subtle text-sm leading-relaxed max-w-sm mx-auto">
            Short dramas. Big emotions. Endless stories. Available on all your devices.
          </p>
        </div>

        {/* APP BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <button className="flex items-center gap-3 bg-white text-black font-bold px-6 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
            <AppleLogo size={30} weight="fill" className="text-black" />
            <div className="text-left">
              <p className="text-[10px] font-normal">Download on the</p>
              <p className="text-base font-black leading-tight">App Store</p>
            </div>
          </button>
          <button className="flex items-center gap-3 bg-white text-black font-bold px-6 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
            <GooglePlayMark size={28} />
            <div className="text-left">
              <p className="text-[10px] font-normal">Get it on</p>
              <p className="text-base font-black leading-tight">Google Play</p>
            </div>
          </button>
        </div>

        {/* COMING SOON NOTICE */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-10 inline-flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div className="text-left">
            <p className="text-white font-bold text-sm">Native App Coming Soon</p>
            <p className="text-brand-subtle text-xs">Meanwhile, use our web app — it works great on mobile!</p>
          </div>
        </div>

        {/* PWA SECTION */}
        <InstallCard />

        {/* FEATURES */}
        <h2 className="text-white font-bold text-xl mb-5">Why you'll love it</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-brand-card border border-brand-border rounded-xl p-4 text-left">
              <span className="text-2xl mb-2 block">{f.icon}</span>
              <p className="text-white font-bold text-xs mb-1">{f.title}</p>
              <p className="text-brand-subtle text-[10px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* WEB APP CTA */}
        <div className="border-t border-brand-border pt-8">
          <p className="text-brand-subtle text-sm mb-4">Don't want to wait? Use the web app now.</p>
          <a href="/" className="btn-primary px-8 py-3 inline-flex items-center gap-2">
            <Monitor size={16} /> Open Web App
          </a>
        </div>

      </div>
    </main>
  )
}
