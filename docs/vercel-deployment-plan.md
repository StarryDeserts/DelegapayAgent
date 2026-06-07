# DelegaPay Agent — Vercel Deployment Plan

This document is a deployment plan, not a record of a completed deployment. Do not deploy, promote, or configure production secrets until the checklist below has been reviewed for the intended demo mode.

## 1. Deployment goal

Deploy DelegaPay Agent as a judge-accessible Next.js application while preserving the demo safety model:

- `/` presents the product story, Bounded Budget Field, protocol sequence, and public proof surface.
- `/demo` presents the guided Mission Control flow.
- `/console` remains available as the advanced/developer console.
- x402 is clearly labeled as simulated in this MVP.
- Dry-run estimate is safe and does not write to chain.
- Broadcast is explicit and real on Base Sepolia when enabled in the running app.
- Automated harnesses remain mocked and do not send real transactions.

The default recommended deployment for hackathon judging is a safe public demo mode: public proof hash enabled, mock or server-side AI planning as desired, and no server-key broadcast secrets unless a controlled live testnet fallback is intentionally needed.

## 2. Pre-deployment checklist

Before creating or promoting a Vercel deployment:

- [ ] Confirm the latest code has been reviewed locally.
- [ ] Confirm `README.md`, `docs/demo-checklist.md`, and `docs/demo-video-plan.md` match the intended submission story.
- [ ] Confirm `docs/demo-checklist.md` section 6 still clearly distinguishes real, simulated, and mocked flows.
- [ ] Confirm `.env.local` and any other secret-bearing files are not committed.
- [ ] Confirm the default demo narrative uses the verified public Base Sepolia proof transaction unless a new live broadcast is explicitly approved.
- [ ] Run local verification:

  ```bash
  pnpm install
  pnpm exec tsc --noEmit
  pnpm lint
  pnpm build
  ```

- [ ] Optionally run the headless harnesses locally before deployment:

  ```bash
  pnpm dev:harness
  pnpm test:harness
  ```

- [ ] Do not click **Broadcast on-chain** during pre-deployment verification unless the team has explicitly approved a new live Base Sepolia transfer.

Build note: the app now uses system font stacks and no longer depends on `next/font/google` fetching Google Fonts during `pnpm build`.

## 3. Vercel project setup

Recommended project settings:

| Setting | Recommended value |
| --- | --- |
| Framework preset | Next.js |
| Package manager | pnpm |
| Install command | `pnpm install` |
| Build command | `pnpm build` |
| Output directory | Vercel default for Next.js |
| Development command | `pnpm dev` |
| Root directory | Repository root (`delegapay-agent`) if importing only this project; otherwise select the `delegapay-agent` subdirectory in a monorepo import. |

Setup steps:

1. Import the repository into Vercel.
2. Select the project root that contains `package.json` for DelegaPay Agent.
3. Confirm Vercel detects Next.js.
4. Add environment variables for the selected deployment mode only.
5. Deploy a preview build first.
6. Verify the preview using the post-deployment checklist below.
7. Promote to production only after the preview matches the demo script and safety labels.

## 4. Environment variables on Vercel

Configure Vercel environment variables by mode. Do not paste real secrets into source files, prompts, screenshots, browser-visible logs, or `NEXT_PUBLIC_*` variables unless the value is intentionally public.

### Public proof and demo surface

