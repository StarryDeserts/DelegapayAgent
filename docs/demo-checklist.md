# DelegaPay Agent — Demo Checklist & Runbook

A pre-demo checklist for running DelegaPay end to end, plus the regression
harnesses. Read this top to bottom before a live demo.

DelegaPay lets a user grant an AI agent a bounded USDC budget, has an AI planner
produce a validated mission plan, optionally buys a **simulated** x402 risk score
before any funds move, and then executes a delegated USDC transfer on **Base
Sepolia** through the 1Shot relayer — with every step shown in a Mission Timeline.

> **The one rule that protects the demo:** estimate is always a *dry run*;
> **Broadcast** is the only action that sends a real on-chain transfer. See
> [§6 Real vs simulated vs mocked](#6-which-flows-are-real-on-chain-vs-simulated-vs-mocked).

---

## 1. Environment variables

Copy `.env.example` → `.env.local` (git-ignored) and fill in values. **Phase 1
needs none of these** — with no provider key set, the app uses the deterministic
mock planner and you can demo the planning + timeline UI offline.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | Real AI planning | `mock` \| `deepseek` \| `venice` \| `openai-compatible`. Blank → first configured key wins; none → mock planner. |
| `DEEPSEEK_API_KEY` | DeepSeek planner | Default real provider. Pair with `DEEPSEEK_MODEL=deepseek-v4-flash`. |
| `DEEPSEEK_MODEL` / `DEEPSEEK_API_BASE_URL` / `DEEPSEEK_THINKING` | DeepSeek tuning | Model defaults to `deepseek-v4-flash`; thinking is `disabled` for fast JSON. |
| `VENICE_API_KEY` / `VENICE_MODEL` / `VENICE_BASE_URL` | Venice planner | OpenAI-compatible; model is per-account so it's required. |
| `OPENAI_COMPATIBLE_*` | Any other OpenAI-format endpoint | Key + model + base URL. |
| `PRIVATE_KEY` | **Server-key broadcast** (`/api/mission/execute`) | **THROWAWAY Base Sepolia testnet key only** — not user custody. Never paste into prompts/screenshots/the planner. |
| `OWNER` | Server-key broadcast | The EOA upgraded in place via EIP-7702 (the local signer's address). |
| `RPC_URL` | Any on-chain read/broadcast | Base Sepolia RPC (e.g. Alchemy). The embedded API key is sensitive — keep it out of prompts and client bundles. |
| `BASE_SEPOLIA_USDC_CONTRACT_ADDRESS` | On-chain | Defaults to Circle's Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. |
| `CHAIN_ID` | On-chain | `84532` (Base Sepolia). |

**Secret hygiene (binding):** `PRIVATE_KEY`, `RPC_URL`, and any AI provider key
are server-only. They must never appear in browser code, prompts, logs, or
screenshots. `lib/metamask/execute.ts` and `lib/metamask/localSigner.ts` are
**server-only** modules — never import them into a client component.

---

## 2. Start the dev server

| Command | Port | Use |
| --- | --- | --- |
| `pnpm dev` | 3000 | Normal local development. |
| `pnpm dev:harness` | 3001 | **Required for the headless harnesses** (they target `:3001`). |

```bash
pnpm install
pnpm dev:harness        # serves on http://localhost:3001
```

`next dev` writes to `.next/dev` (separate from `.next`), so you can run
`pnpm dev:harness` and `pnpm build` concurrently without conflicts.

---

## 3. Base Sepolia setup

- **Network:** Base Sepolia, chain id **84532**.
- **RPC:** set `RPC_URL` to a Base Sepolia endpoint (Alchemy works). Used for the
  EIP-7702 account-code check and any real broadcast.
- **Explorer:** transactions link to **`https://sepolia.basescan.org/tx/<hash>`**
  (the confirmed-broadcast banner renders this automatically).
- **Gas:** the 1Shot relayer is **gas-abstracted** — the relayer fee is paid in
  USDC, not ETH, so the demo wallet does not need ETH to *relay* the transfer.
  Keep a little Base Sepolia ETH around anyway for any direct EIP-7702 upgrade tx
  or manual fallback.

---

## 4. MetaMask requirements (Phase 4 / EIP-7715 path)

Only required for the **MetaMask** signing toggle. The **Server-key** toggle does
not use a browser wallet.

- **MetaMask version:** ERC-20 periodic (Advanced) permissions require
  **MetaMask Flask ≥ 13.5** or **MetaMask production ≥ 13.23**. An older build
  will not expose `wallet_requestExecutionPermissions`.
- **Account upgrade:** the connected account must be upgraded to a **MetaMask
  Smart Account (EIP-7702)**. The app runtime-checks this (`publicClient.getCode`)
  and shows readiness state; if not upgraded, MetaMask prompts the upgrade during
  the permission grant.
- **Network:** MetaMask must be on Base Sepolia (84532). The detect step surfaces
  an "EIP-7715 ready" chip only when provider + chain + permission support all
  pass.
- **Delegate target:** the relayer's redemption `targetAddress` comes from
  **capability discovery** (`/api/relayer/capabilities`) — it is never hardcoded.

If `requestExecutionPermissions` is unavailable, the wallet likely doesn't
support EIP-7715 → switch to a compatible MetaMask build or use the Server-key
path for the demo.

---

## 5. Test USDC requirements

- **Token:** Circle's official Base Sepolia USDC
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals).
- **Where it's needed:** the **signer/owner** account (server-key path) or the
  **connected MetaMask** account (EIP-7715 path) must hold test USDC to cover the
  **transfer amount + relayer fee** of a real broadcast.
- **Faucet:** mint test USDC from Circle's testnet faucet (`faucet.circle.com`,
  select Base Sepolia). A demo budget of a few USDC is plenty (the sample missions
  cap at ~1 USDC transfer + ~0.01 relayer fee + 0.05 simulated premium).
