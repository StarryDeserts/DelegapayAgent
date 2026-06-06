import { getCapabilities } from '@/lib/relayer'

/**
 * Keyless capabilities proxy. Before the browser can request an EIP-7715
 * permission it needs the relayer's `targetAddress` (the only valid delegate)
 * and accepted USDC token — but calling the relayer JSON-RPC directly from the
 * page trips CORS. This same-origin GET forwards to the relayer's keyless
 * `getCapabilities`. No secrets, no signing; reads `chainId` from the query so
 * it runs at request time rather than being prerendered.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chainIdParam = searchParams.get('chainId')
  const chainId = chainIdParam ? Number(chainIdParam) : 84532
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return Response.json({ error: 'invalid chainId' }, { status: 400 })
  }

  try {
    const caps = await getCapabilities([chainId])
    return Response.json(caps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load relayer capabilities'
    return Response.json({ error: message }, { status: 502 })
  }
}
