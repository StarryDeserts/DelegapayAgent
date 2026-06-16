# DelegaPay Agent

**Safe delegated payments for AI agents.**

> Give AI agents a wallet, not your treasury.

DelegaPay lets a user grant an AI agent a bounded USDC budget on Base Sepolia, asks an AI planner to propose a validated payment mission, and keeps every valuable action behind visible controls: wallet permission, risk gate, dry-run estimate, explicit broadcast, and public proof.

## Why this matters

AI agents are useful when they can take action, but giving an agent a private key or broad treasury access is unacceptable for real payment workflows. DelegaPay demonstrates a safer operating model:

> AI proposes; wallet authorizes; relayer executes.

The agent can draft a payment plan, but it cannot directly move funds. The user sees the budget, token, chain, delegate, permission type, dry-run estimate, risk state, and final proof before any real transfer is broadcast.

## Hackathon and sponsor alignment

| Technology | Role in DelegaPay |
| --- | --- |
| MetaMask Advanced Permissions / EIP-7715 | User-visible bounded wallet permission for the primary custody path. |
| 1Shot relayer / EIP-7710 style delegated execution | Dry-run estimate and delegated relay for the payment mission. |
| x402 premium route | Simulated 402 challenge/signature/unlock premium risk gate. |
| Venice / OpenAI-compatible planner path | AI mission planning layer; the app is provider-agnostic and also supports DeepSeek plus a deterministic mock fallback. |
| Base Sepolia / BaseScan | Public proof surface for delegated execution. |

The current provider selection is explicit and honest: `AI_PROVIDER` can force `mock`, `deepseek`, `venice`, or `openai-compatible`. If no provider is forced, configured keys are checked and the deterministic mock planner is used when no key is present.

The sections below are the code-grounded sponsor usage map: every feature links to the exact file and lines where it is implemented, and each "(if using)" capability is honestly labelled real, simulated, or not used.

## Smart Accounts Kit Usage

DelegaPay uses `@metamask/smart-accounts-kit` (1.6.0) for two distinct, real signing paths on Base Sepolia. All wallet/kit code is isolated under `lib/metamask/*`, behind a narrow client interface so the rest of the app never touches `window.ethereum` or a key.

### Advanced Permissions

EIP-7715 is the **primary** custody path: the user's own MetaMask grants a bounded USDC permission (one-off allowance or recurring period), and a keyless relayer redeems it — the server never reads a private key.

