'use client'

import type { WalletDetect } from '@/lib/metamask/permissions'

export interface PermissionStatusProps {
  detect: WalletDetect | null
  busy: boolean
}

/**
 * Readiness strip for the EIP-7715 path. Surfaces the three fallback states
 * (no provider, unsupported wallet, wrong chain) so the user knows whether to
 * proceed or flip back to Server-key mode. Presentational only.
 */
export function PermissionStatus({ detect, busy }: PermissionStatusProps) {
  if (busy && !detect) {
    return <p className="text-[11px] text-zinc-500">Checking wallet…</p>
  }
  if (!detect) return null

  if (!detect.hasProvider) {
    return (
      <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] leading-5 text-amber-200/90">
        No MetaMask provider found. Install MetaMask, or switch to <strong>Server key</strong> signing above.
      </p>
    )
  }

  if (!detect.supported) {
    return (
      <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] leading-5 text-amber-200/90">
        This wallet doesn&apos;t expose EIP-7715 Advanced Permissions. Update to MetaMask Flask ≥13.5 / prod
        ≥13.23 for the <strong>{detect.permissionType}</strong> permission, or use <strong>Server key</strong> mode.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded-full bg-emerald-950/50 px-2.5 py-1 font-medium text-emerald-300">
        EIP-7715 ready
      </span>
      <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-zinc-400">{detect.permissionType}</span>
      <span
        className={`rounded-full px-2.5 py-1 font-mono ${
          detect.onBaseSepolia ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-950/40 text-amber-300'
        }`}
      >
        {detect.onBaseSepolia ? 'Base Sepolia' : `chain ${detect.chainId ?? '?'} — will switch`}
      </span>
    </div>
  )
}
