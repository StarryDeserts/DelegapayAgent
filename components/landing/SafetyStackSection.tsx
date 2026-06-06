const SAFETY_SEQUENCE = [
  { title: 'Budget cap', detail: 'The mission starts with a USDC ceiling.', tone: 'field' },
  { title: 'Plan validation', detail: 'The AI proposal is structured before permission.', tone: 'field' },
  { title: 'Wallet permission', detail: 'MetaMask grants allowance, not custody.', tone: 'orange' },
  { title: 'Risk gate', detail: 'x402 simulated scoring clears when required.', tone: 'amber' },
  { title: 'Dry run', detail: '1Shot estimates before broadcast.', tone: 'cyan' },
  { title: 'Proof', detail: 'BaseScan confirms the final transfer.', tone: 'proof' },
]

const TONE_CLASS: Record<string, string> = {
  field: 'bg-[color:var(--dp-field)] shadow-[0_0_18px_var(--dp-glow-strong)]',
  orange: 'bg-[color:var(--dp-metamask)] shadow-[0_0_18px_var(--dp-glow-warm)]',
  amber: 'bg-[color:var(--dp-x402)] shadow-[0_0_18px_rgba(253,230,138,0.22)]',
  cyan: 'bg-[color:var(--dp-oneshot)] shadow-[0_0_18px_var(--dp-glow-cyan)]',
  proof: 'bg-[color:var(--dp-proof)] shadow-[0_0_18px_var(--dp-glow-strong)]',
}

export function SafetyStackSection() {
  return (
    <section className="px-5 py-20 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-emerald-200/75">Boundary model</p>
          <h2 className="mt-4 max-w-3xl text-balance text-4xl font-black tracking-[-0.035em] md:text-6xl">
            The agent can act, but the treasury stays outside the field.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-zinc-300">
            The unsafe pattern is a raw key. DelegaPay moves the limit into the payment permission itself, so every valuable action must pass through the same bounded route.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-[#03100d] p-6 shadow-[0_0_54px_var(--dp-glow-field)] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,var(--dp-glow-field),transparent_34%),radial-gradient(circle_at_88%_76%,var(--dp-glow-cyan),transparent_28%)]" />
          <div className="absolute -left-16 bottom-8 h-40 w-40 rounded-full border border-zinc-700/40 bg-black/25 opacity-55" />
          <p className="relative z-10 mb-6 max-w-md text-base leading-7 text-zinc-300">
            Treasury access stays outside the field. Each control narrows what the agent can do before money moves.
          </p>

          <ol className="relative z-10 grid gap-0">
            <span className="absolute bottom-5 left-[0.66rem] top-5 w-px bg-gradient-to-b from-[color:var(--dp-field)]/20 via-[color:var(--dp-field)]/45 to-[color:var(--dp-proof)]/20" aria-hidden="true" />
            {SAFETY_SEQUENCE.map((item) => (
              <li key={item.title} className="relative grid grid-cols-[2rem_1fr] gap-x-4 py-4">
                <span className={`relative z-10 mt-1 h-4 w-4 rounded-full ${TONE_CLASS[item.tone]}`} aria-hidden="true" />
                <div>
                  <h3 className="text-xl font-black tracking-[-0.02em] text-zinc-50">{item.title}</h3>
                  <p className="mt-1 text-base leading-7 text-zinc-400">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
