import { relayerRpc, relayerUrlForChain } from './client'
import type { Send7710TransactionParams } from './transaction'

export interface GetFeeDataParams {
  chainId: string
  /** ERC-20 payment token address (must be in capabilities.tokens). */
  token: `0x${string}`
}

export interface GetFeeDataResult {
  chainId: string
  token: { address: `0x${string}`; decimals: number; symbol?: string; name?: string }
  /** native gas units → payment-token atoms. */
  rate: number
  /** floor fee in token atoms (≈ $0.01 worth). */
  minFee: string
  /** unix seconds; quote unusable after this. */
  expiry: number
  /** current gas price in wei (hex). */
  gasPrice: `0x${string}`
  feeCollector: `0x${string}`
  targetAddress?: `0x${string}`
  /** signed price-lock; pass verbatim to send7710Transaction.context. */
  context?: string
}

export interface Estimate7710TransactionResult {
  success: boolean
  paymentTokenAddress?: `0x${string}`
  paymentChain?: number
  /** Per-chain sum of 1Shot gas units (decimal strings), keyed by chain id string. */
  gasUsed: Record<string, string>
  /** Required fee in paymentTokenAddress smallest units; floored to chain/token minFee. */
  requiredPaymentAmount?: string
  /** Signed price quote for the first payment chain; pass as params.context on send. */
  context?: string
  /** Per-chain signed quotes; for multichain send, set each params[i].context from this map. */
  contextByChainId?: Record<string, string>
  /** Present when success is false. */
  error?: string
}

/**
 * Step 2b (fallback): rough quote before a signed bundle exists — e.g. browser
 * permission UX that needs a fee estimate before the user signs. Always floor
 * the fee at `minFee`.
 */
export async function getFeeData(params: GetFeeDataParams, url?: string): Promise<GetFeeDataResult> {
  const endpoint = url ?? relayerUrlForChain(Number(params.chainId))
  return relayerRpc<GetFeeDataResult>(endpoint, 'relayer_getFeeData', params)
}

/**
 * Step 3 (preferred): synchronous fee quote once the signed bundle exists.
 * Same params as send, minus `context`. Validates + simulates without creating
 * a task. Check `result.success` before send — failures arrive in `result`,
 * not always as JSON-RPC errors. Wire `result.context` into the send call.
 */
export async function estimate7710Transaction(
  params: Send7710TransactionParams,
  url?: string,
): Promise<Estimate7710TransactionResult> {
  const endpoint = url ?? relayerUrlForChain(Number(params.chainId))
  return relayerRpc<Estimate7710TransactionResult>(endpoint, 'relayer_estimate7710Transaction', params)
}
