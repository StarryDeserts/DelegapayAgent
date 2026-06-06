import type { Planner } from '../schema'
import { createOpenAICompatiblePlanner } from './openaiCompatible'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/**
 * Default provider. Use `deepseek-v4-flash`, NOT the legacy
 * `deepseek-chat` / `deepseek-reasoner` (those retire 2026-07-24).
 * DeepSeek's native API has no strict json_schema, so we rely on
 * `response_format: json_object` + the word "json" in the prompt + zod.
 */
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash'

export function createDeepSeekPlanner(env: NodeJS.ProcessEnv = process.env): Planner {
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set')
  }
  return createOpenAICompatiblePlanner({
    id: 'deepseek',
    baseUrl: env.DEEPSEEK_API_BASE_URL ?? DEEPSEEK_BASE_URL,
    apiKey,
    model: env.DEEPSEEK_MODEL ?? DEEPSEEK_DEFAULT_MODEL,
    // Non-thinking by default for fast, deterministic JSON planning; flip with DEEPSEEK_THINKING=enabled.
    thinking: env.DEEPSEEK_THINKING === 'enabled' ? 'enabled' : 'disabled',
  })
}
