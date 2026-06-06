import Link from 'next/link'

export function DemoCtaSection() {
  return (
    <section className="px-5 py-24 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[2rem] border border-zinc-800 bg-black/45 p-8 md:p-12">
        <div className="max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-emerald-200/80">Run the sequence</p>
          <h2 className="mt-4 text-balance text-4xl font-black tracking-[-0.03em] md:text-6xl">
            Walk the judge through the bounded wallet in under four minutes.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-zinc-300">
            Plan the mission, grant a bounded permission, clear the simulated risk gate, estimate safely, then broadcast only when the operator chooses to prove it on Base Sepolia.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-bold text-[#03100d] hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-100">
            Start guided demo
          </Link>
          <Link href="/console" className="rounded-full border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-300">
            Open advanced console
          </Link>
        </div>
        <p className="font-mono text-[11px] leading-5 text-zinc-500">
          Automated tests use mocked relayer broadcasts. In the running app, Broadcast is real on Base Sepolia.
        </p>
      </div>
    </section>
  )
}
