'use client'

import { Receipt } from '@/components/ui/icons'
import { useTransactions } from '@/hooks'
import EmptyState from '@/components/ui/EmptyState'
import type { CoinTransaction } from '@/types'

const TYPE_META: Record<CoinTransaction['type'], { icon: string; label: string }> = {
  PURCHASE:         { icon: '💳', label: 'Purchase' },
  EPISODE_UNLOCK:   { icon: '🔓', label: 'Unlock' },
  DAILY_REWARD:     { icon: '🎁', label: 'Reward' },
  REFERRAL_BONUS:   { icon: '👥', label: 'Referral' },
  WELCOME_BONUS:    { icon: '🎉', label: 'Welcome bonus' },
  AD_REWARD:        { icon: '📺', label: 'Ad reward' },
  ADMIN_ADJUSTMENT: { icon: '🛠️', label: 'Adjustment' },
  REFUND:           { icon: '↩️', label: 'Refund' },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions()

  return (
    <main className="min-h-screen bg-brand-black pt-20 pb-24 md:pb-12">
      <div className="max-w-2xl mx-auto px-5 md:px-8">
        <div className="flex items-center gap-3 mb-8">
          <Receipt size={24} className="text-brand-red" />
          <h1 className="text-white font-bold text-3xl">Transaction History</h1>
        </div>

        {!isLoading && transactions.length === 0 ? (
          <EmptyState icon="🪙" title="No transactions yet" description="Coins you earn, buy or spend on episodes will show up here." actionLabel="Start Watching" actionHref="/" />
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map(txn => {
              const meta = TYPE_META[txn.type] ?? { icon: '🪙', label: txn.type }
              return (
                <div key={txn.id} className="flex items-center gap-4 bg-brand-card border border-brand-border rounded-xl px-4 py-3.5 hover:border-brand-muted transition-colors">
                  <div className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center text-xl flex-shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{txn.description || meta.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-brand-subtle text-xs">{formatDate(txn.created_at)}</p>
                      <span className="text-brand-border">·</span>
                      <p className="text-brand-subtle text-xs">{meta.label}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-sm ${txn.amount > 0 ? 'text-green-400' : 'text-brand-red'}`}>
                      {txn.amount > 0 ? `+${txn.amount}` : txn.amount} 🪙
                    </p>
                    <p className="text-brand-subtle text-[10px] mt-0.5">Balance {txn.balance_after}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
