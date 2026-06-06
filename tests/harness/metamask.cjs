/**
 * Headless harness for the Phase 4 MetaMask EIP-7715 path.
 *
 * Drives the real dev server in bundled chromium with NO MetaMask and NO chain
 * write: a stub WalletPermissionsClient is injected on `window` before mount, and
 * /api/mission/{plan,relay} + /api/relayer/capabilities are mocked with
 * page.route. Asserts the dry-run → gated-broadcast hero flow, the
 * committed-budget ledger, the dup-send lock, the BaseScan link, that ZERO real
 * broadcast left the browser, and that there are no console/page errors.
 *
 * Also covers the budget-semantics vocabulary on the MetaMask path: the grant
 * allowance (1.10, incl. fee headroom) is labelled as a spending cap distinct
 * from committed spend, and the cost breakdown omits the Premium fee row when
 * the plan needs no premium route.
 *
 * Machine paths + base URL are resolved in ./_shared.cjs via env vars.
 */
const { CONSOLE_URL, ADDR, launchBrowser, createReporter, readCommitted, fillPlanForm } = require('./_shared.cjs')

const { USER, TARGET, USDC, FEE_COLLECTOR } = ADDR
const TXHASH = '0xabc1230000000000000000000000000000000000000000000000000000000def'

// Regression fixture for the blank-amount bug: the plan asks for 1 USDC, so a
// blank Amount field must default the executed work to 1.00 — never the old
// 0.10 demo stub. maxSpend (1.00) is deliberately below the form budget (5.00)
// so committed (work + fee = 1.01) stays under budget and the ledger is sane.
const PLAN = {
  summary: 'Subscribe to a research API and summarize this week’s reports',
  requiredPermissionType: 'erc20-token-allowance',
  maxSpendUsdc: '1.00',
  premiumToolRequired: false,
  targetAction: null,
  riskChecks: ['budget capped at 1 USDC'],
}

const { ok, finish } = createReporter()

