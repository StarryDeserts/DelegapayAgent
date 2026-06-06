import { MissionConsole } from '@/components/mission/MissionConsole'

export default function ConsolePage() {
  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-950 px-6 py-12 font-sans text-zinc-100">
      <header className="mb-10 flex w-full max-w-5xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-bold text-zinc-950">
            DelegaPay
          </span>
          <span className="font-mono text-xs text-zinc-500">Base Sepolia · USDC</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Mission Console</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          Grant an AI agent a bounded payment budget, let it draft a validated mission plan, and
          watch every delegated step land on the Mission Timeline.
        </p>
      </header>

      <MissionConsole />
    </main>
  )
}
