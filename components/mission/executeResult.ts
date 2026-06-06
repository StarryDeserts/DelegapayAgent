import type { TimelineEvent } from '@/lib/timeline/events'

/**
 * Client-side mirror of lib/metamask/execute's ExecuteMissionResult. Lives in
 * this pure module so the client bundle never imports a server-only execute
 * module (which reads PRIVATE_KEY), and so both signing paths — the Phase 3
 * server-key MissionExecutePanel and the Phase 4 MetaMask WalletMissionPanel —
 * render off one identical shape. Only the fields the panels render are kept.
 */
export interface ExecuteResponse {
  ok: boolean
  broadcast: boolean
  events: TimelineEvent[]
  chainId: number
  delegator: string
  recipient: string
  /** Transfer amount — USDC sent to the recipient (the work leg). Wire name kept stable. */
  amountUsdc: string
  /** Relayer fee — execution fee paid to the 1Shot relayer. Wire name kept stable. */
  feeUsdc?: string
  taskId?: string
  txHash?: string
  status?: number
  error?: string
}

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${hash}`
  return null
}

export function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}
