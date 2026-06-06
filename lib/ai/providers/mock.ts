import type { MissionInput, MissionPlan, Planner } from '../schema'

/**
 * Deterministic, key-free planner. Powers Phase 1 and tests: same input →
 * same plan, no network, no Math.random (so static prerender stays stable).
 * The heuristics are intentionally simple — real reasoning is the AI
 * providers' job; the mock only has to return a valid MissionPlan.
 */
const PERIODIC_HINTS = [
  'subscription',
  'subscribe',
  'recurring',
  'monthly',
  'weekly',
  'daily',
  'every month',
  'every week',
  'per month',
  'per week',
  '订阅',
  '每月',
  '每周',
  '每天',
  '定期',
]

const PREMIUM_HINTS = [
  'premium',
  'research',
  'deep dive',
  'analysis',
  'report',
  'x402',
  'paid api',
  '高级',
  '研究',
  '报告',
]

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n))
}

export function createMockPlanner(): Planner {
  return {
    id: 'mock',
    model: 'mock-deterministic',
    async plan(input: MissionInput): Promise<MissionPlan> {
      const task = input.task.toLowerCase()
      const periodic = includesAny(task, PERIODIC_HINTS)
      const premium = includesAny(task, PREMIUM_HINTS)

      return {
        summary: `Mock plan: allocate up to ${input.budgetUsdc} USDC to "${input.task.trim()}".`,
        requiredPermissionType: periodic ? 'erc20-token-periodic' : 'erc20-token-allowance',
        maxSpendUsdc: input.budgetUsdc,
        premiumToolRequired: premium,
        targetAction: null,
        riskChecks: [
          `Spend stays within the ${input.budgetUsdc} USDC delegated budget`,
          'Recipient / target is validated before any transfer',
          'No private key or seed phrase ever leaves the server',
        ],
      }
    },
  }
}
