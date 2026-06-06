import { z } from 'zod'
import { parseUnits } from 'viem'

/**
 * x402 PAYMENT-REQUIRED challenge — the unpaid-request body the premium route
 * returns with a 402. Pure and keyless: no chain call, no env, no secrets, so it
 * is safe in the client bundle and runs in CI. Mirrors the official x402 buyer
 * handshake (architecture.md §411-436): the server offers one or more payment
 * requirements; the client validates them, requests a fixed ERC-20 allowance for
 * the chosen one, and replies with a PAYMENT-SIGNATURE.
 *
 * This is the *simulated-first* route: the handshake, the budget binding, and the
 * timeline events are real, but the payment itself is never settled on-chain.
 */

export const X402_VERSION = 1
export const X402_NETWORK = 'base-sepolia'
export const USDC_DECIMALS = 6
/** erc7710 = the asset is moved via a redeemed ERC-7710 delegation, not a raw transfer. */
export const X402_ASSET_TRANSFER_METHOD = 'erc7710'
/** Logical resource the premium payment unlocks. Echoed in the challenge + nonce derivation. */
export const X402_RESOURCE = 'https://delegapay.local/premium/risk-score'
/** Challenge validity window. The paid request must arrive within this many seconds. */
export const X402_CHALLENGE_TTL_SECONDS = 120

/**
 * Base Sepolia USDC — the same token the relayer path uses, but bound to a
 * DISTINCT x402 permission context (architecture.md §438-440). The x402
 * fixed-allowance permission authorizes the facilitator/payee below, NOT the
 * 1Shot relayer's redemption `targetAddress`. These synthetic, reserved
 * addresses are distinct from any live relayer target by construction (R3), so
 * the premium spend can never be redeemed through the relayer delegation.
 */
export const X402_USDC_ASSET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
export const X402_PAYEE = '0x000000000000000000000000000000000000F402'
export const X402_FACILITATOR = '0x000000000000000000000000000000000000FaC1'
export const X402_REDEEMER = '0x000000000000000000000000000000000000fED2'
/** Simulated buyer/delegator that authorizes the premium spend (the `from` of the payment). */
export const X402_PAYER = '0x000000000000000000000000000000000000bA00'

const HexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'invalid address')

/**
 * `assetTransferMethod` and facilitator/redeemer are validated loosely here so a
 * wrong/missing value still *parses* into the structure — validatePaymentRequired
 * then runs the §428-435 semantic checks and returns a precise error per case
 * (wrong method vs. missing facilitator), instead of an opaque zod issue.
 */
export const PaymentRequirementExtraSchema = z.object({
  assetTransferMethod: z.string(),
  facilitator: z.string().optional(),
  redeemer: z.string().optional(),
})

export const PaymentRequirementSchema = z.object({
  scheme: z.literal('exact'),
  network: z.string(),
  asset: HexAddress,
  /** Atoms (USDC has 6 decimals), as a decimal string. */
  amount: z.string(),
  payTo: HexAddress,
  resource: z.string(),
  description: z.string(),
  extra: PaymentRequirementExtraSchema,
})

export const PaymentRequiredSchema = z.object({
  x402Version: z.number(),
  /** Kept permissive (no .min(1)) so an empty offer parses and yields a precise error. */
  accepts: z.array(PaymentRequirementSchema),
  resource: z.string(),
  nonce: z.string(),
  /** Unix seconds the challenge expires. */
  expiry: z.number(),
})

export type PaymentRequirement = z.infer<typeof PaymentRequirementSchema>
export type PaymentRequired = z.infer<typeof PaymentRequiredSchema>

export interface BuildPaymentRequiredArgs {
  /** Premium tool price, decimal USDC (e.g. "0.05"). */
  costUsdc: string
  /** Caller-derived nonce (deterministic; see lib/x402/premium deriveNonce). */
  nonce: string
  resource?: string
}

/** Build the 402 challenge body for a given cost + nonce. Pure. */
export function buildPaymentRequired({ costUsdc, nonce, resource }: BuildPaymentRequiredArgs): PaymentRequired {
  const res = resource ?? X402_RESOURCE
  const amount = parseUnits(costUsdc, USDC_DECIMALS).toString()
  const expiry = Math.floor(Date.now() / 1000) + X402_CHALLENGE_TTL_SECONDS
  return {
    x402Version: X402_VERSION,
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK,
        asset: X402_USDC_ASSET,
        amount,
        payTo: X402_PAYEE,
        resource: res,
        description: 'DelegaPay premium risk score for the planned payment',
        extra: {
          assetTransferMethod: X402_ASSET_TRANSFER_METHOD,
          facilitator: X402_FACILITATOR,
          redeemer: X402_REDEEMER,
        },
      },
    ],
    resource: res,
    nonce,
    expiry,
  }
}

/**
 * Result of validating a PAYMENT-REQUIRED challenge. On success it carries the
 * chosen requirement plus non-optional facilitator/redeemer so the client can use
 * them without re-narrowing. On failure, `error` is the visible MVP failure
 * message (architecture.md §428-435).
 */
export type ValidatedPaymentRequired =
  | { ok: true; required: PaymentRequired; requirement: PaymentRequirement; facilitator: string; redeemer: string }
  | { ok: false; error: string }

/**
 * Run the official-flow validation gates on a decoded challenge. Each gate maps
 * to a distinct, visible failure: undecodable body, no requirement offered,
 * unsupported transfer method (must be erc7710), or missing facilitator/redeemer.
 */
export function validatePaymentRequired(value: unknown): ValidatedPaymentRequired {
  const parsed = PaymentRequiredSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: 'PAYMENT-REQUIRED is malformed or undecodable' }
  }
  const required = parsed.data
  const requirement = required.accepts[0]
  if (!requirement) {
    return { ok: false, error: 'PAYMENT-REQUIRED offered no payment requirement' }
  }
  if (requirement.extra.assetTransferMethod !== X402_ASSET_TRANSFER_METHOD) {
    return {
      ok: false,
      error: `unsupported asset transfer method "${requirement.extra.assetTransferMethod}" (expected ${X402_ASSET_TRANSFER_METHOD})`,
    }
  }
  const { facilitator, redeemer } = requirement.extra
  if (!facilitator || !redeemer) {
    return { ok: false, error: 'PAYMENT-REQUIRED is missing the facilitator/redeemer binding' }
  }
  return { ok: true, required, requirement, facilitator, redeemer }
}
