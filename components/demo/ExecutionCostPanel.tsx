import { PREMIUM_COST_USDC } from '@/lib/x402/payment'
import { COST_LABELS } from '@/lib/mission/costTerms'
import type { ExecuteResponse } from '@/components/mission/executeResult'

export interface ExecutionCostPanelProps {
  planAmountUsdc?: string
  committedUsdc: number
  premiumRequired: boolean
  premiumUnlocked: boolean
  result: ExecuteResponse | null
}

export function ExecutionCostPanel({
  planAmountUsdc,
  committedUsdc,
  premiumRequired,
  premiumUnlocked,
  result,
}: ExecutionCostPanelProps) {
  const transfer = result?.amountUsdc ?? planAmountUsdc ?? '—'
  const relayerFee = result?.feeUsdc ? `${result.feeUsdc} USDC` : 'estimated after dry run'
  const premiumFee = premiumRequired ? `${PREMIUM_COST_USDC} USDC ${premiumUnlocked ? 'paid' : 'locked'}` : 'not required'

  return (
    <section className="rounded-[1.5rem] border border-cyan-300/15 bg-[#061014] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/70">Execution cost</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">{COST_LABELS.transfer}</dt>
          <dd className="font-mono text-zinc-100">{transfer === '—' ? transfer : `${transfer} USDC`}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">{COST_LABELS.relayerFee}</dt>
          <dd className="text-right font-mono text-zinc-100">{relayerFee}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">{COST_LABELS.premiumFee}</dt>
          <dd className="text-right font-mono text-zinc-100">{premiumFee}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-cyan-300/10 pt-3">
          <dt className="text-zinc-400">{COST_LABELS.totalCommitted}</dt>
          <dd className="font-mono text-emerald-200">{committedUsdc.toFixed(2)} USDC</dd>
        </div>
      </dl>
    </section>
  )
}
