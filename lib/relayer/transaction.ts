import { relayerRpc, relayerUrlForChain } from './client'

export interface Execution7710 {
  target: `0x${string}`
  /** wei as decimal or 0x-hex string. */
  value: string
  data: `0x${string}`
}

export interface DelegationCaveat {
  enforcer: `0x${string}`
  terms: string
  args: string
}

export interface Delegation7710 {
  /** = targetAddress from capabilities. */
  delegate: `0x${string}`
  /** = signer's smart account address. */
  delegator: `0x${string}`
  /** bytes32; "0x000…0" for root authority. */
  authority: string
  caveats: DelegationCaveat[]
  /** 32-byte hex; fresh per delegation. */
  salt: string
  /** hex; from smartAccount.signDelegation. */
  signature: string
}

export interface DelegatedTransaction7710 {
  /** Delegation chain (length 1 for direct delegation). */
  permissionContext: Delegation7710[]
  executions: Execution7710[]
}

export interface AuthorizationListEntry {
  address: `0x${string}`
  chainId: number | string
  nonce: number | string
  r: `0x${string}`
  s: `0x${string}`
  yParity: number | string
}

export interface Send7710TransactionParams {
  chainId: string
  /** Merged server-side into one redeemDelegations batch. */
  transactions: DelegatedTransaction7710[]
  /** ≤1 entry; for in-flight EIP-7702 upgrade. */
  authorizationList?: AuthorizationListEntry[]
  /** Signed price-lock from estimate or getFeeData. Omit on estimate. */
  context?: string
  taskId?: `0x${string}`
  /** ≤256 chars; webhook URL for status events. */
  destinationUrl?: string
  /** ≤256 chars; opaque correlation label echoed in status/webhooks. */
  memo?: string
}

export type TaskId = `0x${string}`

/**
 * Step 4: submit a signed ERC-7710 bundle.
 *
 * Transport only. Building a valid `transactions[]` (signed delegations +
 * encoded executions, mock fee ≥ minFee) requires the Phase 3 local-signer
 * delegation flow (`createDelegation` + `smartAccount.signDelegation`). Pass
 * `context` from the matching `estimate7710Transaction` to honor the quote.
 */
export async function send7710Transaction(
  params: Send7710TransactionParams,
  url?: string,
): Promise<TaskId> {
  const endpoint = url ?? relayerUrlForChain(Number(params.chainId))
  return relayerRpc<TaskId>(endpoint, 'relayer_send7710Transaction', params)
}
