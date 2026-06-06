'use client'

import { useState } from 'react'
import type { MissionPlan } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import { PREMIUM_COST_USDC, type RiskScore } from '@/lib/x402/payment'
import { requestPremium } from '@/lib/x402/client'
import { COST_LABELS } from '@/lib/mission/costTerms'

export interface PremiumGateProps {
  plan: MissionPlan
  /** Remaining mission budget (USDC). The premium spend is bound to it (R1). */
  remainingUsdc?: number
  onEvents: (events: TimelineEvent[]) => void
  /** Debit the shared mission budget ledger by the premium cost. */
  onPaid: (costUsdc: number) => void
  /** Unlock the panels' Broadcast button once the risk check clears. */
  onUnlocked: () => void
}

const RATING_CLASS: Record<RiskScore['rating'], string> = {
  low: 'text-emerald-300',
  medium: 'text-amber-300',
  high: 'text-red-300',
}

/**
 * Gates the real on-chain send behind a simulated x402 premium payment: the agent
 * buys a fraud/risk score for the planned payment before funds can move. Renders
 * only when the plan flags `premiumToolRequired`; emits the three premium timeline
 * events through onEvents, debits the budget via onPaid, and reports onUnlocked so
 * the panels enable Broadcast. The handshake is simulated — no second on-chain send.
 */
export function PremiumGate({ plan, remainingUsdc, onEvents, onPaid, onUnlocked }: PremiumGateProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)

  const unlocked = riskScore !== null
  const overBudget = remainingUsdc !== undefined && Number(PREMIUM_COST_USDC) > remainingUsdc

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const outcome = await requestPremium({ plan, remainingUsdc })
      // Emit whatever steps completed, even on failure, so partial progress shows.
      if (outcome.events.length) onEvents(outcome.events)
      if (outcome.ok && outcome.riskScore && outcome.costUsdc) {
        setRiskScore(outcome.riskScore)
        setResultId(outcome.resultId ?? null)
        onPaid(Number(outcome.costUsdc))
        onUnlocked()
      } else {
        setError(outcome.error ?? 'premium risk check failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Premium risk check</h2>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          x402 · simulated
        </span>
      </div>

      <p className="text-xs leading-5 text-zinc-400">
        Before any funds move, the agent pays for a fraud/risk score through the x402 challenge
        handshake. The payment is a simulated handshake — not a real on-chain settlement — and gates the
        Broadcast button.
      </p>

      <p className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px] leading-5 text-zinc-400">
        {COST_LABELS.premiumFee} (x402):{' '}
        <span className="font-mono text-zinc-200">{PREMIUM_COST_USDC} USDC</span> · simulated handshake, not a
        real on-chain settlement — debited from mission budget on unlock.
      </p>

      {!unlocked ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={run}
            disabled={busy || overBudget}
            className="self-start rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {busy ? 'Running risk check…' : 'Run premium risk check'}
          </button>
          {overBudget && (
            <p className="text-[11px] leading-4 text-red-300">
              Premium cost exceeds the remaining mission budget — raise the budget or re-plan.
            </p>
          )}
        </div>
      ) : (
        <span className="self-start rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-300">
          Premium unlocked ✓
        </span>
      )}

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {riskScore && (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Risk score</span>
            <span className={`font-mono text-lg font-semibold ${RATING_CLASS[riskScore.rating]}`}>
              {riskScore.score}
              <span className="ml-1.5 text-xs uppercase">{riskScore.rating}</span>
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {riskScore.flags.map((flag, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-4 text-zinc-400">
                <span className="text-zinc-600">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
          {resultId && <p className="font-mono text-[11px] text-zinc-600">result {resultId}</p>}
        </div>
      )}
    </div>
  )
}
