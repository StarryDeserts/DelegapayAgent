'use client'

import { useState } from 'react'
import { PREMIUM_COST_USDC } from '@/lib/x402/payment'
import { MissionForm } from '@/components/mission/MissionForm'
import { MissionExecutePanel } from '@/components/mission/MissionExecutePanel'
import { SigningModeToggle } from '@/components/mission/SigningModeToggle'
import { WalletMissionPanel } from '@/components/wallet/WalletMissionPanel'
import { useMissionControl } from '@/components/mission/useMissionControl'
import type { ExecuteResponse } from '@/components/mission/executeResult'
import { DemoSafetyRail } from './DemoSafetyRail'
import { FlightRecorderArtifact } from './FlightRecorderArtifact'
import { PremiumRiskGate } from './PremiumRiskGate'
import { ProofStage } from './ProofStage'

export function DemoMissionControlShell() {
  const {
    budgetUsdc,
    task,
    loading,
    error,
    result,
    entries,
    committedUsdc,
    premiumUnlocked,
    planNonce,
    signingMode,
    setBudgetUsdc,
    setTask,
    setSigningMode,
    setPremiumUnlocked,
    addCommittedUsdc,
    pushServerEvents,
    handleSubmit,
  } = useMissionControl({ defaultSigningMode: 'metamask' })
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null)
  const [syncedPlanNonce, setSyncedPlanNonce] = useState(planNonce)
  if (planNonce !== syncedPlanNonce) {
    setSyncedPlanNonce(planNonce)
    setExecuteResult(null)
  }

  const plan = result?.plan ?? null
  const premiumRequired = plan?.premiumToolRequired === true
  const remainingUsdc = Math.max(0, (Number.parseFloat(budgetUsdc) || 0) - committedUsdc)
  const broadcastBlocked = premiumRequired && !premiumUnlocked
  const dryRunReady = executeResult?.ok === true && executeResult.broadcast === false
  const proofReady = executeResult?.ok === true && executeResult.broadcast === true
  const showRiskGate = premiumRequired && dryRunReady

  const stageLabel = !plan
    ? 'Mission brief'
    : proofReady
      ? 'BaseScan proof'
      : showRiskGate
        ? premiumUnlocked
          ? 'Broadcast unlocked'
          : 'x402 risk gate'
        : 'MetaMask permission'

  const stageTitle = !plan
    ? 'Define the payment mission.'
    : proofReady
      ? 'Proof replaces the promise.'
      : showRiskGate
        ? premiumUnlocked
          ? 'Risk cleared. Broadcast is now explicit.'
          : 'Unlock broadcast with simulated x402 risk scoring.'
        : 'Give the agent a bounded wallet permission.'

  const stageDetail = !plan
    ? 'Set a USDC cap and task. No permission exists, and no funds can move.'
    : proofReady
      ? 'The final state is a public transaction, linked from the main stage.'
      : showRiskGate
        ? 'Dry run is complete. The premium gate controls whether Broadcast on-chain can activate.'
        : 'MetaMask is the hero path. Server key remains a fallback for controlled testnet demos.'

  const executionPanel = result ? (
    signingMode === 'metamask' ? (
      <WalletMissionPanel
        key={`wallet-${planNonce}`}
        plan={result.plan}
        onEvents={pushServerEvents}
        onBroadcastSuccess={addCommittedUsdc}
        onResult={setExecuteResult}
        broadcastBlocked={broadcastBlocked}
        premiumFeeUsdc={premiumRequired ? PREMIUM_COST_USDC : undefined}
        premiumPaid={premiumUnlocked}
      />
    ) : (
      <MissionExecutePanel
        key={`server-${planNonce}`}
        plan={result.plan}
        onEvents={pushServerEvents}
        onBroadcastSuccess={addCommittedUsdc}
        onResult={setExecuteResult}
        broadcastBlocked={broadcastBlocked}
        premiumFeeUsdc={premiumRequired ? PREMIUM_COST_USDC : undefined}
        premiumPaid={premiumUnlocked}
      />
    )
  ) : null

  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--dp-bg)] text-zinc-100">
      <section className="relative px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_18%_10%,var(--dp-glow-field),transparent_30%),radial-gradient(circle_at_82%_12%,var(--dp-glow-warm),transparent_24%),linear-gradient(180deg,var(--dp-bg),var(--dp-stage)_62%,var(--dp-bg))]" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1440px] flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/90 pb-4">
            <div>
              <p className="text-sm font-semibold text-emerald-200/75">DelegaPay demo</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-zinc-50 md:text-4xl">Mission Control</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[13px] text-zinc-500">
              <span>Base Sepolia</span>
              <span>USDC</span>
              <span className="text-orange-200">MetaMask</span>
              <span className="text-amber-100">x402 · simulated</span>
              <span className="text-cyan-100">1Shot</span>
              <span className="text-emerald-100">BaseScan</span>
            </div>
          </header>

          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
            <section className="min-w-0 rounded-[2rem] bg-[color:var(--dp-stage)]/95 p-6 shadow-[0_0_80px_rgba(0,0,0,0.34)] md:p-8">
              <div className="mb-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
                <div>
                  <p className="text-sm font-semibold text-emerald-200/75">{stageLabel}</p>
                  <h2 className="mt-3 max-w-3xl text-balance text-4xl font-black tracking-[-0.04em] text-zinc-50 md:text-5xl">
                    {stageTitle}
                  </h2>
                </div>
                <p className="max-w-2xl text-pretty text-lg leading-8 text-zinc-300 lg:text-right">{stageDetail}</p>
              </div>

              {!result && (
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                  <div>
                    <p className="text-xl font-semibold leading-8 text-zinc-100">
                      A judge should see the safety boundary before they see any transaction button.
                    </p>
                    <p className="mt-4 text-base leading-7 text-zinc-400">
                      The budget is a cap. The agent receives no treasury balance, no raw key, and no permission until the plan is generated and approved.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] bg-black/24 p-5">
                    <MissionForm
                      budgetUsdc={budgetUsdc}
                      task={task}
                      loading={loading}
                      onBudgetChange={setBudgetUsdc}
                      onTaskChange={setTask}
                      onSubmit={handleSubmit}
                    />
                    {error && (
                      <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {result && proofReady && executeResult && (
                <>
                  <ProofStage result={executeResult} />
                  <FlightRecorderArtifact entries={entries} />
                </>
              )}

              {result && !proofReady && (
                <div className="grid gap-6">
                  <div className="grid gap-5 border-y border-zinc-800/80 py-5 md:grid-cols-[1fr_0.8fr_0.7fr] md:items-center">
                    <div>
                      <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-zinc-500">Validated AI plan</p>
                      <p className="mt-2 text-xl font-semibold leading-7 text-zinc-50">{result.plan.summary}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Max spend</p>
                      <p className="mt-1 font-mono text-xl text-emerald-100">{result.plan.maxSpendUsdc} USDC</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Premium tool</p>
                      <p className="mt-1 text-xl font-semibold text-zinc-100">{premiumRequired ? 'Required' : 'Not needed'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SigningModeToggle mode={signingMode} onChange={setSigningMode} />
                    <p className="text-sm leading-6 text-emerald-100/75">Grant allowance, not spent until broadcast.</p>
                  </div>

                  <div className={`grid gap-5 ${showRiskGate ? 'xl:grid-cols-[0.86fr_1.14fr] xl:items-start' : ''}`}>
                    <div className={showRiskGate ? 'xl:order-2' : ''}>{executionPanel}</div>
                    {showRiskGate && (
                      <div className="xl:order-1">
                        <PremiumRiskGate
                          key={planNonce}
                          plan={result.plan}
                          remainingUsdc={remainingUsdc}
                          onEvents={pushServerEvents}
                          onPaid={addCommittedUsdc}
                          onUnlocked={() => setPremiumUnlocked(true)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <DemoSafetyRail
              budgetUsdc={budgetUsdc}
              committedUsdc={committedUsdc}
              premiumRequired={premiumRequired}
              premiumUnlocked={premiumUnlocked}
              hasPlan={plan !== null}
              result={executeResult}
              entries={entries}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
