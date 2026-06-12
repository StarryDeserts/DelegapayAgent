# DelegaPay — Sponsor Feedback (Track 2: Best Feedback)

> Grounded in the actual DelegaPay codebase. Every friction point below cites the real file where we
> hit it, so the feedback is specific and verifiable rather than generic. Date: 2026-06-12.
>
> **Project context:** DelegaPay grants an AI agent a *bounded* USDC budget on Base Sepolia. The AI
> only *proposes* a mission; a MetaMask EIP-7715 permission authorizes it; a 1Shot relayer redeems it;
> the user sees a dry-run estimate before any explicit broadcast. Stack: Next.js 16, viem 2.x,
> `@metamask/smart-accounts-kit` 1.6.0, OpenAI-compatible planners (DeepSeek default, Venice optional).

---

## 1. MetaMask — Smart Accounts Kit / Advanced Permissions (EIP-7715 + EIP-7702)

### What worked well
- **EIP-7715 was the right primitive.** `requestExecutionPermissions([{ chainId, permission, to, expiry }])`
  let us ask the wallet for a *bounded* grant instead of inventing our own custody scheme. The two
  permission shapes mapped cleanly to our product:
  - `erc20-token-allowance` → one-off fixed cap
  - `erc20-token-periodic` (`periodAmount` + `periodDuration`) → recurring/subscription budget
  (`lib/metamask/permissions.ts`)
- **EIP-7702 in-flight upgrade is magic when it works.** The EOA becomes a stateless smart account
  during the grant — no pre-deploy step for the user. `createDelegation` + `smartAccount.signDelegation`
  produced a redeemable delegation with very little code (`lib/metamask/delegation.ts`).
- **Self-contained client boundary.** We could hide the entire kit behind one `WalletPermissionsClient`
  interface and stub it in CI, because the actions are reasonably well-typed.

### Friction we actually hit (with fixes we had to write)
1. **`getSupportedExecutionPermissions()` throws on non-Flask / older MetaMask** instead of reporting
   "unsupported." We had to wrap detection in `try/catch` and treat *any* throw as "fall back to the
   server-key path," or the console would crash on a normal wallet (`lib/metamask/permissions.ts`,
   `detect()`).
   - **Suggestion:** return a capability descriptor (or empty map) for unsupported wallets; reserve
     throws for genuine RPC failures. Capability detection shouldn't be a try/catch.

2. **Discriminated-union widening fights you.** Building the delegation `scope` in a shared ternary
   (`const scope = cond ? {…} : {…}`) widens `type` to the entire `ScopeType` enum and no longer matches
   the kit's discriminated `ScopeConfig`. We had to *inline* the whole `createDelegation({…})` call per
   branch to keep the literal narrow (`lib/metamask/delegation.ts`, lines ~54–72).
   - **Suggestion:** ship per-scope factory helpers (e.g. `erc20TransferAmountScope(...)`,
     `erc20PeriodScope(...)`) so the discriminant is preserved without forcing call-site duplication.

3. **Kit `Delegation` vs ERC-7710 wire shape needs an `as unknown as` cast.** `decodeDelegations(ctx)`
   returns a structurally-identical-but-nominally-different type from our relayer's `Delegation7710`, so
   we cast `as unknown as Delegation7710[]` (`lib/metamask/permissions.ts`, `grant()`).
   - **Suggestion:** export the on-the-wire delegation type (or a `toErc7710()` adapter) so integrators
     don't double-cast through `unknown` and lose type safety at the most security-sensitive seam.

4. **The immutable signed allowance vs. an unknown relayer fee is the single biggest design tax.** The
   grant is fixed the moment MetaMask signs it — there is no server-side re-sign to widen it. But the
   relayer fee is only known *after* an estimate. We had to authorize `maxSpend + fee headroom (0.10 USDC)`
   up front, and still hard-fail with "grant a higher budget" when `fee + work` overflows the signed cap
   (`lib/metamask/permissions.ts` `GRANT_FEE_HEADROOM_USDC`; `lib/metamask/relayGranted.ts`, lines ~177–195).
   - **Suggestion:** document a first-class "fee rides on top of intent" pattern, or make
     `isAdjustmentAllowed` support a *bounded* programmatic top-up that doesn't require a fresh user
     prompt. Right now `isAdjustmentAllowed: true` still means re-prompting the human.

