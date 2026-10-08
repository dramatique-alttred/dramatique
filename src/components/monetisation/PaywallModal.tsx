'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Lock, Crown, ChevronRight, Loader2, Gift, Check, Play } from '@/components/ui/icons'
import { useCoinStore } from '@/store'
import { useAuthStore } from '@/store/authStore'
import { useDailyReward, useClaimReward } from '@/hooks'
import LoginModal from '@/components/ui/LoginModal'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  episodeNumber: number
  coinCost?: number
  seriesTitle?: string
  posterUrl?: string
  episodeTitle?: string
  /** Set when the previous episode just finished playing — the cliffhanger moment */
  justFinished?: boolean
  vipOnly?: boolean       // episode can't be bought with coins
  onUnlock?: () => void   // spend coins — server does the real debit
  unlocking?: boolean
  autoUnlock?: boolean
  onAutoUnlockChange?: (on: boolean) => void
}

const COIN_PACKS = [
  { id: 1, coins: 30,    price: '₹89',    badge: '' },
  { id: 2, coins: 100,   price: '₹285',   badge: '🔥 Popular' },
  { id: 3, coins: 350,   price: '₹950',   badge: '⭐ Best Value' },
  { id: 4, coins: 1200,  price: '₹2,850', badge: '' },
]

// First real sign-in pays a one-time welcome bonus (backend: auth welcome credit)
const WELCOME_COINS = 10

type View = 'main' | 'coins' | 'vip'

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ComingSoon() {
  return <p className="text-brand-subtle text-[11px] text-center mt-3">Payments are launching soon — collect free daily coins meanwhile.</p>
}