- **Requesting the permission** — [`lib/metamask/permissions.ts` → `grant()` calling `requestExecutionPermissions`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/permissions.ts#L175-L200), with the per-type permission payload built in [`buildPermission()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/permissions.ts#L97-L121).
- **Redeeming the permission** — [`lib/metamask/relayGranted.ts` → `relayGrantedMission()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/relayGranted.ts#L83-L211) (keyless; the delegation was signed in the browser), exposed at [`app/api/mission/relay/route.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/app/api/mission/relay/route.ts#L14-L34).

### Delegations

ERC-7710 is the **fallback** path: a server-held throwaway testnet key creates and signs a root delegation, then the same relayer redeems it. Used only as a controlled Base Sepolia fallback when the wallet does not support EIP-7715.

- **Creating the delegation** — [`lib/metamask/delegation.ts` → `buildSignedDelegation()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/delegation.ts#L44-L77) (`createDelegation` + `smartAccount.signDelegation`).
- **Redeeming the delegation** — [`lib/metamask/execute.ts` → `executeMission()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/execute.ts#L112-L249) and the shared [`relayBundle()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/execute.ts#L284-L345) transport tail, exposed at [`app/api/mission/execute/route.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/app/api/mission/execute/route.ts#L13-L33).

### Redelegation

**Not used.** DelegaPay only issues **root** delegations (a single delegator to the relayer's `targetAddress`); every redeemed `permissionContext` is a length-1 chain, never a re-delegated one. The length-1 invariant is enforced in [`RelayGrantedInputSchema`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/relayGranted.ts#L64-L79) and documented on the [`Delegation7710` wire type](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/relayer/transaction.ts#L30-L34). A delegate-of-a-delegate (redelegation) chain is out of scope for this MVP.

### x402

The premium risk-score route speaks the x402 handshake with `assetTransferMethod: "erc7710"`. **This leg is simulated by design** — the 402 challenge/signature/unlock and the budget binding are real and gate Broadcast, but the payment is never settled on-chain (synthetic, reserved addresses; `simulated: true`).

- **x402 on the server** — [`app/api/premium/route.ts` → `POST()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/app/api/premium/route.ts#L14-L35), backed by [`lib/x402/premium.ts` → `runPremiumRoute()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/x402/premium.ts#L97-L118).
- **x402-to-ERC-7710 asset transfer on the client** — [`lib/x402/client.ts` → `requestPremium()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/x402/client.ts#L48-L133); the simulated ERC-7710 permission context (distinct from any live relayer target) is built at [lines 86-96](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/x402/client.ts#L86-L96), and the `erc7710` method constant plus the "never settled on-chain" note live in [`lib/x402/challenge.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/x402/challenge.ts#L12-L20).

## 1Shot API Usage

The 1Shot public relayer (keyless JSON-RPC; clients pay per transaction in on-chain ERC-20) redeems both signing paths above. No API key, no Bearer token; the delegate address is discovered, never hardcoded.

- **Transport and endpoints** — [`lib/relayer/client.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/relayer/client.ts#L8-L21) (`RELAYER_URLS`, testnet/mainnet switch) and the single [`relayerRpc()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/relayer/client.ts#L47-L63) JSON-RPC 2.0 call.
- **Capability discovery** — [`lib/relayer/capabilities.ts` → `getCapabilities()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/relayer/capabilities.ts#L26-L33) (`relayer_getCapabilities` returns `feeCollector`, `targetAddress`, and accepted tokens), proxied same-origin at [`app/api/relayer/capabilities/route.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/app/api/relayer/capabilities/route.ts#L11-L26).
- **Submitting a delegated bundle** — [`lib/relayer/transaction.ts` → `send7710Transaction()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/relayer/transaction.ts#L70-L76) (`relayer_send7710Transaction`); estimate-first then explicit broadcast is orchestrated in [`relayBundle()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/metamask/execute.ts#L284-L345).

## Venice AI Usage

**Optional provider.** Venice is wired through DelegaPay's generic OpenAI-compatible planner; the **default** provider is DeepSeek, with a deterministic mock fallback when no key is set. All AI output is treated as a *proposal* and validated against a zod `MissionPlanSchema` before any permission or transfer can happen.

- **Venice provider** — [`lib/ai/providers/venice.ts` → `createVenicePlanner()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/ai/providers/venice.ts#L11-L26) (base URL `https://api.venice.ai/api/v1`; `VENICE_MODEL` is required, which is why Venice is optional rather than the default).
- **Provider selection** — [`lib/ai/index.ts` → `selectProvider()`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/ai/index.ts#L16-L30) (`AI_PROVIDER=venice` forces it; otherwise the first configured key wins).
- **Plan contract and prompts** — [`lib/ai/planner.ts`](https://github.com/StarryDeserts/DelegapayAgent/blob/main/lib/ai/planner.ts#L14-L48) (`buildSystemPrompt`, plus the zod `parseMissionPlan` gate every provider's output must pass).

## Demo flow

The judge-facing flow is split into three routes:

| Route | Purpose |
| --- | --- |
| `/` | Landing page with the Bounded Budget Field, safety ladder, protocol sequence, and public proof section. |
| `/demo` | Guided Mission Control flow for recording and judging. |
| `/console` | Preserved advanced/developer console for lower-level testing. |

Recommended demo path:

1. Open `/` and explain the product framing: bounded payment authority instead of treasury custody.
2. Click **Start guided demo** to open `/demo`.
3. Set a USDC budget and mission, for example: `Send 1 USDC to 0x4727165918986b69ff3F94aC1dAa94987B819cfD on Base Sepolia`.
4. Generate a validated AI mission plan.
5. Use the MetaMask path as the primary custody story, or the Server-key path only as a controlled Base Sepolia fallback.
6. Run the simulated x402 risk check when the plan requires it.
7. Run **Estimate (dry run)** before any broadcast.
8. Show that **Broadcast on-chain** is explicit, gated, and real in the running app.
9. End on the Mission Timeline / Flight Recorder and the public proof transaction.

For the final recording script, see [`docs/demo-video-plan.md`](docs/demo-video-plan.md). For the operational demo runbook, see [`docs/demo-checklist.md`](docs/demo-checklist.md).

## Real vs simulated vs mocked

| Flow | Status | What it means |
| --- | --- | --- |
| AI planning | Real app logic; provider may be real or mock depending on env | Planner output is validated before permission or execution. With no AI key, the deterministic mock planner is used. |
| MetaMask permission | Real wallet interaction when a compatible wallet is connected | The grant is a spending cap, not money spent. It authorizes bounded execution but does not transfer USDC by itself. |
| 1Shot dry-run estimate | Real relayer estimate path, no chain write | Estimate previews relayer state and fees. It does not move funds. |
| Broadcast on-chain | Real Base Sepolia USDC transfer in the running app | This is the only action that sends the delegated transfer. Do not click it unless a live testnet transfer is intended. |
| x402 premium route | Simulated in this demo | It mirrors a 402 challenge/signature/unlock handshake and gates Broadcast, but it is not a real on-chain x402 settlement. |
| Headless harness broadcasts | Mocked in tests only | Harnesses intercept planner/relayer/broadcast paths so regression tests do not write to chain. |

Verified public proof transaction for the default demo narrative:

```text
0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab
```

## Architecture overview

DelegaPay is a Next.js App Router application with server-side API routes for planning, risk gating, relayer capability discovery, dry-run estimates, and delegated execution.

```text
User / Wallet
  -> Next.js UI routes: /, /demo, /console
  -> Mission planner API validates AI output
  -> MetaMask permission path or Server-key fallback path
  -> Optional simulated x402 premium gate
  -> 1Shot estimate first, explicit broadcast second
  -> Base Sepolia transaction proof + Mission Timeline events
```

Key surfaces:

| Area | Files |
| --- | --- |
| Landing page | `app/page.tsx`, `components/landing/*` |
| Guided demo | `app/demo/page.tsx`, `components/demo/*` |
| Advanced console | `app/console/page.tsx`, `components/mission/*`, `components/wallet/*` |
| AI planner | `lib/ai/*`, planner API route |
| MetaMask / relayer path | `components/wallet/WalletMissionPanel.tsx`, `app/api/mission/relay/route.ts`, `app/api/relayer/capabilities/route.ts` |
| Server-key fallback | `app/api/mission/execute/route.ts`, `lib/metamask/localSigner.ts` |
| Simulated premium gate | `components/mission/PremiumGate.tsx`, `app/api/premium/route.ts` |
| Timeline / audit trail | `lib/timeline/events.ts` |
| Regression harnesses | `tests/harness/*` |

## Safety model

DelegaPay is designed around bounded authority and explicit user-visible gates:

- The AI planner proposes a structured mission plan; it never executes transactions directly.
- Planner output is validated in application code before wallet permission or execution steps are available.
- MetaMask is the primary custody boundary for the demo flow.
- Server-key mode is a controlled Base Sepolia fallback and must use only a throwaway testnet key.
- The relayer delegate target is discovered through capabilities, not hardcoded in the UI.
- Grant allowance is a cap, not spent until Broadcast.
- Estimate is always a dry run.
- Broadcast is the only real transfer action in the running app.
- x402 is simulated by design in this MVP.
- Automated tests mock broadcast paths and do not send real transactions.
- Secrets stay server-side and must never be pasted into prompts, screenshots, logs, or client code.

## Local development

Requirements:

- Node.js compatible with Next.js 16.
- `pnpm`.
- Optional MetaMask build that supports Advanced Permissions / EIP-7715 if testing the wallet path.
- Optional Base Sepolia USDC when intentionally testing a real broadcast.

Install and run:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000` locally.

For harnesses, use the dedicated port:

```bash
pnpm dev:harness
# then, in another terminal
pnpm test:harness
```

The harness server runs on `http://localhost:3001` because the headless tests target that origin.

## Environment variables

Copy `.env.example` to `.env.local` and fill only the values needed for the mode you are testing. `.env.local` is git-ignored and must not be committed.

| Variable | Required for | Secret? | Notes |
| --- | --- | --- | --- |
| `AI_PROVIDER` | Choosing a planner provider | No | `mock`, `deepseek`, `venice`, or `openai-compatible`. Blank allows automatic selection. |
| `DEEPSEEK_API_KEY` | DeepSeek planner | Yes | Server-only. Default real provider when configured and no explicit provider overrides it. |
| `DEEPSEEK_MODEL` | DeepSeek planner tuning | No | Defaults are documented in `.env.example`. |
| `DEEPSEEK_API_BASE_URL` | DeepSeek-compatible endpoint tuning | Usually no, but may include private routing | Keep server-only. |
| `DEEPSEEK_THINKING` | DeepSeek planner tuning | No | Defaults to disabled for fast JSON planning. |
| `VENICE_API_KEY` | Venice planner | Yes | Server-only. Requires a configured Venice model. |
| `VENICE_MODEL` | Venice planner | No | Required when using Venice. |
| `VENICE_BASE_URL` | Venice planner | No | OpenAI-compatible base URL. |
| `OPENAI_COMPATIBLE_API_KEY` | Other OpenAI-compatible planner | Yes | Server-only. |
| `OPENAI_COMPATIBLE_MODEL` | Other OpenAI-compatible planner | No | Required for the generic provider path. |
| `OPENAI_COMPATIBLE_BASE_URL` | Other OpenAI-compatible planner | Usually no, but may include private routing | Server-side only. |
| `PRIVATE_KEY` | Server-key fallback broadcast | Yes | Throwaway Base Sepolia testnet key only. Never use a real-funds key. |
| `OWNER` | Server-key fallback broadcast | No, but sensitive metadata | EOA corresponding to the local signer. |
| `RPC_URL` | On-chain reads and server-key broadcast | Yes | Server-only; RPC URLs often embed API keys. |
| `BASE_SEPOLIA_USDC_CONTRACT_ADDRESS` | On-chain token config | No | Defaults to Circle Base Sepolia USDC. |
| `CHAIN_ID` | On-chain network config | No | `84532` for Base Sepolia. |
| `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` | Landing proof section | No | Public confirmed tx hash. Safe to expose because it is on-chain public data. |

A no-key local demo still works through the deterministic mock planner and the safe dry-run UI path.

## Testing

Static checks:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Headless regression harnesses:

```bash
pnpm dev:harness
pnpm test:harness
pnpm test:harness:premium
pnpm test:harness:metamask
```

Harness coverage includes landing copy, guided demo smoke flow, stale-estimate replan protection, the simulated x402 premium gate, and the MetaMask permission path with mocked relayer broadcasts. The harnesses do not send real chain transactions.

## Deployment status

The project is ready for a planned Vercel deployment, but this repository does not claim a live production deployment by default. See [`docs/vercel-deployment-plan.md`](docs/vercel-deployment-plan.md) for the deployment checklist, environment-variable policy, safe demo modes, security review, post-deployment verification, and rollback plan.

The app uses system font stacks, so `pnpm build` no longer depends on fetching Google Fonts during build.

## Known caveats

- This is a hackathon MVP, not production custody software.
- The x402 premium leg is simulated and should be described that way in every demo.
- Broadcast in the running app is real on Base Sepolia; keep demo budgets small and use only testnet funds.
- MetaMask Advanced Permissions / EIP-7715 requires a compatible MetaMask build and Base Sepolia wallet state.
- Server-key fallback requires `PRIVATE_KEY`, `OWNER`, and `RPC_URL`; use only a throwaway testnet key.
- Harness browser resolution depends on the local Playwright/Chromium setup documented in `docs/demo-checklist.md`.
- The public proof hash is a previously verified transaction for the demo narrative; a new live broadcast should be approved and recorded separately.

## Feedback

Detailed, code-grounded sponsor feedback is in [`docs/submission/sponsor-feedback.md`](docs/submission/sponsor-feedback.md). Every friction point cites the real file where we hit it, so the feedback is specific and verifiable rather than generic.

- **MetaMask / Smart Accounts Kit** — `getSupportedExecutionPermissions()` throws on non-Flask/older MetaMask instead of reporting "unsupported"; discriminated-union scope widening forces per-branch call-site duplication; the kit `Delegation` vs ERC-7710 wire type needs an `as unknown as` cast; the immutable signed allowance vs. an after-the-fact relayer fee is the sharpest design tax; EIP-7702 authorization plumbing is under-documented.
- **1Shot** — inconsistent JSON-RPC param shapes (positional array vs. single object); `decimals` arrives as `number | string`; the "delegate must equal `targetAddress`" rule is invisible until it rejects you; two-phase fee discovery can force a re-sign; terminal status semantics had to be reverse-engineered.
- **Venice** — no safe default model (so it became optional, not the default); the `"json"`-must-appear-in-prompt quirk cost a confusing 400; a 10-line quickstart would have made it the default provider.

## Social Media

A drafted X / Twitter thread is in [`docs/submission/x-thread.md`](docs/submission/x-thread.md). It tags **@MetaMaskDev** and showcases how Advanced Permissions streamline obtaining a bounded permission from the user (the EIP-7715 grant), ends on the public proof transaction `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab` on BaseScan, and is explicit that the x402 leg is simulated by design.

## Links

- [Demo checklist and runbook](docs/demo-checklist.md)
- [Demo video plan](docs/demo-video-plan.md)
- [Vercel deployment plan](docs/vercel-deployment-plan.md)
- [Architecture notes](docs/architecture.md)
- Public proof transaction hash: `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab`
