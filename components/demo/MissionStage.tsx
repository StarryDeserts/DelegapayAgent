import type { ReactNode } from 'react'

export interface MissionStageProps {
  step: string
  title: string
  detail: string
  children: ReactNode
}

export function MissionStage({ step, title, detail, children }: MissionStageProps) {
  return (
    <section className="relative py-7">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-200/70">{step}</p>
          <h2 className="mt-2 text-balance text-2xl font-black tracking-[-0.02em] text-zinc-50 md:text-3xl">
            {title}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-zinc-400 sm:text-right">{detail}</p>
      </div>
      {children}
    </section>
  )
}
