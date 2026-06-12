# DelegaPay — X / Twitter Thread (Track 1: Best Social Media Presence)

> Draft for review. Grounded in the real DelegaPay codebase (`lib/metamask/*`, `lib/relayer/*`).
> Tag is included as required: **@MetaMaskDev**. Replace `[DEMO VIDEO]` with the final clip before posting.
> Char counts are approximate (standard X limit ~280; X Premium allows longer posts).

---

## Tweet 1 — Hook (~270 chars)

We wanted to let an AI agent *pay* for things on-chain.

The blocker wasn't the AI. It was custody: handing an agent a private key or an unbounded `approve()` is a non-starter for real money.

So we built DelegaPay on @MetaMaskDev Advanced Permissions. 🧵

`[DEMO VIDEO]`

---

## Tweet 2 — The journey + the core insight (~280 chars)

Our use case: "Send 1 USDC to 0x47…9cfD on Base Sepolia," proposed by an AI.

With EIP-7715 we stopped asking "should we trust the agent?" and started asking the wallet for a *bounded grant*:

- `erc20-token-allowance` → one-off cap
- `erc20-token-periodic` → daily budget

AI proposes. Wallet authorizes.

---

## Tweet 3 — The technical depth (EIP-7715 + EIP-7702) (~290 chars)

What made it click:

`requestExecutionPermissions([{ chainId, permission, to, expiry }])` returns a signed delegation. EIP-7702 quietly upgrades the EOA to a stateless smart account *in the same grant* — no pre-deploy.

The agent never holds keys. It can only spend inside a cap the user signed once.

---

## Tweet 4 — The hard-won lesson + payoff (~290 chars)

Best part / sharpest edge: the signed allowance is **immutable**. You can't widen it server-side.

That forced an honest design — authorize `budget + fee headroom` up front, then a 1Shot relayer redeems it. Every step is dry-run-first, broadcast-explicit.

Bounded authority > blind trust.

cc @MetaMaskDev
#MetaMask #SmartAccounts #EIP7715 #EIP7702 #AIagents #Base #web3

---

## Posting notes (not part of the thread)

- **Required by Track 1 rules:** thread tags @MetaMaskDev (Tweets 1, 4) and showcases how Advanced Permissions streamlined *obtaining bounded permission from the user* — that's the EIP-7715 grant in Tweets 2–3.
- **Attach the demo video** to Tweet 1 for max reach; pin Tweet 1.
- **Optional media per tweet:**
  - T1: 5–10s clip of the agent proposing a mission.
  - T2: screenshot of the Bounded Budget Field + the MetaMask permission prompt.
  - T3: the permission JSON / a frame of the EIP-7715 grant dialog.
  - T4: the Mission Timeline ending on the public proof tx
    (`0x5b3deadb58a88343c8f3cbddf9c564cdc9d9eb9ebaf84bbddf7f383bd80997ab` on BaseScan).
- **Authenticity:** every technical claim above maps to real code —
  `lib/metamask/permissions.ts` (`requestExecutionPermissions`, the two permission types),
  `lib/metamask/execute.ts` (EIP-7702 upgrade check), and
  `lib/metamask/relayGranted.ts` (the immutable-allowance fail-fast). Keep it honest if anyone asks.
- **Do not claim** the x402 leg is real on-chain settlement — it is simulated by design.
