import { COST_LABELS, totalCommittedUsdc } from '@/lib/mission/costTerms'

export interface CostBreakdownProps {
  /** USDC sent to the recipient (the work leg). */
  transferUsdc: string
  /** Relayer execution fee; undefined until a dry run returns it. */
  relayerFeeUsdc?: string
  /** x402 premium unlock fee; provided only when the plan requires the premium route. */
  premiumFeeUsdc?: string
  /** Whether the premium fee has already committed (risk check unlocked). */
  premiumPaid?: boolean
}

function fmt(usdc?: string): string {
  const v = Number(usdc)
  return Number.isFinite(v) ? v.toFixed(2) : (usdc ?? '—')
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-zinc-400">
        {label}
        {note && <span className="ml-1.5 text-[10px] text-zinc-600">{note}</span>}
      </dt>
      <dd className="font-mono text-zinc-200">{value}</dd>
    </div>
  )
}

/**
 * Compact, read-only breakdown of what a broadcast will actually commit:
 * transfer + relayer fee (+ premium fee when the plan requires it), summed into
 * "Total committed". The relayer fee is only known after a dry run, so the total
 * is prefixed `~` and the row reads "run dry run to estimate" until then. This is
 * a projection — no funds move from rendering it; the budget meter is what
 * reflects real committed spend.
 */
export function CostBreakdown({ transferUsdc, relayerFeeUsdc, premiumFeeUsdc, premiumPaid }: CostBreakdownProps) {
  const feeKnown = relayerFeeUsdc !== undefined && relayerFeeUsdc !== ''
  const premiumRequired = premiumFeeUsdc !== undefined && premiumFeeUsdc !== ''
  const total = totalCommittedUsdc({ transferUsdc, relayerFeeUsdc, premiumFeeUsdc })
  const totalNote = premiumRequired && !premiumPaid ? 'after unlock + broadcast' : 'after broadcast'

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Cost breakdown</span>
      <dl className="flex flex-col gap-1.5 text-xs">
        <Row label={COST_LABELS.transfer} value={`${fmt(transferUsdc)} USDC`} note="to recipient" />
        <Row
          label={COST_LABELS.relayerFee}
          value={feeKnown ? `${fmt(relayerFeeUsdc)} USDC` : '—'}
          note={feeKnown ? 'execution fee' : 'run dry run to estimate'}
        />
        {premiumRequired && (
          <Row
            label={COST_LABELS.premiumFee}
            value={`${fmt(premiumFeeUsdc)} USDC`}
            note={premiumPaid ? 'committed · x402 simulated' : 'on unlock · x402 simulated'}
          />
        )}
        <div className="mt-0.5 flex items-baseline justify-between gap-3 border-t border-zinc-800 pt-1.5">
          <dt className="text-zinc-300">
            {COST_LABELS.totalCommitted}
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-zinc-600">{totalNote}</span>
          </dt>
          <dd className="font-mono text-zinc-100">
            {feeKnown ? '' : '~'}
            {total.toFixed(2)} USDC
          </dd>
        </div>
      </dl>
    </div>
  )
}
