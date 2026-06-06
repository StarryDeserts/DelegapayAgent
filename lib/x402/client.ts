import { formatUnits } from 'viem'
import type { MissionPlan } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import {
  USDC_DECIMALS,
  validatePaymentRequired,
  X402_FACILITATOR,
  X402_PAYER,
  X402_REDEEMER,
} from './challenge'
import { encodePaymentSignature, type PaymentSignaturePayload, type RiskScore } from './payment'

/**
 * Browser-side driver for the simulated x402 handshake. Pure (no `window`, no
 * hooks), so the client component can call it and CI can exercise it against the
 * real keyless route. It walks the official buyer flow (architecture.md §411-436)
 * — unpaid 402 → validate PAYMENT-REQUIRED → simulated fixed-allowance grant →
 * PAYMENT-SIGNATURE → unlock — and returns the three timeline events so the
 * console renders them through its existing onEvents plumbing.
 */

export interface RequestPremiumArgs {
  plan: MissionPlan
  /** Optional payee the score is about; omitted ⇒ the signer is scored. */
  recipient?: string
  /** Remaining mission budget (USDC). If the premium cost exceeds it, abort before paying (R1). */
  remainingUsdc?: number
}

export interface PremiumOutcome {
  ok: boolean
  /** Emitted in order regardless of outcome, so partial progress still renders. */
  events: TimelineEvent[]
  costUsdc?: string
  resultId?: string
  riskScore?: RiskScore
  error?: string
}

async function postPremium(body: string, signature?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // The paid leg adds PAYMENT-SIGNATURE; the body is byte-identical to the unpaid
  // leg so the server re-derives the same nonce.
  if (signature) headers['PAYMENT-SIGNATURE'] = signature
  return fetch('/api/premium', { method: 'POST', headers, body })
}

export async function requestPremium({ plan, recipient, remainingUsdc }: RequestPremiumArgs): Promise<PremiumOutcome> {
  const events: TimelineEvent[] = []
  // Byte-identical body for both legs (drives the deterministic server nonce).
  const body = JSON.stringify(recipient ? { plan, recipient } : { plan })

  try {
    // ── Unpaid leg: expect 402 + PAYMENT-REQUIRED ──────────────────────────────
    const unpaid = await postPremium(body)
    if (unpaid.status !== 402) {
      return { ok: false, events, error: `expected a 402 challenge, got ${unpaid.status}` }
    }
    const challengeBody = (await unpaid.json()) as { paymentRequired?: unknown }
    const validated = validatePaymentRequired(challengeBody.paymentRequired)
    if (!validated.ok) {
      return { ok: false, events, error: validated.error }
    }
    const { required, requirement } = validated

    const costUsdc = formatUnits(BigInt(requirement.amount), USDC_DECIMALS)
    events.push({ type: 'premium.challenge.received', costUsdc })

    // ── Budget guard (R1): never pay more than the remaining mission budget ─────
    if (remainingUsdc !== undefined && Number(costUsdc) > remainingUsdc) {
      return {
        ok: false,
        events,
        costUsdc,
        error: `premium cost ${costUsdc} USDC exceeds remaining budget ${remainingUsdc.toFixed(2)} USDC`,
      }
    }

    // ── Simulated fixed-allowance grant (distinct permission context, R3) ───────
    // The delegate is a reserved, synthetic address — never the live 1Shot relayer
    // targetAddress — and `simulated: true` keeps the provenance honest. Guard
    // defensively in case a future edit swaps in a real or relayer-bound address.
    if (X402_FACILITATOR.toLowerCase() === requirement.payTo.toLowerCase()) {
      return { ok: false, events, error: 'x402 grant delegate must differ from the payee' }
    }
    const permissionContext = [
      {
        delegate: X402_FACILITATOR,
        delegator: X402_PAYER,
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        asset: requirement.asset,
        amount: requirement.amount,
        redeemer: X402_REDEEMER,
        simulated: true,
      },
    ]
    events.push({
      type: 'permission.granted',
      flow: 'x402',
      amountUsdc: costUsdc,
      expiry: required.expiry,
      target: requirement.payTo,
    })

    // ── Paid leg: PAYMENT-SIGNATURE over the same body ──────────────────────────
    const payload: PaymentSignaturePayload = {
      nonce: required.nonce,
      from: X402_PAYER,
      asset: requirement.asset,
      amount: requirement.amount,
      permissionContext,
    }
    const paid = await postPremium(body, encodePaymentSignature(payload))
    const paidBody = (await paid.json()) as { resultId?: string; riskScore?: RiskScore; error?: string }
    if (!paid.ok) {
      return { ok: false, events, costUsdc, error: paidBody.error ?? `premium payment failed (${paid.status})` }
    }
    if (!paidBody.resultId || !paidBody.riskScore) {
      return { ok: false, events, costUsdc, error: 'premium response missing result' }
    }

    events.push({ type: 'premium.paid', resultId: paidBody.resultId })
    return {
      ok: true,
      events,
      costUsdc,
      resultId: paidBody.resultId,
      riskScore: paidBody.riskScore,
    }
  } catch (err) {
    return { ok: false, events, error: err instanceof Error ? err.message : 'network error' }
  }
}
