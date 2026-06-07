# DelegaPay Demo Video Plan

## 1. Demo positioning

**DelegaPay: Safe Delegated Payments for AI Agents**

Core sentence:

> “Give AI agents a wallet, not your treasury.”

Operating model:

> “AI proposes; wallet authorizes; relayer executes.”

DelegaPay lets a user grant a bounded USDC budget, asks an AI planner to propose a validated payment mission, and keeps every valuable action behind visible controls. The demo shows a simulated x402 premium risk gate that can block broadcast, MetaMask Advanced Permissions / EIP-7715 granting a scoped allowance, a 1Shot dry-run estimate before delegated execution, a Mission Timeline / Flight Recorder for the audit trail, and BaseScan as the public proof endpoint.

Be explicit and honest while narrating:

- The x402 premium leg is simulated in this demo, not a real on-chain x402 settlement.
- The delegated payment proof is real and verifiable on Base Sepolia.
- Automated tests use mocked broadcasts and do not write to chain.
- Estimate is a dry run; Broadcast is the only real transfer action in the running app.

Verified public proof transaction for the default recording:

```text
0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab
```

## 2. Recording prerequisites

Use this checklist before recording the primary video.

- Install dependencies if needed: `pnpm install`.
- Set the public proof hash in `.env.local` or in the shell before starting Next.js:

  ```bash
  NEXT_PUBLIC_DELEGAPAY_PROOF_TX=0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab pnpm dev
  ```

- Expected recording URL: `http://localhost:3000`.
- If reusing the harness dev server for visual checks, use `pnpm dev:harness` and `http://localhost:3001` instead.
- Recommended browser size: `1440×900` for a clean product-demo frame, or `1920×1080` for final export.
- Start on `/`, then navigate to `/demo` through the `Start guided demo` CTA.
- If recording the MetaMask path live:
  - Use MetaMask on Base Sepolia, chain id `84532`.
  - Use a compatible MetaMask build for Advanced Permissions / EIP-7715.
  - Confirm the connected account is ready for the permission flow.
  - Keep a small Base Sepolia USDC balance for any manually approved real broadcast.
  - Do not click `Broadcast on-chain` unless a new live transfer has been explicitly approved for this recording session.
- For the default recording, avoid a new live broadcast. Show the flow through dry run and use the verified proof transaction above.
- Confirm x402 is presented as `x402 · simulated`.
- Confirm automated harnesses use mocked broadcasts and do not send real transactions.
- If wallet popups, network, or chain state are unstable, use the fallback plan in section 5.

## 3. Full timestamped plan, primary version

Primary target: record at a calm pace and trim pauses to land around 3 minutes 45 seconds to 4 minutes. The table below includes a few seconds of buffer, ending at 4:10 if spoken slowly.

