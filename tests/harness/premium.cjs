/**
 * Headless harness for the Phase 5 x402 premium route + the budget-semantics
 * hardening round. (server-key / MissionExecutePanel signing path)
 *
 * Drives the real dev server in bundled chromium. The planner and the 1Shot
 * execute route are mocked with page.route so no AI provider and no PRIVATE_KEY
 * are needed — but `/api/premium` is left UNMOCKED because it is keyless +
 * simulated, so the harness exercises the REAL handshake end to end.
 *
 * The execute route is mocked for BOTH dry run and broadcast, so the "broadcast"
 * here is a MOCKED settlement — no relayer, no chain write ever leaves the
 * browser (page.route intercepts the request). That lets the harness assert the
 * full committed-budget progression safely:
 *
 *   plan: transfer 1.00 · relayer fee 0.01 · premium fee 0.05
 *   committed 0.00  (after dry run — dry runs never commit)
 *   committed 0.05  (after the simulated x402 premium unlock)
 *   committed 1.06  (after the mocked broadcast: 1.00 + 0.01 + 0.05)
 *
 * Also asserts the new cost vocabulary is on screen (Transfer amount / Relayer
 * fee / Premium fee / Total committed), the cost-breakdown projection, the
 * unpaid 402 + PAYMENT-REQUIRED handshake, the three premium timeline steps in
 * order, Broadcast gating before/after unlock, and no console / page errors.
 *
 * Machine paths + base URL are resolved in ./_shared.cjs via env vars.
 */
const { CONSOLE_URL, ADDR, launchBrowser, createReporter, readCommitted, fillPlanForm } = require('./_shared.cjs')

const { USER, TARGET } = ADDR

