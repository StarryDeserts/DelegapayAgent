import type { Planner } from '../schema'
import { createOpenAICompatiblePlanner } from './openaiCompatible'

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1'

/**
 * Optional provider. Venice is OpenAI-compatible and supports strict
 * json_schema, but we still validate with zod. The model varies per account,
 * so `VENICE_MODEL` is required rather than guessed.
 */
export function createVenicePlanner(env: NodeJS.ProcessEnv = process.env): Planner {
  const apiKey = env.VENICE_API_KEY
  if (!apiKey) {
    throw new Error('VENICE_API_KEY is not set')
  }
  const model = env.VENICE_MODEL
  if (!model) {
    throw new Error('VENICE_MODEL is required when using the Venice provider')
  }
  return createOpenAICompatiblePlanner({
    id: 'venice',
    baseUrl: env.VENICE_BASE_URL ?? VENICE_BASE_URL,
    apiKey,
    model,
  })
}
