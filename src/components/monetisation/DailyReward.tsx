'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Gift, X, Check, Coins } from '@/components/ui/icons'
import { useDailyReward, useClaimReward } from '@/hooks'
import { useAuthStore } from '@/store/authStore'
import type { DailyRewardStatus } from '@/types'

const FALLBACK_SCHEDULE = [5, 5, 10, 10, 15, 15, 30]

/** Where the user sits in the 7-day cycle: how many days are ticked, and which slot is today */
function cyclePosition(r: DailyRewardStatus | undefined) {
  const streak = r?.streak ?? 0
  const claimedToday = !!r?.claimed_today
  const done = claimedToday ? ((streak - 1) % 7) + 1 : streak % 7
  const todayIdx = claimedToday ? done - 1 : done
  return { done, todayIdx, claimedToday }
}

/** 7-day strip: ticked days, today's slot highlighted, bigger days ahead */
export function DailyRewardStrip({ reward }: { reward: DailyRewardStatus | undefined }) {
  const schedule = reward?.schedule ?? FALLBACK_SCHEDULE
  const { done, todayIdx, claimedToday } = cyclePosition(reward)
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {schedule.map((coins, i) => {
        const ticked = i < done
        const today = i === todayIdx
        const big = i === 6
        return (
          <div
            key={i}
            className={`relative rounded-lg flex flex-col items-center justify-center py-2 border transition-colors ${
              today && !claimedToday ? 'bg-brand-red border-brand-red text-white shadow-glow-red'
              : ticked ? 'bg-brand-red/15 border-brand-red/40 text-brand-red'
              : big ? 'bg-brand-gold/10 border-brand-gold/40 text-brand-gold'
              : 'bg-brand-dark border-brand-border text-brand-muted'}`}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">Day {i + 1}</span>
            <span className="my-1 h-4 flex items-center">
              {ticked ? <Check size={14} weight="bold" /> : <Coins size={14} />}
            </span>
            <span className="text-[11px] font-black">+{coins}</span>
          </div>
        )
      })}
    </div>
  )
}

function DailyRewardDialog({ onClose }: { onClose: () => void }) {
  const { data: reward } = useDailyReward()
  const claim = useClaimReward()
  const [claimed, setClaimed] = useState<number | null>(null)
  const { claimedToday } = cyclePosition(reward)

  const doClaim = () => claim.mutate(undefined, { onSuccess: d => setClaimed(d.coins) })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm bg-brand-card border border-brand-border rounded-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="relative px-5 pt-6 pb-4 text-center bg-gradient-to-b from-brand-red/20 to-transparent">
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-brand-subtle hover:text-white"><X size={20} /></button>
          <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${claimed !== null ? 'bg-green-500/20 animate-scale-in' : 'bg-brand-red/20'}`}>
            {claimed !== null ? <Check size={30} weight="bold" className="text-green-400" /> : <Gift size={30} className="text-brand-red" />}
          </div>
          <h3 className="text-white font-bold text-lg">
            {claimed !== null ? `+${claimed} coins collected!` : claimedToday ? 'See you tomorrow' : 'Your daily reward is ready'}
          </h3>
          <p className="text-brand-subtle text-xs mt-1">
            {(reward?.streak ?? 0) > 0 && <>🔥 {reward!.streak}-day streak · </>}
            {claimed !== null || claimedToday
              ? `Come back tomorrow for +${reward?.next_reward ?? '…'}`
              : 'Check in every day — day 7 pays the most'}
          </p>
        </div>

        <div className="px-5 pb-5">
          <DailyRewardStrip reward={reward} />
          {claimed !== null || claimedToday ? (
            <button onClick={onClose} className="w-full btn-primary py-3 mt-4">Keep Watching</button>
          ) : (
            <button onClick={doClaim} disabled={!reward || claim.isPending} className="w-full btn-primary py-3 mt-4 disabled:opacity-60">
              {claim.isPending ? 'Collecting…' : `Collect +${reward?.reward ?? ''} Coins`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// One automatic prompt per (IST) day — the same calendar day the server uses
const SEEN_KEY = 'dq.dailyReward.prompted'
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

function readSeen() { try { return localStorage.getItem(SEEN_KEY) } catch { return null } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, istToday()) } catch { /* storage blocked */ } }

/**
 * Pops the daily reward on the home page once a day for signed-in users who
 * haven't collected yet. Never interrupts the player or other pages.
 */
export function DailyRewardPrompt() {
  const pathname = usePathname()
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const { data: reward } = useDailyReward()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pathname !== '/' || !isLoggedIn || !reward || reward.claimed_today) return
    if (readSeen() === istToday()) return
    const t = setTimeout(() => { markSeen(); setOpen(true) }, 1500)
    return () => clearTimeout(t)
  }, [pathname, isLoggedIn, reward])

  return open ? <DailyRewardDialog onClose={() => setOpen(false)} /> : null
}

/** Gift button for the navbar — red dot while today's reward is waiting */
export function DailyRewardButton({ onSignIn }: { onSignIn: () => void }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const { data: reward } = useDailyReward()
  const [open, setOpen] = useState(false)
  const waiting = !isLoggedIn || (reward && !reward.claimed_today)

  return (
    <>
      <button
        onClick={() => (isLoggedIn ? setOpen(true) : onSignIn())}
        aria-label="Daily reward"
        title={isLoggedIn ? 'Daily reward' : 'Sign in for daily coins'}
        className="relative p-2 text-white hover:text-brand-red transition-colors rounded-lg hover:bg-brand-card"
      >
        <Gift size={18} />
        {waiting && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-red ring-2 ring-brand-black animate-pulse" />}
      </button>
      {open && <DailyRewardDialog onClose={() => setOpen(false)} />}
    </>
  )
}