| Time | Page / URL | Visual action | Interaction | English narration | What the judge should understand | Fallback note |
| --- | --- | --- | --- | --- | --- | --- |
| 00:00–00:15 | `/` | Show the landing hero, Bounded Budget Field, and the headline “Give AI agents a wallet, not your treasury.” | None. Start with the hero in frame. | “Would you give an AI agent your wallet? Probably not. But approving every tiny payment manually kills automation. DelegaPay creates a third path: the agent gets a bounded payment permission, not your treasury.” | DelegaPay is about safe agent payment authority, not custody. | If animation is distracting, pause on a static hero frame. |
| 00:15–00:35 | `/` | Scroll to the Boundary model / safety ladder. Keep the budget and gate language visible. | Smooth scroll only. | “The core safety rule is simple: the agent can act, but every valuable action must pass through the same bounded sequence — budget cap, plan validation, wallet permission, risk gate, dry run, and public proof.” | Safety is a sequence of controls, not a hidden backend claim. | If scrolling overshoots, cut to the section and resume narration. |
| 00:35–00:55 | `/` | Scroll to the Protocol sequence: MetaMask → x402 → 1Shot → BaseScan. | None beyond scroll. | “Each sponsor technology plays a specific role. MetaMask gives readable bounded permissions, x402 gates premium risk scoring, 1Shot estimates and relays delegated execution, and BaseScan gives the public proof.” | The sponsor stack is integrated into one coherent payment story. | If x402 is questioned, immediately say it is simulated in this demo. |
| 00:55–01:05 | `/` to `/demo` | Return the CTA area if needed and show the primary button. | Click `Start guided demo`. | “Now let’s run the guided mission flow.” | The landing story moves into an executable demo. | If navigation is slow, cut on the click and resume once `/demo` loads. |
| 01:05–01:35 | `/demo` | Show Mission Control, budget input, task textarea, and the safety rail. | Use budget `25.00` or `5.00`. Enter: `Send 1 USDC to 0x4727165918986b69ff3F94aC1dAa94987B819cfD on Base Sepolia`. Click `Generate mission plan`. | “The human starts by setting the boundary: a USDC budget and a concrete payment mission. The AI can draft a plan, but it cannot spend anything yet. At this point there is no wallet permission, no relayer execution, and no transaction.” | The AI has planning authority only; money does not move from text input. | If the form is already prefilled, briefly point to the budget and task before clicking. |
| 01:35–02:00 | `/demo` | Show the validated AI plan, max spend, permission type, and risk checks. | No payment action. | “The planner returns a structured mission plan. This is only a proposal. The plan is validated before any wallet permission or broadcast is allowed. The planner is provider-agnostic; this build can route through DeepSeek, Venice-compatible, OpenAI-compatible, or mock providers. The important boundary is that the AI proposes, while the wallet authorizes.” | The AI output is validated and cannot directly execute. | If configured provider is visible, name it honestly; otherwise keep the provider-agnostic line. |
| 02:00–02:35 | `/demo` | Show MetaMask as the selected signing mode, the Server key fallback, grant allowance copy, and permission status. | If safe and approved for recording, connect MetaMask and grant permission. Otherwise show the UI state without approving a new transfer. | “This is the first important moment: user custody stays with the wallet. MetaMask grants a scoped allowance — token, amount, chain, and delegate are visible before approval. A grant allowance is a cap, not money spent. Server-key mode remains available only as a controlled testnet fallback.” | MetaMask is the hero path; DelegaPay does not take the user’s private key. | Fallback narration: “For recording reliability, I’m showing the already verified path. The same MetaMask permission flow was manually verified on Base Sepolia.” |
| 02:35–03:00 | `/demo` | Show the x402 risk gate if the plan requires premium, then show the dry-run estimate and cost breakdown. | Click `Run premium risk check` if present. Click `Estimate (dry run)` or `Grant budget & estimate` only for dry run. Do not click Broadcast. | “Before broadcast, DelegaPay can require a premium risk check. In this demo, x402 runs the challenge-signature-unlock handshake in simulated mode, so the demo is deterministic and safe. Then 1Shot performs a dry-run estimate. No transfer happens during estimate.” | x402 is simulated; dry run previews cost and relayer state without moving funds. | If the generated plan does not require premium, say: “This mission does not need the premium gate, but the app supports it and the checklist covers that path.” |
| 03:00–03:30 | `/demo` and proof surface | Show Broadcast readiness, the disabled/enabled interlock, and then the proof section or proof drawer with the verified transaction hash. | Do not trigger a new broadcast. Open the existing proof link only if it is already rendered from `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` or from a previously confirmed run. | “Only after permission, risk gate, and dry run are complete does Broadcast become available. The duplicate-send lock prevents repeated execution. For public proof, here is a real Base Sepolia transaction from the verified MetaMask plus 1Shot redeem path: `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab`.” | Broadcast is the only real transfer action; the proof tx is public and real. | If proof is not rendered in `/demo`, show the landing proof section using the env-configured hash. |
| 03:30–03:55 | `/demo` | Show Mission Timeline / Flight Recorder with planner, permission, premium, estimate, submitted, and finalized events if present. | No broadcast action. | “The result is not just a payment. It is an auditable payment mission. Every important transition lands in the flight recorder: plan, permission, risk check, dry run, relay, and final proof.” | Auditability is a product feature, not just a log. | If finalized events are unavailable in the safe recording, show the dry-run timeline and point to the verified proof transaction. |
| 03:55–04:10 | `/demo` or `/` | End on proof state, landing proof, or the hero field. | None. | “DelegaPay turns AI payments from private-key custody into bounded, inspectable delegated execution. The agent can act, but the treasury stays outside the field.” | Final takeaway: bounded authority, readable controls, public proof. | Trim this line or shorten earlier pauses if the video must stay under 4 minutes. |

