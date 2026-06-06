/**
 * Shared boilerplate for the DelegaPay headless UI harnesses.
 *
 * These harnesses drive the REAL dev server in a bundled chromium and assert the
 * mission flows end to end. They are deliberately NOT wired to a unit-test runner
 * or to playwright-as-a-devDependency — adding deps is ask-first for this repo —
 * so the browser binary and playwright-core are resolved from the machine via env
 * vars, each defaulting to the path this repo was developed against:
 *
 *   HARNESS_PLAYWRIGHT_CORE  path to a playwright-core install (require()'d)
 *   HARNESS_CHROME           path to a chromium/chrome binary (executablePath)
 *   HARNESS_NSS_LIB          dir prepended to LD_LIBRARY_PATH for libnss3 (WSL2)
 *   HARNESS_BASE_URL         dev server origin (default http://localhost:3001)
 *
 * Portability upgrade (documented in docs/demo-checklist.md): run
 * `pnpm add -D playwright-core` and the bare `require('playwright-core')` candidate
 * below resolves with no env vars needed. The defaults keep it zero-config here.
 */
const fs = require('fs')

const DEFAULTS = {
  playwrightCore: '/home/stardust/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core',
  chrome: '/home/stardust/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
  nssLib: '/home/stardust/.cache/playwright-nss-libs/extract/usr/lib/x86_64-linux-gnu',
  baseUrl: 'http://localhost:3001',
}

const BASE = process.env.HARNESS_BASE_URL || DEFAULTS.baseUrl

function routeUrl(pathname) {
  return new URL(pathname, BASE.endsWith('/') ? BASE : `${BASE}/`).toString()
}

const CONSOLE_URL = routeUrl('/console')
const DEMO_URL = routeUrl('/demo')

// Shared fixture addresses used across both harnesses' mocks.
const ADDR = {
  USER: '0x1111111111111111111111111111111111111111',
  TARGET: '0x2222222222222222222222222222222222222222',
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  FEE_COLLECTOR: '0x3333333333333333333333333333333333333333',
}

function resolveChromium() {
  // Bundled chromium needs libnss3 et al. on its library path (WSL2/Linux). Skip
  // the prepend only if the var is explicitly set to empty (system libs present).
  const nss = process.env.HARNESS_NSS_LIB ?? DEFAULTS.nssLib
  if (nss) process.env.LD_LIBRARY_PATH = `${nss}:${process.env.LD_LIBRARY_PATH || ''}`

  const candidates = [
    process.env.HARNESS_PLAYWRIGHT_CORE,
    'playwright-core', // resolves if installed as a devDependency (optional upgrade)
    DEFAULTS.playwrightCore, // npx cache this repo was developed against
  ].filter(Boolean)

  let lastErr
  for (const candidate of candidates) {
    try {
      return require(candidate).chromium
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(
    `Could not load playwright-core. Tried: ${candidates.join(', ')}. ` +
      `Set HARNESS_PLAYWRIGHT_CORE or run \`pnpm add -D playwright-core\`. ` +
      `Last error: ${lastErr && lastErr.message}`,
  )
}

async function launchBrowser() {
  const chromium = resolveChromium()
  const executablePath = process.env.HARNESS_CHROME || DEFAULTS.chrome
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Chromium binary not found at ${executablePath}. ` +
        `Set HARNESS_CHROME to your bundled chromium/chrome binary.`,
    )
  }
  return chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
}

// Minimal PASS/FAIL reporter shared by both harnesses. finish() prints the tally
// and returns true when every check passed (caller maps that to the exit code).
function createReporter() {
  const results = []
  const ok = (name, cond, extra = '') => {
    results.push({ name, pass: !!cond, extra })
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`)
  }
  const finish = () => {
    const failed = results.filter((r) => !r.pass)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    return failed.length === 0
  }
  return { ok, finish, results }
}

// Read the budget meter's committed line. It uniquely ends with the
// "transfer + relayer fee + premium fee" breakdown, so match on that to avoid
// colliding with the cost-breakdown's own "Total committed" row.
const readCommitted = (page) =>
  page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'))
    const span = spans.find(
      (s) =>
        /Total committed/.test(s.textContent || '') &&
        /transfer \+ relayer fee \+ premium fee/.test(s.textContent || ''),
    )
    const txt = (span?.textContent || '').trim()
    const m = txt.match(/([0-9]+\.[0-9]{2})\s*USDC/)
    return { txt, value: m ? m[1] : null }
  })

// Fill the mission form in a hydration-safe way: controlled inputs reset when
// React hydrates, so re-fill until the submit button enables, then submit and
// wait for the execute view.
async function fillPlanForm(page, { budget, task }) {
  await page.waitForSelector('#task')
  let formReady = false
  for (let i = 0; i < 25 && !formReady; i++) {
    await page.fill('#budget', budget)
    await page.fill('#task', task)
    formReady = (await page.locator('button[type="submit"]:not([disabled])').count()) > 0
    if (!formReady) await page.waitForTimeout(150)
  }
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Execute mission')
}

module.exports = { BASE, CONSOLE_URL, DEMO_URL, ADDR, DEFAULTS, launchBrowser, createReporter, readCommitted, fillPlanForm }
