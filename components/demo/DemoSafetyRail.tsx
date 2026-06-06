import { COST_LABELS } from '@/lib/mission/costTerms'
import { describeEvent, type TimelineEntry } from '@/lib/timeline/events'
import type { ExecuteResponse } from '@/components/mission/executeResult'

export interface DemoSafetyRailProps {
  budgetUsdc: string
  committedUsdc: number
  premiumRequired: boolean
  premiumUnlocked: boolean
  hasPlan: boolean
  result: ExecuteResponse | null
  entries: TimelineEntry[]
}

function money(value: string | undefined) {
  return value ? `${value} USDC` : 'pending'
}

export function DemoSafetyRail({
  budgetUsdc,
  committedUsdc,
  premiumRequired,
  premiumUnlocked,
  hasPlan,
  result,
  entries,
}: DemoSafetyRailProps) {
  const budget = Number.parseFloat(budgetUsdc)
  const pct = Number.isFinite(budget) && budget > 0 ? Math.min(100, Math.max(0, (committedUsdc / budget) * 100)) : 0
  const estimated = result?.ok === true && result.broadcast === false
  const proved = result?.ok === true && result.broadcast === true
  const gates = [
    ['Permission', hasPlan ? 'ready' : 'waiting', 'text-orange-100'],
    ['Risk', !premiumRequired ? 'not required' : premiumUnlocked ? 'open' : estimated ? 'locked' : 'pending', 'text-amber-100'],
    ['Relay', estimated || proved ? 'estimated' : 'dry run pending', 'text-cyan-100'],
    ['Proof', proved ? 'confirmed' : 'empty', 'text-emerald-100'],
  ]

  return (
    <aside className="lg:sticky lg:top-5">
      <div className="overflow-hidden rounded-[1.75rem] bg-[#03100d] p-5 shadow-[0_0_54px_var(--dp-glow-field)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200/75">Bounded Budget Field</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-zinc-50">Safety rail</h2>
          </div>
          <span className="rounded-full bg-emerald-300/10 px-3 py-1.5 font-mono text-[13px] text-emerald-100">
            {committedUsdc.toFixed(2)} committed
          </span>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-baseline justify-between gap-4 font-mono text-sm">
            <span className="text-zinc-500">budget cap</span>
            <span className="text-zinc-100">{Number.isFinite(budget) ? budget.toFixed(2) : '—'} USDC</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-950/80">
            <div className="h-full rounded-full bg-[color:var(--dp-field-strong)] shadow-[0_0_18px_var(--dp-glow-strong)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Allowance is a cap. Spend commits only after premium unlock or confirmed broadcast.</p>
        </div>

        <div className="mt-8 grid gap-3">
          {gates.map(([name, state, color]) => (
            <div key={name} className="flex items-center justify-between gap-4 border-t border-zinc-800/80 pt-3">
              <span className="text-base font-semibold text-zinc-200">{name}</span>
              <span className={`font-mono text-[13px] ${color}`}>{state}</span>
            </div>
          ))}
        </div>

        <dl className="mt-8 grid gap-3 border-t border-zinc-800/80 pt-5 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-zinc-500">{COST_LABELS.transfer}</dt>
            <dd className="font-mono text-zinc-100">{money(result?.amountUsdc)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-zinc-500">{COST_LABELS.relayerFee}</dt>
            <dd className="font-mono text-zinc-100">{money(result?.feeUsdc)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-zinc-500">{COST_LABELS.premiumFee}</dt>
            <dd className="font-mono text-zinc-100">{premiumRequired ? (premiumUnlocked ? '0.05 USDC paid' : '0.05 USDC locked') : 'not required'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-2">
            <dt className="text-zinc-300">{COST_LABELS.totalCommitted}</dt>
            <dd className="text-right font-mono text-emerald-200">
              <span>
                {COST_LABELS.totalCommitted} {committedUsdc.toFixed(2)} USDC · transfer + relayer fee + premium fee
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-zinc-800/80 pt-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-zinc-500">Flight recorder</p>
            <span className="font-mono text-[13px] text-zinc-600">newest first</span>
          </div>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-500">No audit events yet.</p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {entries.slice(0, 3).map((entry) => {
                const event = describeEvent(entry.event)
                return (
                  <li key={entry.id} className="text-sm leading-5">
                    <p className="font-semibold text-zinc-200">{event.title}</p>
                    {event.detail && <p className="mt-1 line-clamp-2 text-zinc-500">{event.detail}</p>}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </aside>
  )
}
