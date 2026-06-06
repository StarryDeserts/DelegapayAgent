import { MissionInputSchema, generateMissionPlan } from '@/lib/ai'

/**
 * Server-only AI planner route. Keeps the provider API key on the server,
 * validates the request, and returns a zod-validated MissionPlan. With no key
 * configured this falls back to the deterministic mock planner.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 })
  }

  const parsed = MissionInputSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const result = await generateMissionPlan(parsed.data)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'planner failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
