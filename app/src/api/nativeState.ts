import { request } from '@/api/client'

// The ngit/NIP-34 state repository behind recovery: revision history,
// known-good marker, drift, assisted rollback and disaster-recovery
// replication. Read-only tools plus two signed writes (rollback.apply,
// state.publish).

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  pending_approval?: boolean
  state?: string
  [field: string]: unknown
}

export type StateStatus = {
  path: string
  revision: string
  known_good: string
  dirty: boolean
  on_known_good: boolean
  recovery_bundle: boolean
}

export type StateHistoryEntry = {
  revision: string
  message: string
  op_event_id?: string
  known_good?: boolean
  [field: string]: unknown
}

export type RollbackStep = {
  section?: string
  action?: string
  path: string
  tool?: string
  automatic?: boolean
  reversibility?: string
  restore_required?: boolean
  description?: string
  [field: string]: unknown
}

export type RollbackPlan = {
  schema?: number
  generated_at?: number
  from: string
  to: string
  restic_snapshot?: string
  restic_required?: boolean
  steps: RollbackStep[]
  summary: {
    total: number
    automatic: number
    manual: number
    restore_required: number
    impossible: number
  }
  approved?: boolean
}

export function getStateStatus() {
  return request<StateStatus>('/package/state/status', 'GET')
}

export function getStateHistory(limit = 20) {
  return request<{ history: StateHistoryEntry[] }>(
    `/package/state/history?limit=${limit}`,
    'GET',
  )
}

export function getStateDiff(from = '', to = '') {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return request<{ from: string; to: string; diff: string }>(
    `/package/state/diff${query ? `?${query}` : ''}`,
    'GET',
  )
}

export function getReconcilePlan() {
  return request<Record<string, unknown>>(
    '/package/state/reconcile/plan',
    'GET',
  )
}

export function planRollback(from = '', to = '', resticSnapshot = '') {
  return request<RollbackPlan>(
    '/package/state/rollback/plan',
    'POST',
    JSON.stringify({
      from: from,
      to: to,
      restic_snapshot: resticSnapshot,
    }),
  )
}

export function applyRollback(plan: RollbackPlan) {
  return request<LifecycleOperation>(
    '/package/state/rollback/apply',
    'POST',
    JSON.stringify({ plan }),
  )
}

export function publishState(snapshotOnly = false) {
  return request<LifecycleOperation>(
    '/package/state/publish',
    'POST',
    JSON.stringify({ snapshot_only: snapshotOnly }),
  )
}
