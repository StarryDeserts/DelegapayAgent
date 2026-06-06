'use client'

import { PREMIUM_COST_USDC } from '@/lib/x402/payment'
import { MissionForm } from './MissionForm'
import { MissionPlanPreview } from './MissionPlanPreview'
import { MissionExecutePanel } from './MissionExecutePanel'
import { MissionTimeline } from './MissionTimeline'
import { BudgetMeter } from './BudgetMeter'
import { PremiumGate } from './PremiumGate'
import { SigningModeToggle } from './SigningModeToggle'
import { WalletMissionPanel } from '@/components/wallet/WalletMissionPanel'
import { useMissionControl } from './useMissionControl'

export function MissionConsole() {
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
  } = useMissionControl({ defaultSigningMode: 'server' })

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Mission Builder</h2>
          <MissionForm
            budgetUsdc={budgetUsdc}
            task={task}
            loading={loading}
            onBudgetChange={setBudgetUsdc}
            onTaskChange={setTask}
            onSubmit={handleSubmit}
          />
          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </section>

        <BudgetMeter budgetUsdc={budgetUsdc} spentUsdc={String(committedUsdc)} />

        {result && (
          <>
            <MissionPlanPreview provider={result.provider} model={result.model} plan={result.plan} />
            {result.plan.premiumToolRequired && (
              <PremiumGate
                key={planNonce}
                plan={result.plan}
                remainingUsdc={
                  Number.isFinite(Number(budgetUsdc))
                    ? Math.max(0, Number(budgetUsdc) - committedUsdc)
                    : undefined
                }
                onEvents={pushServerEvents}
                onPaid={addCommittedUsdc}
                onUnlocked={() => setPremiumUnlocked(true)}
              />
            )}
            <div className="flex flex-col gap-4">
              <SigningModeToggle mode={signingMode} onChange={setSigningMode} />
              {signingMode === 'server' ? (
                <MissionExecutePanel
                  key={`server-${planNonce}`}
                  plan={result.plan}
                  onEvents={pushServerEvents}
                  onBroadcastSuccess={addCommittedUsdc}
                  broadcastBlocked={result.plan.premiumToolRequired && !premiumUnlocked}
                  premiumFeeUsdc={result.plan.premiumToolRequired ? PREMIUM_COST_USDC : undefined}
                  premiumPaid={premiumUnlocked}
                />
              ) : (
                <WalletMissionPanel
                  key={`wallet-${planNonce}`}
                  plan={result.plan}
                  onEvents={pushServerEvents}
                  onBroadcastSuccess={addCommittedUsdc}
                  broadcastBlocked={result.plan.premiumToolRequired && !premiumUnlocked}
                  premiumFeeUsdc={result.plan.premiumToolRequired ? PREMIUM_COST_USDC : undefined}
                  premiumPaid={premiumUnlocked}
                />
              )}
            </div>
          </>
        )}
      </div>

      <MissionTimeline entries={entries} />
    </div>
  )
}
