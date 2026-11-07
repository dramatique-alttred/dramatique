'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Crown, Check, Play, Download, Gift, Film, Shield, Globe, Clock } from '@/components/ui/icons'
import type { AppIcon } from '@/components/ui/icons'
import { useAllSeries } from '@/hooks'
import { useUIStore } from '@/store/uiStore'
import { track } from '@/lib/analytics'

const PERKS: { icon: AppIcon; title: string; sub: string }[] = [
  { icon: Film,     title: 'Unlimited episodes',     sub: 'No coins needed, fresh dramas every week' },
  { icon: Play,     title: 'Ad-free viewing',        sub: 'Pure, uninterrupted emotion' },
  { icon: Clock,    title: 'Early access',           sub: 'Watch new series drops before everyone else' },
  { icon: Globe,    title: 'All languages unlocked', sub: 'Watch in your preferred language' },
  { icon: Shield,   title: 'HD streaming',           sub: 'On any device, anywhere' },
  { icon: Gift,     title: 'Daily member rewards',   sub: 'Extra coins and special drops' },
  { icon: Download, title: 'Offline download',       sub: 'Coming soon' },
]

const PLANS = [
  { id: 'monthly', label: 'Monthly Membership', inr: 950,  usd: 11.4, per: 'month', tag: '',                   detail: 'Billed every month' },
  { id: 'annual',  label: 'Annual Membership',  inr: 5700, usd: 68,   per: 'year',  tag: 'Only ₹475 / month', detail: 'Save 50% compared with monthly' },
]

export default function MemberPage() {
  const [plan, setPlan] = useState('annual')
  const [currency, setCurrency] = useState<'inr' | 'usd'>('inr')
  const showToast = useUIStore(s => s.showToast)
  const { data: series = [] } = useAllSeries()
  const current = PLANS.find(p => p.id === plan)!
  const price = (p: typeof PLANS[number]) => (currency === 'inr' ? `₹${p.inr.toLocaleString('en-IN')}` : `$${p.usd}`)
  const banner = series.slice(0, 4)

  return (
    <main className="min-h-screen bg-black pb-56 md:pb-12">
      {/* BANNER — a strip of posters fading into the page */}
      <div className="relative h-52 overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-4">
          {banner.map(s => (
            <div key={s.id} className="relative">
              <Image src={s.thumbnail_url} alt="" fill sizes="25vw" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="absolute left-0 right-0 bottom-3 px-5">
          <div className="max-w-lg mx-auto flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Crown size={20} weight="fill" className="text-yellow-400" />
                <h1 className="text-white font-bold text-xl">Join Membership</h1>
              </div>
              <p className="text-brand-subtle text-xs mt-1">Unlimited dramas. No interruptions.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-black/50 border border-white/15 rounded-md p-0.5 text-[11px]">
                <button onClick={() => setCurrency('inr')} className={`px-2.5 py-1 rounded font-bold ${currency === 'inr' ? 'bg-brand-red text-white' : 'text-brand-subtle'}`}>₹</button>
                <button onClick={() => setCurrency('usd')} className={`px-2.5 py-1 rounded font-bold ${currency === 'usd' ? 'bg-brand-red text-white' : 'text-brand-subtle'}`}>$</button>
              </div>
              <button onClick={() => showToast('No purchases to restore yet', 'info')} className="text-white text-xs font-semibold">Restore</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5">
        {/* PLANS */}
        <div className="space-y-3 mt-4 mb-8">
          {PLANS.map(p => {
            const on = plan === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`relative w-full flex items-stretch text-left rounded-lg overflow-hidden border transition-all ${on ? 'border-brand-red bg-brand-red/10' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}
              >
                {/* check column */}
                <span className={`w-14 flex items-center justify-center flex-shrink-0 ${on ? 'bg-brand-red' : 'bg-white/10'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center ${on ? 'bg-white' : 'border border-white/40'}`}>
                    <Check size={13} weight="bold" className={on ? 'text-brand-red' : 'text-white/40'} />
                  </span>
                </span>

                <span className="flex-1 min-w-0 px-4 py-3.5">
                  <span className="block text-white font-semibold text-sm">{p.label}</span>
                  <span className="block text-white font-black text-xl mt-0.5">
                    {price(p)}<span className="text-white/70 text-xs font-semibold">/{p.per}</span>
                  </span>
                  <span className="block text-brand-subtle text-[11px] mt-0.5">{p.detail}</span>
                  {p.tag && (
                    <span className="inline-block mt-2 text-[11px] font-semibold text-purple-200 border border-purple-300/50 rounded px-2 py-0.5">{p.tag}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* WHY JOIN */}
        <h2 className="text-white font-bold text-lg mb-4">Why Join?</h2>
        <div className="space-y-5">
          {PERKS.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-4">
              <Icon size={22} className="text-white flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{title}</p>
                <p className="text-brand-subtle text-xs mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — pinned above the bottom bar on phones */}
      <div className="fixed left-0 right-0 bottom-[3.9rem] md:static md:mt-8 z-40 px-5 pb-3 pt-6 md:pt-0 bg-gradient-to-t from-black via-black/95 to-transparent">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => track('join_membership_clicked', { plan })}
            className="w-full bg-brand-red hover:bg-red-600 active:scale-[0.99] transition rounded-full py-2.5 text-white"
          >
            <span className="block font-black text-base leading-tight">Join Now — {price(current)}/{current.per}</span>
            <span className="block text-[10px] text-white/75 leading-tight mt-0.5">Auto-renew · Cancel anytime</span>
          </button>
        </div>
      </div>
    </main>
  )
}
