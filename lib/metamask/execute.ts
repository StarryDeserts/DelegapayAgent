import { formatUnits, getAddress, parseUnits, type Address } from 'viem'
import { z } from 'zod'
import { MissionPlanSchema, type MissionPlan } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import {
  estimate7710Transaction,
  getCapabilities,
  getStatus,
  isTerminalStatus,
  send7710Transaction,
  RelayerStatus,
  type AuthorizationListEntry,
  type Delegation7710,
  type Estimate7710TransactionResult,
  type Execution7710,
  type Send7710TransactionParams,
} from '@/lib/relayer'
import { createLocalSigner, type LocalSigner } from './localSigner'
import { buildAuthorization, checkUpgrade } from './accountChecks'
import { buildSignedDelegation, encodeUsdcTransfer, freshSalt } from './delegation'

/**
 * The Phase 3 orchestrator: turn a validated mission plan into a real ERC-7710
 * delegated USDC transfer on Base Sepolia, routed through the 1Shot relayer.
 *
 * Self-sponsored shape (one delegation, two executions): the signer's own smart
 * account both pays the relayer fee and performs the work transfer. The
 * delegation scope covers `feeAmount + workAmount`; execution[0] pays the fee to
 * the relayer's feeCollector, execution[1] is the actual work transfer.
 *
 * Safety posture for a money-moving demo:
 *  - `broadcast` defaults to false → estimate-only dry run, nothing irreversible.
 *  - `recipient` defaults to the signer's OWN address → a self-transfer, so a
 *    careless broadcast can't leak funds to a third party.
 *  - `amountUsdc` defaults to `plan.maxSpendUsdc` (the mission's amount) and is
 *    capped there; the relayer fee rides on top.
 * Expected failures (unconfigured signer, over-budget amount, relayer rejects
 * the estimate) come back as `{ ok: false, error }`; only genuinely unexpected
 * faults throw, so the route can map them to 502.
 */

/** Mock fee leg; the relayer floors this at the chain/token minFee. */
export const MOCK_FEE_USDC = '0.01'
/** Stop polling getStatus after this long; the task may still land later. */
const POLL_DEADLINE_MS = 120_000
const POLL_INTERVAL_MS = 3_000

export const MissionExecuteInputSchema = z.object({
  plan: MissionPlanSchema,
  /** Optional 20-byte hex address; defaults to the signer's own EOA. */
  recipient: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'recipient must be a 20-byte 0x address')
    .optional(),
  /** Optional decimal USDC string; defaults to the plan budget (plan.maxSpendUsdc). */
  amountUsdc: z.string().min(1).optional(),
  /** Opt in to an actual on-chain send. Absent/false → dry-run estimate only. */
  broadcast: z.boolean().optional(),
})

export type MissionExecuteInput = z.infer<typeof MissionExecuteInputSchema>

