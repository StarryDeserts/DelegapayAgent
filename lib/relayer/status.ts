import { relayerRpc, relayerUrlForChain, DEFAULT_CHAIN_ID } from './client'

export const RelayerStatus = {
  Pending: 100,
  Submitted: 110,
  Confirmed: 200,
  Rejected: 400,
  Reverted: 500,
} as const

export type RelayerStatusCode = (typeof RelayerStatus)[keyof typeof RelayerStatus]

export const RELAYER_STATUS_LABELS: Record<RelayerStatusCode, string> = {
  100: 'Pending',
  110: 'Submitted',
  200: 'Confirmed',
  400: 'Rejected',
  500: 'Reverted',
}

const TERMINAL_STATUSES = new Set<number>([
  RelayerStatus.Confirmed,
  RelayerStatus.Rejected,
  RelayerStatus.Reverted,
])

export function isTerminalStatus(code: number): boolean {
  return TERMINAL_STATUSES.has(code)
}

export interface GetStatusParams {
  id: `0x${string}`
  /** include EVM event logs in the receipt for confirmed txs. */
  logs: boolean
}

export interface RelayerReceipt {
  blockHash: `0x${string}`
  blockNumber: string | number
  gasUsed: string
  transactionHash: `0x${string}`
  logs?: unknown[]
}

/** Discriminated by `status`; extra fields populate per status code. */
export interface GetStatusResult {
  id: `0x${string}`
  chainId: string
  createdAt: number
  status: RelayerStatusCode
  /** present only when send included memo; never null. */
  memo?: string
  /** status 110. */
  hash?: `0x${string}`
  /** status 200. */
  receipt?: RelayerReceipt
  /** status 400. */
  message?: string
  /** status 500 (revert data). */
  data?: unknown
}

/**
 * Step 5: poll task status. Prefer the webhook (`destinationUrl`) in
 * production; poll every 2–3s and stop on a terminal status otherwise.
 * `chainId` only selects the endpoint (status params carry no chain).
 */
export async function getStatus(
  params: GetStatusParams,
  chainId: number = DEFAULT_CHAIN_ID,
  url?: string,
): Promise<GetStatusResult> {
  const endpoint = url ?? relayerUrlForChain(chainId)
  return relayerRpc<GetStatusResult>(endpoint, 'relayer_getStatus', params)
}
