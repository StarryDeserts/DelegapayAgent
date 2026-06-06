import type { MissionPlan, ProviderId } from '@/lib/ai/schema'

export interface MissionPlanPreviewProps {
  provider: ProviderId
  model: string
  plan: MissionPlan
}

const PERMISSION_LABELS: Record<MissionPlan['requiredPermissionType'], string> = {
  'erc20-token-allowance': 'One-off allowance',
  'erc20-token-periodic': 'Periodic / subscription',
}

export function MissionPlanPreview({ provider, model, plan }: MissionPlanPreviewProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Mission plan</h2>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          {provider} · {model}
        </span>
      </div>

      <p className="text-sm leading-6 text-zinc-300">{plan.summary}</p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Permission</dt>
          <dd className="text-zinc-200">{PERMISSION_LABELS[plan.requiredPermissionType]}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Max spend</dt>
          <dd className="font-mono text-zinc-200">{plan.maxSpendUsdc} USDC</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Premium tool</dt>
          <dd className="text-zinc-200">{plan.premiumToolRequired ? 'Required' : 'Not needed'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Target action</dt>
          <dd className="text-zinc-200">{plan.targetAction ?? '—'}</dd>
        </div>
      </dl>

      {plan.riskChecks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Risk checks</span>
          <ul className="flex flex-col gap-1">
            {plan.riskChecks.map((check, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="text-emerald-500">✓</span>
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
