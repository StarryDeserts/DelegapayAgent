import type { ExecuteResponse } from '@/components/mission/executeResult'

export interface BroadcastInterlockProps {
  hasPlan: boolean
  premiumRequired: boolean
  premiumUnlocked: boolean
  result: ExecuteResponse | null
}

export function BroadcastInterlock({ hasPlan, premiumRequired, premiumUnlocked, result }: BroadcastInterlockProps) {
  const dryRunReady = result?.ok === true && result.broadcast === false
  const proofReady = result?.ok === true && result.broadcast === true
  const message = !hasPlan
    ? 'Generate a mission plan before any permission or relay step.'
    : proofReady
      ? 'Broadcast confirmed. Re-estimate before sending again.'
      : premiumRequired && dryRunReady && !premiumUnlocked
        ? 'Unlock the premium risk check first.'
        : premiumRequired && !premiumUnlocked
          ? 'Dry run is available now. Broadcast waits for the premium risk gate.'
          : dryRunReady
            ? 'Ready for explicit Broadcast on-chain.'
            : 'Run Estimate (dry run) before broadcast.'

  return (
    <section className="rounded-[1.5rem] border border-emerald-300/15 bg-[#07100e] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-200/70">Broadcast interlock</p>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{message}</p>
    </section>
  )
}
