import type { MissionPlan } from '@/lib/ai/schema'
import type { TimelineEvent } from '@/lib/timeline/events'
import { PremiumGate } from '@/components/mission/PremiumGate'

export interface PremiumRiskGateProps {
  plan: MissionPlan
  remainingUsdc: number
  onEvents: (events: TimelineEvent[]) => void
  onPaid: (costUsdc: number) => void
  onUnlocked: () => void
}

export function PremiumRiskGate({ plan, remainingUsdc, onEvents, onPaid, onUnlocked }: PremiumRiskGateProps) {
  return (
    <section className="grid gap-5">
      <div>
        <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-amber-200/75">x402 · simulated</p>
        <h3 className="mt-3 text-4xl font-black tracking-[-0.04em] text-amber-50">Risk Gate controls Broadcast.</h3>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
          The dry run is complete. This simulated paid-tool handshake produces the risk score that unlocks the explicit send button.
        </p>
      </div>
      <PremiumGate
        plan={plan}
        remainingUsdc={remainingUsdc}
        onEvents={onEvents}
        onPaid={onPaid}
        onUnlocked={onUnlocked}
      />
    </section>
  )
}
