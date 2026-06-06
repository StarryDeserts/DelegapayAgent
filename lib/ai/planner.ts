import {
  MissionPlanSchema,
  type MissionInput,
  type MissionPlan,
} from './schema'

/**
 * Prompt + zod-parse helpers shared by every provider.
 *
 * The word "json" MUST appear in the prompt: DeepSeek (and other
 * OpenAI-compatible endpoints) require it when `response_format` is
 * `{ type: 'json_object' }`, otherwise the request is rejected.
 */
export function buildSystemPrompt(): string {
  return [
    'You are DelegaPay, a payment-mission planner for an AI agent operating on Base Sepolia with USDC.',
    'Given a budget and a task, return a single json object describing how the agent should spend a delegated budget.',
    'Return ONLY a json object with exactly these keys:',
    '- summary: string — one or two sentences describing the mission.',
    "- requiredPermissionType: either 'erc20-token-allowance' (one-off / fixed cap) or 'erc20-token-periodic' (recurring / subscription).",
    '- maxSpendUsdc: string — the maximum USDC to spend, never exceeding the provided budget.',
    '- premiumToolRequired: boolean — true if the task needs a paid (x402) premium tool.',
    '- targetAction: string or null — a short on-chain action label if one is clearly implied, otherwise null.',
    '- riskChecks: string[] — short safety checks to run before spending.',
    'Do not include any commentary outside the json object. Never request private keys or seed phrases.',
  ].join('\n')
}

export function buildUserPrompt(input: MissionInput): string {
  return [
    `Budget (USDC): ${input.budgetUsdc}`,
    `Task: ${input.task}`,
    'Respond with the json object now.',
  ].join('\n')
}

/**
 * Validate raw provider output against the MissionPlan contract.
 * Throws with a readable message on failure — callers surface this as a
 * timeline `validation failed` event rather than trusting free text.
 */
export function parseMissionPlan(raw: unknown): MissionPlan {
  const parsed = MissionPlanSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Planner returned an invalid MissionPlan: ${parsed.error.message}`)
  }
  return parsed.data
}
