'use client'

import { useState } from 'react'
import type { MissionPlan } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import { COST_LABELS } from '@/lib/mission/costTerms'
import { ADDRESS_RE, explorerTxUrl, shorten, type ExecuteResponse } from './executeResult'
import { CostBreakdown } from './CostBreakdown'

export interface MissionExecutePanelProps {
  plan: MissionPlan
  onEvents: (events: TimelineEvent[]) => void
  /** Fired once per confirmed on-chain broadcast with the committed USDC (transfer + relayer fee). */
  onBroadcastSuccess?: (spentUsdc: number) => void
  onResult?: (result: ExecuteResponse) => void
  /** When true, the real send is gated behind the premium risk check. Dry run stays available. */
  broadcastBlocked?: boolean
  /** Premium (x402) fee to surface in the cost breakdown; set only when the plan requires it. */
  premiumFeeUsdc?: string
  /** Whether the premium fee has already committed (risk check unlocked). */
  premiumPaid?: boolean
}

export function MissionExecutePanel({
  plan,
  onEvents,
  onBroadcastSuccess,
  onResult,
  broadcastBlocked,
  premiumFeeUsdc,
  premiumPaid,
}: MissionExecutePanelProps) {
  const [recipient, setRecipient] = useState('')
  // Pre-fill the execution amount with the mission's planned spend so a blank
  // field never silently falls back to a demo stub. Editable + overridable.
  const [amountUsdc, setAmountUsdc] = useState(plan.maxSpendUsdc)
  const [busy, setBusy] = useState<null | 'estimate' | 'broadcast'>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExecuteResponse | null>(null)

  // Re-plan → re-pin the amount to the new mission spend and drop any stale
  // estimate. React's recommended way to adjust state on a prop change is during
  // render with a previous-value guard, not a setState-in-effect:
  // https://react.dev/learn/you-might-not-need-an-effect
  const [syncedPlanAmount, setSyncedPlanAmount] = useState(plan.maxSpendUsdc)
  if (plan.maxSpendUsdc !== syncedPlanAmount) {
    setSyncedPlanAmount(plan.maxSpendUsdc)
    setAmountUsdc(plan.maxSpendUsdc)
    setResult(null)
    setError(null)
  }

  const recipientTrimmed = recipient.trim()
  const recipientValid = recipientTrimmed === '' || ADDRESS_RE.test(recipientTrimmed)

  // Amount vs. the planned spend. The server caps work at plan.maxSpendUsdc
  // (execute.ts), so flag an over-budget value before the round-trip and make a
  // within-budget override explicit (changeAmount already forces a re-estimate).
  const planAmount = plan.maxSpendUsdc
  const amountTrimmed = amountUsdc.trim()
  const amountBlank = amountTrimmed === ''
  const amountNum = Number(amountTrimmed)
  const planNum = Number(planAmount)
  const amountValid = !amountBlank && Number.isFinite(amountNum) && amountNum > 0
  const amountOverBudget = amountValid && Number.isFinite(planNum) && amountNum > planNum
  const amountOverridden = amountValid && !amountOverBudget && amountNum !== planNum
  const canEstimate = busy === null && recipientValid && !amountOverBudget
  // Broadcast is only offered right after a successful dry run. Editing either
  // input clears the result, so the user always re-estimates before sending.
  // Once a broadcast lands, result.broadcast is true → the button disappears,
  // making an accidental double-send impossible without a fresh estimate.
  const estimateReady = result !== null && result.ok && !result.broadcast
  const broadcastConfirmed = result !== null && result.ok && result.broadcast
  // A send was attempted but the relayer didn't confirm (revert, rejection, or
  // a pre-submit guard like over-budget that the user hit with broadcast on).
  const broadcastFailed = result !== null && !result.ok && result.broadcast

  function changeRecipient(value: string) {
    setRecipient(value)
    setResult(null)
    setError(null)
  }

  function changeAmount(value: string) {
    setAmountUsdc(value)
    setResult(null)
    setError(null)
  }

  async function run(broadcast: boolean) {
    setBusy(broadcast ? 'broadcast' : 'estimate')
    setError(null)
    try {
      const body: Record<string, unknown> = { plan, broadcast }
      if (recipientTrimmed) body.recipient = recipientTrimmed
      if (amountUsdc.trim()) body.amountUsdc = amountUsdc.trim()

      const res = await fetch('/api/mission/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : `request failed (${res.status})`
        setError(message)
        return
      }

      const next = data as ExecuteResponse
      setResult(next)
      onResult?.(next)
      if (next.events?.length) onEvents(next.events)
      // Confirmed on-chain send → debit the budget ledger in the parent. Guarded
      // on ok && broadcast so dry runs and failed sends never decrement it.
      if (next.ok && next.broadcast) {
        onBroadcastSuccess?.(parseFloat(next.amountUsdc) + parseFloat(next.feeUsdc ?? '0'))
      }
      // Dry-run business failures (bad budget, relayer-rejected estimate) use the
      // inline error box; broadcast outcomes render in their own banners below.
      if (!next.ok && next.error && !next.broadcast) setError(next.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error')
    } finally {
      setBusy(null)
    }
  }

  const txUrl = result?.txHash ? explorerTxUrl(result.chainId, result.txHash) : null

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Execute mission</h2>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          ERC-7710 · 1Shot relayer
        </span>
      </div>

      <p className="text-xs leading-5 text-zinc-400">
        Signs a USDC delegation scoped to the plan budget and routes it through the 1Shot relayer.
        Estimate is a dry run; broadcasting sends a real transfer on Base Sepolia.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="recipient" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Recipient (optional)
          </label>
          <input
            id="recipient"
            value={recipient}
            onChange={(e) => changeRecipient(e.target.value)}
            disabled={busy !== null}
            placeholder="defaults to signer"
            spellCheck={false}
            className={`rounded-lg border bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${
              recipientValid ? 'border-zinc-700' : 'border-red-700'
            }`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Amount USDC
          </label>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amountUsdc}
            onChange={(e) => changeAmount(e.target.value)}
            disabled={busy !== null}
            placeholder={planAmount}
            className={`rounded-lg border bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${
              amountOverBudget ? 'border-red-700' : 'border-zinc-700'
            }`}
          />
          {amountOverBudget ? (
            <p className="text-[11px] leading-4 text-red-300">
              Exceeds the {planAmount} USDC plan budget — lower it or re-plan.
            </p>
          ) : amountOverridden ? (
            <p className="text-[11px] leading-4 text-amber-300">
              Overrides the plan’s {planAmount} USDC — re-estimate before broadcasting.
            </p>
          ) : amountBlank ? (
            <p className="text-[11px] leading-4 text-zinc-500">Blank sends the full plan amount ({planAmount} USDC).</p>
          ) : (
            <p className="text-[11px] leading-4 text-zinc-500">Defaults to the {planAmount} USDC mission plan amount.</p>
          )}
        </div>
      </div>

      <CostBreakdown
        transferUsdc={amountValid ? amountTrimmed : planAmount}
        relayerFeeUsdc={result?.ok ? result.feeUsdc : undefined}
        premiumFeeUsdc={premiumFeeUsdc}
        premiumPaid={premiumPaid}
      />

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => run(false)}
          disabled={!canEstimate}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {busy === 'estimate' ? 'Estimating…' : 'Estimate (dry run)'}
        </button>
        {estimateReady && (
          <button
            type="button"
            onClick={() => run(true)}
            disabled={busy !== null || broadcastBlocked}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {busy === 'broadcast' ? 'Broadcasting…' : 'Broadcast on-chain'}
          </button>
        )}
      </div>

      {estimateReady && broadcastBlocked && (
        <p className="text-[11px] leading-4 text-amber-300">Unlock the premium risk check first.</p>
      )}

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {broadcastConfirmed && (
        <div className="flex flex-col gap-1.5 rounded-md border border-emerald-800/60 bg-emerald-950/40 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-300">On-chain transfer confirmed</p>
          <p className="text-[11px] leading-5 text-emerald-200/80">
            {result.amountUsdc} USDC sent to {shorten(result.recipient)} · {result.feeUsdc ?? '0'} USDC relayer fee
          </p>
          {txUrl ? (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-emerald-300 underline-offset-2 hover:underline"
            >
              {result.txHash ? shorten(result.txHash) : 'transaction'} on BaseScan ↗
            </a>
          ) : result.txHash ? (
            <span className="font-mono text-[11px] text-emerald-200/70">{shorten(result.txHash)}</span>
          ) : null}
          <p className="text-[11px] text-emerald-200/60">Re-estimate to send again.</p>
        </div>
      )}

      {broadcastFailed && (
        <div className="flex flex-col gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-300">Broadcast failed</p>
          {result.error && <p className="text-[11px] leading-5 text-red-200/80">{result.error}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-red-200/60">
            {typeof result.status === 'number' && <span>status {result.status}</span>}
            {result.taskId && <span>task {shorten(result.taskId)}</span>}
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-red-300 underline-offset-2 hover:underline"
            >
              {result.txHash ? shorten(result.txHash) : 'transaction'} on BaseScan ↗
            </a>
          )}
          <p className="text-[11px] text-red-200/60">Re-estimate to try again.</p>
        </div>
      )}

      {result?.ok && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{COST_LABELS.transfer}</dt>
            <dd className="font-mono text-zinc-200">{result.amountUsdc} USDC</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{COST_LABELS.relayerFee}</dt>
            <dd className="font-mono text-zinc-200">{result.feeUsdc ? `${result.feeUsdc} USDC` : '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Recipient</dt>
            <dd className="font-mono text-zinc-200">{shorten(result.recipient)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Mode</dt>
            <dd className="text-zinc-200">{result.broadcast ? 'Broadcast' : 'Dry run'}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
