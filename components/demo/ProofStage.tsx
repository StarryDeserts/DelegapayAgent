import { explorerTxUrl, shorten, type ExecuteResponse } from '@/components/mission/executeResult'

export interface ProofStageProps {
  result: ExecuteResponse
}

export function ProofStage({ result }: ProofStageProps) {
  const txUrl = result.txHash ? explorerTxUrl(result.chainId, result.txHash) : null

  return (
    <section className="relative min-h-[520px] overflow-hidden rounded-[2rem] bg-[#03120f] p-8 shadow-[0_0_90px_rgba(16,185,129,0.16)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(52,211,153,0.2),transparent_34%),radial-gradient(circle_at_85%_68%,rgba(34,211,238,0.12),transparent_30%)]" />
      <div className="relative z-10 flex h-full min-h-[456px] flex-col justify-between gap-10">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-emerald-200/75">Proof drawer</p>
          <h2 className="mt-4 max-w-3xl text-balance text-5xl font-black tracking-[-0.04em] text-emerald-50 md:text-6xl">
            On-chain transfer confirmed.
          </h2>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-emerald-100/80">
            The final state is public evidence: amount, recipient, relayer fee, and Base Sepolia transaction proof.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <dl className="grid gap-3 text-base">
            <div className="flex items-baseline justify-between gap-4 border-t border-emerald-200/15 pt-3">
              <dt className="text-emerald-100/60">Transfer</dt>
              <dd className="font-mono text-emerald-50">{result.amountUsdc} USDC</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-emerald-200/15 pt-3">
              <dt className="text-emerald-100/60">Relayer fee</dt>
              <dd className="font-mono text-emerald-50">{result.feeUsdc ?? '0'} USDC</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-emerald-200/15 pt-3">
              <dt className="text-emerald-100/60">Recipient</dt>
              <dd className="font-mono text-emerald-50">{shorten(result.recipient)}</dd>
            </div>
          </dl>

          <div className="rounded-[1.5rem] bg-black/30 p-5">
            <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-emerald-200/65">BaseScan proof</p>
            {txUrl ? (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block break-all font-mono text-xl leading-8 text-emerald-100 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {result.txHash ? shorten(result.txHash) : 'transaction'} on BaseScan ↗
              </a>
            ) : result.txHash ? (
              <p className="mt-4 break-all font-mono text-xl leading-8 text-emerald-100">{shorten(result.txHash)}</p>
            ) : (
              <p className="mt-4 text-base leading-7 text-zinc-300">Transaction hash pending.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
