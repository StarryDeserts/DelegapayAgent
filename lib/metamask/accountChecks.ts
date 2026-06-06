import { getAddress, type Address, type Hex, type PublicClient } from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import type { AuthorizationListEntry } from '@/lib/relayer'
import { SignerConfigError } from './localSigner'

/**
 * EIP-7702 upgrade detection + authorization signing for the local signer.
 *
 * A 7702-delegated EOA carries on-chain code of the form
 * `0xef0100 ++ <20-byte implementation address>`. If the account isn't yet
 * pointed at the MetaMask Stateless7702 implementation, the relayer needs a
 * signed `authorizationList` entry to upgrade it in-flight (one entry max).
 */

const DELEGATION_PREFIX = '0xef0100'

export interface UpgradeStatus {
  upgraded: boolean
  needsAuthorization: boolean
}

/**
 * Read the account's code and decide whether it already delegates to the
 * expected implementation. RPC failures surface as SignerConfigError so the
 * caller can tell the user their RPC_URL is wrong/unreachable.
 */
export async function checkUpgrade(
  publicClient: PublicClient,
  address: Address,
  implAddress: Address,
): Promise<UpgradeStatus> {
  let code: Hex | undefined
  try {
    code = await publicClient.getCode({ address })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new SignerConfigError(
      `could not read account code from RPC (${message}) — check RPC_URL points at a reachable Base Sepolia node`,
    )
  }

  if (!code || code === '0x') {
    return { upgraded: false, needsAuthorization: true }
  }

  const lower = code.toLowerCase()
  const upgraded =
    lower.startsWith(DELEGATION_PREFIX) &&
    lower.slice(DELEGATION_PREFIX.length) === implAddress.slice(2).toLowerCase()

  return { upgraded, needsAuthorization: !upgraded }
}

/**
 * Sign an EIP-7702 authorization pointing the EOA at `implAddress`. Offline
 * (no funds, no broadcast) — just a signature the relayer includes when it
 * redeems. Uses the pending nonce so it composes with the same account's tx.
 */
export async function buildAuthorization(
  account: PrivateKeyAccount,
  publicClient: PublicClient,
  chainId: number,
  implAddress: Address,
): Promise<AuthorizationListEntry> {
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  })
  const auth = await account.signAuthorization({
    chainId,
    contractAddress: implAddress,
    nonce,
  })

  return {
    address: getAddress(auth.address),
    chainId: auth.chainId,
    nonce: auth.nonce,
    r: auth.r,
    s: auth.s,
    yParity: auth.yParity ?? 0,
  }
}
