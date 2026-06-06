import { describeEvent, type TimelineEntry } from '@/lib/timeline/events'

export interface FlightRecorderArtifactProps {
  entries: TimelineEntry[]
}

export function FlightRecorderArtifact({ entries }: FlightRecorderArtifactProps) {
  return (
    <section className="mt-8 border-t border-zinc-800/80 pt-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-zinc-500">Flight recorder</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-zinc-50">Audit artifact</h2>
        </div>
        <span className="font-mono text-[13px] text-zinc-500">newest first</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-base leading-7 text-zinc-500">No events yet. Generate a mission plan to start the audit trail.</p>
      ) : (
        <ol className="grid gap-0 border-y border-zinc-800/80">
          {entries.map((entry) => {
            const event = describeEvent(entry.event)
            return (
              <li key={entry.id} className="grid gap-3 border-b border-zinc-800/70 py-4 last:border-b-0 md:grid-cols-[10rem_1fr]">
                <span className="font-mono text-[13px] text-zinc-600">{new Date(entry.at).toLocaleTimeString()}</span>
                <div>
                  <p className="text-base font-semibold text-zinc-100">{event.title}</p>
                  {event.detail && <p className="mt-1 text-sm leading-6 text-zinc-500">{event.detail}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
