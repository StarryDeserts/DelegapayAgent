import type { MissionPlan } from '@/lib/ai/schema'

export interface PermissionCapsuleProps {
  plan: MissionPlan | null
}

export function PermissionCapsule({ plan }: PermissionCapsuleProps) {
  return (
    <section className="rounded-[1.5rem] border border-orange-300/20 bg-[#120a05] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-200/70">Permission capsule</p>
      <h2 className="mt-3 text-xl font-black tracking-[-0.02em] text-orange-50">Grant allowance</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">Cap</dt>
          <dd className="font-mono text-zinc-100">{plan ? `${plan.maxSpendUsdc} USDC` : 'Awaiting plan'}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">Target</dt>
          <dd className="text-right text-zinc-300">discovered from 1Shot capabilities</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-zinc-500">Spend</dt>
          <dd className="text-right text-emerald-200">not spent until broadcast</dd>
        </div>
      </dl>
    </section>
  )
}
