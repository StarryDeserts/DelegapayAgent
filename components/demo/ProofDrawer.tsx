import { explorerTxUrl, shorten, type ExecuteResponse } from '@/components/mission/executeResult'

export interface ProofDrawerProps {
  result: ExecuteResponse | null
}

export function ProofDrawer({ result }: ProofDrawerProps) {
  const confirmed = result?.ok === true && result.broadcast === true
  const txUrl = confirmed && result.txHash ? explorerTxUrl(result.chainId, result.txHash) : null

  return (
    <section className="rounded-[1.75rem] border border-emerald-300/20 bg-[#03120f] p-5 shadow-[0_0_60px_rgba(16,185,129,0.1)]">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-200/70">Proof drawer</p>
      {confirmed ? (
        <div className="mt-4 flex flex-col gap-3">
          <h2 className="text-2xl font-black tracking-[-0.02em] text-emerald-50">On-chain transfer confirmed</h2>
          <p className="text-sm leading-6 text-emerald-100/80">
            {result.amountUsdc} USDC moved with a {result.feeUsdc ?? '0'} USDC relayer fee. The UI now points at public Base Sepolia proof.
          </p>
          {txUrl ? (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-emerald-200 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {result.txHash ? shorten(result.txHash) : 'transaction'} on BaseScan ↗
            </a>
          ) : result.txHash ? (
            <span className="break-all font-mono text-sm text-emerald-200">{shorten(result.txHash)}</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          The drawer stays empty until a confirmed broadcast returns a transaction hash. Automated smoke tests mock this broadcast so no real chain write occurs.
        </p>
      )}
    </section>
  )
}
