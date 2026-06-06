interface JudgeScriptRailProps {
  hasPlan: boolean
  premiumRequired: boolean
  premiumUnlocked: boolean
  hasProof: boolean
}

const SCRIPT_STEPS = [
  'Define a mission and USDC cap.',
  'Validate the AI payment plan.',
  'Grant bounded MetaMask permission.',
  'Run simulated x402 risk scoring.',
  'Dry-run through the 1Shot relayer.',
  'Broadcast only after explicit approval.',
  'Flight recorder audit trail.',
]

export function JudgeScriptRail({ hasPlan, premiumRequired, premiumUnlocked, hasProof }: JudgeScriptRailProps) {
  const state = hasProof
    ? 'Proof recorded'
    : premiumRequired && premiumUnlocked
      ? 'Risk gate unlocked'
      : hasPlan
        ? 'Plan ready'
        : 'Awaiting mission'

  return (
    <aside className="rounded-[1.75rem] border border-emerald-300/15 bg-[#05110f] p-5 shadow-[0_0_60px_rgba(16,185,129,0.08)] lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-200/70">Judge script</p>
        <span className="rounded-full border border-emerald-300/20 px-2.5 py-1 font-mono text-[11px] text-emerald-100">
          {state}
        </span>
      </div>
      <h2 className="mt-4 text-balance text-2xl font-black tracking-[-0.02em] text-zinc-50">Mission Control</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        The story is custody first: the agent gets a bounded wallet permission, not open treasury access.
      </p>
      <ol className="mt-6 flex flex-col gap-3">
        {SCRIPT_STEPS.map((step, index) => (
          <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-5 text-zinc-300">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 font-mono text-[11px] text-emerald-200">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
