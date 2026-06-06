import type { MissionPlan } from '@/lib/ai/schema'

/**
 * Every observable step in a mission, as a discriminated union. The Mission
 * Timeline renders these in order. Phase 1 only emits the planner events
 * (`planner.provider.selected`, `planner.plan.created`, `planner.failed`);
 * later phases add the wallet, delegation, relayer, and x402 events.
 */
export type TimelineEvent =
  | { type: 'wallet.connected'; address: string; chainId: number }
  | { type: 'account.upgrade.checked'; upgraded: boolean }
  | {
      type: 'planner.provider.selected'
      provider: 'deepseek' | 'venice' | 'openai-compatible' | 'mock'
      model: string
    }
  | { type: 'planner.plan.created'; provider: string; plan: MissionPlan }
  | { type: 'planner.failed'; message: string }
  | { type: 'relayer.capabilities.loaded'; targetAddress: string; chainIds: number[] }
  | { type: 'delegation.signed'; from: string; to: string; amountUsdc: string }
  | { type: 'permission.support.checked'; supported: boolean; permissionType: string }
  | {
      type: 'permission.granted'
      flow: 'relayer' | 'x402'
      amountUsdc: string
      expiry: number
      target: string
    }
  | { type: 'premium.challenge.received'; costUsdc: string }
  | { type: 'premium.paid'; resultId: string }
  | { type: 'relayer.estimate.created'; feeUsdc?: string }
  | { type: 'relayer.transaction.submitted'; taskId?: string; txHash?: string }
  | { type: 'relayer.transaction.finalized'; txHash?: string; status: 'success' | 'failed' }

export type TimelineEventType = TimelineEvent['type']

/** A timestamped, keyed wrapper for rendering. */
export interface TimelineEntry {
  id: string
  at: number
  event: TimelineEvent
}

/** Wrap an event with a stable id + timestamp. Call client-side, on user action. */
export function makeEntry(event: TimelineEvent): TimelineEntry {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    event,
  }
}

export type EventTone = 'info' | 'plan' | 'success' | 'error'

/** Human-readable rendering for a timeline event. Presentation only. */
export function describeEvent(event: TimelineEvent): {
  title: string
  detail?: string
  tone: EventTone
} {
  switch (event.type) {
    case 'wallet.connected':
      return { title: 'Wallet connected', detail: `${event.address} · chain ${event.chainId}`, tone: 'info' }
    case 'account.upgrade.checked':
      return {
        title: 'Smart account checked',
        detail: event.upgraded ? 'EIP-7702 upgraded' : 'upgrade required',
        tone: 'info',
      }
    case 'planner.provider.selected':
      return { title: 'Planner selected', detail: `${event.provider} · ${event.model}`, tone: 'info' }
    case 'planner.plan.created':
      return { title: 'Mission plan created', detail: event.plan.summary, tone: 'plan' }
    case 'planner.failed':
      return { title: 'Planner failed', detail: event.message, tone: 'error' }
    case 'relayer.capabilities.loaded':
      return {
        title: 'Relayer capabilities loaded',
        detail: `target ${event.targetAddress}`,
        tone: 'info',
      }
    case 'delegation.signed':
      return {
        title: 'Delegation signed',
        detail: `${event.amountUsdc} USDC → ${event.to}`,
        tone: 'success',
      }
    case 'permission.support.checked':
      return {
        title: 'Permission support checked',
        detail: `${event.permissionType}: ${event.supported ? 'supported' : 'unsupported'}`,
        tone: 'info',
      }
    case 'permission.granted':
      return {
        title: `Permission granted (${event.flow})`,
        detail: `${event.amountUsdc} USDC → ${event.target}`,
        tone: 'success',
      }
    case 'premium.challenge.received':
      return { title: 'Premium challenge received', detail: `${event.costUsdc} USDC`, tone: 'info' }
    case 'premium.paid':
      return { title: 'Premium paid', detail: event.resultId, tone: 'success' }
    case 'relayer.estimate.created':
      return { title: 'Relayer estimate created', detail: event.feeUsdc ? `${event.feeUsdc} USDC fee` : undefined, tone: 'info' }
    case 'relayer.transaction.submitted':
      return { title: 'Transaction submitted', detail: event.txHash ?? event.taskId, tone: 'info' }
    case 'relayer.transaction.finalized':
      return {
        title: 'Transaction finalized',
        detail: event.txHash,
        tone: event.status === 'success' ? 'success' : 'error',
      }
  }
}
