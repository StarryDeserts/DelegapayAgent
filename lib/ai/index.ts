import type { MissionInput, MissionPlan, Planner, ProviderId } from './schema'
import { parseMissionPlan } from './planner'
import { createMockPlanner } from './providers/mock'
import { createDeepSeekPlanner } from './providers/deepseek'
import { createVenicePlanner } from './providers/venice'
import { createOpenAICompatiblePlannerFromEnv } from './providers/openaiCompatible'

export * from './schema'
export { buildSystemPrompt, buildUserPrompt, parseMissionPlan } from './planner'

/**
 * Pick a provider from the environment. Phase 1 default is the key-free mock,
 * so the app runs end-to-end with zero configuration. `AI_PROVIDER` forces a
 * specific provider; otherwise the first configured key wins.
 */
export function selectProvider(env: NodeJS.ProcessEnv = process.env): Planner {
  const explicit = env.AI_PROVIDER?.toLowerCase()

  if (explicit === 'mock') return createMockPlanner()
  if (explicit === 'deepseek') return createDeepSeekPlanner(env)
  if (explicit === 'venice') return createVenicePlanner(env)
  if (explicit === 'openai-compatible' || explicit === 'openai') {
    return createOpenAICompatiblePlannerFromEnv(env)
  }

  if (env.DEEPSEEK_API_KEY) return createDeepSeekPlanner(env)
  if (env.OPENAI_COMPATIBLE_API_KEY) return createOpenAICompatiblePlannerFromEnv(env)
  if (env.VENICE_API_KEY) return createVenicePlanner(env)
  return createMockPlanner()
}

export interface PlannerResult {
  provider: ProviderId
  model: string
  plan: MissionPlan
}

/**
 * The one entry point the API route should call: select a provider, get raw
 * output, and validate it against the MissionPlan contract before returning.
 */
export async function generateMissionPlan(
  input: MissionInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PlannerResult> {
  const provider = selectProvider(env)
  const raw = await provider.plan(input)
  const plan = parseMissionPlan(raw)
  return { provider: provider.id, model: provider.model, plan }
}
