/**
 * 1Shot public relayer JSON-RPC transport.
 *
 * The relayer is a keyless, open service: no API key, no Bearer token. Clients
 * pay per-transaction in ERC-20 on-chain. A different relayer speaking the same
 * `relayer_*` methods can be swapped in by changing the endpoint.
 */
export const RELAYER_URLS = {
  mainnet: 'https://relayer.1shotapi.com/relayers',
  /** Sepolia (11155111) and Base Sepolia (84532). */
  testnet: 'https://relayer.1shotapi.dev/relayers',
} as const

const TESTNET_CHAIN_IDS = new Set<number>([11155111, 84532])

/** Base Sepolia — the chain this demo targets. */
export const DEFAULT_CHAIN_ID = 84532

export function relayerUrlForChain(chainId: number): string {
  return TESTNET_CHAIN_IDS.has(chainId) ? RELAYER_URLS.testnet : RELAYER_URLS.mainnet
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

export class RelayerRpcError extends Error {
  readonly code: number
  readonly data?: unknown
  constructor(err: JsonRpcError) {
    super(`relayer rpc error ${err.code}: ${err.message}`)
    this.name = 'RelayerRpcError'
    this.code = err.code
    this.data = err.data
  }
}

let idCounter = 0

/**
 * Single JSON-RPC 2.0 call. `params` is passed through verbatim: some methods
 * take a positional array (`relayer_getCapabilities`), others a single object
 * (`relayer_send7710Transaction`).
 */
export async function relayerRpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++idCounter, method, params }),
  })

  if (!res.ok) {
    throw new Error(`relayer HTTP ${res.status} for ${method}`)
  }

  const body = (await res.json()) as { result?: T; error?: JsonRpcError }
  if (body.error) {
    throw new RelayerRpcError(body.error)
  }
  return body.result as T
}
