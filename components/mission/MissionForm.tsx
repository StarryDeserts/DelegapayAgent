'use client'

import type { FormEvent } from 'react'

export interface MissionFormProps {
  budgetUsdc: string
  task: string
  loading: boolean
  onBudgetChange: (value: string) => void
  onTaskChange: (value: string) => void
  onSubmit: () => void
}

export function MissionForm({
  budgetUsdc,
  task,
  loading,
  onBudgetChange,
  onTaskChange,
  onSubmit,
}: MissionFormProps) {
  const disabled = loading || budgetUsdc.trim() === '' || task.trim() === ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget" className="text-sm font-medium text-zinc-400">
          Budget (USDC)
        </label>
        <input
          id="budget"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={budgetUsdc}
          onChange={(e) => onBudgetChange(e.target.value)}
          placeholder="25.00"
          className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="task" className="text-sm font-medium text-zinc-400">
          Task
        </label>
        <textarea
          id="task"
          rows={3}
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="e.g. Subscribe to a research API and summarize this week's reports"
          className="min-h-28 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="min-h-11 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {loading ? 'Planning…' : 'Generate mission plan'}
      </button>
    </form>
  )
}
