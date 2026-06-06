interface BoundedBudgetFieldProps {
  compact?: boolean
  committedUsdc?: number
  budgetUsdc?: string
  premiumUnlocked?: boolean
}

const GATES = [
  {
    name: 'Permission Gate',
    label: 'MetaMask',
    position: 'left-[31%] top-[53%]',
    halo: 'bg-[color:var(--dp-metamask)]/18 shadow-[0_0_32px_var(--dp-glow-warm)]',
    ring: 'border-[color:var(--dp-metamask)]/70',
    text: 'text-orange-100',
  },
  {
    name: 'Risk Gate',
    label: 'x402 simulated',
    position: 'left-[51%] top-[43%]',
    halo: 'bg-[color:var(--dp-x402)]/18 shadow-[0_0_32px_rgba(253,230,138,0.24)]',
    ring: 'border-[color:var(--dp-x402)]/70',
    text: 'text-amber-100',
  },
  {
    name: 'Relay Gate',
    label: '1Shot relay',
    position: 'left-[69%] top-[56%]',
    halo: 'bg-[color:var(--dp-oneshot)]/18 shadow-[0_0_32px_var(--dp-glow-cyan)]',
    ring: 'border-[color:var(--dp-oneshot)]/70',
    text: 'text-cyan-100',
  },
]

const PARTICLES = Array.from({ length: 7 }, (_, i) => i)

export function BoundedBudgetField({ compact, committedUsdc = 0, budgetUsdc = '25.00', premiumUnlocked }: BoundedBudgetFieldProps) {
  const budget = Number.parseFloat(budgetUsdc)
  const pct = Number.isFinite(budget) && budget > 0 ? Math.min(100, Math.max(0, (committedUsdc / budget) * 100)) : 0
  const sceneHeight = compact ? 'min-h-[320px]' : 'min-h-[560px] lg:min-h-[640px]'

  return (
    <figure className={`relative isolate overflow-hidden ${sceneHeight} rounded-[2.75rem]`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_46%,var(--dp-glow-field),transparent_38%),radial-gradient(circle_at_80%_58%,var(--dp-glow-cyan),transparent_24%),linear-gradient(135deg,rgba(5,24,20,0.92),rgba(2,3,3,0.7)_64%)]" />
      <div className="absolute inset-[5%] rounded-[2.4rem] bg-[color:var(--dp-field)]/[0.025] shadow-[inset_0_0_82px_rgba(52,211,153,0.12),0_0_64px_rgba(16,185,129,0.1)]" />
      <div className="absolute -left-10 top-[54%] h-44 w-44 rounded-full border border-zinc-700/50 bg-black/30 opacity-55 blur-[1px]" />
      <div className="absolute -left-2 top-[61%] z-10 max-w-[10rem] text-right sm:max-w-[12rem]">
        <p className="text-sm font-semibold text-zinc-300">User wallet</p>
        <p className="mt-1 text-[13px] leading-5 text-zinc-500">treasury stays outside</p>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 620" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="budgetPath" x1="80" y1="0" x2="820" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6ee7b7" stopOpacity="0.18" />
            <stop offset="0.32" stopColor="#fb923c" stopOpacity="0.82" />
            <stop offset="0.55" stopColor="#fde68a" stopOpacity="0.9" />
            <stop offset="0.76" stopColor="#67e8f9" stopOpacity="0.86" />
            <stop offset="1" stopColor="#6ee7b7" stopOpacity="0.74" />
          </linearGradient>
          <filter id="pathGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M88 388 C 188 252 260 235 330 318 C 410 414 493 179 566 250 C 642 324 693 402 814 270" fill="none" stroke="url(#budgetPath)" strokeWidth="4" strokeLinecap="round" filter="url(#pathGlow)" />
        <path d="M108 460 C 236 565 594 565 800 430" fill="none" stroke="#fb7185" strokeOpacity="0.14" strokeWidth="2" strokeDasharray="12 14" />
        <path d="M90 110 H 794 C 840 110 862 136 852 180 L 774 494 C 768 520 744 536 716 528 L 154 526 C 116 526 90 500 90 462 V 110Z" fill="none" stroke="#6ee7b7" strokeOpacity="0.18" strokeWidth="2" />
      </svg>

      <div className="absolute left-[8%] top-[9%] z-20 max-w-[22rem]">
        <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-emerald-200/75">Bounded Budget Field</p>
        <h2 className={`${compact ? 'mt-2 text-3xl' : 'mt-4 text-4xl md:text-5xl'} text-balance font-black leading-[0.95] tracking-[-0.04em] text-emerald-50`}>
          USDC moves only through approved gates.
        </h2>
      </div>

      <div className="absolute right-[8%] top-[9%] z-20 rounded-full bg-emerald-300/10 px-4 py-2 font-mono text-[13px] text-emerald-100 shadow-[0_0_28px_rgba(52,211,153,0.12)]">
        {committedUsdc.toFixed(2)} / {Number.isFinite(budget) ? budget.toFixed(2) : '—'} USDC
      </div>

      {GATES.map((gate) => (
        <div key={gate.name} className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${gate.position}`}>
          <div className="flex flex-col items-center text-center">
            <div className={`grid h-24 w-24 place-items-center rounded-full ${gate.halo}`}>
              <div className={`grid h-16 w-16 place-items-center rounded-full border ${gate.ring} bg-black/35`}>
                <div className={`h-7 w-7 rounded-full border ${gate.ring} bg-white/5`} />
              </div>
            </div>
            <p className={`mt-3 min-w-32 text-base font-black tracking-[-0.02em] ${gate.text}`}>{gate.name}</p>
            <p className="mt-1 text-[13px] leading-5 text-zinc-400">{gate.label}</p>
          </div>
        </div>
      ))}

      <div className="absolute right-[6%] top-[41%] z-20 max-w-[9rem] text-center">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[color:var(--dp-proof)]/14 shadow-[0_0_36px_var(--dp-glow-strong)]">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-[color:var(--dp-proof)]/65 bg-black/30">
            <div className="h-8 w-8 rounded-full bg-[color:var(--dp-proof)]/80 shadow-[0_0_18px_rgba(110,231,183,0.68)]" />
          </div>
        </div>
        <p className="mt-3 text-base font-black tracking-[-0.02em] text-emerald-50">Proof</p>
        <p className="mt-1 text-[13px] leading-5 text-zinc-400">BaseScan visible</p>
      </div>

      <div className="absolute bottom-[7%] left-[9%] right-[9%] z-20">
        <div className="h-2 overflow-hidden rounded-full bg-emerald-950/80">
          <div className="h-full rounded-full bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.75)]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
          Allowance is a cap, not spent until broadcast{premiumUnlocked ? '. Risk gate open.' : '.'}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]" aria-hidden="true">
        {PARTICLES.map((particle) => (
          <span
            key={particle}
            className="field-usdc-particle absolute h-3 w-3 rounded-full bg-emerald-100 shadow-[0_0_22px_rgba(110,231,183,0.95)]"
            style={{ animationDelay: `${particle * 620}ms` }}
          />
        ))}
      </div>
    </figure>
  )
}
