import { Prisma, CoinTransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma'

type Tx = Prisma.TransactionClient

export class InsufficientCoinsError extends Error {
  constructor(public needed: number, public balance: number) {
    super('Insufficient coins')
  }
}

interface LedgerEntry {
  userId: string
  amount: number // positive = credit, negative = debit
  type: CoinTransactionType
  description?: string
  referenceId?: string
  // Unique per logical event (e.g. `welcome:<userId>`) — a retry with the same
  // key fails on the unique index instead of paying twice
  idempotencyKey?: string
}

/**
 * The ONLY way coins move. Must run inside a transaction together with
 * whatever the coins are paying for, so a failure rolls both back.
 * Debits use a conditional update (balance >= cost) so two concurrent
 * spends can never push the balance below zero.
 */
export async function applyLedgerEntry(tx: Tx, entry: LedgerEntry): Promise<number> {
  const { userId, amount } = entry

  if (amount < 0) {
    const debited = await tx.coinWallet.updateMany({
      where: { userId, balance: { gte: -amount } },
      data: { balance: { decrement: -amount } },
    })
    if (debited.count === 0) {
      const wallet = await tx.coinWallet.findUnique({ where: { userId } })
      throw new InsufficientCoinsError(-amount, wallet?.balance ?? 0)
    }
  } else {
    await tx.coinWallet.upsert({
      where: { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount },
    })
  }

  const wallet = await tx.coinWallet.findUniqueOrThrow({ where: { userId } })
  await tx.coinTransaction.create({
    data: {
      userId,
      amount,
      balanceAfter: wallet.balance,
      type: entry.type,
      description: entry.description,
      referenceId: entry.referenceId,
      idempotencyKey: entry.idempotencyKey,
    },
  })
  return wallet.balance
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

/** Reads a tunable number from app_settings, falling back to a default */
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return typeof row?.value === 'number' ? row.value : fallback
}

/**
 * +N coins the first time a user has a real (non-guest) account. Safe to call
 * on every login — the idempotency key makes repeats a no-op.
 */
export async function grantWelcomeBonus(userId: string): Promise<boolean> {
  const amount = await getNumberSetting('coins.welcome_bonus', 10)
  if (amount <= 0) return false
  try {
    await prisma.$transaction(tx => applyLedgerEntry(tx, {
      userId, amount, type: 'WELCOME_BONUS', description: 'Welcome bonus', idempotencyKey: `welcome:${userId}`,
    }))
    return true
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}
