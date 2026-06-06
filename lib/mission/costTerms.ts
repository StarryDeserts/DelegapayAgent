/**
 * Single source of truth for the words the UI and tests use to describe money in
 * a mission. The product has several distinct cost concepts that were previously
 * blurred together (a "send 1 USDC" plan showing >1 "committed" because the
 * relayer fee and premium fee were folded in without labels). Centralizing the
 * vocabulary keeps the meter, the panels, the gate, and the harness assertions
 * in lockstep — change a term here, every surface follows.
 *
 *  - Transfer amount  — USDC actually sent to the recipient (the work leg).
 *  - Relayer fee      — execution fee paid to the 1Shot relayer (known after a dry run).
 *  - Premium fee      — x402 simulated risk-check unlock fee (only when the plan requires it).
 *  - Total committed  — transfer + relayer fee + premium fee; the real spend the
 *                       budget meter reflects. Only moves on confirmed settlement.
 *  - Grant allowance  — the wallet permission ceiling. Includes fee headroom and is
 *                       NOT the same as committed spend: granting an allowance signs
 *                       a spending cap, it does not move funds.
 */
export const COST_LABELS = {
  transfer: 'Transfer amount',
  relayerFee: 'Relayer fee',
  premiumFee: 'Premium fee',
  totalCommitted: 'Total committed',
  grantAllowance: 'Grant allowance',
} as const

export type CostLabelKey = keyof typeof COST_LABELS

export interface CommittedParts {
  transferUsdc?: string
  relayerFeeUsdc?: string
  premiumFeeUsdc?: string
}

/**
 * Sum the committed legs, tolerating blank/undefined parts (e.g. relayer fee is
 * unknown until the dry run returns). Non-numeric inputs count as 0 rather than
 * NaN-poisoning the total.
 */
export function totalCommittedUsdc(parts: CommittedParts): number {
  const n = (s?: string) => {
    const v = Number(s)
    return Number.isFinite(v) ? v : 0
  }
  return n(parts.transferUsdc) + n(parts.relayerFeeUsdc) + n(parts.premiumFeeUsdc)
}
