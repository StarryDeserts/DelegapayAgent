const { CONSOLE_URL, ADDR, launchBrowser, createReporter, fillPlanForm } = require('./_shared.cjs')

const { USER } = ADDR
const PLAN_A = {
  summary: 'First vendor research payment',
  requiredPermissionType: 'erc20-token-allowance',
  maxSpendUsdc: '1.00',
  premiumToolRequired: false,
  targetAction: null,
  riskChecks: ['budget capped at 1 USDC'],
}
const PLAN_B = {
  summary: 'Second vendor research payment',
  requiredPermissionType: 'erc20-token-allowance',
  maxSpendUsdc: '1.00',
  premiumToolRequired: false,
  targetAction: null,
  riskChecks: ['fresh plan requires fresh estimate'],
}

const { ok, finish } = createReporter()

;(async () => {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  const consoleErrors = []
  let planCalls = 0
  let executeCalls = 0

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  await page.route('**/api/mission/plan', (route) => {
    planCalls += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'mock', model: 'mock-1', plan: planCalls === 1 ? PLAN_A : PLAN_B }),
    })
  })

  await page.route('**/api/mission/execute', (route) => {
    executeCalls += 1
    const body = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        broadcast: body.broadcast === true,
        chainId: 84532,
        delegator: USER,
        recipient: body.recipient || USER,
        amountUsdc: body.amountUsdc || body.plan?.maxSpendUsdc || '1.00',
        feeUsdc: '0.01',
        events: [{ type: 'relayer.estimate.created', feeUsdc: '0.01' }],
      }),
    })
  })

  await page.goto(CONSOLE_URL, { waitUntil: 'networkidle' })
  await fillPlanForm(page, { budget: '5.00', task: 'First vendor payment' })
  await page.click('button:has-text("Estimate (dry run)")')
  await page.waitForSelector('button:has-text("Broadcast on-chain")')
  ok('replan: broadcast available after first dry run', await page.locator('button:has-text("Broadcast on-chain")').count() === 1)

  await fillPlanForm(page, { budget: '5.00', task: 'Second vendor payment with same max spend' })
  ok('replan: second plan rendered', await page.locator('text=Second vendor research payment').count() > 0)
  ok('replan: old broadcast hidden after same-budget replan', await page.locator('button:has-text("Broadcast on-chain")').count() === 0)
  ok('replan: no extra execute call during replan', executeCalls === 1, `executeCalls=${executeCalls}`)
  ok('replan: no console / page errors', consoleErrors.length === 0, consoleErrors.join(' | '))

  await browser.close()
  process.exit(finish() ? 0 : 1)
})().catch((err) => {
  console.error('HARNESS ERROR:', err)
  process.exit(1)
})
