import { z } from 'zod'

/**
 * MissionPlan is the single source of truth for planner output.
 * Every provider — including the mock — must return data that passes this
 * schema. The AI's output is a *proposal*, never authority: shape is validated
 * here, business constraints elsewhere, and execution still goes through the
 * MetaMask delegation + 1Shot relayer checks.
 */
export const MissionPlanSchema = z.object({
  summary: z.string(),
  requiredPermissionType: z.enum(['erc20-token-allowance', 'erc20-token-periodic']),
  maxSpendUsdc: z.string(),
  premiumToolRequired: z.boolean(),
  targetAction: z.string().nullable(),
  riskChecks: z.array(z.string()),
})

export type MissionPlan = z.infer<typeof MissionPlanSchema>

/** Raw user request that drives a plan. Never carries secrets. */
export const MissionInputSchema = z.object({
  budgetUsdc: z.string().min(1),
  task: z.string().min(1),
})

export type MissionInput = z.infer<typeof MissionInputSchema>

export type ProviderId = 'deepseek' | 'venice' | 'openai-compatible' | 'mock'

/**
 * A Planner turns a MissionInput into raw JSON. It deliberately returns
 * `unknown`: validation against MissionPlanSchema is centralized in the
 * planner orchestration so no provider can bypass it.
 */
export interface Planner {
  readonly id: ProviderId
  readonly model: string
  plan(input: MissionInput): Promise<unknown>
}
