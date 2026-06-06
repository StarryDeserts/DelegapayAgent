import type { TimelineEntry } from '@/lib/timeline/events'
import { MissionTimeline } from '@/components/mission/MissionTimeline'

export interface FlightRecorderProps {
  entries: TimelineEntry[]
}

export function FlightRecorder({ entries }: FlightRecorderProps) {
  return (
    <section className="rounded-[1.75rem] border border-zinc-800/80 bg-[#050807] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Flight recorder</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.02em] text-zinc-50">Audit trail</h2>
        </div>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          newest first
        </span>
      </div>
      <MissionTimeline entries={entries} />
    </section>
  )
}
