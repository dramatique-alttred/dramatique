'use client'

import Link from 'next/link'
import { Instagram, Youtube, Facebook, TikTok, XTwitter, WhatsApp } from '@/components/ui/icons'

// Set NEXT_PUBLIC_SOCIAL_* in the environment to point these at the real profiles;
// until then they open each platform's home page.
const SOCIAL = [
  { label: 'Instagram', Icon: Instagram, href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://www.instagram.com/' },
  { label: 'YouTube', Icon: Youtube, href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || 'https://www.youtube.com/' },
  { label: 'Facebook', Icon: Facebook, href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || 'https://www.facebook.com/' },
  { label: 'TikTok', Icon: TikTok, href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || 'https://www.tiktok.com/' },
  { label: 'X', Icon: XTwitter, href: process.env.NEXT_PUBLIC_SOCIAL_X || 'https://x.com/' },
  { label: 'WhatsApp', Icon: WhatsApp, href: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP || 'https://www.whatsapp.com/' },
]

const LINKS = {
  Discover: [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/categories' },
    { label: 'New & Hot', href: '/new-hot' },
    { label: 'Blog', href: '/blog' },
  ],
  Account: [
    { label: 'My List', href: '/my-list' },
    { label: 'Watch History', href: '/history' },
    { label: 'Coins', href: '/coins' },
    { label: 'VIP Plans', href: '/vip' },
  ],
  Support: [
    { label: 'Help & FAQ', href: '/help' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Download App', href: '/download' },
    { label: 'Invite Friends', href: '/invite' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Refund Policy', href: '/refund' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-brand-dark border-t border-brand-border mt-16 pb-24 md:pb-0">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-12">

        {/* TOP ROW */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">

          {/* BRAND */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <img src="/logo.png" alt="Dramatique" className="h-12 w-auto object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement; if (f) f.style.display = 'block' }} />
              <div className="bg-brand-red px-2.5 py-1 rounded-md inline-block hidden">
                <span className="font-display text-white font-black text-xl tracking-tight leading-none block">DRAMA</span>
                <span className="font-display text-white font-black text-xl tracking-tight leading-none block -mt-1">TIQUE</span>
              </div>
            </div>
            <p className="text-brand-subtle text-sm leading-relaxed mb-4">
              Short dramas. Big emotions. Endless stories.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {SOCIAL.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Dramatique on ${label}`}
                  title={label}
                  className="w-10 h-10 rounded-full bg-brand-card border border-brand-border flex items-center justify-center text-brand-subtle hover:text-white hover:bg-brand-red hover:border-brand-red transition-colors"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* LINK COLUMNS */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-brand-subtle hover:text-white text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* DIVIDER */}
        <div className="border-t border-brand-border mb-6" />

        {/* BOTTOM ROW */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-brand-muted text-xs">
            © 2026 Dramatique. All rights reserved. Built by{' '}
            <a href="https://alttrednexxus.com" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:text-red-400 transition-colors">Alttred Nexxus</a>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-brand-muted hover:text-white text-xs transition-colors">Terms</Link>
            <Link href="/privacy" className="text-brand-muted hover:text-white text-xs transition-colors">Privacy</Link>
            <Link href="/refund" className="text-brand-muted hover:text-white text-xs transition-colors">Refund</Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-brand-muted text-xs">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
