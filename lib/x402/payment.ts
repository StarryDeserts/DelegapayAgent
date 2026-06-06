import { z } from 'zod'
import type { PaymentRequired } from './challenge'

/**
 * PAYMENT-SIGNATURE payload + verification for the simulated x402 handshake.
 *
 * Isomorphic by design: imports nothing server-only and uses TextEncoder/btoa
 * (present in Node 18+ and browsers) instead of Buffer, so the same module backs
 * both the client (builds the header) and the route (verifies it). The shared
 * cost constant and RiskScore type also live here so the client renders off the
 * exact shape the server returns, with no server import.
 */

/** Premium risk-check price, decimal USDC. Debited from the same mission budget ledger. */
export const PREMIUM_COST_USDC = '0.05'

/** The artifact the premium payment unlocks — a deterministic fraud/risk score. */
export interface RiskScore {
  /** 0–99; higher is riskier. Deterministic from the recipient + plan (no randomness). */
  score: number
  rating: 'low' | 'medium' | 'high'
  /** Human-readable reasons the score landed where it did. */
  flags: string[]
  /** Address (or "signer default") the score was computed for. */
  recipient: string
  /** Unix ms the score was produced. */
  checkedAt: number
}

/**
 * The decoded PAYMENT-SIGNATURE body. `permissionContext` must be non-empty —
 * an empty context is the §428-435 "permission response is empty" failure, so the
 * min(1) message is surfaced verbatim by verifyPaymentSignature.
 */
export const PaymentSignaturePayloadSchema = z.object({
  /** Echoes the challenge nonce; re-checked server-side. */
  nonce: z.string(),
  /** Payer (the simulated x402 delegator). */
  from: z.string(),
  asset: z.string(),
  /** Atoms paid, decimal string; must be ≥ the requirement amount. */
  amount: z.string(),
  permissionContext: z.array(z.unknown()).min(1, 'permission response is empty'),
})

export type PaymentSignaturePayload = z.infer<typeof PaymentSignaturePayloadSchema>

/** UTF-8-safe base64 without Buffer, so the module is safe in the client bundle. */
function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodePaymentSignature(payload: PaymentSignaturePayload): string {
  return toBase64(JSON.stringify(payload))
}

/** Decode a PAYMENT-SIGNATURE header value. Throws on bad base64 / bad JSON. */
export function decodePaymentSignature(headerValue: string): unknown {
  return JSON.parse(fromBase64(headerValue))
}

/**
 * Verification result. `status` lets the route map each failure to the right
 * HTTP code: 400 for a malformed/undecodable payload, 402 for a payment that is
 * structurally valid but doesn't satisfy the challenge (wrong nonce, underpaid).
 */
export type VerifiedPayment =
  | { ok: true; payload: PaymentSignaturePayload }
  | { ok: false; status: 400 | 402; error: string }

/**
 * Verify a paid request against the challenge the server re-derived for the same
 * body. Simulated: no on-chain settlement — we check the nonce binds to this
 * challenge, the amount covers the requirement, and the permission context is
 * present. Each failure is a visible MVP error (architecture.md §428-435).
 */
export function verifyPaymentSignature(headerValue: string | null, challenge: PaymentRequired): VerifiedPayment {
  if (!headerValue) {
    return { ok: false, status: 400, error: 'missing PAYMENT-SIGNATURE header' }
  }
  const requirement = challenge.accepts[0]
  if (!requirement) {
    return { ok: false, status: 400, error: 'challenge has no payment requirement' }
  }

  let decoded: unknown
  try {
    decoded = decodePaymentSignature(headerValue)
  } catch {
    return { ok: false, status: 400, error: 'PAYMENT-SIGNATURE is undecodable' }
  }

  const parsed = PaymentSignaturePayloadSchema.safeParse(decoded)
  if (!parsed.success) {
    // Surface the empty-permission-context failure verbatim; otherwise generic.
    const ctxIssue = parsed.error.issues.find((issue) => issue.path[0] === 'permissionContext')
    return { ok: false, status: 400, error: ctxIssue?.message ?? 'PAYMENT-SIGNATURE payload is malformed' }
  }
  const payload = parsed.data

  if (payload.nonce !== challenge.nonce) {
    return { ok: false, status: 402, error: 'payment nonce does not match the challenge' }
  }

  let paid: bigint
  let required: bigint
  try {
    paid = BigInt(payload.amount)
    required = BigInt(requirement.amount)
  } catch {
    return { ok: false, status: 400, error: 'payment amount is not an integer atom value' }
  }
  if (paid < required) {
    return { ok: false, status: 402, error: `insufficient payment: ${payload.amount} < required ${requirement.amount}` }
  }

  return { ok: true, payload }
}
