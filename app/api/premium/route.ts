import { PremiumRequestSchema, runPremiumRoute } from '@/lib/x402/premium'

/**
 * Simulated x402 premium route — the one paid route in the MVP. Mirrors the
 * keyless relay route: it reads no PRIVATE_KEY/RPC and makes no chain call, so it
 * runs in CI and the headless harness can exercise it for real.
 *
 * Two legs, distinguished by the PAYMENT-SIGNATURE header:
 *  - absent  → 402 + PAYMENT-REQUIRED challenge (the unpaid leg)
 *  - present → verify against the body-derived challenge → 200 { resultId, riskScore }
 * Verification failures come back as 400 (malformed) / 402 (unsatisfied) with a
 * visible error; only unexpected faults map to 502.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 })
  }

  const parsed = PremiumRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const signature = request.headers.get('PAYMENT-SIGNATURE')
    const result = runPremiumRoute(signature, parsed.data)
    return Response.json(result.body, { status: result.status, headers: result.headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'premium route failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
