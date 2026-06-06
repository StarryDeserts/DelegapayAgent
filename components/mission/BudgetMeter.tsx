import { COST_LABELS } from '@/lib/mission/costTerms'

export interface BudgetMeterProps {
  budgetUsdc: string
  /** Phase 1 has no real spend; defaults to 0. */
  spentUsdc?: string
}

export function BudgetMeter({ budgetUsdc, spentUsdc = '0' }: BudgetMeterProps) {
  const budget = Number.parseFloat(budgetUsdc)
  const spent = Number.parseFloat(spentUsdc)
  const hasBudget = Number.isFinite(budget) && budget > 0
  const safeSpent = Number.isFinite(spent) ? spent : 0
  const pct = hasBudget ? Math.min(100, Math.max(0, (safeSpent / budget) * 100)) : 0
  const remaining = hasBudget ? Math.max(0, budget - safeSpent) : 0

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Budget</span>
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm text-zinc-100">
            {hasBudget ? `${remaining.toFixed(2)} / ${budget.toFixed(2)} USDC` : '— USDC'}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-zinc-600">remaining / total</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500">
        {COST_LABELS.totalCommitted} {safeSpent.toFixed(2)} USDC
        <span className="text-zinc-600"> · transfer + relayer fee + premium fee</span>
      </span>
    </div>
  )
}
