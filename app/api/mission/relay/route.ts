import { RelayGrantedInputSchema, relayGrantedMission } from '@/lib/metamask/relayGranted'

/**
 * Keyless Phase 4 relay route. Redeems a permission the user's own MetaMask
 * granted via EIP-7715 — the signed delegation arrives in the request body, so
 * this route never reads PRIVATE_KEY / RPC_URL and never signs anything.
 *
 * `broadcast` defaults to false: the default response is a dry-run estimate that
 * never touches the chain. Expected outcomes (chain unsupported, wrong delegate,
 * over-budget amount, relayer-rejected estimate) come back as `{ ok: false,
 * error }` with a 200 so the timeline can render them; only unexpected faults
 * map to 502.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 })
  }

  const parsed = RelayGrantedInputSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const result = await relayGrantedMission(parsed.data)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'relay failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
