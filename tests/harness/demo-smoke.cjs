const { DEMO_URL, ADDR, launchBrowser, createReporter, readCommitted, fillPlanForm } = require('./_shared.cjs')

const { USER, TARGET, USDC, FEE_COLLECTOR } = ADDR
const PLAN = {
  summary: 'Deep dive: research a vendor and risk-score the planned payment',
  requiredPermissionType: 'erc20-token-allowance',
  maxSpendUsdc: '1.00',
  premiumToolRequired: true,
  targetAction: null,
  riskChecks: ['budget capped at 1 USDC', 'recipient allowlist'],
}

const { ok, finish } = createReporter()

;(async () => {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  const consoleErrors = []
  const isExpected402 = (t) => /Failed to load resource.*\b402\b/.test(t)

  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpected402(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

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

  await page.route('**/api/mission/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'mock', model: 'mock-1', plan: PLAN }),
    }),
  )

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

  let relayBroadcast = 0
  await page.route('**/api/mission/relay', (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const broadcast = body.broadcast === true
    if (broadcast) relayBroadcast += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        broadcast,
        chainId: 84532,
        delegator: USER,
        recipient: body.recipient || USER,
        amountUsdc: body.amountUsdc || PLAN.maxSpendUsdc,
        feeUsdc: '0.01',
        txHash: broadcast ? '0xabc1230000000000000000000000000000000000000000000000000000000def' : undefined,
        status: broadcast ? 200 : undefined,
        events: broadcast
          ? [
              { type: 'relayer.transaction.submitted', taskId: '0xtask' },
              { type: 'relayer.transaction.finalized', txHash: '0xabc1230000000000000000000000000000000000000000000000000000000def', status: 'success' },
            ]
          : [
              { type: 'relayer.capabilities.loaded', targetAddress: TARGET, chainIds: [84532] },
              { type: 'relayer.estimate.created', feeUsdc: '0.01' },
            ],
      }),
    })
  })

  await page.goto(DEMO_URL, { waitUntil: 'networkidle' })
  ok('demo: Mission Control shell shown', await page.locator('text=Mission Control').count() > 0)
  ok('demo: Bounded Budget Field shown', await page.locator('text=Bounded Budget Field').count() > 0)
  ok('demo: Flight recorder shown', await page.locator('text=Flight recorder').count() > 0)

  await fillPlanForm(page, { budget: '5.00', task: 'Deep dive research analysis report on a vendor before paying' })
  ok('demo: MetaMask is the default signing path', await page.locator('text=EIP-7715 · your MetaMask').count() > 0)
  ok('demo: Server-key fallback visible', await page.locator('button:has-text("Server key")').count() > 0)

  await page.click('button:has-text("Connect MetaMask")')
  await page.click('button:has-text("Grant budget & estimate")')
  await page.waitForSelector('button:has-text("Broadcast on-chain")')
  ok('demo: Broadcast disabled before premium unlock', await page.locator('button:has-text("Broadcast on-chain")').isDisabled())
  ok('demo: interlock explains premium gate', await page.locator('text=Unlock the premium risk check first').count() > 0)

  await page.click('button:has-text("Run premium risk check")')
  await page.waitForSelector('text=Premium unlocked ✓')
  ok('demo: committed debited by premium fee', (await readCommitted(page)).value === '0.05')
  ok('demo: Broadcast enabled after premium unlock', !(await page.locator('button:has-text("Broadcast on-chain")').isDisabled()))

  await page.click('button:has-text("Broadcast on-chain")')
  await page.waitForSelector('text=On-chain transfer confirmed')
  ok('demo: proof drawer shows BaseScan link', await page.locator('text=Proof drawer').count() > 0)
  ok('demo: mocked broadcast only once', relayBroadcast === 1, `relayBroadcast=${relayBroadcast}`)
  ok('demo: no console / page errors', consoleErrors.length === 0, consoleErrors.join(' | '))

  await browser.close()
  process.exit(finish() ? 0 : 1)
})().catch((err) => {
  console.error('HARNESS ERROR:', err)
  process.exit(1)
})
