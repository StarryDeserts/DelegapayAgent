import { relayerRpc, relayerUrlForChain } from './client'

export interface CapabilityToken {
  address: `0x${string}`
  symbol?: string
  name?: string
  /** May arrive as a numeric string. */
  decimals: number | string
}

export interface ChainCapability {
  /** Address fee transfers must target. */
  feeCollector: `0x${string}`
  /** The ONLY valid `to` for createDelegation against this relayer. */
  targetAddress: `0x${string}`
  tokens: CapabilityToken[]
}

export type GetCapabilitiesResult = Record<string /* chainId */, ChainCapability>

/**
 * Step 1 of every integration: discover supported chains, accepted payment
 * tokens, `feeCollector`, and `targetAddress`. Cache the result per session —
 * it changes rarely. Keyless and safe to call now.
 */
export async function getCapabilities(
  chainIds: number[],
  url?: string,
): Promise<GetCapabilitiesResult> {
  const endpoint = url ?? relayerUrlForChain(chainIds[0])
  const params = chainIds.map(String)
  return relayerRpc<GetCapabilitiesResult>(endpoint, 'relayer_getCapabilities', params)
}