- **Budget math for the canned demo mission:** transfer `1.00` + relayer fee
  `0.01` + premium fee `0.05` (simulated) = **`1.06` committed**. The MetaMask
  grant signs a `1.10` allowance (maxSpend `1.00` + `0.10` fee headroom) — that is
  a **spending cap**, not spent until broadcast.

---

## 6. Which flows are real on-chain vs simulated vs mocked

Three distinct execution modes exist. Keeping them straight is the whole point of
this section — and it is why the UI labels each one.

| Mode | Where | On-chain? | How to recognize it |
| --- | --- | --- | --- |
| **Dry run (estimate)** | "Estimate (dry run)" / "Grant budget & estimate" | **No.** Quote only. | Button literally says *dry run*; helper text: "Estimate is a dry run; broadcasting sends a real transfer on Base Sepolia." Never debits the budget. |
| **Real broadcast** | "Broadcast on-chain" (Server-key `/api/mission/execute` **or** MetaMask `/api/mission/relay`) | **YES — real USDC transfer on Base Sepolia.** | "On-chain transfer confirmed" banner + a real BaseScan link. Debits committed budget by transfer + relayer fee. Gated behind a successful dry run, and behind the premium gate when the plan requires it. |
| **Simulated premium (x402)** | "Run premium risk check" (`/api/premium`) | **No.** Keyless, no chain write. | Badge **"x402 · simulated"**; copy: "simulated handshake, not a real on-chain settlement." Runs the *full* 402 → PAYMENT-REQUIRED → paid handshake and debits 0.05 from the budget, but settles nothing on-chain. |
| **Mocked broadcast** | **Headless harnesses only** (`tests/harness/*`) | **No.** `page.route` intercepts `/api/mission/{execute,relay}`. | Never appears in the running app. Exists solely so the regression suite can assert the full committed-budget progression with **zero** real chain writes. |

**Takeaways:**
- In the **running app**, a *Broadcast* is always **real**. There is no "mock"
  mode in the product — mocking exists only inside the test harnesses.
- The **premium** step is *always* simulated by design (this MVP keeps one real
  relayer permission and one simulated x402 route).
- Dry run and the simulated premium **never** move funds.

### Running the regression harnesses

