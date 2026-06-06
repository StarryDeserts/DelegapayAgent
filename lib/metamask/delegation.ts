import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem'
import { bytesToHex } from 'viem/utils'
import {
  ScopeType,
  TransferWindow,
  createDelegation,
  type MetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit'
import type { MissionPlan } from '@/lib/ai/schema'
import type { Delegation7710, Execution7710 } from '@/lib/relayer'

/**
 * Turn a validated plan + a concrete amount into a single signed ERC-7710
 * delegation scoped to USDC, plus the encoded executions the relayer redeems.
 *
 * Self-sponsored shape: ONE delegation whose scope covers `feeAmount +
 * workAmount`, and TWO executions (fee transfer to the relayer's feeCollector,
 * then the real work transfer). The relayer parses the fee leg to price the tx.
 */

type PermissionType = MissionPlan['requiredPermissionType']

/** Fresh 32-byte salt so two delegations never collide / replay. */
export function freshSalt(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

export interface BuildDelegationParams {
  smartAccount: MetaMaskSmartAccount
  /** = targetAddress from relayer capabilities (the only valid delegate). */
  to: Address
  usdc: Address
  /** Total USDC atoms the delegation may move (fee + work). */
  maxAmount: bigint
  permissionType: PermissionType
  salt: Hex
}

/**
 * Create a root delegation with the right caveat scope and sign it with the
 * smart account. Returns the relayer-ready `Delegation7710` (kit `Delegation`
 * fields are already hex, so no bigint conversion is needed).
 */
export async function buildSignedDelegation(params: BuildDelegationParams): Promise<Delegation7710> {
  const { smartAccount, to, usdc, maxAmount, permissionType, salt } = params

  const common = {
    environment: smartAccount.environment,
    from: smartAccount.address,
    to,
    salt,
  }

  // Inline the scope per branch so its discriminant `type` keeps its specific
  // literal. A shared `const scope = cond ? … : …` widens `type` to the whole
  // ScopeType enum and no longer matches the kit's discriminated ScopeConfig.
  const delegation =
    permissionType === 'erc20-token-periodic'
      ? createDelegation({
          ...common,
          scope: {
            type: ScopeType.Erc20PeriodTransfer,
            tokenAddress: usdc,
            periodAmount: maxAmount,
            periodDuration: TransferWindow.Daily,
            startDate: Math.floor(Date.now() / 1000),
          },
        })
      : createDelegation({
          ...common,
          scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc, maxAmount },
        })

  const signature = await smartAccount.signDelegation({ delegation })

  return { ...delegation, signature } as Delegation7710
}

/** Encode an ERC-20 `transfer(to, amount)` as a relayer execution. */
export function encodeUsdcTransfer(usdc: Address, to: Address, amount: bigint): Execution7710 {
  return {
    target: usdc,
    value: '0x0',
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }),
  }
}