## 4. 90-second compressed version

Use this version when the submission video has a strict short limit.

| Time | Page / URL | Visual action | Interaction | Exact English narration |
| --- | --- | --- | --- | --- |
| 00:00–00:15 | `/` | Hero and Bounded Budget Field. | None. | “DelegaPay is safe delegated payments for AI agents. The core idea is simple: give AI agents a wallet, not your treasury. The agent can act only inside a bounded USDC permission.” |
| 00:15–00:30 | `/` | Boundary model, then protocol rail. | Scroll. | “The sequence is budget cap, validated plan, MetaMask permission, simulated x402 risk gate, 1Shot dry run, and BaseScan proof. Each protocol has one visible job in the flow.” |
| 00:30–00:50 | `/demo` | Mission form and validated plan. | Click `Start guided demo`, enter mission, generate plan. | “I set a budget and a payment mission. The AI proposes a structured plan, but it cannot spend anything. AI proposes; wallet authorizes; relayer executes.” |
| 00:50–01:10 | `/demo` | MetaMask path, Server-key fallback, x402 gate. | Show permission area; run simulated risk check only if present. | “MetaMask is the custody boundary. Grant allowance is a cap, not spent until broadcast. The x402 step is simulated in this demo, but it still gates the send path and records the risk result.” |
| 01:10–01:25 | `/demo` | Dry-run estimate, cost breakdown, proof hash. | Click dry run only; do not broadcast. | “Estimate is a dry run; broadcast is the only real transfer action. For proof, this verified Base Sepolia transfer is public: `0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab`.” |
| 01:25–01:30 | `/demo` or `/` | Flight Recorder or hero field. | None. | “Every step is visible in the Mission Timeline / Flight Recorder. The agent can act, but the treasury stays outside the field.” |

## 5. If live chain or MetaMask is unstable

Use this fallback instead of attempting a new broadcast:

1. Open `/demo` and show the mission flow through plan generation.
2. If MetaMask popup behavior is unreliable, narrate the verified MetaMask path without approving a new permission.
3. Run only the safe dry-run estimate path.
4. Do not click a real unmocked `Broadcast on-chain`.
5. Use the existing verified Base Sepolia transaction as public proof:

   ```text
   0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab
   ```

6. If asked about real, simulated, and mocked paths, show `docs/demo-checklist.md` section 6, “Which flows are real on-chain vs simulated vs mocked.”
7. Explain: “x402 is simulated by design for deterministic demo safety; the delegated transfer proof is real and public on Base Sepolia.”
8. If the proof link is not rendered because the env var was missing, restart the dev server with `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` set and show the landing proof section.

## 6. Do not say

- Do not claim the x402 premium leg is a real on-chain settlement.
- Do not claim grant allowance is already spent.
- Do not claim automated harnesses send real chain transactions.
- Do not imply the AI holds the private key.
- Do not claim production-ready custody.
- Do not say the relayer target is hardcoded; it is discovered from capabilities.
- Do not call a dry run a payment.
- Do not describe Server-key mode as user custody.

## 7. Must say

- “AI proposes; wallet authorizes; relayer executes.”
- “Grant allowance is a cap, not spent until broadcast.”
- “Estimate is a dry run; broadcast is the only real transfer action.”
- “x402 is simulated in this demo; the delegated transfer proof is real.”
- “Every step is visible in the Mission Timeline / Flight Recorder.”
- “MetaMask is the primary custody boundary; Server-key mode is a controlled testnet fallback.”
- “Automated tests use mocked relayer broadcasts and do not write to chain.”

## 8. Final recording checklist

Before pressing record:

- `NEXT_PUBLIC_DELEGAPAY_PROOF_TX` is set to the verified proof hash.
- Browser is sized to `1440×900` or `1920×1080`.
- `/` loads without wallet prompts.
- `/demo` shows Mission Control and the safety rail.
- The planned mission text is ready to paste:

  ```text
  Send 1 USDC to 0x4727165918986b69ff3F94aC1dAa94987B819cfD on Base Sepolia
  ```

- Narration explicitly distinguishes real, simulated, and mocked paths.
- The default recording plan avoids a new live broadcast.
- If a live broadcast is later approved, perform it manually only after dry run, risk gate, wallet readiness, and test-USDC balance checks.
