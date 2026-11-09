'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Gift, Coins, Check } from '@/components/ui/icons'
import { DailyRewardStrip } from '@/components/monetisation/DailyReward'
import LoginModal from '@/components/ui/LoginModal'
import { useDailyReward, useClaimReward } from '@/hooks'
import { useAuthStore } from '@/store/authStore'
import { useCoinStore } from '@/store'
import { track } from '@/lib/analytics'

const WAYS = [
  { title: 'Check in every day', sub: 'Coins grow through the week — day 7 pays the most' },
  { title: 'Invite friends', sub: 'You both get coins when they join', href: '/invite', cta: 'Invite' },
  { title: 'Buy a coin pack', sub: 'Unlock any episode instantly', href: '/coins', cta: 'Get coins' },
]

export default function RewardsPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const balance = useCoinStore(s => s.balance)
  const { data: reward } = useDailyReward()
  const claim = useClaimReward()
  const [loginOpen, setLoginOpen] = useState(false)

  const days = reward ? (reward.claimed_today ? ((reward.streak - 1) % 7) + 1 : reward.streak % 7) : 0
  const claimedToday = !!reward?.claimed_today

  const onCheckIn = () => {
    if (!isLoggedIn) { setLoginOpen(true); return }
    track('reward_check_in')
    claim.mutate()
  }

  return (
    <main className="min-h-screen bg-black pt-20 pb-28 md:pb-12">
      <div className="max-w-lg mx-auto px-5">
        {/* BALANCE */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-2xl">Rewards</h1>
            <p className="text-brand-subtle text-xs mt-1">Check in daily and earn coins for episodes</p>
          </div>
          <Link href="/coins" className="flex items-center gap-1.5 bg-white/10 rounded-full px-3.5 py-2 text-white text-sm font-bold">
            <Coins size={16} className="text-brand-gold" /> {isLoggedIn ? balance : 0}
          </Link>
        </div>

        {/* CHECK IN */}
        <div className="rounded-2xl border border-brand-border bg-gradient-to-b from-brand-red/15 to-brand-card p-5 mb-8">
          <p className="text-white font-bold text-base mb-4">
            {isLoggedIn ? `You've checked in for ${days} day${days === 1 ? '' : 's'}` : 'Sign in to start your check-in streak'}
          </p>
          <DailyRewardStrip reward={reward} />
          <button
            onClick={onCheckIn}
            disabled={claim.isPending || (isLoggedIn && claimedToday)}
            className="w-full btn-primary py-3 mt-5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {!isLoggedIn ? 'Sign in to check in'
              : claimedToday ? <><Check size={16} /> Checked in today — back tomorrow for +{reward?.next_reward ?? '…'}</>
              : claim.isPending ? 'Checking in…'
              : <><Gift size={16} /> Check in +{reward?.reward ?? ''}</>}
          </button>
        </div>

        {/* EARN MORE */}
        <h2 className="text-white font-bold text-lg mb-4">Earn rewards</h2>
        <div className="space-y-3">
          {WAYS.map(w => (
            <div key={w.title} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{w.title}</p>
                <p className="text-brand-subtle text-xs mt-0.5">{w.sub}</p>
              </div>
              {w.href && <Link href={w.href} className="flex-shrink-0 bg-brand-red text-white text-xs font-bold rounded-full px-4 py-2">{w.cta}</Link>}
            </div>
          ))}
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  )
}
