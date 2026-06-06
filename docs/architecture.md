# DelegaPay Agent Architecture

## Status

Draft v3 for MVP implementation planning. This revision makes the AI planner provider-agnostic (DeepSeek default, Venice optional) and locks a staged-hybrid signing path (Phase 1 local signer, Phase 2 browser EIP-7715). It continues to align with official MetaMask, 1Shot Public Relayer, and x402 flow requirements.

## Locked Decisions (v3)

- **AI provider:** provider-agnostic planner. Default is DeepSeek `deepseek-v4-flash`; Venice and any OpenAI-compatible endpoint are optional pluggable providers. Structured output uses `response_format: { type: "json_object" }` plus the word "json" in the prompt plus mandatory app-side zod validation (DeepSeek's native API has no strict `json_schema` on final messages). Providers that support strict schema may opt into it behind the same interface.
- **Signing path:** staged hybrid. Phase 1 builds a local-signer engine driven by a throwaway testnet `PRIVATE_KEY` (scriptable, no browser) to de-risk the delegation + relayer plumbing. Phase 2 adds the browser MetaMask EIP-7715 `requestExecutionPermissions` popup as the visible Advanced Permissions hero moment. Both paths share the same 1Shot relayer backend and set the delegation `to` to the relayer `targetAddress`.

## Date

2026-06-04

## Objective

DelegaPay Agent is a hackathon MVP for the MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off. The product goal is to let a user grant an AI agent a bounded payment/task budget, let an AI planner produce a validated mission plan, and then show every delegated payment/execution step in a clear Mission Timeline.

The MVP should prove this loop:

1. A user connects MetaMask on Base Sepolia.
2. The app runtime-checks wallet, chain, account upgrade, and Advanced Permission support.
3. The user describes a mission and maximum USDC budget.
4. The AI planner (DeepSeek `deepseek-v4-flash` by default) converts the mission into a strict JSON plan.
5. The app validates the plan against schema and business limits.
6. The app discovers 1Shot relayer capabilities before choosing the relayer permission target.
7. The user grants bounded MetaMask Advanced Permission(s), with amount/token/expiry/target visible.
8. The agent unlocks one x402-style premium tool route inside the budget.
9. The app estimates and submits delegated execution through the 1Shot public relayer path.
10. The UI shows permission state, premium spend, relayer status, final result, and remaining budget.

## Core Assumptions

- MVP first targets Base Sepolia and USDC-like test token flows.
- A tiny Base mainnet proof can be added later for final hackathon credibility.
- The app is a web app, likely Next.js + TypeScript.
- MetaMask is the primary wallet UX for the Phase 2 hero moment; Phase 1 uses a local-signer engine (throwaway testnet `PRIVATE_KEY`) to exercise the same delegation + relayer flow without a browser popup. Passkey/WebAuthn wallet support is a future module unless explicitly pulled into MVP.
- The AI planner runs server-side behind a provider-agnostic interface. Default provider is DeepSeek with `DEEPSEEK_API_KEY`; Venice (`VENICE_API_KEY`) and OpenAI-compatible endpoints are optional. No provider API key is ever exposed to browser code.
- x402 is limited to one premium route in the MVP.
- `.agents/`, `skill-lock.json`, and `skills-lock.json` remain local/ignored project artifacts.

## Tech Stack

| Area | MVP choice | Notes |
|---|---|---|
| App framework | Next.js + TypeScript | Server routes for Venice and premium endpoints; client components for wallet UX. |
| Wallet client | Viem + MetaMask Smart Accounts Kit | Phase 1: local signer (`privateKeyToAccount` + `createDelegation`/`signDelegation`). Phase 2: `erc7715ProviderActions()` browser popup. |
| Chain | Base Sepolia | Optional final Base mainnet tiny execution. |
| Token | USDC / USDC-compatible test token | Used for mission budget, premium route payment, and relayer fee story. |
| AI planner | Provider-agnostic (DeepSeek `deepseek-v4-flash` default) | `json_object` + zod validation; Venice / OpenAI-compatible optional. |
| Relayer | 1Shot Public Relayer | Use capability discovery before permission targeting and submission. |
| Premium route | One x402-protected DelegaPay endpoint | Keep x402 narrow and visible in the Mission Timeline. |
| Optional wallet | WebAuthn PRF wallet | Future isolated passkey-derived wallet module. |

## Commands

The app is scaffolded with Next.js (App Router) + TypeScript + Tailwind v4 + ESLint; package manager is pnpm.

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

## Project Structure

Proposed structure after scaffolding:

```text
delegapay-agent/
  app/
    page.tsx                          # Mission Builder and Mission Timeline shell
    api/
      mission/plan/route.ts           # Server-only AI planner route
      premium/route.ts                # Single x402-protected premium route
      relayer/capabilities/route.ts   # Optional relayer capability proxy/cache
      relayer/status/route.ts         # Optional polling proxy for relayer status
  components/
    wallet/
      ConnectWallet.tsx
      AccountUpgradePanel.tsx
      PermissionSupportPanel.tsx
      PermissionGrantPanel.tsx
    mission/
      MissionForm.tsx
      MissionPlanPreview.tsx
      MissionTimeline.tsx
      BudgetMeter.tsx
    relayer/
      RelayerStatusPanel.tsx
  lib/
    metamask/
      accountChecks.ts                # Smart account / EIP-7702 runtime checks (both phases)
      localSigner.ts                  # Phase 1: privateKeyToAccount + toMetaMaskSmartAccount(Stateless7702)
      delegation.ts                   # Phase 1: createDelegation / signDelegation (to = relayer targetAddress)
      permissions.ts                  # Phase 2: ERC-7715 browser wallet client helpers
      permissionTargets.ts            # Target selection by flow type
    ai/
      index.ts                        # Provider-agnostic planner interface + provider selection
      schema.ts                       # MissionPlan zod schema and validation
      planner.ts                      # buildPrompt + callProvider + zod parse
      providers/
        deepseek.ts                   # Default: deepseek-v4-flash, json_object
        openaiCompatible.ts           # Generic OpenAI-compatible endpoint
        venice.ts                     # Optional: Venice (can use strict json_schema)
        mock.ts                       # Deterministic planner for Phase 1 / tests
    relayer/
      capabilities.ts                 # 1Shot capability discovery
      fees.ts                         # Quote and estimate handling
      transaction.ts                  # Delegated transaction bundle preparation
      status.ts                       # Status polling/webhook helpers
    x402/
      challenge.ts                    # 402 / PAYMENT-REQUIRED parsing
      payment.ts                      # PAYMENT-SIGNATURE payload creation
      premium.ts                      # Premium route validation and result shape
    timeline/
      events.ts                       # Timeline event types and reducers
  docs/
    architecture.md
```

## Design Principle: One Budget, Multiple Authority Contexts

The product UI should present one mission budget, but the implementation must not pretend every spend uses the same permission target.

There are two distinct authority contexts:

| Flow | What it authorizes | Officially important target/recipient |
|---|---|---|
| 1Shot relayer execution | Delegated transaction/fee execution | Use `targetAddress` from `relayer_getCapabilities`; do not hardcode or use a random session account. |
| x402 premium route | Payment authorization for protected endpoint | Use the x402 challenge's accepted payment terms, fixed allowance, facilitator/redeemer constraints, and `PAYMENT-SIGNATURE` payload. |

The Mission Timeline and Budget Meter can aggregate both as one user-facing budget ledger, but the permission construction code must keep these contexts separate.

## Module Architecture

### 1. MetaMask Smart Accounts Kit Module

Source skill: `metamask-smart-accounts-kit`.

Role: authorization layer.

This module owns the permission/delegation grant flow. It proves that DelegaPay does not silently execute AI decisions: bounded, human-readable authority is established before delegated execution happens.

This module is built in two phases that share one 1Shot relayer backend (delegation `to` is always the relayer `targetAddress`):

- **Phase 1 — local-signer engine (build first):** a throwaway testnet `PRIVATE_KEY` signs a MetaMask Smart Account delegation server-side/CLI, with no browser popup, so the delegation + relayer plumbing can be scripted and tested. This is a development engine, not user custody.
- **Phase 2 — browser Advanced Permissions (hero moment):** the user grants the same bounded authority through the MetaMask EIP-7715 `requestExecutionPermissions` popup. Keys stay in MetaMask.

Responsibilities (Phase 2 browser path):

- Create a Viem wallet client from `window.ethereum`.
- Extend the wallet client with `erc7715ProviderActions()`.
- Check connected chain and switch/guide to Base Sepolia for MVP.
- Check `getSupportedExecutionPermissions()` before rendering grant actions.
- Runtime-check whether the user account is upgraded to a MetaMask Smart Account where required by the Advanced Permissions flow.
- Prefer `erc20-token-allowance` for MVP fixed-budget flows.
- Keep `erc20-token-periodic` as an enhancement for recurring-budget storytelling.
- Request the narrowest permission that satisfies the validated plan and selected execution flow.
- Show granted permission context in the Mission Timeline:
  - chain
  - token
  - amount
  - expiry
  - target/recipient
  - permission type
  - budget consumed

#### Phase 1: local-signer engine (official Smart Accounts Kit pattern)

Runs server-side or as a CLI. The private key is a throwaway testnet key (never user funds, never logged, never sent to the AI planner):

```ts
import { privateKeyToAccount } from 'viem/accounts'
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  ScopeType,
} from '@metamask/smart-accounts-kit'

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: process.env.OWNER as `0x${string}`, // EOA upgraded in place via EIP-7702
  signer,
})

// First use: if publicClient.getCode(OWNER) is empty, upgrade the EOA to a 7702
// smart account (signAuthorization). Then build the bounded delegation:
const delegation = createDelegation({
  from: smartAccount.address,
  to: relayerTargetAddress,             // from relayer_getCapabilities; never hardcoded
  scope: ScopeType.Erc20TransferAmount, // + token + max amount (see skill for exact args)
})
const signature = await smartAccount.signDelegation({ delegation })
```

Verify exact signatures against `.agents/skills/public-relayer/SKILL.md` and the installed `@metamask/smart-accounts-kit` — this Next/SDK version may differ from training data.

#### Phase 2: browser client pattern (EIP-7715)

```ts
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(window.ethereum!),
}).extend(erc7715ProviderActions())

const supported = await walletClient.getSupportedExecutionPermissions()
```

#### Runtime account checks

The EIP-7702 account-code check (`publicClient.getCode`) applies to both phases; the MetaMask-provider and permission-support states below are Phase 2 (browser) only.

Implementation should follow the official Advanced Permissions runtime checks instead of assuming documentation support is enough:

- Request connected addresses with the wallet client.
- Use a Viem public client to inspect account code.
- Detect whether the account has the expected EIP-7702 / MetaMask smart account delegation state.
- Show an explicit fallback if the connected wallet/version/account cannot support the required permission.

The UI must distinguish these states:

| State | UI behavior |
|---|---|
| No MetaMask provider | Ask user to install/connect MetaMask. |
| Wrong chain | Ask user to switch to Base Sepolia. |
| Permission type unsupported | Disable grant action and show fallback message. |
| Account not upgraded where required | Show upgrade guidance before mission execution. |
| Supported | Enable permission preview and request flow. |

#### Permission target rules

- Standalone Smart Accounts Kit session execution can target a session account.
- 1Shot public relayer execution must use the relayer `targetAddress` from `relayer_getCapabilities`.
- x402 premium payment must follow the x402 challenge's accepted payment terms and facilitator/redeemer constraints.
- Do not reuse one target-selection rule across all flows.

MVP output:

- `AccountUpgradePanel` shows smart account / EIP-7702 readiness.
- `PermissionSupportPanel` shows permission support for Base Sepolia (Phase 2).
- `PermissionGrantPanel` requests and records bounded permissions (Phase 2).
- Phase 1 records `account.upgrade.checked` and `delegation.signed` (local signer); Phase 2 adds `permission.support.checked` and `permission.granted` (browser EIP-7715).

### 2. AI Planner Module

Source skill: `venice-ai` (optional provider reference). Provider-agnostic by design.

Role: planning and read-only context layer.

The planner converts the user's natural-language mission into a strict, validated execution plan. It must never hold signing keys, sign, execute, or bypass MetaMask/1Shot boundaries.

Provider strategy:

- One provider-agnostic interface (`lib/ai/index.ts`) selects a provider at runtime.
- **Default: DeepSeek**, model `deepseek-v4-flash`. (The legacy `deepseek-chat` / `deepseek-reasoner` names retire 2026-07-24; do not target them.)
- **Optional: Venice** and any **OpenAI-compatible** endpoint, selectable by env without changing planner logic.
- A `mock` provider returns a deterministic plan so Phase 1 and tests need no API key.

Responsibilities:

- Keep the active provider's API key (e.g. `DEEPSEEK_API_KEY`) and model name server-only.
- Call the provider's chat completions endpoint behind the shared interface.
- Request structured output with `response_format: { type: "json_object" }` and include the word "json" in the prompt (DeepSeek's native API requires both and has no strict `json_schema` on final messages).
- Inject the `MissionPlan` shape into the prompt as the contract.
- **Always re-validate the returned JSON with a zod schema in application code** — this is the real guarantee, regardless of provider.
- Include current wallet support, relayer capability, and user budget facts in prompt context.
- Reject or downgrade plans that exceed the user-approved budget.
- Track rate-limit, request ID, model deprecation, and token-usage headers when present.

#### Structured output by provider

| Provider | Mechanism | Notes |
|---|---|---|
| DeepSeek (default) | `json_object` + "json" in prompt + zod | No strict schema on final message; zod is the contract. |
| OpenAI-compatible | `json_object` (or `json_schema` if supported) + zod | Same interface; opt into schema when the endpoint supports it. |
| Venice (optional) | `json_schema` strict + zod | Venice supports strict schema; still validate with zod. |

App-side validation is mandatory for every provider; never parse free text as a plan.

#### MVP schema shape

```ts
type MissionPlan = {
  summary: string
  requiredPermissionType: 'erc20-token-allowance' | 'erc20-token-periodic'
  maxSpendUsdc: string
  premiumToolRequired: boolean
  targetAction: string | null
  riskChecks: string[]
}
```

The same shape is expressed as a zod schema in `lib/ai/schema.ts` and is the single source of truth for validation.

#### Critical boundary

- Planner output is a proposal, not authority.
- The app validates shape (zod) and business constraints before presenting permission/delegation requests.
- Final execution still passes through MetaMask permission / local-signer delegation and 1Shot relayer checks.
- Prompts must not include private keys, seed phrases, raw auth secrets, or unnecessary wallet metadata.

MVP output:

- `POST /api/mission/plan` returns a zod-validated `MissionPlan`.
- `MissionPlanPreview` shows summary, budget, permission type, and risk checks.
- `MissionTimeline` records `planner.plan.created` and validation failures.

### 3. 1Shot Public Relayer Module

Source skill: `public-relayer`.

Role: delegated execution/relay layer for ERC-7710-style flows.

The public relayer module discovers relayer capabilities, uses the returned target and token constraints, estimates the delegated transaction, submits it, and tracks status.

Endpoints:

```text
Base Sepolia / Sepolia: https://relayer.1shotapi.dev/relayers
Mainnet: https://relayer.1shotapi.com/relayers
```

Responsibilities:

- Call `relayer_getCapabilities` before requesting or redeeming a relayer-targeted permission.
- Treat capabilities as authoritative for supported chains, payment tokens, `feeCollector`, and `targetAddress`.
- Use returned `targetAddress` as the 1Shot relayer delegation/permission target.
- Do not hardcode relayer tokens or target addresses.
- Cache capabilities per browser session and refresh periodically.
- Estimate before submit with `relayer_estimate7710Transaction` once the signed bundle exists.
- Submit through `relayer_send7710Transaction` for same-chain MVP execution.
- Track final state through `relayer_getStatus`; signed webhooks can be added later.
- Display relayer state in the Mission Timeline.

#### Official relayer flow

```text
relayer_getCapabilities
  -> choose supported chain/payment token/targetAddress
  -> build narrow permission/delegation for target execution
  -> relayer_getFeeData OR relayer_estimate7710Transaction
  -> relayer_send7710Transaction
  -> relayer_getStatus or signed webhook
```

#### Fee quote versus signed-bundle estimate

| Method | When to use | Notes |
|---|---|---|
| `relayer_getFeeData` | Before the final delegation bundle exists | Rough/pre-bundle quote. Use returned context only while valid. Refresh if expired. |
| `relayer_estimate7710Transaction` | After the signed bundle is assembled | Preferred before submit. If returned payment differs, update fee/delegation scope, re-sign, and re-estimate. |

MVP default: use capability discovery first, then signed-bundle estimate immediately before send.

#### Status tracking

- Submission returns a task id or transaction reference depending on response shape.
- Preferred later: signed webhook at `destinationUrl` with signature verification.
- MVP fallback: poll `relayer_getStatus` every 2–3 seconds.
- Track terminal states such as confirmed, rejected, and reverted.

Critical boundary:

- Do not assume the relayer target address.
- Do not mix standalone Smart Accounts Kit session flow with the 1Shot relayer target flow.
- Signing is performed by MetaMask (Phase 2) or the Phase 1 local-signer engine's throwaway testnet key; a real user's private key is never sent to or stored by the server.
- Use fresh delegation salts and narrow scopes for amount, token, target, and function.

MVP output:

- `relayer.capabilities.loaded` timeline event.
- `relayer.estimate.created` timeline event.
- `relayer.transaction.submitted` timeline event.
- `relayer.transaction.finalized` timeline event with receipt/status.

### 4. x402 Premium Route Module

Sources: `1shot-api` skill and MetaMask x402 buyer guidance.

Role: one premium tool/payment gate in the mission loop.

This module gives the demo a concrete reason for delegated budget usage: the agent unlocks or pays for one premium action before performing the final relayed transaction.

Responsibilities:

- Implement exactly one premium route for MVP.
- Keep x402 usage narrow and visible in the Mission Timeline.
- Use the official x402 challenge/paid request pattern instead of a vague boolean unlock.
- Bind premium spend to the validated mission budget.
- Do not expand into a full marketplace or generalized payment platform for MVP.

Example route:

```text
POST /api/premium
```

Suggested premium tool behavior:

- Return enriched risk scoring for a planned payment.
- Return a vendor quote or simulated invoice approval.
- Return a signed/verified task artifact required before relayer submission.

#### Official x402 buyer flow to preserve

```text
unpaid POST /api/premium
  -> endpoint returns 402 + PAYMENT-REQUIRED
  -> client parses PAYMENT-REQUIRED
  -> select accepted payment requirement
  -> require accepted.extra.assetTransferMethod === "erc7710"
  -> request fixed ERC-20 allowance for accepted.asset / accepted.amount
  -> bind redeemer/facilitator constraints from the challenge
  -> create x402 payment payload
  -> send paid request with PAYMENT-SIGNATURE header
  -> endpoint verifies payment and returns premium result
```

#### Required x402 checks

The MVP should fail clearly if any of these occur:

- The protected route does not return `402` for the unpaid request.
- `PAYMENT-REQUIRED` is missing or cannot be decoded.
- No accepted payment requirement is available.
- `assetTransferMethod` is not `erc7710`.
- Facilitator/redeemer data is missing.
- Permission response is empty.
- Paid API response fails.

#### x402 permission distinction

The x402 fixed allowance flow can authorize payment to a session actor/facilitator path from the x402 challenge. It is not automatically the same as the 1Shot public relayer `targetAddress` permission. If both are used in the same MVP run, the UI should show one mission budget but the implementation should keep separate permission contexts.

MVP output:

- `premium.challenge.received` timeline event.
- `premium.permission.granted` timeline event if x402 requires a dedicated fixed allowance.
- `premium.paid` or `premium.unlocked` timeline event.
- Budget meter decrements by the premium tool cost.

### 5. WebAuthn PRF Wallet Module

Source skill: `webauthn-prf-wallet`.

Role: optional future passkey-derived wallet/auth layer.

This module should not block the MVP. It is valuable as a future enhancement for a passkey-backed automation or recovery wallet, but MetaMask remains the primary hackathon judging path because the challenge requires visible Smart Accounts Kit integration.

Responsibilities if added later:

- Use passkey PRF output with HKDF for deterministic secp256k1 key derivation.
- Keep derived private keys isolated inside an iframe.
- Use a fresh WebAuthn ceremony before signing wallet operations.
- Use LongBlob fallback only where PRF is unavailable.
- Never expose derived private keys to the parent app.

MVP decision:

- Document as an extension module.
- Do not include in the first implementation unless needed for a stronger demo story.

### 6. Frontend Mission Timeline Module

Role: product storytelling and auditability layer.

The timeline is central to the hackathon demo because it makes the required technologies legible in one flow.

Responsibilities:

- Collect the user's mission text and budget.
- Show wallet connection, chain, permission support, and account upgrade checks.
- Preview the AI planner's structured plan.
- Show MetaMask permission grant state.
- Show x402 challenge/payment state.
- Show 1Shot capability, estimate, submission, and status.
- Show final receipt/result and budget consumed.

Suggested timeline event types:

```ts
type TimelineEvent =
  | { type: 'wallet.connected'; address: string; chainId: number }
  | { type: 'account.upgrade.checked'; upgraded: boolean }
  | { type: 'planner.provider.selected'; provider: 'deepseek' | 'venice' | 'openai-compatible' | 'mock'; model: string }
  | { type: 'planner.plan.created'; provider: string; plan: MissionPlan }
  | { type: 'relayer.capabilities.loaded'; targetAddress: string; chainIds: number[] }
  | { type: 'delegation.signed'; from: string; to: string; amountUsdc: string }          // Phase 1 local signer
  | { type: 'permission.support.checked'; supported: boolean; permissionType: string }    // Phase 2 browser
  | { type: 'permission.granted'; flow: 'relayer' | 'x402'; amountUsdc: string; expiry: number; target: string } // Phase 2 browser
  | { type: 'premium.challenge.received'; costUsdc: string }
  | { type: 'premium.paid'; resultId: string }
  | { type: 'relayer.estimate.created'; feeUsdc?: string }
  | { type: 'relayer.transaction.submitted'; taskId?: string; txHash?: string }
  | { type: 'relayer.transaction.finalized'; txHash?: string; status: 'success' | 'failed' }
```

### 7. Backend/API Orchestration Module

Role: server-only integrations and policy enforcement.

Responsibilities:

- Keep secrets server-side.
- Call the configured AI planner provider.
- Validate planner output with zod.
- Host the single premium route.
- Optionally proxy/cache relayer capability and status data for observability.
- Enforce business constraints before returning data to the client.
- Log non-sensitive request IDs, rate-limit headers, model deprecation warnings, relayer task IDs, and x402 payment verification status.

Routes:

| Route | Method | Purpose | Secret access |
|---|---|---|---|
| `/api/mission/plan` | `POST` | Generate zod-validated AI plan | `DEEPSEEK_API_KEY` (or configured provider) |
| `/api/premium` | `POST` | Single x402-protected premium action | x402/payment config |
| `/api/relayer/capabilities` | `GET` | Optional capabilities proxy/cache | no private keys |
| `/api/relayer/status` | `GET` | Optional relayer status proxy | no private keys |

Server must not:

- Custody a real user's wallet private key or accept seed phrases.
- Treat AI planner text as executable instructions.
- Log raw secrets, private key material, seed phrases, or full signed payloads unless redacted.

Phase 1 local signer (allowed, scoped):

- The Phase 1 engine signs with a throwaway testnet `PRIVATE_KEY` to exercise the delegation/relayer flow. This key is development-only, holds only testnet funds, and is never a user's key.
- Keep it in `.env.local` (git-ignored), never in browser code, never in prompts/logs/screenshots.
- Phase 2 moves signing back into MetaMask; the browser path never sends keys to the server.

## End-to-End MVP Flow

```text
User
  |
  | connects MetaMask on Base Sepolia
  v
Frontend wallet module
  |
  | check chain, account upgrade, getSupportedExecutionPermissions()
  v
Permission readiness UI
  |
  | user enters mission + max USDC budget
  v
POST /api/mission/plan
  |
  | server calls the configured AI provider (DeepSeek json_object) and zod-validates the result
  v
Validated MissionPlan
  |
  | frontend displays plan + budget/risk preview
  v
1Shot relayer capability discovery
  |
  | use targetAddress from relayer_getCapabilities for relayer execution permission
  v
Bounded authority for relayer execution
  |
  | Phase 1: local signer creates + signs delegation (to = relayer targetAddress)
  | Phase 2: user grants bounded ERC-20 permission in MetaMask (EIP-7715)
  v
Unpaid x402 premium request
  |
  | receive 402 + PAYMENT-REQUIRED and parse accepted erc7710 payment terms
  v
MetaMask/x402 fixed allowance flow if required
  |
  | create PAYMENT-SIGNATURE and retry paid premium request
  v
Relayer signed-bundle estimate + submit
  |
  | relayer_estimate7710Transaction -> relayer_send7710Transaction
  v
Mission Timeline final receipt/status
```

## Security Boundaries

Always:

- Keep the active AI provider key (e.g. `DEEPSEEK_API_KEY`) server-only.
- Validate AI planner output with a zod schema in application code.
- Runtime-check wallet chain, permission support, and account upgrade state.
- Use the relayer-provided `targetAddress` for 1Shot relayer permission targeting.
- Treat x402 fixed allowance target/facilitator constraints as separate from the 1Shot relayer target.
- Display budget, token, target, expiry, permission type, and flow type before requesting permission.
- Treat all external API responses as untrusted until validated.
- Keep `.env` and `.env.*` out of Git.

Ask first:

- Adding a new wallet custody mechanism.
- Switching MVP chain from Base Sepolia.
- Adding dependencies beyond the scaffold and core SDKs.
- Moving from one premium x402 route to multiple paid routes.
- Adding Base mainnet execution beyond a tiny final proof.

Never:

- Put any AI provider key in browser code.
- Put seed phrases, private keys, raw auth secrets, or excessive wallet metadata in prompts.
- Use a real-funds or user private key for the Phase 1 local signer — testnet throwaway only.
- Let the AI planner directly execute transactions.
- Hardcode 1Shot relayer permission target addresses without capability discovery.
- Treat an x402 premium route challenge as equivalent to a relayer execution permission.
- Commit `.agents/`, skill lock files, `.env`, build output, or dependency folders.

## Data Contracts

### Mission Draft

```ts
type MissionDraft = {
  text: string
  maxBudgetUsdc: string
  chainId: number
  tokenAddress: string
}
```

### Validated Mission Plan

```ts
type MissionPlan = {
  summary: string
  requiredPermissionType: 'erc20-token-allowance' | 'erc20-token-periodic'
  maxSpendUsdc: string
  premiumToolRequired: boolean
  targetAction: string | null
  riskChecks: string[]
}
```

### Permission Grant View Model

```ts
type PermissionGrantView = {
  flow: 'relayer' | 'x402'
  chainId: number
  permissionType: 'erc20-token-allowance' | 'erc20-token-periodic'
  tokenAddress: string
  amountUsdc: string
  expiry: number
  targetAddress: string
  justification: string
}
```

### Relayer Capabilities View Model

```ts
type RelayerCapabilitiesView = {
  chainIds: number[]
  paymentTokens: string[]
  feeCollector?: string
  targetAddress: string
  refreshedAt: number
}
```

### Relayer Execution View Model

```ts
type RelayerExecution = {
  targetAddress: string
  quoteContext?: unknown
  estimateContext?: unknown
  taskId?: string
  txHash?: string
  status: 'idle' | 'estimated' | 'submitted' | 'confirmed' | 'rejected' | 'reverted' | 'failed'
}
```

### x402 Premium Challenge View Model

```ts
type PremiumChallenge = {
  statusCode: 402
  acceptedAsset: string
  acceptedAmount: string
  assetTransferMethod: 'erc7710'
  facilitators: string[]
  rawPaymentRequired: string
}
```

## Testing Strategy

### Unit tests

- Validate MissionPlan zod schema acceptance/rejection.
- Validate AI provider selection and fallback to the mock provider.
- Validate budget comparison rules.
- Validate permission target selection by flow type.
- Validate timeline reducer/event transitions.
- Validate x402 challenge parsing and failure cases.
- Validate relayer quote/estimate expiry handling.

### Integration tests

- Mock the AI provider response and verify provider selection and zod parsing.
- Mock an invalid planner response at `/api/mission/plan` and verify zod rejection.
- Mock relayer capability response and verify relayer permission target uses `targetAddress`.
- Mock relayer estimate response and verify changed fee requires re-sign/re-estimate handling.
- Mock x402 unpaid `402` response and verify `PAYMENT-REQUIRED` parsing and unsupported method rejection.
- Mock paid premium response and verify budget/timeline events.

### Browser/manual tests

- Connect MetaMask on Base Sepolia.
- Verify wrong-chain state is handled.
- Verify account upgrade/readiness panel.
- Verify unsupported permission state shows a clear fallback.
- Submit a mission and inspect the AI plan preview.
- Confirm relayer capabilities are loaded before relayer-targeted permission request.
- Grant permission through MetaMask.
- Trigger x402 premium challenge and paid retry.
- Estimate and submit through the 1Shot relayer path.
- Confirm timeline contains every major event.

### Testnet rehearsal

- Run the complete flow on Base Sepolia.
- Confirm transaction/relayer status can be shown in the UI.
- Record failures with request IDs, rate-limit headers, relayer status, x402 challenge/payment details, and wallet error messages.

### Final demo proof

- If safe and cheap, run one tiny Base mainnet action before final submission.
- Keep the mainnet action bounded and user-approved.
- Preserve video evidence of MetaMask permission grant, the AI plan, premium route payment/unlock, and final relayer result.

## Success Criteria

The MVP is successful when:

- The demo visibly uses MetaMask Smart Accounts Kit or Advanced Permissions in the main flow.
- The app runtime-checks wallet chain, permission support, and account upgrade/readiness before permission request.
- The app calls the configured AI provider server-side and receives a zod-validated JSON mission plan.
- Planner output is validated by zod; invalid output fails safely before any permission request.
- The user grants bounded ERC-20 permission(s) with amount, token, expiry, target, and flow type visible.
- The app uses 1Shot relayer capability discovery before relayer permission targeting and execution.
- The permission target for the 1Shot relayer path comes from relayer capabilities.
- One x402 premium route follows the `402` challenge and paid retry pattern.
- The Mission Timeline shows wallet, Venice, permission, x402 premium, relayer, and final result events.
- No secrets or local skill artifacts are committed.
- Base Sepolia end-to-end rehearsal works, or blockers are documented with exact error/status details.

## Implementation Phases

These phases follow the locked staged-hybrid signing path: the local-signer relayer flow (Phase 3) is proven before the browser hero moment (Phase 4).

### Phase 1: Scaffold and static demo shell

- Scaffold Next.js (App Router) + TypeScript + Tailwind v4 + ESLint with pnpm. (done)
- Add Mission Builder and Mission Timeline skeleton.
- Add `lib/ai` interface with the `mock` provider so the UI runs with no API key.
- Add `lib/relayer` skeleton (capability discovery types/stubs).
- Add `.env.example` without secrets.

### Phase 2: AI planner (DeepSeek default)

- Implement the provider-agnostic `lib/ai` interface and the DeepSeek provider (`deepseek-v4-flash`, `json_object`).
- Implement `/api/mission/plan`.
- Add the `MissionPlan` zod schema and mandatory app-side validation.
- Render the plan preview in the UI.

### Phase 3: Local-signer delegation + 1Shot relayer

- Implement `lib/metamask/localSigner.ts` (`privateKeyToAccount` + `toMetaMaskSmartAccount` Stateless7702).
- Upgrade the OWNER EOA to a 7702 smart account on first use (`signAuthorization`).
- Load relayer capabilities; use `targetAddress` as the delegation target.
- `createDelegation` / `signDelegation`, then `relayer_estimate7710Transaction` -> `relayer_send7710Transaction`.
- Add `delegation.signed` and relayer estimate/submit/status timeline events.

### Phase 4: Browser Advanced Permissions (hero moment)

- Add wallet connection and chain support checks.
- Add account upgrade/readiness and permission support panels.
- Request the EIP-7715 permission grant (`requestExecutionPermissions`) for Base Sepolia + USDC budget.
- Route the granted permission to the same relayer backend as Phase 3.

### Phase 5: x402 premium route

- Add one protected premium endpoint.
- Implement unpaid `402` challenge handling.
- Parse and validate `PAYMENT-REQUIRED`.
- Implement paid retry with `PAYMENT-SIGNATURE`.
- Bind premium route result to mission budget and timeline.

### Phase 6: End-to-end verification and demo polish

- Run browser flow.
- Run Base Sepolia rehearsal.
- Record demo video flow.
- Optionally execute tiny Base mainnet proof.

## Open Questions

- Which exact USDC/test token address should be used on Base Sepolia for the first implementation?
- Should MVP use one relayer execution permission plus one x402 payment permission, or simplify the first demo to one real permission and one simulated premium route until x402 is fully wired?
- Should the first permission type be only `erc20-token-allowance`, or should `erc20-token-periodic` be included for the budget story?
- What should the single premium x402 route represent: risk scoring, invoice verification, vendor quote, or another demo-friendly action?
- Should relayer calls be made directly from the browser or through a server proxy for logging and CORS control?
- Is Base mainnet tiny execution required for submission, or only recommended for stronger judging credibility?
- Should WebAuthn PRF wallet remain a documented extension or become a secondary demo path?

## Official Source References from Project Skills

- MetaMask Smart Accounts Kit install: https://docs.metamask.io/smart-accounts-kit/get-started/install.md
- MetaMask Smart Accounts Kit quickstart: https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart.md
- MetaMask Advanced Permissions concept: https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions.md
- MetaMask execute on user's behalf: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf.md
- MetaMask x402 buyer with Advanced Permissions: https://docs.metamask.io/smart-accounts-kit/guides/x402/buyer/advanced-permissions.md
- 1Shot Public Relayer API Reference: https://1shotapi.com/docs/api-reference/public-relayer
- 1Shot Gas Abstraction / EIP-7710 Quickstart: https://1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710
- 1Shot OpenRPC spec: https://1shotapi.com/openrpc/openrpc.json
- 1Shot Public Relayer skill: local `.agents/skills/public-relayer/SKILL.md`
- 1Shot API skill: local `.agents/skills/1shot-api/SKILL.md`
- WebAuthn PRF wallet skill: local `.agents/skills/webauthn-prf-wallet/SKILL.md`
- DeepSeek API docs (default provider): https://api-docs.deepseek.com
- Venice API spec (optional provider): https://docs.venice.ai/api-reference/api-spec
- Venice chat completions (optional): https://docs.venice.ai/api-reference/endpoint/chat/completions
- Venice structured responses (optional): https://docs.venice.ai/guides/features/structured-responses
- Venice x402 API (optional): https://docs.venice.ai/guides/integrations/x402-venice-api
