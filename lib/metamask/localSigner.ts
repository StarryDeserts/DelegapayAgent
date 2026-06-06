import {
  createPublicClient,
  getAddress,
  http,
  type Address,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit'
import { DEFAULT_CHAIN_ID } from '@/lib/relayer'

/**
 * SERVER ONLY. Reads PRIVATE_KEY and the RPC key from the environment; never
 * import this from a Client Component or the secret lands in the browser bundle.
 *
 * PRIVATE_KEY is the demo's *local signer* — a throwaway Base Sepolia testnet
 * EOA, NOT custody of a real user's wallet. With EIP-7702 the same EOA address
 * is upgraded in place into a MetaMask `Stateless7702` smart account, so the
 * smart account address equals the EOA address.
 */

/** Default Base Sepolia USDC; overridable via env for other testnets. */
const DEFAULT_USDC: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

/** Thrown when required signing config is missing or still a placeholder. */
export class SignerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignerConfigError'
  }
}

const ZERO_PRIVATE_KEY = /^0x0{64}$/i

export interface LocalSigner {
  account: PrivateKeyAccount
  publicClient: PublicClient
  smartAccount: MetaMaskSmartAccount
  chainId: number
  usdcAddress: Address
}

function readPrivateKey(env: NodeJS.ProcessEnv): `0x${string}` {
  const raw = env.PRIVATE_KEY?.trim()
  if (!raw) {
    throw new SignerConfigError('PRIVATE_KEY is not set — add a throwaway Base Sepolia testnet key to .env.local')
  }
  if (ZERO_PRIVATE_KEY.test(raw)) {
    throw new SignerConfigError('PRIVATE_KEY is still the zero placeholder — set a real throwaway Base Sepolia testnet key')
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new SignerConfigError('PRIVATE_KEY must be a 0x-prefixed 32-byte hex string')
  }
  return raw as `0x${string}`
}

function readRpcUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.RPC_URL?.trim()
  if (!raw) {
    throw new SignerConfigError('RPC_URL is not set — add a Base Sepolia RPC endpoint to .env.local')
  }
  if (raw.includes('YOUR_ALCHEMY_KEY')) {
    throw new SignerConfigError('RPC_URL still contains the YOUR_ALCHEMY_KEY placeholder — set a real Base Sepolia RPC URL')
  }
  return raw
}

/**
 * Build the local signer, public client, and the MetaMask Stateless7702 smart
 * account from environment config. Async because smart-account construction is.
 */
export async function createLocalSigner(env: NodeJS.ProcessEnv = process.env): Promise<LocalSigner> {
  const privateKey = readPrivateKey(env)
  const rpcUrl = readRpcUrl(env)
  const chainId = env.CHAIN_ID ? Number(env.CHAIN_ID) : DEFAULT_CHAIN_ID
  const usdcAddress = env.BASE_SEPOLIA_USDC_CONTRACT_ADDRESS
    ? getAddress(env.BASE_SEPOLIA_USDC_CONTRACT_ADDRESS)
    : DEFAULT_USDC

  const account = privateKeyToAccount(privateKey)
  // baseSepolia's op-stack formatters make createPublicClient's return type carry
  // a `deposit` tx variant in getBlock that the plain `PublicClient` shape lacks,
  // so the specialized client won't assign to it (TS2719). Launder to the base
  // `PublicClient` here once; the kit imports that same viem type for its `client`
  // param and every downstream consumer expects base, so nothing else needs a cast.
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }) as unknown as PublicClient

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: account.address,
    signer: { account },
  })

  return { account, publicClient, smartAccount, chainId, usdcAddress }
}
