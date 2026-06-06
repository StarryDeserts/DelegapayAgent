'use client'

import { useState } from 'react'
import type { MissionPlan, ProviderId } from '@/lib/ai/schema'
import { makeEntry, type TimelineEntry, type TimelineEvent } from '@/lib/timeline/events'
import type { SigningMode } from './SigningModeToggle'

export interface PlanResponse {
  provider: ProviderId
  model: string
  plan: MissionPlan
}

export interface UseMissionControlOptions {
  defaultSigningMode?: SigningMode
}

export interface UseMissionControlState {
  budgetUsdc: string
  task: string
  loading: boolean
  error: string | null
  result: PlanResponse | null
  entries: TimelineEntry[]
  committedUsdc: number
  premiumUnlocked: boolean
  planNonce: number
  signingMode: SigningMode
  setBudgetUsdc: (value: string) => void
  setTask: (value: string) => void
  setSigningMode: (mode: SigningMode) => void
  setPremiumUnlocked: (value: boolean) => void
  addCommittedUsdc: (value: number) => void
  pushServerEvents: (events: TimelineEvent[]) => void
  handleSubmit: () => Promise<void>
}

export function useMissionControl({ defaultSigningMode = 'server' }: UseMissionControlOptions = {}): UseMissionControlState {
  const [budgetUsdc, setBudgetUsdc] = useState('25.00')
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PlanResponse | null>(null)
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [committedUsdc, setCommittedUsdc] = useState(0)
  const [premiumUnlocked, setPremiumUnlocked] = useState(false)
  const [planNonce, setPlanNonce] = useState(0)
  const [signingMode, setSigningMode] = useState<SigningMode>(defaultSigningMode)

  function pushEvent(...next: TimelineEntry[]) {
    setEntries((prev) => [...next.reverse(), ...prev])
  }

  function pushServerEvents(events: TimelineEvent[]) {
    pushEvent(...events.map(makeEntry))
  }

  function addCommittedUsdc(value: number) {
    setCommittedUsdc((current) => current + value)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mission/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetUsdc, task }),
      })
      const data = await res.json()

      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : `request failed (${res.status})`
        setError(message)
        pushEvent(makeEntry({ type: 'planner.failed', message }))
        return
      }

      const plan = data as PlanResponse
      setResult(plan)
      setPremiumUnlocked(false)
      setPlanNonce((n) => n + 1)
      pushEvent(
        makeEntry({ type: 'planner.provider.selected', provider: plan.provider, model: plan.model }),
        makeEntry({ type: 'planner.plan.created', provider: plan.provider, plan: plan.plan }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error'
      setError(message)
      pushEvent(makeEntry({ type: 'planner.failed', message }))
    } finally {
      setLoading(false)
    }
  }

  return {
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
  }
}
