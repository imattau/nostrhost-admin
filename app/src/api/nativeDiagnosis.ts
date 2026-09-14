import { request } from '@/api/client'

// Mirrors yunohost.diagnosis's report shape (full=true) — see
// docs/reference/diagnosis-engine.md for the underlying engine.
export type DiagnosisStatus = 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR'

export type DiagnosisItem = {
  meta?: Record<string, unknown>
  status: DiagnosisStatus
  summary: string
  details?: string[]
  data?: Record<string, unknown>
  ignored?: boolean
}

export type DiagnosisReport = {
  id: string
  description: string
  cached_for?: number
  timestamp?: number
  items: DiagnosisItem[]
}

export type IgnoreFilters = Record<string, Record<string, string>[]>

// POST /package/diagnosis/run with force=false reuses the cache when it's
// still fresh, so this doubles as "load the current report" — there is no
// separate read-only GET endpoint (see docs/reference/diagnosis-engine.md).
// full=true is required to get back `meta`/`ignored`, which the ignore
// filter UI needs; the engine's default (full=false) strips both.
export async function runDiagnosis(categories: string[] = [], force = false) {
  const { reports } = await request<{ reports: DiagnosisReport[] }>(
    '/package/diagnosis/run',
    'POST',
    JSON.stringify({ categories, force, full: true }),
  )
  return reports
}

export async function getIgnoreFilters() {
  const { ignore_filters } = await request<{ ignore_filters: IgnoreFilters }>(
    '/package/diagnosis/ignored',
    'GET',
  )
  return ignore_filters
}

function toFilterArgs(category: string, criteria: Record<string, unknown>) {
  return [
    category,
    ...Object.entries(criteria).map(([key, value]) => `${key}=${value}`),
  ]
}

// Both routes are routed through the signed owner co-signature chain
// (nostrhost/api.py), not the plain tool-call path diagnosis.run uses —
// mutating what the diagnosis system will keep complaining about is a
// higher-trust action than just running the checks. A rejected/pending
// chain result comes back as ok:false rather than a non-2xx response, so
// that has to be checked explicitly.
async function runLifecycle(path: string, filter: string[]) {
  const body = await request<{
    ok?: boolean
    state?: string
    reason?: string
    ignored?: boolean
    unignored?: boolean
  }>(path, 'POST', JSON.stringify({ filter }))
  if (body.ok === false || (body.state && body.state !== 'succeeded')) {
    throw new Error(body.reason || `Request ended in state: ${body.state}`)
  }
  return body
}

export function ignoreIssue(category: string, criteria: Record<string, unknown>) {
  return runLifecycle('/package/diagnosis/ignore', toFilterArgs(category, criteria))
}

export function unignoreIssue(category: string, criteria: Record<string, unknown>) {
  return runLifecycle('/package/diagnosis/unignore', toFilterArgs(category, criteria))
}
