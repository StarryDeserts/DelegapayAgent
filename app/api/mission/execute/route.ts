import { MissionExecuteInputSchema, executeMission } from '@/lib/metamask'

/**
 * Server-only mission execution route. Reads PRIVATE_KEY / RPC_URL from the
 * server environment to sign an ERC-7710 delegation and drive the 1Shot relayer
 * — the signing key never reaches the client bundle.
 *
 * `broadcast` defaults to false: the default response is a dry-run estimate that
 * never touches the chain. Expected outcomes (unconfigured signer, over-budget
 * amount, relayer-rejected estimate) come back as `{ ok: false, error }` with a
 * 200 so the timeline can render them; only unexpected faults map to 502.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 })
  }

  const parsed = MissionExecuteInputSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const result = await executeMission(parsed.data)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'execution failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
