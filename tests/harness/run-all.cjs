/**
 * Runs every DelegaPay headless harness sequentially against the same dev server
 * and aggregates the result. Each harness runs in its own node process (via
 * spawnSync) so a crash or non-zero exit in one is isolated and reported rather
 * than aborting the rest. Exits non-zero if ANY harness failed.
 *
 * Requires the dev server already running on HARNESS_BASE_URL (default
 * http://localhost:3001) — start it with `pnpm dev:harness`. All HARNESS_* env
 * vars are inherited by each child (see ./_shared.cjs).
 */
const { spawnSync } = require('child_process')
const path = require('path')

const HARNESSES = [
  { name: 'landing (judge-facing entry)', file: 'landing.cjs' },
  { name: 'demo (guided Mission Control)', file: 'demo-smoke.cjs' },
  { name: 'replan (fresh estimate guard)', file: 'replan.cjs' },
  { name: 'premium (x402 + server-key panel)', file: 'premium.cjs' },
  { name: 'metamask (EIP-7715 path)', file: 'metamask.cjs' },
]

const outcomes = []
for (const h of HARNESSES) {
  console.log(`\n=== harness: ${h.name} (${h.file}) ===`)
  const res = spawnSync(process.execPath, [path.join(__dirname, h.file)], {
    stdio: 'inherit',
    env: process.env,
  })
  // status is null when the process was killed by a signal; treat that as failure.
  const code = res.status === null ? 1 : res.status
  outcomes.push({ name: h.name, code })
}

console.log('\n=== harness summary ===')
for (const o of outcomes) {
  console.log(`${o.code === 0 ? 'PASS' : 'FAIL'}  ${o.name}${o.code === 0 ? '' : `  (exit ${o.code})`}`)
}

const failed = outcomes.filter((o) => o.code !== 0)
console.log(`\n${outcomes.length - failed.length}/${outcomes.length} harnesses passed`)
process.exit(failed.length === 0 ? 0 : 1)