| Variable | Required? | Secret? | Recommended value / notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` | Recommended for judge demo | No | Use the verified public proof tx: `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab`. |

### AI planner

| Variable | Required? | Secret? | Notes |
| --- | --- | --- | --- |
| `AI_PROVIDER` | Optional | No | Use `mock`, `deepseek`, `venice`, or `openai-compatible`. Blank allows automatic selection. |
| `DEEPSEEK_API_KEY` | Optional | Yes | Server-only. Use if deploying with DeepSeek-backed planning. |
| `DEEPSEEK_MODEL` | Optional | No | Defaults are documented in `.env.example`. |
| `DEEPSEEK_API_BASE_URL` | Optional | Usually no | Keep server-side; do not expose as public config. |
| `DEEPSEEK_THINKING` | Optional | No | Defaults to disabled for fast JSON planning. |
| `VENICE_API_KEY` | Optional | Yes | Server-only. Use only if the Venice provider is selected or should be auto-selected. |
| `VENICE_MODEL` | Required when using Venice | No | Model name depends on the account. |
| `VENICE_BASE_URL` | Optional | No | OpenAI-compatible Venice base URL. |
| `OPENAI_COMPATIBLE_API_KEY` | Optional | Yes | Server-only. |
| `OPENAI_COMPATIBLE_MODEL` | Required when using generic OpenAI-compatible provider | No | Required for that provider. |
| `OPENAI_COMPATIBLE_BASE_URL` | Required when using generic OpenAI-compatible provider | Usually no | Server-side only. |

For maximum judging reliability, `AI_PROVIDER=mock` is acceptable for a deterministic demo if the submission clearly states that live provider-backed planning is optional and configurable.

### Base Sepolia / relayer / token config

| Variable | Required? | Secret? | Notes |
| --- | --- | --- | --- |
| `BASE_SEPOLIA_USDC_CONTRACT_ADDRESS` | Recommended | No | Circle Base Sepolia USDC address from `.env.example`. |
| `CHAIN_ID` | Recommended | No | `84532` for Base Sepolia. |
| `RPC_URL` | Required for server-key fallback / some on-chain reads | Yes | Server-only; RPC URLs usually contain API keys. |

### Server-key fallback broadcast

| Variable | Required? | Secret? | Notes |
| --- | --- | --- | --- |
| `PRIVATE_KEY` | Only for Server-key fallback broadcast | Yes | Throwaway Base Sepolia testnet key only. Do not configure for public demo mode unless the fallback must be live. |
| `OWNER` | Only for Server-key fallback broadcast | Sensitive metadata | EOA upgraded in place via EIP-7702 for the local signer path. |

The MetaMask/EIP-7715 path is the primary custody story and does not require putting a user private key on the server.

## 5. Recommended deployment modes

### Mode A — Safe judge demo mode

Use this mode for the default hackathon submission.

Environment:

- Set `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` to the verified public proof hash.
- Use `AI_PROVIDER=mock` for deterministic planning, or configure one server-side AI provider if live planning is desired.
- Do not set `PRIVATE_KEY` or `OWNER` unless the server-key fallback must be demonstrated live.
- Set `CHAIN_ID` and `BASE_SEPOLIA_USDC_CONTRACT_ADDRESS` for accurate UI/config behavior.

Expected behavior:

- Landing page shows the product story and proof hash.
- `/demo` can show plan generation, permission narrative, simulated x402 gate, and dry-run estimate.
- No new live transfer is required for judging.

### Mode B — MetaMask live testnet mode

Use this only for a controlled live demo with a compatible MetaMask account.

Environment:

- Configure the public proof hash.
- Configure the preferred server-side AI provider or use mock.
- Do not configure server-key fallback secrets unless needed separately.

Operator requirements:

- Use Base Sepolia, chain id `84532`.
- Use a MetaMask build that supports Advanced Permissions / EIP-7715.
- Use only testnet USDC.
- Run dry-run estimate before any broadcast.
- Click **Broadcast on-chain** only after explicit approval for that recording/demo session.

### Mode C — Server-key fallback testnet mode

Use this only when a controlled fallback is required.

Environment:

- Configure `PRIVATE_KEY`, `OWNER`, and `RPC_URL` as Vercel server-side environment variables.
- Use only a throwaway Base Sepolia testnet key with no real funds.
- Keep budgets small.

Risk note:

Server-key mode is not the user-custody story. It is a testnet fallback path for controlled demos and should be described that way.

## 6. Security checklist

Before promoting any deployment:

- [ ] No `.env.local`, `.env`, private key, wallet seed, RPC secret, or AI provider key is committed.
- [ ] No secret is placed in a `NEXT_PUBLIC_*` variable.
- [ ] `PRIVATE_KEY` is absent unless intentionally enabling Server-key fallback mode.
- [ ] Any configured `PRIVATE_KEY` is a throwaway Base Sepolia testnet key, not a real-funds wallet.
- [ ] `RPC_URL` is server-only.
- [ ] AI provider keys are server-only.
- [ ] The README and UI state that x402 is simulated in this demo.
- [ ] The UI still states that Estimate is a dry run and Broadcast is the real transfer action.
- [ ] The relayer delegate target is discovered from capabilities, not presented as a hardcoded trust assumption.
- [ ] The public proof hash is safe to expose because it is already public on-chain data.
- [ ] Vercel preview logs are checked for accidental secret output.

## 7. Post-deployment verification

On the preview deployment:

1. Open `/`.
   - Confirm the landing page loads without wallet prompts.
   - Confirm the Bounded Budget Field, safety model, protocol sequence, and proof section render.
   - Confirm x402 copy is presented as simulated where referenced.
2. Open `/demo`.
   - Confirm Mission Control loads.
   - Generate a mission plan.
   - Confirm the planner result is structured and validated.
   - Confirm MetaMask remains the primary custody path in the story.
   - If using mock/safe mode, do not initiate a real broadcast.
3. Run the premium gate only if it appears.
   - Confirm it is labeled `x402 · simulated`.
   - Confirm it does not claim real on-chain settlement.
4. Run **Estimate (dry run)** only.
   - Confirm the UI says estimate is a dry run.
   - Confirm no transfer is broadcast during estimate.
5. Confirm Broadcast behavior.
   - It should only become available after the required gates.
   - Do not click it unless a new live transfer has been approved.
6. Open `/console`.
   - Confirm the advanced console still loads for developer review.
7. Review browser console and Vercel function logs.
   - Confirm no secrets are printed.
   - Confirm no unexpected API errors appear in the safe path.

If a live MetaMask/Base Sepolia transfer is intentionally performed, record the resulting transaction hash and update the public proof variable only after verifying it on BaseScan.

## 8. Rollback plan

If the deployment fails verification:

1. Do not promote the preview to production.
2. If production was already promoted, use Vercel's previous successful deployment rollback.
3. Remove or rotate any environment variable that may have been exposed in logs or screenshots.
4. Reproduce the issue locally with:

   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm build
   ```

5. Fix the issue in source or configuration.
6. Re-run local verification.
7. Deploy a fresh preview and repeat post-deployment verification.

Rollback triggers:

- Landing or `/demo` fails to load.
- Build fails.
- Secrets appear in logs or client-visible bundles.
- UI implies x402 is real on-chain settlement.
- UI makes Broadcast appear automatic or safe to click casually.
- Preview requires a real transaction for the default judge path.

## 9. Submission notes

For hackathon submission:

- Link to the repository README as the primary technical overview.
- Use `docs/demo-video-plan.md` as the recording script.
- Use `docs/demo-checklist.md` as the live-demo safety runbook.
- Use this deployment plan to explain how the project can be safely hosted on Vercel.
- State clearly that x402 is simulated in the MVP, while the delegated transfer proof is real and verifiable on Base Sepolia.
- Prefer the verified public proof transaction for default judging unless a new live broadcast has been approved and verified.
- Do not describe the project as production custody software.
