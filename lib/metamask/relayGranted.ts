import { formatUnits, getAddress, parseUnits } from 'viem'
import { z } from 'zod'
import { MissionPlanSchema } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import {
  estimate7710Transaction,
  getCapabilities,
  type Delegation7710,
  type Execution7710,
  type Send7710TransactionParams,
} from '@/lib/relayer'
import { encodeUsdcTransfer } from './delegation'
import {
  MOCK_FEE_USDC,
  pickUsdcToken,
  relayBundle,
  resultError,
  tokenDecimals,
  type ExecuteMissionResult,
} from './execute'

/**
 * Phase 4 orchestrator: redeem a permission the **user's own MetaMask** granted
 * via EIP-7715, routed through the same 1Shot relayer as Phase 3.
 *
 * This path is **keyless**. The delegation in `permissionContext` was already
 * signed in the browser, so the server never reads PRIVATE_KEY / RPC_URL and
 * never signs anything. It only assembles the executions, prices them against
 * the relayer, and (on explicit opt-in) submits + polls — all relayer JSON-RPC.
 *
 * Crucial difference from the local path: the delegation's allowance is fixed by
 * what MetaMask signed. We can rebuild executions when the real fee exceeds the
 * mock, but we can never re-sign for a larger scope — so if `fee + work` would
 * exceed the granted allowance, we fail with an actionable message instead.
 *
 * Safety posture matches Phase 3: `broadcast` defaults false (dry-run estimate),
 * and `recipient` defaults to the granting account itself (a self-transfer, so a
 * stray broadcast can't leak funds to a third party).
 */

/** 20-byte hex address. */
const HexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 20-byte 0x address')

/** One caveat from the granted delegation; passed through to the relayer verbatim. */
const CaveatSchema = z.object({
  enforcer: HexAddress,
  terms: z.string(),
  args: z.string(),
})

/**
 * A single granted delegation, structurally the relayer's Delegation7710. Decoded
 * in the browser from the EIP-7715 permission context and POSTed here as JSON.
 */
const DelegationSchema = z.object({
  delegate: HexAddress,
  delegator: HexAddress,
  authority: z.string(),
  caveats: z.array(CaveatSchema),
  salt: z.string(),
  signature: z.string(),
})

export const RelayGrantedInputSchema = z.object({
  chainId: z.number().int().positive(),
  /** Delegation chain from the MetaMask grant (length 1 for a direct delegation). */
  permissionContext: z.array(DelegationSchema).min(1, 'permissionContext must contain at least one delegation'),
  plan: MissionPlanSchema,
  /** Optional work-transfer recipient; defaults to the granting account (self-transfer). */
  recipient: HexAddress.optional(),
  /** Optional decimal USDC work amount; defaults to the plan budget (plan.maxSpendUsdc). */
  amountUsdc: z.string().min(1).optional(),
  /** USDC token the permission was granted against; defaults to the relayer's USDC by symbol. */
  usdc: HexAddress.optional(),
  /** Granted allowance (human USDC) that bounds fee + work; defaults to plan.maxSpendUsdc. */
  allowanceUsdc: z.string().min(1).optional(),
  /** Opt in to an actual on-chain send. Absent/false → dry-run estimate only. */
  broadcast: z.boolean().optional(),
})

export type RelayGrantedInput = z.infer<typeof RelayGrantedInputSchema>