The harnesses drive the real `:3001` dev server in a bundled chromium and assert
each flow with **no real chain write** (planner + relayer routes are mocked;
`/api/premium` is exercised for real because it's keyless + simulated).

```bash
# Terminal 1
pnpm dev:harness                 # http://localhost:3001

# Terminal 2
pnpm test:harness                # run premium + metamask, aggregate exit code
pnpm test:harness:premium        # x402 + server-key panel only
pnpm test:harness:metamask       # EIP-7715 path only
```

Each harness exits non-zero if any check fails and prints a `N/M checks passed`
tally. `pnpm test:harness` additionally prints a per-harness PASS/FAIL summary.

**Harness environment (machine paths).** Because Playwright is intentionally *not*
a dependency of this repo, the harnesses resolve the browser via env vars, each
defaulting to the path this repo was developed against (`tests/harness/_shared.cjs`):

| Env var | Default | Purpose |
| --- | --- | --- |
| `HARNESS_BASE_URL` | `http://localhost:3001` | Dev server origin to drive. |
| `HARNESS_PLAYWRIGHT_CORE` | npx cache path | `playwright-core` install to `require()`. |
| `HARNESS_CHROME` | ms-playwright cache path | Chromium/Chrome binary (`executablePath`). |
| `HARNESS_NSS_LIB` | playwright-nss-libs path | Dir prepended to `LD_LIBRARY_PATH` for `libnss3` (WSL2/Linux). Set empty to skip if system libs are present. |

**Portability upgrade:** run `pnpm add -D playwright-core` and `download` a
chromium, then the bare `require('playwright-core')` candidate resolves with no
env vars — at the cost of adding a dev dependency (ask-first for this repo).

---

## 7. Manual MetaMask verification steps

Use this to verify the **real** EIP-7715 redeem path on Base Sepolia (the part the
harness deliberately mocks):

1. `pnpm dev` (or `pnpm dev:harness`) and open the app.
2. Ensure MetaMask is on Base Sepolia and the account holds test USDC (§5).
3. Enter a **budget** and a **mission task**, then **Generate plan**.
4. Toggle signing mode to **MetaMask**. Confirm the **"EIP-7715 ready"** chip and
   the "Permission support checked" timeline step.
5. **Connect MetaMask** → confirm "Wallet connected" in the timeline.
6. **Grant budget & estimate** → approve the permission in MetaMask. Confirm:
   - "Permission granted (relayer)" in the timeline,
   - the **Grant allowance** note reads as a **cap** (e.g. `1.10 USDC`, "not spent
     until broadcast"),
   - the dry-run estimate shows the plan amount and the committed meter is still
     `0.00`.
7. If the plan requires a premium route, **Run premium risk check** first and
   confirm the risk-score artifact + the three premium timeline steps; the
   Broadcast button stays disabled until this clears.
8. **Broadcast on-chain** → approve. Confirm:
   - "On-chain transfer confirmed" banner,
   - the **BaseScan link** opens the real tx (`sepolia.basescan.org/tx/...`),
   - committed budget debits by transfer + relayer fee,
   - the Broadcast button disappears (duplicate-send lock).
9. Open the BaseScan link and verify the USDC `Transfer` event on-chain.

---

## 8. Known caveats & recovery

- **"Broadcast" is real.** Only click it on a throwaway/testnet account with test
  USDC. Estimate first; the premium gate (when present) must be cleared first.
- **Mock planner fallback.** No AI key → the deterministic mock planner runs. Good
  for an offline demo; set a provider key for live planning.
- **MetaMask permission unavailable.** `wallet_requestExecutionPermissions does not
  exist` → the wallet is too old or not Flask. Upgrade MetaMask (≥13.23 prod /
  ≥13.5 Flask) or demo the Server-key path instead.
- **Account not upgraded.** If the EIP-7702 upgrade prompt doesn't appear, the
  account may already be upgraded, or on the wrong chain — re-check the network is
  Base Sepolia and re-connect.
- **Relayer quote expired (`4204`).** Quotes last ~45s. Re-run the dry-run
  estimate and broadcast promptly after.
- **Insufficient payment (`4200`).** The relayer fee floors at the token `minFee`;
  raise the budget/allowance so transfer + fee fits, then re-estimate.
- **Stale committed meter.** The meter only moves on real/mocked settlement; the
  cost-breakdown row *projects* the post-broadcast total earlier — this is
  expected, not a bug.
- **Harness can't find chromium.** Set `HARNESS_CHROME` / `HARNESS_PLAYWRIGHT_CORE`
  (see §6) or install `playwright-core` as a dev dependency.
- **Harness "connection refused".** The dev server isn't on `:3001` — start
  `pnpm dev:harness` (or point `HARNESS_BASE_URL` at your dev origin).
- **Recovery from a bad broadcast.** There is no on-chain "undo". Because spend is
  bounded by the signed allowance and the per-mission budget, the blast radius is
  capped at the budget you set — keep demo budgets small.

---

## Quick runbook (TL;DR)

```bash
cp .env.example .env.local        # fill PRIVATE_KEY/OWNER/RPC_URL for real broadcast (optional for mock demo)
pnpm install
pnpm dev:harness                  # http://localhost:3001

# Regression (zero real chain writes):
pnpm test:harness                 # in a second terminal

# Live demo: Generate plan → (MetaMask|Server-key) → Estimate (dry run)
#            → [Run premium risk check if required] → Broadcast on-chain → verify on BaseScan
```