export default function PaywallModal({
  isOpen, onClose, episodeNumber, coinCost = 5, seriesTitle = 'this series', posterUrl, episodeTitle,
  justFinished = false, vipOnly = false, onUnlock, unlocking = false, autoUnlock = false, onAutoUnlockChange,
}: PaywallModalProps) {
  const [view, setView] = useState<View>('main')
  const [loginOpen, setLoginOpen] = useState(false)
  const userCoins = useCoinStore(s => s.balance)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const { data: reward } = useDailyReward()
  const claim = useClaimReward()

  if (!isOpen) return null
  const close = () => { setView('main'); onClose() }

  // ── VIP VIEW ──
  if (view === 'vip') {
    return (
      <Shell onClose={close}>
        <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-400/10 p-5 border-b border-brand-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-yellow-400" />
              <h3 className="text-white font-bold text-lg">Go VIP</h3>
            </div>
            <button onClick={() => setView('main')} aria-label="Back" className="text-brand-subtle hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-brand-subtle text-sm">Unlimited access to every episode</p>
        </div>
        <div className="p-5">
          <div className="space-y-2.5 mb-5">
            {['Unlimited episodes — no coins needed', 'Early access to new series', 'All languages unlocked'].map(perk => (
              <div key={perk} className="flex items-center gap-2.5 text-sm text-brand-text">
                <Check size={14} className="text-green-400 flex-shrink-0" />{perk}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="border border-brand-border rounded-xl p-3 text-center">
              <p className="text-white font-bold text-lg">₹950</p>
              <p className="text-brand-subtle text-xs">per month</p>
            </div>
            <div className="border-2 border-yellow-400/50 rounded-xl p-3 text-center bg-yellow-400/5 relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full">SAVE 50%</div>
              <p className="text-white font-bold text-lg">₹5,700</p>
              <p className="text-brand-subtle text-xs">per year</p>
            </div>
          </div>
          <button disabled className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
            <Crown size={16} /> Start VIP
          </button>
          <ComingSoon />
        </div>
      </Shell>
    )
  }

  // ── COIN SHOP VIEW ──
  if (view === 'coins') {
    return (
      <Shell onClose={close}>
        <div className="p-5 border-b border-brand-border flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">🪙 Coin Shop</h3>
          <button onClick={() => setView('main')} aria-label="Back" className="text-brand-subtle hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">
          <p className="text-brand-subtle text-sm mb-4">Your balance: <span className="text-white font-bold">{userCoins} coins</span></p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {COIN_PACKS.map(pack => (
              <div key={pack.id} className={`relative border rounded-xl p-3 text-center ${pack.badge ? 'border-brand-red/50 bg-brand-red/5' : 'border-brand-border'}`}>
                {pack.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-red text-white text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">{pack.badge}</div>
                )}
                <p className="text-white font-bold text-base">{pack.coins} coins</p>
                <p className="text-brand-red font-bold text-sm mt-1">{pack.price}</p>
              </div>
            ))}
          </div>
          <button disabled className="w-full btn-primary py-3 opacity-50 cursor-not-allowed">Continue to Payment</button>
          <ComingSoon />
        </div>
      </Shell>
    )
  }

  // ── MAIN: the cliffhanger ──
  const enough = userCoins >= coinCost
  const canCollect = isLoggedIn && reward && !reward.claimed_today
  const short = Math.max(0, coinCost - userCoins)

  return (
    <>
      <Shell onClose={close}>
        {/* Poster backdrop — keeps the story on screen at the decision point */}
        <div className="relative h-44 sm:h-48 overflow-hidden">
          {posterUrl && <Image src={posterUrl} alt="" fill className="object-cover scale-110 blur-[3px] brightness-75" sizes="384px" />}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-card via-brand-card/60 to-black/30" />
          <button onClick={close} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/80 hover:text-white"><X size={18} /></button>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            {justFinished && (
              <span className="inline-flex items-center gap-1 bg-brand-red text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded mb-2">
                Episode {episodeNumber - 1} just ended
              </span>
            )}
            <h3 className="text-white font-bold text-xl leading-tight">
              {justFinished ? `What happens in Episode ${episodeNumber}?` : `Episode ${episodeNumber} is locked`}
            </h3>
            <p className="text-brand-subtle text-xs mt-1 truncate">
              {seriesTitle}{episodeTitle && episodeTitle !== `Episode ${episodeNumber}` ? ` · ${episodeTitle}` : ''}
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 flex flex-col gap-3">
          {vipOnly ? (
            <p className="text-brand-subtle text-sm text-center">This episode is exclusive to VIP members.</p>
          ) : (
            <>
              {/* Balance */}
              <div className="flex items-center justify-between text-sm bg-brand-dark border border-brand-border rounded-xl px-3.5 py-2.5">
                <span className="text-brand-subtle">🪙 Balance <span className="text-white font-bold ml-1">{userCoins}</span></span>
                <span className="text-brand-subtle text-xs">Unlock: <span className="text-brand-gold font-bold">{coinCost}</span></span>
              </div>

              {enough ? (
                <>
                  <button onClick={onUnlock} disabled={unlocking} className="w-full bg-brand-red hover:bg-brand-redHover disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-glow-red active:scale-[0.98]">
                    {unlocking ? <><Loader2 size={16} className="animate-spin" /> Unlocking…</> : <><Play size={16} fill="white" /> Unlock &amp; Watch · {coinCost} coins</>}
                  </button>
                  {onAutoUnlockChange && (
                    <label className="flex items-center gap-2.5 text-xs text-brand-text cursor-pointer select-none">
                      <input type="checkbox" checked={autoUnlock} onChange={e => onAutoUnlockChange(e.target.checked)} className="w-4 h-4 accent-brand-red" />
                      Auto-unlock the next episodes with coins
                    </label>
                  )}
                </>
              ) : !isLoggedIn ? (
                // Guests: the welcome bonus is the fastest route past the lock
                <button onClick={() => setLoginOpen(true)} className="w-full bg-brand-red hover:bg-brand-redHover text-white font-bold py-3.5 rounded-xl transition-colors flex flex-col items-center justify-center shadow-glow-red active:scale-[0.98]">
                  <span className="flex items-center gap-2"><Gift size={16} /> Sign in — get {WELCOME_COINS} free coins</span>
                  {WELCOME_COINS + userCoins >= coinCost && <span className="text-[11px] font-medium text-white/80 mt-0.5">Enough to unlock this episode</span>}
                </button>
              ) : canCollect ? (
                <button onClick={() => claim.mutate()} disabled={claim.isPending} className="w-full bg-brand-red hover:bg-brand-redHover disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-glow-red active:scale-[0.98]">
                  {claim.isPending ? <><Loader2 size={16} className="animate-spin" /> Collecting…</> : <><Gift size={16} /> Collect today&apos;s +{reward!.reward} free coins</>}
                </button>
              ) : (
                <button onClick={() => setView('coins')} className="w-full bg-brand-red hover:bg-brand-redHover text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  🪙 Get {short} more coins <ChevronRight size={16} />
                </button>
              )}
              {!enough && isLoggedIn && !canCollect && reward && (
                <p className="text-brand-subtle text-[11px] text-center -mt-1">Tomorrow&apos;s check-in pays +{reward.next_reward} coins</p>
              )}
            </>
          )}

          <button onClick={() => setView('vip')} className="w-full border border-yellow-400/40 hover:border-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10 text-yellow-400 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Crown size={16} /> Go VIP — Unlimited Access
          </button>
          <p className="text-brand-muted text-[10px] text-center flex items-center justify-center gap-1"><Lock size={9} /> Unlocked episodes stay yours forever</p>
        </div>
      </Shell>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  )
}
