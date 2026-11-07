'use client'

import { useState } from 'react'
import { Crown, Check, Play, Download, Gift, Film, Shield, Globe, Clock } from '@/components/ui/icons'
import type { AppIcon } from '@/components/ui/icons'

const PERKS: { icon: AppIcon; title: string; sub: string }[] = [
  { icon: Film,     title: 'Unlimited episodes',     sub: 'No coins needed, fresh dramas every week' },
  { icon: Play,     title: 'Ad-free viewing',        sub: 'Pure, uninterrupted emotion' },
  { icon: Clock,    title: 'Early access',           sub: 'Watch new series drops before everyone else' },
  { icon: Globe,    title: 'All languages unlocked', sub: 'Watch in your preferred language' },
  { icon: Shield,   title: 'HD streaming',           sub: 'On any device, anywhere' },
  { icon: Gift,     title: 'Members-only perks',     sub: 'Daily rewards and special drops' },
  { icon: Download, title: 'Offline download',       sub: 'Coming soon' },
]

const PLANS = [
  { id: 'monthly', label: 'Monthly Membership', price_inr: 950,  price_usd: 11.4, per: 'month', badge: '',         note: 'Billed every month' },
  { id: 'annual',  label: 'Annual Membership',  price_inr: 5700, price_usd: 68,   per: 'year',  badge: 'SAVE 50%', note: '≈ ₹475 / month' },
]

export default function MemberPage() {
  const [plan, setPlan] = useState('annual')
  const [currency, setCurrency] = useState<'inr' | 'usd'>('inr')
  const current = PLANS.find(p => p.id === plan)!
  const price = (p: typeof PLANS[number]) => (currency === 'inr' ? `₹${p.price_inr.toLocaleString('en-IN')}` : `$${p.price_usd}`)

  return (
    <main className="min-h-screen bg-brand-black pt-20 pb-52 md:pb-12">
      <div className="max-w-lg mx-auto px-5 md:px-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-yellow-400/15 flex items-center justify-center">
              <Crown size={24} className="text-yellow-400" weight="fill" />
            </div>
            <div>
              <h1 className="text-white font-bold text-2xl leading-tight">Join Membership</h1>
              <p className="text-brand-subtle text-xs">Unlimited dramas. No interruptions.</p>
            </div>
          </div>
          <div className="flex bg-brand-card border border-brand-border rounded-lg p-0.5 text-xs">
            <button onClick={() => setCurrency('inr')} className={`px-3 py-1.5 rounded-md font-bold transition-all ${currency === 'inr' ? 'bg-brand-red text-white' : 'text-brand-subtle hover:text-white'}`}>₹</button>
            <button onClick={() => setCurrency('usd')} className={`px-3 py-1.5 rounded-md font-bold transition-all ${currency === 'usd' ? 'bg-brand-red text-white' : 'text-brand-subtle hover:text-white'}`}>$</button>
          </div>
        </div>

        {/* PLANS */}
        <div className="space-y-3 mb-8">
          {PLANS.map(p => {
            const on = plan === p.id
            return (
              <button key={p.id} onClick={() => setPlan(p.id)}
                className={`relative w-full flex items-center gap-4 text-left rounded-xl border-2 p-4 transition-all ${on ? 'border-brand-red bg-brand-red/10' : 'border-brand-border bg-brand-card hover:border-brand-muted'}`}>
                {p.badge && (
                  <span className="absolute -top-2.5 right-3 bg-yellow-400 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full">{p.badge}</span>
                )}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${on ? 'bg-brand-red border-brand-red' : 'border-brand-muted'}`}>
                  {on && <Check size={13} className="text-white" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-white font-bold text-sm">{p.label}</span>
                  <span className="block text-brand-subtle text-xs mt-0.5">{p.note}</span>
                </span>
                <span className="text-right">
                  <span className="block text-white font-black text-xl">{price(p)}</span>
                  <span className="block text-brand-subtle text-[11px]">per {p.per}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* WHY JOIN */}
        <h2 className="text-white font-bold text-lg mb-4">Why Join?</h2>
        <div className="space-y-4 mb-8">
          {PERKS.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-brand-text" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{title}</p>
                <p className="text-brand-subtle text-xs mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — pinned above the bottom bar on phones */}
        <div className="fixed left-0 right-0 bottom-[3.9rem] md:static z-40 px-5 pb-3 pt-6 md:p-0 bg-gradient-to-t from-brand-black via-brand-black/95 to-transparent">
          <div className="max-w-lg mx-auto">
            <button className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-3.5 rounded-full transition-colors text-base">
              Join Now — {price(current)}/{current.per}
            </button>
            <p className="text-brand-muted text-[10px] text-center mt-2">Auto-renews · Cancel anytime · Secure payment</p>
          </div>
        </div>

      </div>
    </main>
  )
}
