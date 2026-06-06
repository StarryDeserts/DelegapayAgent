import Link from 'next/link'
import { BoundedBudgetField } from './BoundedBudgetField'

const STATUS = ['Base Sepolia', 'USDC', 'MetaMask EIP-7715', '1Shot relay', 'x402 simulated']

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-[color:var(--dp-bg)] px-5 py-6 text-zinc-100 sm:px-8 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_15%,var(--dp-glow-field),transparent_32%),radial-gradient(circle_at_88%_40%,var(--dp-glow-cyan),transparent_26%),linear-gradient(180deg,var(--dp-bg)_0%,#07100d_58%,var(--dp-bg)_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] flex-col gap-8">
        <nav className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 font-mono text-[13px] text-zinc-400">
          <Link href="/" className="font-semibold tracking-[0.2em] text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-300">
            DELEGAPAY
          </Link>
          <div className="hidden items-center gap-5 lg:flex">
            {STATUS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <Link href="/console" className="text-zinc-300 underline-offset-4 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-300">
            Console
          </Link>
        </nav>

        <div className="grid flex-1 grid-cols-1 items-center gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="flex max-w-3xl flex-col gap-7 lg:pb-10">
            <div>
              <p className="text-sm font-semibold text-emerald-200/80">Agent payment control plane</p>
              <h1 className="mt-5 text-balance text-5xl font-black tracking-[-0.04em] text-zinc-50 sm:text-6xl xl:text-7xl">
                Give AI agents a wallet, not your treasury.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-xl leading-8 text-zinc-300">
                DelegaPay turns an AI payment mission into a bounded USDC permission, verified through MetaMask, simulated x402 risk scoring, 1Shot dry run, and Base Sepolia proof.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-full bg-emerald-300 px-6 py-3.5 text-base font-bold text-[#03100d] shadow-[0_0_32px_rgba(52,211,153,0.32)] transition hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                Start guided demo
              </Link>
              <Link href="/console" className="rounded-full border border-zinc-600 px-6 py-3.5 text-base font-semibold text-zinc-100 transition hover:border-zinc-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                Open advanced console
              </Link>
            </div>

            <p className="max-w-xl text-sm leading-6 text-zinc-500">
              Automated tests mock relayer broadcasts. In the running app, Broadcast is a real Base Sepolia action.
            </p>
          </div>

          <BoundedBudgetField />
        </div>
      </div>
    </section>
  )
}
