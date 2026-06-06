import { describeEvent, type EventTone, type TimelineEntry } from '@/lib/timeline/events'

export interface MissionTimelineProps {
  entries: TimelineEntry[]
}

const TONE_DOT: Record<EventTone, string> = {
  info: 'bg-zinc-500',
  plan: 'bg-sky-400',
  success: 'bg-emerald-400',
  error: 'bg-red-400',
}

const TONE_TEXT: Record<EventTone, string> = {
  info: 'text-zinc-200',
  plan: 'text-sky-200',
  success: 'text-emerald-200',
  error: 'text-red-200',
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

export function MissionTimeline({ entries }: MissionTimelineProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-sm font-semibold text-zinc-100">Mission Timeline</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No events yet. Generate a mission plan to start the timeline.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => {
            const { title, detail, tone } = describeEvent(entry.event)
            return (
              <li key={entry.id} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-medium ${TONE_TEXT[tone]}`}>{title}</span>
                    <span className="font-mono text-[11px] text-zinc-600">{formatTime(entry.at)}</span>
                  </div>
                  {detail && <span className="break-words text-xs text-zinc-400">{detail}</span>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