;(async () => {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  // Count relay calls by mode; both are served by the mock, so a real broadcast
  // can never reach the server.
  let relayDry = 0
  let relayBroadcast = 0
  // Capture the work amount + granted allowance the panel actually POSTs, so the
  // regression can assert the blank field defaulted to the plan amount (not 0.10)
  // and that the grant carried fee headroom over maxSpend.
  let relayDryAmount = null
  let relayDryAllowance = null
  let relayBroadcastAmount = null

  // ---- Inject the stub wallet client BEFORE any app script runs. ----
  await page.addInitScript(() => {
    const DELEG = {
      delegate: '0x2222222222222222222222222222222222222222',
      delegator: '0x1111111111111111111111111111111111111111',
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [],
      salt: '0x01',
      signature: '0xdeadbeef',
    }
    window.__delegapayWalletClient = {
      async detect(permissionType) {
        return { hasProvider: true, chainId: 84532, onBaseSepolia: true, supported: true, permissionType }
      },
      async connect() {
        return { address: '0x1111111111111111111111111111111111111111', chainId: 84532 }
      },
      async grant(args) {
        return {
          delegations: [DELEG],
          expiry: Math.floor(Date.now() / 1000) + 3600,
          target: args.targetAddress,
          allowanceUsdc: args.budgetUsdc,
        }
      },
    }
  })

  // ---- Mock the planner so we need no AI provider. ----
  await page.route('**/api/mission/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'mock', model: 'mock-1', plan: PLAN }),
    }),
  )

  // ---- Mock keyless capabilities proxy. ----
  await page.route('**/api/relayer/capabilities**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        '84532': {
          feeCollector: FEE_COLLECTOR,
          targetAddress: TARGET,
          tokens: [{ address: USDC, symbol: 'USDC', decimals: 6 }],
        },
      }),
    }),
  )

  // ---- Mock the keyless relay route: dry-run vs gated broadcast. ----
  await page.route('**/api/mission/relay', (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const broadcast = body.broadcast === true
    // Echo the requested work amount so the UI reflects the real payload (this is
    // what the regression assertions below read back). Fall back to the old stub
    // only if the panel sent nothing — which, post-fix, it never should.
    const reqAmount = typeof body.amountUsdc === 'string' ? body.amountUsdc : null
    const baseFields = {
      chainId: 84532,
      delegator: USER,
      recipient: body.recipient || USER,
      amountUsdc: reqAmount ?? '0.10',
      feeUsdc: '0.01',
    }
    if (!broadcast) {
      relayDry += 1
      relayDryAmount = reqAmount
      relayDryAllowance = typeof body.allowanceUsdc === 'string' ? body.allowanceUsdc : null
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          broadcast: false,
          ...baseFields,
          events: [
            { type: 'relayer.capabilities.loaded', targetAddress: TARGET, chainIds: [84532] },
            { type: 'relayer.estimate.created', feeUsdc: '0.01' },
          ],
        }),
      })
    }
    relayBroadcast += 1
    relayBroadcastAmount = reqAmount
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        broadcast: true,
        ...baseFields,
        taskId: '0xtask',
        txHash: TXHASH,
        status: 200,
        events: [
          { type: 'relayer.estimate.created', feeUsdc: '0.01' },
          { type: 'relayer.transaction.submitted', taskId: '0xtask' },
          { type: 'relayer.transaction.finalized', txHash: TXHASH, status: 'success' },
        ],
      }),
    })
  })

  await page.goto(CONSOLE_URL, { waitUntil: 'networkidle' })

  // ---- Generate a plan (hydration-safe form fill). ----
  const TASK = 'Subscribe to a research API and summarize this week’s reports'
  await fillPlanForm(page, { budget: '5.00', task: TASK })

  // ---- Flip to MetaMask signing. ----
  await page.click('button:has-text("MetaMask")')
  await page.waitForSelector('text=EIP-7715 · your MetaMask')
  ok('detect: EIP-7715 ready chip shown', await page.locator('text=EIP-7715 ready').count() > 0)
  ok('timeline: permission support checked', await page.locator('text=Permission support checked').count() > 0)

  // ---- Connect. ----
  await page.click('button:has-text("Connect MetaMask")')
  await page.waitForSelector('text=Grant budget & estimate')
  ok('connect: wallet.connected in timeline', await page.locator('text=Wallet connected').count() > 0)

  // ---- Grant + dry-run estimate. ----
  await page.click('button:has-text("Grant budget & estimate")')
  await page.waitForSelector('button:has-text("Broadcast on-chain")')
  const committedAfterDry = await readCommitted(page)
  ok('dry-run: committed still 0.00', committedAfterDry.value === '0.00', committedAfterDry.txt)
  ok('dry-run: relay called once with broadcast=false', relayDry === 1, `relayDry=${relayDry}`)
  ok('dry-run: NO broadcast yet', relayBroadcast === 0, `relayBroadcast=${relayBroadcast}`)
  ok('grant: permission.granted in timeline', await page.locator('text=Permission granted (relayer)').count() > 0)
  ok('dry-run: estimate dl shows amount', await page.locator('dd:has-text("1.00 USDC")').count() > 0)
  ok('dry-run: no confirmed banner yet', await page.locator('text=On-chain transfer confirmed').count() === 0)

  // ---- Grant-allowance vocabulary: the signed 1.10 allowance (maxSpend 1.00 +
  // fee headroom) must read as a spending cap, NOT as committed spend. ----
  ok('grant: "Grant allowance" note shown', await page.locator('text=Grant allowance').count() > 0)
  ok('grant: allowance 1.10 (headroom over maxSpend 1.00) shown', await page.locator('text=1.10 USDC').count() > 0)
  ok('grant: note says a cap, not spent until broadcast', await page.locator('text=not spent until broadcast').count() > 0)

  // ---- Cost breakdown renders here too; with no premium route the Premium fee
  // row must be ABSENT (the breakdown is conditional on the plan). Scope the
  // negative check to the breakdown box — the budget meter's committed subtext
  // ("… + premium fee") legitimately contains that phrase, so a global substring
  // match would false-positive. ----
  ok('vocab: "Cost breakdown" shown', await page.locator('text=Cost breakdown').count() > 0)
  ok('vocab: "Transfer amount" label shown', await page.locator('text=Transfer amount').count() > 0)
  const breakdownHasPremiumRow = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'))
    const head = spans.find((s) => s.textContent?.trim() === 'Cost breakdown')
    const box = head?.parentElement
    return box ? /Premium fee/.test(box.textContent || '') : false
  })
  ok('vocab: no "Premium fee" row when no premium route', breakdownHasPremiumRow === false)

  // ---- Regression: blank Amount must default to the plan amount (1.00), not the
  // old 0.10 demo stub; the grant must carry fee headroom over maxSpend (1.10). ----
  ok('regression: dry-run payload sends plan amount 1.00, not 0.10', relayDryAmount === '1.00', `amountUsdc=${relayDryAmount}`)
  ok('regression: grant carried fee headroom (allowance 1.10 over maxSpend 1.00)', Number(relayDryAllowance) === 1.1, `allowanceUsdc=${relayDryAllowance}`)

  // ---- Gated broadcast. ----
  await page.click('button:has-text("Broadcast on-chain")')
  await page.waitForSelector('text=On-chain transfer confirmed')
  const committedAfterBroadcast = await readCommitted(page)
  ok('broadcast: committed debited to 1.01 (transfer 1.00 + relayer fee 0.01)', committedAfterBroadcast.value === '1.01', committedAfterBroadcast.txt)
  ok('regression: broadcast payload sends plan amount 1.00, not 0.10', relayBroadcastAmount === '1.00', `amountUsdc=${relayBroadcastAmount}`)
  ok('broadcast: relay called once with broadcast=true', relayBroadcast === 1, `relayBroadcast=${relayBroadcast}`)
  ok('broadcast: dup-send lock (button gone)', await page.locator('button:has-text("Broadcast on-chain")').count() === 0)
  ok('broadcast: timeline finalized', await page.locator('text=Transaction finalized').count() > 0)

  const link = page.locator('a:has-text("on BaseScan")').first()
  const href = (await link.count()) ? await link.getAttribute('href') : null
  ok('broadcast: BaseScan link correct', href === `https://sepolia.basescan.org/tx/${TXHASH}`, href || 'missing')

  ok('no console / page errors', consoleErrors.length === 0, consoleErrors.join(' | '))

  await browser.close()

  process.exit(finish() ? 0 : 1)
})().catch((err) => {
  console.error('HARNESS ERROR:', err)
  process.exit(1)
})