export interface ExecuteMissionResult {
  ok: boolean
  broadcast: boolean
  /** Ordered timeline events for the client to wrap + render. */
  events: TimelineEvent[]
  chainId: number
  delegator: Address
  recipient: Address
  /** Work transfer amount, human USDC. */
  amountUsdc: string
  /** Final relayer fee (max of mock fee and requiredPaymentAmount), human USDC. */
  feeUsdc?: string
  taskId?: string
  txHash?: string
  /** Terminal relayer status code (200 confirmed, 400 rejected, 500 reverted). */
  status?: number
  /** Set when ok is false: a human-readable reason. */
  error?: string
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Normalize capability decimals (may arrive as a numeric string) to a number. */
export function tokenDecimals(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : 6
}

/**
 * Resolve the USDC payment token from relayer capabilities: prefer an exact
 * address match against the configured USDC, then a USDC symbol, then the first
 * accepted token.
 */
export function pickUsdcToken(
  tokens: { address: Address; symbol?: string; decimals: number | string }[],
  usdc: Address,
) {
  const lower = usdc.toLowerCase()
  return (
    tokens.find((t) => t.address.toLowerCase() === lower) ??
    tokens.find((t) => t.symbol?.toUpperCase() === 'USDC') ??
    tokens[0]
  )
}

/**
 * Run the mission. `env` is injectable for tests; in the route it is
 * `process.env`. Reads PRIVATE_KEY / RPC_URL server-side only.
 */
export async function executeMission(
  input: MissionExecuteInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ExecuteMissionResult> {
  const { plan, broadcast = false } = input
  const events: TimelineEvent[] = []

  let signer: LocalSigner
  try {
    signer = await createLocalSigner(env)
  } catch (err) {
    // Unconfigured/placeholder PRIVATE_KEY or RPC_URL — an expected, actionable
    // misconfiguration, not a crash. Surface the message so the user can fix it.
    return failure(events, broadcast, err)
  }

  const { account, publicClient, smartAccount, chainId, usdcAddress } = signer
  const delegator = account.address

  // Step 1 — capabilities: the relayer tells us where to send the fee and the
  // single address we are allowed to delegate to.
  const caps = await getCapabilities([chainId])
  const chainCap = caps[String(chainId)]
  if (!chainCap) {
    return resultError(events, broadcast, chainId, delegator, delegator, '0', `relayer does not support chain ${chainId}`)
  }
  events.push({ type: 'relayer.capabilities.loaded', targetAddress: chainCap.targetAddress, chainIds: [chainId] })

  const token = pickUsdcToken(chainCap.tokens, usdcAddress)
  if (!token) {
    return resultError(events, broadcast, chainId, delegator, delegator, '0', `relayer reports no payment tokens for chain ${chainId}`)
  }
  const usdc = getAddress(token.address)
  const decimals = tokenDecimals(token.decimals)

  // Resolve recipient + amounts. Default recipient is the signer itself, so a
  // stray broadcast is a self-transfer rather than a third-party leak.
  const recipient = input.recipient ? getAddress(input.recipient) : delegator

  let maxSpendAtoms: bigint
  let workAmount: bigint
  try {
    maxSpendAtoms = parseUnits(plan.maxSpendUsdc, decimals)
    // No explicit amount → transfer the full planned budget (the mission's
    // amount), not a fixed demo stub. The cap check below still bounds it.
    workAmount = input.amountUsdc ? parseUnits(input.amountUsdc, decimals) : maxSpendAtoms
  } catch {
    return resultError(events, broadcast, chainId, delegator, recipient, '0', 'maxSpendUsdc / amountUsdc is not a valid USDC amount')
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

  // Step 2 — EIP-7702 upgrade check. If the EOA isn't yet pointed at the
  // Stateless7702 implementation, the relayer needs a signed authorization to
  // upgrade it in-flight (one entry max).
  const implAddress = resolveImplAddress(smartAccount)
  const upgrade = await checkUpgrade(publicClient, delegator, implAddress)
  events.push({ type: 'account.upgrade.checked', upgraded: upgrade.upgraded })

  let authorizationList: AuthorizationListEntry[] | undefined
  if (upgrade.needsAuthorization) {
    authorizationList = [await buildAuthorization(account, publicClient, chainId, implAddress)]
  }

  // Step 3 — build + sign the bundle, then estimate. The mock fee leg lets the
  // relayer price the tx; if it wants more than our mock, we re-sign once with
  // the higher fee (delegation terms changed → new signature required).
  let feeAmount = parseUnits(MOCK_FEE_USDC, decimals)

  const buildSendParams = async (fee: bigint): Promise<Send7710TransactionParams> => {
    const maxAmount = fee + workAmount
    const delegation: Delegation7710 = await buildSignedDelegation({
      smartAccount,
      to: chainCap.targetAddress,
      usdc,
      maxAmount,
      permissionType: plan.requiredPermissionType,
      salt: freshSalt(),
    })
    const executions: Execution7710[] = [
      encodeUsdcTransfer(usdc, chainCap.feeCollector, fee),
      encodeUsdcTransfer(usdc, recipient, workAmount),
    ]
    return {
      chainId: String(chainId),
      transactions: [{ permissionContext: [delegation], executions }],
      ...(authorizationList ? { authorizationList } : {}),
    }
  }

  let sendParams = await buildSendParams(feeAmount)
  let estimate = await estimate7710Transaction(sendParams)

  if (estimate.success && estimate.requiredPaymentAmount) {
    const required = BigInt(estimate.requiredPaymentAmount)
    if (required > feeAmount) {
      feeAmount = required
      sendParams = await buildSendParams(feeAmount)
      estimate = await estimate7710Transaction(sendParams)
    }
  }

  // Step 4+5 — hand the final signed bundle + estimate to the shared transport
  // tail (estimate-check → submit → poll → finalize). The delegation.signed
  // event is local-path provenance: the delegation we just signed scopes exactly
  // fee+work. It rides as an onSignedEvent so it only lands on a successful
  // estimate, immediately before relayer.estimate.created — preserving the
  // original event order.
  const maxAmount = feeAmount + workAmount
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
    onSignedEvents: [
      { type: 'delegation.signed', from: delegator, to: chainCap.targetAddress, amountUsdc: formatUnits(maxAmount, decimals) },
    ],
  })
}

export interface RelayBundleArgs {
  /** Accumulated timeline so far; relayBundle appends to it in place. */
  events: TimelineEvent[]
  broadcast: boolean
  chainId: number
  delegator: Address
  recipient: Address
  /** Final built + signed bundle; `context` is filled from the estimate on broadcast. */
  sendParams: Send7710TransactionParams
  /** Final estimate for that bundle, after any caller-side fee re-price. */
  estimate: Estimate7710TransactionResult
  /** Work transfer atoms. */
  workAmount: bigint
  /** Final relayer fee atoms (max of mock fee and requiredPaymentAmount). */
  feeAmount: bigint
  decimals: number
  /**
   * Path-specific events appended only after a successful estimate, just before
   * `relayer.estimate.created` (e.g. the local path's `delegation.signed`). The
   * browser path omits this — its delegation was signed in MetaMask and the
   * client emits `permission.granted` instead.
   */
  onSignedEvents?: TimelineEvent[]
}

/**
 * Signer-agnostic relayer transport tail shared by both signing paths: the
 * Phase 3 server-key flow (executeMission) and the Phase 4 MetaMask flow
 * (relayGrantedMission). Given a final signed bundle and its estimate, it checks
 * the estimate, emits the estimate timeline event, returns the dry-run result,
 * and — only when `broadcast` is true — submits with the price-lock context and
 * polls to a terminal status. Nothing here reads a private key.
 */
export async function relayBundle(args: RelayBundleArgs): Promise<ExecuteMissionResult> {
  const { events, broadcast, chainId, delegator, recipient, sendParams, estimate, workAmount, feeAmount, decimals } = args

  if (!estimate.success) {
    return resultError(
      events,
      broadcast,
      chainId,
      delegator,
      recipient,
      formatUnits(workAmount, decimals),
      estimate.error ?? 'relayer rejected the transaction estimate',
    )
  }

  if (args.onSignedEvents?.length) events.push(...args.onSignedEvents)
  events.push({ type: 'relayer.estimate.created', feeUsdc: formatUnits(feeAmount, decimals) })

  const base: ExecuteMissionResult = {
    ok: true,
    broadcast,
    events,
    chainId,
    delegator,
    recipient,
    amountUsdc: formatUnits(workAmount, decimals),
    feeUsdc: formatUnits(feeAmount, decimals),
  }

  // Dry run stops here: a signed, validated, priced bundle that never touched
  // the chain. Everything below moves real testnet USDC.
  if (!broadcast) {
    return base
  }

  // Step 4 — submit with the signed price-lock context from the estimate.
  const taskId = await send7710Transaction({ ...sendParams, context: estimate.context })
  events.push({ type: 'relayer.transaction.submitted', taskId })

  // Step 5 — poll until terminal (or give up; the task may still confirm later).
  const final = await pollUntilTerminal(taskId, chainId)
  if (!final) {
    return { ...base, ok: false, taskId, error: 'timed out waiting for relayer confirmation — the task may still confirm; check status later' }
  }

  const txHash = final.receipt?.transactionHash ?? final.hash
  const confirmed = final.status === RelayerStatus.Confirmed
  events.push({
    type: 'relayer.transaction.finalized',
    txHash,
    status: confirmed ? 'success' : 'failed',
  })

  return {
    ...base,
    ok: confirmed,
    taskId,
    txHash,
    status: final.status,
    ...(confirmed ? {} : { error: final.message ?? `relayer status ${final.status}` }),
  }
}

/** Poll getStatus every few seconds; resolve on a terminal status or null on timeout. */
async function pollUntilTerminal(taskId: `0x${string}`, chainId: number) {
  const deadline = Date.now() + POLL_DEADLINE_MS
  while (Date.now() < deadline) {
    const status = await getStatus({ id: taskId, logs: false }, chainId)
    if (isTerminalStatus(status.status)) {
      return status
    }
    await sleep(POLL_INTERVAL_MS)
  }
  return null
}

/** The Stateless7702 implementation address the EOA must delegate its code to. */
function resolveImplAddress(smartAccount: LocalSigner['smartAccount']): Address {
  const impl = smartAccount.environment.implementations.EIP7702StatelessDeleGatorImpl
  if (!impl) {
    throw new Error('smart-accounts environment is missing EIP7702StatelessDeleGatorImpl — unsupported chain/version')
  }
  return getAddress(impl)
}

/** Shape a SignerConfigError (or any thrown value) into an ok:false result. */
function failure(events: TimelineEvent[], broadcast: boolean, err: unknown): ExecuteMissionResult {
  const error = err instanceof Error ? err.message : String(err)
  return {
    ok: false,
    broadcast,
    events,
    chainId: 0,
    delegator: '0x0000000000000000000000000000000000000000',
    recipient: '0x0000000000000000000000000000000000000000',
    amountUsdc: '0',
    error,
  }
}

export function resultError(
  events: TimelineEvent[],
  broadcast: boolean,
  chainId: number,
  delegator: Address,
  recipient: Address,
  amountUsdc: string,
  error: string,
): ExecuteMissionResult {
  return { ok: false, broadcast, events, chainId, delegator, recipient, amountUsdc, error }
}

export type { MissionPlan }
