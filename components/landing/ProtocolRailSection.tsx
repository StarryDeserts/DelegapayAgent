const PROTOCOLS = [
  {
    name: 'MetaMask',
    role: 'bounded user permission',
    marker: 'bg-[color:var(--dp-metamask)] shadow-[0_0_18px_var(--dp-glow-warm)]',
  },
  {
    name: 'x402',
    role: 'simulated paid risk check',
    marker: 'bg-[color:var(--dp-x402)] shadow-[0_0_18px_rgba(253,230,138,0.22)]',
  },
  {
    name: '1Shot',
    role: 'dry-run quote and relay',
    marker: 'bg-[color:var(--dp-oneshot)] shadow-[0_0_18px_var(--dp-glow-cyan)]',
  },
  {
    name: 'BaseScan',
    role: 'public proof endpoint',
    marker: 'bg-[color:var(--dp-proof)] shadow-[0_0_18px_var(--dp-glow-strong)]',
  },
]

export function ProtocolRailSection() {
  return (
    <section className="px-5 py-20 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-cyan-200/75">Protocol sequence</p>
            <h2 className="mt-4 text-balance text-4xl font-black tracking-[-0.035em] md:text-6xl">
              One payment story, four visible checkpoints.
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-zinc-300 lg:justify-self-end lg:text-right">
            MetaMask defines the boundary, x402 marks the simulated risk purchase, 1Shot estimates and relays, and BaseScan becomes the public endpoint.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-[#03100d] px-6 py-9 shadow-[0_0_54px_var(--dp-glow-field)] md:px-8 md:py-11">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,var(--dp-glow-warm),transparent_30%),radial-gradient(circle_at_74%_56%,var(--dp-glow-cyan),transparent_30%)]" />
          <div className="relative z-10 grid gap-8 md:grid-cols-4">
            <div className="absolute left-3 right-3 top-5 hidden h-px bg-gradient-to-r from-[color:var(--dp-metamask)]/60 via-[color:var(--dp-x402)]/60 via-[color:var(--dp-oneshot)]/60 to-[color:var(--dp-proof)]/60 md:block" aria-hidden="true" />
            <span className="landing-rail-particle absolute top-5 hidden h-2.5 w-2.5 rounded-full bg-emerald-100 shadow-[0_0_18px_rgba(110,231,183,0.85)] md:block" aria-hidden="true" />
            {PROTOCOLS.map((item) => (
              <div key={item.name} className="relative grid grid-cols-[2rem_1fr] gap-4 md:block">
                <div className={`mt-1 h-4 w-4 rounded-full md:mb-7 md:mt-0 ${item.marker}`} />
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.02em] text-zinc-50">{item.name}</h3>
                  <p className="mt-3 text-base leading-7 text-zinc-400">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
