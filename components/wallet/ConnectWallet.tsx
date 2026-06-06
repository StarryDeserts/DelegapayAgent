'use client'

import type { Address } from 'viem'
import { shorten } from '@/components/mission/executeResult'

export interface ConnectWalletProps {
  account: { address: Address; chainId: number } | null
  busy: boolean
  /** Block connect when no provider / unsupported wallet. */
  disabled?: boolean
  onConnect: () => void
}

/** Connect button, or a compact account chip once connected. Presentational. */
export function ConnectWallet({ account, busy, disabled, onConnect }: ConnectWalletProps) {
  if (account) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="font-mono text-[11px] text-emerald-200">{shorten(account.address)}</span>
        <span className="font-mono text-[11px] text-emerald-200/60">· chain {account.chainId}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={busy || disabled}
      className="self-start rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
    >
      {busy ? 'Connecting…' : 'Connect MetaMask'}
    </button>
  )
}
