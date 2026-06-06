import type { MissionInput, Planner, ProviderId } from '../schema'
import { buildSystemPrompt, buildUserPrompt } from '../planner'

/**
 * Generic OpenAI-compatible chat-completions planner. DeepSeek and Venice are
 * both thin configs over this. Returns RAW parsed JSON — the orchestration
 * layer validates it against MissionPlanSchema.
 *
 * Server-only: it reads an API key. Never import a configured instance into a
 * Client Component.
 */
export interface OpenAICompatibleConfig {
  id: ProviderId
  baseUrl: string
  apiKey: string
  model: string
  /** Some endpoints (e.g. Venice) support strict json_schema; default is json_object. */
  useJsonObject?: boolean
  /**
   * DeepSeek V4 hybrid models switch reasoning via a `thinking` body field.
   * Left undefined for endpoints that don't understand it (Venice, generic).
   */
  thinking?: 'enabled' | 'disabled'
}

export function createOpenAICompatiblePlanner(cfg: OpenAICompatibleConfig): Planner {
  return {
    id: cfg.id,
    model: cfg.model,
    async plan(input: MissionInput): Promise<unknown> {
      const body: Record<string, unknown> = {
        model: cfg.model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }
      // V4 hybrid models default thinking on across some gateways; set it
      // explicitly so JSON planning stays fast and temperature is respected.
      if (cfg.thinking) {
        body.thinking = { type: cfg.thinking }
      }

      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        throw new Error(`AI provider ${cfg.id} HTTP ${res.status}: ${errorBody.slice(0, 300)}`)
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error(`AI provider ${cfg.id} returned no message content`)
      }

      try {
        return JSON.parse(content)
      } catch {
        throw new Error(`AI provider ${cfg.id} returned non-JSON content`)
      }
    },
  }
}

/** Build a generic OpenAI-compatible planner from env (escape hatch / custom endpoints). */
export function createOpenAICompatiblePlannerFromEnv(env: NodeJS.ProcessEnv = process.env): Planner {
  const baseUrl = env.OPENAI_COMPATIBLE_BASE_URL
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY
  const model = env.OPENAI_COMPATIBLE_MODEL
  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      'openai-compatible provider requires OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_API_KEY and OPENAI_COMPATIBLE_MODEL',
    )
  }
  return createOpenAICompatiblePlanner({ id: 'openai-compatible', baseUrl, apiKey, model })
}