// A premium mission with a 1.00 USDC transfer cap, so the committed progression
// lands on clean numbers (1.00 + 0.01 relayer + 0.05 premium = 1.06). The shape
// must satisfy the REAL /api/premium route's MissionPlanSchema, since the paid
// leg validates the plan it receives.
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
  // The unpaid leg deliberately returns 402, which the browser logs as a failed
  // resource load. That is the x402 challenge working as designed — not a page
  // bug — so filter it out while still catching every other console error.
  const isExpected402 = (t) => /Failed to load resource.*\b402\b/.test(t)
  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpected402(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  // Capture every response from the REAL premium route so we can assert the
  // unpaid 402 + PAYMENT-REQUIRED marker and the paid 200, in order.
  const premiumResponses = []
  page.on('response', (res) => {
    if (res.url().includes('/api/premium')) {
      premiumResponses.push({
        status: res.status(),
        method: res.request().method(),
        paymentRequired: res.headers()['payment-required'] || null,
      })
    }
  })

  // The execute route is mocked: dry run AND broadcast are intercepted, so a real
  // tx can never reach a relayer or the chain. We count each so the harness can
  // prove dry runs never commit and the broadcast is the single mocked send.
  let execDry = 0
  let execBroadcast = 0

  // Read the cost-breakdown's projected total (its last <dd>). This is a
  // projection of post-broadcast committed spend; it can show 1.06 before the
  // meter does (the meter only moves on real/mocked settlement).
  const readBreakdownTotal = () =>
    page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'))
      const head = spans.find((s) => s.textContent?.trim() === 'Cost breakdown')
      const box = head?.parentElement
      const dds = box ? Array.from(box.querySelectorAll('dd')) : []
      return (dds[dds.length - 1]?.textContent || '').trim()
    })

  // ---- Mock the planner so we need no AI provider. ----
  await page.route('**/api/mission/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'mock', model: 'mock-1', plan: PLAN }),
    }),
  )

  // ---- Mock the keyless execute route: dry run vs mocked broadcast. The dry run
  // emits only relayer estimate events — no permission.granted — so the only
  // "Permission granted (x402)" in the timeline comes from the premium leg,
  // keeping the order assertion unambiguous. ----
  await page.route('**/api/mission/execute', (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const broadcast = body.broadcast === true
    const reqAmount = typeof body.amountUsdc === 'string' ? body.amountUsdc : PLAN.maxSpendUsdc
    const baseFields = {
      chainId: 84532,
      delegator: USER,
      recipient: body.recipient || USER,
      amountUsdc: reqAmount,
      feeUsdc: '0.01',
    }
    if (!broadcast) {
      execDry += 1
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
    // Mocked broadcast: returns a confirmed result so the UI commits transfer +
    // relayer fee, but nothing is sent on-chain (this route is intercepted).
    execBroadcast += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        broadcast: true,
        ...baseFields,
        txHash: '0xdead',
        status: 200,
        // Mirror the real execute route's confirmed-broadcast events
        // (lib/metamask/execute.ts:321,332) so describeEvent renders them.
        events: [
          { type: 'relayer.transaction.submitted', taskId: 'task-mock-1' },
          { type: 'relayer.transaction.finalized', txHash: '0xdead', status: 'success' },
        ],
      }),
    })
  })

  await page.goto(CONSOLE_URL, { waitUntil: 'networkidle' })

  // ---- Generate a premium plan (hydration-safe form fill). ----
  const TASK = 'Deep dive research analysis report on a vendor before paying'
  await fillPlanForm(page, { budget: '5.00', task: TASK })

  // ---- The premium gate renders only when premiumToolRequired. ----
  ok('gate: x402 · simulated badge shown', (await page.locator('text=x402 · simulated').count()) > 0)
  ok(
    'gate: premium-fee line labels the budget debit',
    (await page.locator('text=debited from mission budget').count()) > 0,
  )
  ok(
    'gate: premium copy says NOT a real on-chain settlement',
    (await page.locator('text=not a real on-chain settlement').count()) > 0,
  )

  // ---- New cost vocabulary must be on screen (breakdown + labels). ----
  ok('vocab: "Cost breakdown" shown', (await page.locator('text=Cost breakdown').count()) > 0)
  ok('vocab: "Transfer amount" label shown', (await page.locator('text=Transfer amount').count()) > 0)
  ok('vocab: "Relayer fee" label shown', (await page.locator('text=Relayer fee').count()) > 0)
  ok('vocab: "Premium fee" label shown', (await page.locator('text=Premium fee').count()) > 0)
  ok('vocab: "Total committed" label shown', (await page.locator('text=Total committed').count()) > 0)

  // ---- Dry-run estimate first, so the Broadcast button renders and we can
  // observe it gated before the premium unlock. ----
  await page.click('button:has-text("Estimate (dry run)")')
  await page.waitForSelector('button:has-text("Broadcast on-chain")')
  ok('dry-run: execute called once with broadcast=false', execDry === 1, `execDry=${execDry}`)
  ok('dry-run: NO broadcast yet', execBroadcast === 0, `execBroadcast=${execBroadcast}`)

  // Dry runs never commit: the meter committed line must still read 0.00.
  const committedAfterDry = await readCommitted(page)
  ok('dry-run: committed still 0.00', committedAfterDry.value === '0.00', committedAfterDry.txt)

  // The breakdown PROJECTS the full post-broadcast total even before settlement:
  // 1.00 transfer + 0.01 relayer fee (now known) + 0.05 premium fee = 1.06.
  const breakdownAfterDry = await readBreakdownTotal()
  ok('breakdown: projected total 1.06 after dry run', /1\.06\s*USDC/.test(breakdownAfterDry), breakdownAfterDry)

  // Broadcast must be GATED before the risk check clears.
  const broadcastBtn = page.locator('button:has-text("Broadcast on-chain")')
  ok('gate: Broadcast disabled before unlock', await broadcastBtn.isDisabled())
  ok(
    'gate: "unlock the premium risk check first" hint shown',
    (await page.locator('text=Unlock the premium risk check first').count()) > 0,
  )

  // ---- Run the real x402 handshake. ----
  await page.click('button:has-text("Run premium risk check")')
  await page.waitForSelector('text=Premium unlocked ✓')

  // Unpaid leg must be a 402 carrying PAYMENT-REQUIRED; paid leg a 200.
  ok('x402: unpaid POST returned 402', premiumResponses[0]?.status === 402, `status=${premiumResponses[0]?.status}`)
  ok('x402: unpaid POST was a POST', premiumResponses[0]?.method === 'POST', premiumResponses[0]?.method || 'n/a')
  ok(
    'x402: 402 carried PAYMENT-REQUIRED marker',
    premiumResponses[0]?.paymentRequired === '1',
    `header=${premiumResponses[0]?.paymentRequired}`,
  )
  ok('x402: paid leg returned 200', premiumResponses[1]?.status === 200, `status=${premiumResponses[1]?.status}`)
  ok('x402: exactly two premium calls', premiumResponses.length === 2, `count=${premiumResponses.length}`)

  // Three premium steps, in chronological order. The timeline is newest-first,
  // so chronological challenge→granted→paid means paid sits ABOVE granted sits
  // ABOVE challenge in DOM order.
  const titles = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('h2'))
    const tl = heads.find((h) => h.textContent?.trim() === 'Mission Timeline')
    const container = tl ? tl.parentElement : null
    const lis = container ? Array.from(container.querySelectorAll('ol li')) : []
    return lis.map((li) => li.querySelector('span.font-medium')?.textContent?.trim() || '')
  })
  const iChallenge = titles.indexOf('Premium challenge received')
  const iGranted = titles.indexOf('Permission granted (x402)')
  const iPaid = titles.indexOf('Premium paid')
  ok('timeline: premium.challenge.received present', iChallenge >= 0)
  ok('timeline: permission.granted(x402) present', iGranted >= 0)
  ok('timeline: premium.paid present', iPaid >= 0)
  ok(
    'timeline: order is challenge → granted → paid (newest-first DOM)',
    iPaid >= 0 && iGranted >= 0 && iChallenge >= 0 && iPaid < iGranted && iGranted < iChallenge,
    `paid=${iPaid} granted=${iGranted} challenge=${iChallenge}`,
  )

  // Budget committed debited by the premium fee only (transfer/relayer not yet sent).
  const committedAfterPremium = await readCommitted(page)
  ok('premium: committed debited to 0.05', committedAfterPremium.value === '0.05', committedAfterPremium.txt)

  // Risk-score artifact rendered.
  ok('premium: risk-score artifact shown', (await page.locator('text=Risk score').count()) > 0)
  ok('premium: result id rendered', (await page.locator('text=/result risk-/').count()) > 0)

  // Broadcast must be UNGATED after the risk check clears.
  ok('gate: Broadcast enabled after unlock', !(await broadcastBtn.isDisabled()))
  ok(
    'gate: unlock hint gone after unlock',
    (await page.locator('text=Unlock the premium risk check first').count()) === 0,
  )

  // ---- Mocked broadcast: commits transfer + relayer fee on top of the premium
  // fee. No real tx leaves the browser (the execute route is intercepted). ----
  await broadcastBtn.click()
  await page.waitForSelector('text=On-chain transfer confirmed')
  ok('broadcast: mocked execute called once with broadcast=true', execBroadcast === 1, `execBroadcast=${execBroadcast}`)

  // committed now reflects transfer 1.00 + relayer 0.01 + premium 0.05 = 1.06.
  const committedFinal = await readCommitted(page)
  ok(
    'broadcast: committed = 1.06 (1.00 transfer + 0.01 relayer + 0.05 premium)',
    committedFinal.value === '1.06',
    committedFinal.txt,
  )

  // Safety: the only broadcast was the mocked one, and the premium route saw
  // exactly its two handshake calls — nothing escaped to a real relayer/chain.
  ok('safety: broadcast was mocked, never real', execBroadcast === 1, `execBroadcast=${execBroadcast}`)
  ok('safety: no stray premium calls', premiumResponses.length === 2, `count=${premiumResponses.length}`)

  ok('no console / page errors', consoleErrors.length === 0, consoleErrors.join(' | '))

  await browser.close()

  process.exit(finish() ? 0 : 1)
})().catch((err) => {
  console.error('HARNESS ERROR:', err)
  process.exit(1)
})
