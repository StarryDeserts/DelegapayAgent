import Link from 'next/link'
import { explorerTxUrl, shorten } from '@/components/mission/executeResult'

const TX_RE = /^0x[0-9a-fA-F]{64}$/

export function ProofSection() {
  const proofTxHash = process.env.NEXT_PUBLIC_DELEGAPAY_PROOF_TX ?? ''
  const proofUrl = TX_RE.test(proofTxHash) ? explorerTxUrl(84532, proofTxHash) : null

  return (
    <section className="px-5 pb-24 pt-16 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1320px] gap-10 border-t border-zinc-800/80 pt-14 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-emerald-200/75">Proof moment</p>
          <h2 className="mt-4 max-w-4xl text-balance text-4xl font-black tracking-[-0.035em] md:text-6xl">
            A payment demo should end with public proof, not a screenshot.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            The guided demo keeps dry run safe until the operator explicitly broadcasts. When a confirmed transaction returns, the proof becomes the final stage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="rounded-full bg-emerald-300 px-6 py-3.5 text-base font-bold text-[#03100d] hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-100">
              Start guided demo
            </Link>
            <Link href="/console" className="rounded-full border border-zinc-600 px-6 py-3.5 text-base font-semibold text-zinc-100 hover:border-zinc-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-300">
              Review advanced console
            </Link>
          </div>
        </div>

        <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] bg-[#03120f] p-7 shadow-[0_0_58px_var(--dp-glow-field)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--dp-glow-field),transparent_36%)]" />
          <div className="relative z-10">
            {proofUrl ? (
              <>
                <p className="text-sm font-semibold text-emerald-200/75">Verified BaseScan proof</p>
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block break-all font-mono text-2xl text-emerald-100 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  {shorten(proofTxHash)} on BaseScan ↗
                </a>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-emerald-200/75">Proof drawer waits for live broadcast</p>
                <p className="mt-8 text-2xl font-black leading-tight tracking-[-0.02em] text-emerald-50">
                  This build will not invent a transaction hash.
                </p>
                <p className="mt-5 text-base leading-7 text-zinc-300">
                  Run the guided demo. The final proof stage appears only after a confirmed Base Sepolia broadcast.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
