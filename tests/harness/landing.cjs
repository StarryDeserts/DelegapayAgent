const { BASE, launchBrowser, createReporter } = require('./_shared.cjs')

const { ok, finish } = createReporter()

;(async () => {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  const consoleErrors = []
  const executionRequests = []

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('request', (req) => {
    const url = req.url()
    if (/\/api\/(mission|premium|relayer)/.test(url)) executionRequests.push(url)
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })

  ok('landing: product positioning headline shown', await page.locator('text=Give AI agents a wallet, not your treasury.').count() > 0)
  ok('landing: Bounded Budget Field label shown', await page.locator('text=Bounded Budget Field').count() > 0)
  ok('landing: Permission Gate shown', await page.locator('text=Permission Gate').count() > 0)
  ok('landing: Risk Gate shown', await page.locator('text=Risk Gate').count() > 0)
  ok('landing: Relay Gate shown', await page.locator('text=Relay Gate').count() > 0)

  const demoHref = await page.locator('a:has-text("Start guided demo")').first().getAttribute('href')
  const consoleHref = await page.locator('a:has-text("Open advanced console")').first().getAttribute('href')
  ok('landing: demo CTA points to /demo', demoHref === '/demo', demoHref || 'missing')
  ok('landing: console CTA points to /console', consoleHref === '/console', consoleHref || 'missing')
  ok('landing: first load makes no execution API calls', executionRequests.length === 0, executionRequests.join(' | '))
  ok('landing: no console / page errors', consoleErrors.length === 0, consoleErrors.join(' | '))

  await browser.close()
  process.exit(finish() ? 0 : 1)
})().catch((err) => {
  console.error('HARNESS ERROR:', err)
  process.exit(1)
})
