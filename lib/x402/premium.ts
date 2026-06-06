import { z } from 'zod'
import { keccak256, stringToHex } from 'viem'
import { MissionPlanSchema, type MissionPlan } from '@/lib/ai/schema'
import { buildPaymentRequired, X402_RESOURCE } from './challenge'
import { PREMIUM_COST_USDC, verifyPaymentSignature, type RiskScore } from './payment'

/**
 * Orchestrates the simulated x402 premium route (the only paid route in the MVP,
 * architecture.md §393). Keyless and stateless: it reads no PRIVATE_KEY/RPC and
 * keeps no session store. The challenge nonce is DERIVED deterministically from
 * the request body, so the paid leg re-builds the identical challenge the unpaid
 * leg returned and can verify the PAYMENT-SIGNATURE without server-side state.
 */

const HexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'invalid address')

export const PremiumRequestSchema = z.object({
  plan: MissionPlanSchema,
  /** Optional payee the risk score is about; absent ⇒ the signer is the recipient. */
  recipient: HexAddress.optional(),
})

export type PremiumRequest = z.infer<typeof PremiumRequestSchema>

/** Label used when no external recipient is supplied (score is about the signer). */
const SIGNER_DEFAULT = 'signer default'

/**
 * Deterministic nonce bound to this exact mission. Because both the unpaid and
 * paid requests POST the identical body, the server re-derives the same nonce on
 * each leg — no nonce store needed, yet a PAYMENT-SIGNATURE minted for one plan
 * cannot satisfy a different plan's challenge.
 */
export function deriveNonce(plan: MissionPlan): string {
  return keccak256(stringToHex(`${plan.summary}|${X402_RESOURCE}`))
}

function rate(score: number): RiskScore['rating'] {
  if (score < 34) return 'low'
  if (score < 67) return 'medium'
  return 'high'
}

/**
 * Deterministic 0–99 score from the recipient + plan. No randomness, so the route
 * prerenders/tests cleanly and the same mission always yields the same score.
 */
function deterministicScore(plan: MissionPlan, recipient: string): number {
  const seed = keccak256(
    stringToHex(`risk|${recipient}|${plan.summary}|${plan.maxSpendUsdc}|${plan.targetAction ?? ''}`),
  )
  return parseInt(seed.slice(2, 10), 16) % 100
}

function buildFlags(plan: MissionPlan, recipient: string, rating: RiskScore['rating']): string[] {
  const flags: string[] = []
  flags.push(
    recipient === SIGNER_DEFAULT
      ? 'recipient defaults to the signer (no external payee)'
      : `external recipient ${recipient}`,
  )
  const spend = Number(plan.maxSpendUsdc)
  flags.push(
    Number.isFinite(spend) && spend >= 10
      ? `elevated spend cap (${plan.maxSpendUsdc} USDC)`
      : `spend cap ${plan.maxSpendUsdc} USDC within low band`,
  )
  if (rating === 'high') flags.push('manual review recommended before release')
  for (const check of plan.riskChecks.slice(0, 2)) flags.push(`plan check: ${check}`)
  return flags
}

export function scoreMission(plan: MissionPlan, recipient: string): RiskScore {
  const score = deterministicScore(plan, recipient)
  const rating = rate(score)
  return {
    score,
    rating,
    flags: buildFlags(plan, recipient, rating),
    recipient,
    checkedAt: Date.now(),
  }
}

export interface PremiumRouteResult {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * The route's whole decision. No PAYMENT-SIGNATURE ⇒ the unpaid leg: return a 402
 * with the challenge (and the PAYMENT-REQUIRED header marker). Otherwise verify
 * the signature against the re-derived challenge and, on success, return the
 * unlocked risk score; verification failures map to their own status + message.
 */
export function runPremiumRoute(signature: string | null, input: PremiumRequest): PremiumRouteResult {
  const nonce = deriveNonce(input.plan)
  const challenge = buildPaymentRequired({ costUsdc: PREMIUM_COST_USDC, nonce })

  if (!signature) {
    return {
      status: 402,
      body: { paymentRequired: challenge },
      headers: { 'PAYMENT-REQUIRED': '1' },
    }
  }

  const verified = verifyPaymentSignature(signature, challenge)
  if (!verified.ok) {
    return { status: verified.status, body: { error: verified.error } }
  }

  const recipient = input.recipient ?? SIGNER_DEFAULT
  const riskScore = scoreMission(input.plan, recipient)
  const resultId = `risk-${nonce.slice(2, 14)}`
  return { status: 200, body: { resultId, riskScore } }
}