export async function relayGrantedMission(input: RelayGrantedInput): Promise<ExecuteMissionResult> {
  const { plan, broadcast = false, chainId } = input
  const events: TimelineEvent[] = []

  // The delegator (granting smart account) anchors the default recipient, so a
  // stray broadcast is a self-transfer rather than a third-party leak.
  const delegation = input.permissionContext[0]
  const delegator = getAddress(delegation.delegator)

  // Step 1 — capabilities: where to send the fee, the USDC tokens, and the one
  // address the relayer will redeem a delegation through.
  const caps = await getCapabilities([chainId])
  const chainCap = caps[String(chainId)]
  if (!chainCap) {
    return resultError(events, broadcast, chainId, delegator, delegator, '0', `relayer does not support chain ${chainId}`)
  }
  events.push({ type: 'relayer.capabilities.loaded', targetAddress: chainCap.targetAddress, chainIds: [chainId] })

  // The relayer only redeems delegations granted to its own targetAddress. If the
  // browser granted to anything else, the relayer would reject it — fail fast with
  // a clear instruction rather than a cryptic relayer error.
  if (getAddress(delegation.delegate) !== getAddress(chainCap.targetAddress)) {
    return resultError(
      events,
      broadcast,
      chainId,
      delegator,
      delegator,
      '0',
      `granted permission delegates to ${delegation.delegate}, but this relayer redeems via ${chainCap.targetAddress} — re-grant with the relayer target`,
    )
  }

  const token = input.usdc
    ? pickUsdcToken(chainCap.tokens, getAddress(input.usdc))
    : (chainCap.tokens.find((t) => t.symbol?.toUpperCase() === 'USDC') ?? chainCap.tokens[0])
  if (!token) {
    return resultError(events, broadcast, chainId, delegator, delegator, '0', `relayer reports no payment tokens for chain ${chainId}`)
  }
  const usdc = getAddress(token.address)
  const decimals = tokenDecimals(token.decimals)

  const recipient = input.recipient ? getAddress(input.recipient) : delegator

  let maxSpendAtoms: bigint
  let workAmount: bigint
  let allowanceAtoms: bigint
  try {
    maxSpendAtoms = parseUnits(plan.maxSpendUsdc, decimals)
    allowanceAtoms = parseUnits(input.allowanceUsdc ?? plan.maxSpendUsdc, decimals)
    // No explicit amount → transfer the full planned budget. The grant carries
    // fee headroom above maxSpendUsdc, so fee + work still fits the allowance.
    workAmount = input.amountUsdc ? parseUnits(input.amountUsdc, decimals) : maxSpendAtoms
  } catch {
    return resultError(events, broadcast, chainId, delegator, recipient, '0', 'maxSpendUsdc / amountUsdc / allowanceUsdc is not a valid USDC amount')
  }

  if (workAmount <= BigInt(0)) {
    return resultError(events, broadcast, chainId, delegator, recipient, '0', 'amount must be greater than zero')
  }
  if (workAmount > maxSpendAtoms) {
    return resultError(
      events,
      broadcast,
      chainId,
      delegator,
      recipient,
      formatUnits(workAmount, decimals),
      `amount ${formatUnits(workAmount, decimals)} USDC exceeds plan budget ${plan.maxSpendUsdc} USDC`,
    )
  }

  // Step 2 — build the executions and price them. No authorizationList: MetaMask
  // upgraded the EOA to a 7702 smart account during the grant. No delegation
  // signing: it's fixed from the browser; we only (re)assemble the two transfers.
  let feeAmount = parseUnits(MOCK_FEE_USDC, decimals)

  const buildSendParams = (fee: bigint): Send7710TransactionParams => {
    const executions: Execution7710[] = [
      encodeUsdcTransfer(usdc, chainCap.feeCollector, fee),
      encodeUsdcTransfer(usdc, recipient, workAmount),
    ]
    return {
      chainId: String(chainId),
      transactions: [{ permissionContext: input.permissionContext as unknown as Delegation7710[], executions }],
    }
  }

  let sendParams = buildSendParams(feeAmount)
  let estimate = await estimate7710Transaction(sendParams)

  if (estimate.success && estimate.requiredPaymentAmount) {
    const required = BigInt(estimate.requiredPaymentAmount)
    if (required > feeAmount) {
      // The granted allowance is immutable (signed in MetaMask). We can rebuild
      // the executions with the real fee, but if fee + work overflows the budget
      // the user granted, there is no server-side re-sign that could rescue it.
      if (required + workAmount > allowanceAtoms) {
        return resultError(
          events,
          broadcast,
          chainId,
          delegator,
          recipient,
          formatUnits(workAmount, decimals),
          `relayer fee ${formatUnits(required, decimals)} + work ${formatUnits(workAmount, decimals)} USDC exceeds your granted budget ${formatUnits(allowanceAtoms, decimals)} USDC — grant a higher budget`,
        )
      }
      feeAmount = required
      sendParams = buildSendParams(feeAmount)
      estimate = await estimate7710Transaction(sendParams)
    }
  }

  // Step 3+4 — shared transport tail: estimate-check → (dry run stops) → submit →
  // poll → finalize. No onSignedEvents: the browser already emitted permission.granted.
  return relayBundle({
    events,
    broadcast,
    chainId,
    delegator,
    recipient,
    sendParams,
    estimate,
    workAmount,
    feeAmount,
    decimals,
  })
}