5. **EIP-7702 authorization plumbing is under-documented.** Resolving
   `smartAccount.environment.implementations.EIP7702StatelessDeleGatorImpl` and assembling the
   `authorizationList` (when the EOA isn't yet upgraded) was trial-and-error
   (`lib/metamask/execute.ts` `resolveImplAddress` / `checkUpgrade` / `buildAuthorization`).
   - **Suggestion:** one end-to-end worked example: 7702 upgrade authorization → 7715 grant → relayer
     redeem, with the exact field shapes. This is the path most agent projects will need and it's the
     least documented.

---

## 2. 1Shot API — Delegated Relayer (ERC-7710 redemption)

### What worked well
- **Keyless public relayer is a fantastic DX for a hackathon.** No API key, no Bearer token; clients pay
  per transaction in ERC-20 on-chain. We could call it from day one and swap endpoints
  (`relayer.1shotapi.dev` testnet / `.com` mainnet) by changing one constant (`lib/relayer/client.ts`).
- **Capability discovery is the right model.** `relayer_getCapabilities` returning `feeCollector`,
  `targetAddress`, and accepted `tokens` meant we never hardcoded a delegate address
  (`lib/relayer/capabilities.ts`).
- **Estimate → signed price-lock `context` → send → poll** is a clean, honest lifecycle that made our
  "dry-run first, broadcast explicit" safety story easy to build (`lib/metamask/execute.ts` `relayBundle`).

### Friction we actually hit
1. **Inconsistent JSON-RPC parameter shapes.** `relayer_getCapabilities` takes a *positional array*,
   while `relayer_send7710Transaction` takes a *single object*. We left a comment in our transport
   because we couldn't write one uniform param helper (`lib/relayer/client.ts`, `relayerRpc`).
   - **Suggestion:** standardize on one convention (objects, ideally) across all `relayer_*` methods.

2. **`decimals` arrives as `number | string`.** Capability tokens sometimes report `decimals` as a
   numeric string, so we wrote a defensive `tokenDecimals()` normalizer to avoid `parseUnits` blowing up
   (`lib/metamask/execute.ts`).
   - **Suggestion:** lock the capabilities response types (numbers as numbers) and publish a TS type.

3. **The "delegate must equal `targetAddress`" rule is invisible until it rejects you.** If the browser
   grants a permission `to` anything other than the relayer's `targetAddress`, redemption fails with an
   opaque error. We added a pre-flight comparison to fail fast with an actionable message
   (`lib/metamask/relayGranted.ts`, lines ~104–114).
   - **Suggestion:** document this constraint prominently, and return a typed error code
     (`DELEGATE_MISMATCH`) rather than a generic RPC error.

4. **Two-phase fee discovery forces a re-sign.** The mock fee leg (`0.01`) lets the relayer price the tx,
   but if `estimate.requiredPaymentAmount` exceeds it we must rebuild and (on the local-signer path)
   **re-sign** the delegation, because the scope changed (`lib/metamask/execute.ts`, lines ~218–225).
   Combined with MetaMask's immutable grant, this is a genuinely sharp edge.
   - **Suggestion:** expose the min-fee / fee-floor in `getCapabilities`, or return a *pre-sign* fee quote
     so integrators can size the allowance once and never re-sign.

5. **Terminal status semantics had to be reverse-engineered.** We hardcoded the meaning of confirmed /
   rejected / reverted codes and a 120s poll deadline (`lib/relayer/status.ts`, `lib/metamask/execute.ts`).
   - **Suggestion:** publish a status enum + a webhook payload schema (`destinationUrl` exists but its
     event shape isn't documented).

---

## 3. Venice AI — Mission Planner (OpenAI-compatible)

### What worked well
- **OpenAI compatibility meant near-zero integration cost.** Venice dropped straight into our generic
  `createOpenAICompatiblePlanner({ baseUrl, apiKey, model })` with only a base URL
  (`https://api.venice.ai/api/v1`) — no bespoke client (`lib/ai/providers/venice.ts`).
- **Strict `json_schema` support** is a real advantage over providers that only offer `json_object`; it
  pairs well with our zod contract (`lib/ai/schema.ts` `MissionPlanSchema`).

### Friction we actually hit
1. **No safe default model — `VENICE_MODEL` must be supplied or we fail fast.** The available model varies
   per account, so we couldn't ship a sensible default the way we do for DeepSeek
   (`deepseek-v4-flash`). That extra required-config step is why Venice ended up *optional* and DeepSeek
   became our default provider (`lib/ai/providers/venice.ts` vs `deepseek.ts`).
   - **Suggestion:** document a recommended default planner model, or expose a `/models` endpoint we can
     probe at startup so a no-config "just works" path exists.

2. **The OpenAI-compat `json_object` quirk bites here too.** The literal word **"json"** must appear in
   the prompt or the request is rejected when `response_format` is `{ type: 'json_object' }`. We bake it
   into `buildSystemPrompt()` (`lib/ai/planner.ts`), but it cost us a confusing 400 first.
   - **Suggestion:** call this out explicitly in Venice's `response_format` docs, and ideally relax it
     when a strict `json_schema` is already supplied.

3. **Onboarding friction kept Venice from being our default.** Because the first successful call needed an
   account-specific model name and key, the fastest path to a green demo was DeepSeek + a deterministic
   mock fallback. A "hello-world planner in 10 lines" snippet (key → model → first `chat.completions`
   call returning JSON) would have flipped that decision.
   - **Suggestion:** ship a copy-pasteable TS quickstart and a small official SDK (with types); right now
     it's HTTP-only via the OpenAI-compat shape.

### Honest note
We treat **all** AI output as a *proposal, never authority*: every planner result is validated against
`MissionPlanSchema` (zod) and re-checked by the MetaMask delegation + 1Shot relayer layers before any
money can move (`lib/ai/schema.ts`). That's a deliberate safety posture, not a knock on any provider —
but it does mean a provider's "structured output" guarantees are a *convenience*, not something we rely on.

---

## TL;DR for each sponsor team
- **MetaMask:** EIP-7715 + 7702 is the right abstraction; smooth the edges — don't throw on capability
  detection, preserve scope discriminants, export the wire delegation type, and give a first-class
  "fee on top of a bounded intent" pattern + one end-to-end 7702→7715→redeem example.
- **1Shot:** great keyless model; standardize JSON-RPC param shapes, lock `decimals` types, surface a
  pre-sign fee quote + min-fee in capabilities, and publish typed error codes + a status enum.
- **Venice:** OpenAI compatibility is a winner; add a recommended default model (or a probe-able
  `/models`), document the `"json"`-in-prompt requirement, and ship a 10-line quickstart so you become
  the *default*, not the *optional*, provider.
