'use client'

import { createWalletClient, custom, formatUnits, getAddress, parseUnits, type Address, type EIP1193Provider } from 'viem'
import { baseSepolia } from 'viem/chains'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { decodeDelegations } from '@metamask/smart-accounts-kit/utils'
import type { MissionPlan } from '@/lib/ai/schema'
import type { Delegation7710 } from '@/lib/relayer'

/**
 * The ONLY module that touches `window.ethereum` and the MetaMask EIP-7715 kit
 * actions. Everything browser/wallet-specific is contained here behind the
 * narrow `WalletPermissionsClient` interface, so the rest of the app depends on
 * the interface (and CI swaps in a stub). EIP-7715 failures surface as typed
 * results/throws rather than crashing the console.
 *
 * `'use client'` keeps it in the client bundle and out of any server path — it
 * never imports the server-only localSigner / execute modules.
 */

type PermissionType = MissionPlan['requiredPermissionType']

const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id // 84532
const BASE_SEPOLIA_CHAIN_HEX = `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` as const
const USDC_DECIMALS = 6
/** Daily window for the periodic permission variant. */
const PERIOD_DURATION_SECONDS = 86_400
const DEFAULT_EXPIRY_SECONDS = 3_600

/**
 * Fee headroom added on top of the work cap when requesting the grant. The
 * wallet path defaults the transfer to the full plan budget (maxSpendUsdc), and
 * the relayer fee rides on top — but the signed allowance is immutable once
 * MetaMask signs it, so it must already cover fee + work. We therefore authorize
 * `maxSpendUsdc + headroom`. The relayer floors its fee near 0.01 USDC and gas
 * for two ERC-20 transfers doesn't scale with the amount, so a flat 0.10 is
 * comfortably safe without meaningfully over-authorizing.
 */
export const GRANT_FEE_HEADROOM_USDC = '0.10'

/** `maxSpendUsdc + fee headroom`, as a decimal USDC string (atoms math stays exact). */
export function grantBudgetWithHeadroom(maxSpendUsdc: string): string {
  const atoms = parseUnits(maxSpendUsdc, USDC_DECIMALS) + parseUnits(GRANT_FEE_HEADROOM_USDC, USDC_DECIMALS)
  return formatUnits(atoms, USDC_DECIMALS)
}

export interface WalletDetect {
  hasProvider: boolean
  /** Current wallet chain, when a provider is present. */
  chainId?: number
  onBaseSepolia: boolean
  /** Whether the wallet advertises the plan's permission type on Base Sepolia (EIP-7715). */
  supported: boolean
  /** Echoed back so the panel can message about the exact permission it needs. */
  permissionType: PermissionType
}

export interface GrantArgs {
  /** Whole budget to authorize, decimal USDC (the granted allowance). */
  budgetUsdc: string
  permissionType: PermissionType
  /** Relayer redemption address — the only valid delegate (`to`). */
  targetAddress: Address
  /** USDC token the allowance is scoped to. */
  usdc: Address
  /** Human-readable reason shown in the MetaMask permission UI. */
  justification?: string
  expirySeconds?: number
}

export interface GrantResult {
  /** Decoded permission context, relayer-ready. */
  delegations: Delegation7710[]
  /** Unix seconds the permission expires. */
  expiry: number
  target: Address
  /** Echo of the granted allowance, decimal USDC. */
  allowanceUsdc: string
}

export interface WalletPermissionsClient {
  detect(permissionType: PermissionType): Promise<WalletDetect>
  connect(): Promise<{ address: Address; chainId: number }>
  grant(args: GrantArgs): Promise<GrantResult>
}

function getProvider(): EIP1193Provider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum
}

function erc7715Client(provider: EIP1193Provider) {
  return createWalletClient({ chain: baseSepolia, transport: custom(provider) }).extend(erc7715ProviderActions())
}

/** Build the EIP-7715 permission payload for the plan's permission type. */
function buildPermission(args: GrantArgs) {
  const amount = parseUnits(args.budgetUsdc, USDC_DECIMALS)
  const justification = args.justification ?? 'DelegaPay agent budget'
  if (args.permissionType === 'erc20-token-periodic') {
    return {
      type: 'erc20-token-periodic' as const,
      isAdjustmentAllowed: true,
      data: {
        periodAmount: amount,
        periodDuration: PERIOD_DURATION_SECONDS,
        tokenAddress: args.usdc,
        justification,
      },
    }
  }
  return {
    type: 'erc20-token-allowance' as const,
    isAdjustmentAllowed: true,
    data: {
      allowanceAmount: amount,
      tokenAddress: args.usdc,
      justification,
    },
  }
}

export function createWalletPermissionsClient(): WalletPermissionsClient {
  return {
    async detect(permissionType) {
      const provider = getProvider()
      if (!provider) {
        return { hasProvider: false, onBaseSepolia: false, supported: false, permissionType }
      }

      let chainId: number | undefined
      try {
        const hex = (await provider.request({ method: 'eth_chainId' })) as `0x${string}`
        chainId = Number(hex)
      } catch {
        chainId = undefined
      }
      const onBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID

      // getSupportedExecutionPermissions throws on wallets without EIP-7715
      // (e.g. non-Flask / old MetaMask): treat any failure as "unsupported" so
      // the panel can fall back to the server-key path instead of crashing.
      let supported = false
      try {
        const map = await erc7715Client(provider).getSupportedExecutionPermissions()
        const info = map[permissionType]
        supported = Boolean(info && info.chainIds.includes(BASE_SEPOLIA_CHAIN_ID))
      } catch {
        supported = false
      }

      return { hasProvider: true, chainId, onBaseSepolia, supported, permissionType }
    },

    async connect() {
      const provider = getProvider()
      if (!provider) throw new Error('No Ethereum provider found — install MetaMask to use the wallet path')

      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as Address[]
      if (!accounts?.length) throw new Error('MetaMask returned no accounts')

      let chainId = Number((await provider.request({ method: 'eth_chainId' })) as `0x${string}`)
      if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
        // Ask the wallet to move to Base Sepolia; the user can reject.
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_SEPOLIA_CHAIN_HEX }],
        })
        chainId = Number((await provider.request({ method: 'eth_chainId' })) as `0x${string}`)
      }

      return { address: getAddress(accounts[0]), chainId }
    },

    async grant(args) {
      const provider = getProvider()
      if (!provider) throw new Error('No Ethereum provider found — install MetaMask to use the wallet path')

      const expiry = Math.floor(Date.now() / 1000) + (args.expirySeconds ?? DEFAULT_EXPIRY_SECONDS)
      const target = getAddress(args.targetAddress)

      const granted = await erc7715Client(provider).requestExecutionPermissions([
        {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          permission: buildPermission(args),
          to: target,
          expiry,
        },
      ])

      const first = granted[0]
      if (!first) throw new Error('MetaMask granted no permission')

      // decodeDelegations yields the kit Delegation shape, which is structurally
      // the relayer's Delegation7710 (hex fields). Cast straight across.
      const delegations = decodeDelegations(first.context) as unknown as Delegation7710[]
      if (!delegations.length) throw new Error('granted permission decoded to zero delegations')

      return { delegations, expiry, target, allowanceUsdc: args.budgetUsdc }
    },
  }
}
