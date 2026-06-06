import { BoundedBudgetField } from './BoundedBudgetField'

export function ProblemSection() {
  return (
    <section className="px-5 py-24 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-200/80">Problem</p>
          <h2 className="max-w-3xl text-balance text-4xl font-black tracking-[-0.03em] md:text-6xl">
            Agents are useful because they act. Treasuries are dangerous because they trust too much.
          </h2>
          <p className="max-w-2xl text-pretty text-lg leading-8 text-zinc-300">
            The unsafe pattern is simple: give an automated agent a hot wallet and hope prompts, policies, and logs catch mistakes. DelegaPay moves the boundary into the payment permission itself.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="flex min-h-[320px] flex-col justify-between rounded-[2rem] border border-red-400/20 bg-red-950/15 p-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-red-200/60">Raw treasury access</p>
              <p className="mt-4 text-2xl font-semibold text-red-100">One prompt failure can reach every token the key controls.</p>
            </div>
            <p className="text-sm leading-6 text-red-100/70">Manual approvals slow the agent down. Raw keys make the blast radius too large.</p>
          </div>
          <BoundedBudgetField compact committedUsdc={0.05} budgetUsdc="1.06" premiumUnlocked />
        </div>
      </div>
    </section>
  )
}
