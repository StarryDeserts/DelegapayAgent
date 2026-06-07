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

## Links

- [Demo checklist and runbook](docs/demo-checklist.md)
- [Demo video plan](docs/demo-video-plan.md)
- [Vercel deployment plan](docs/vercel-deployment-plan.md)
- [Architecture notes](docs/architecture.md)
- Public proof transaction hash: `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab`
