import { request } from '@/api/client'

export type DiagnosisStatus = 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR'

export type DiagnosisItem = {
  status: DiagnosisStatus
  summary: string
  details?: string[]
  meta?: Record<string, string | number | boolean>
  ignored?: boolean
  [field: string]: unknown
}

export type DiagnosisReport = {
  id: string
  description: string
  items: DiagnosisItem[]
  timestamp?: number
  cached_for?: number
  [field: string]: unknown
}

export type DiagnosisRunResult = {
  reports?: DiagnosisReport[]
}

export type IgnoreFilterCriteria = Record<string, string>

export type IgnoreFilters = {
  ignore_filters: Record<string, IgnoreFilterCriteria[]>
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export type DiagnosisRunInput = {
  categories?: string[]
  force?: boolean
  full?: boolean
}

export function runDiagnosis(input: DiagnosisRunInput = {}) {
  return request<DiagnosisRunResult>(
    '/package/diagnosis/run',
    'POST',
    JSON.stringify(input),
  )
}

export function getIgnoredFilters() {
  return request<IgnoreFilters>('/package/diagnosis/ignored', 'GET')
}

export function ignoreDiagnosisFilter(filter: string[]) {
  return request<LifecycleOperation>(
    '/package/diagnosis/ignore',
    'POST',
    JSON.stringify({ filter }),
  )
}

export function unignoreDiagnosisFilter(filter: string[]) {
  return request<LifecycleOperation>(
    '/package/diagnosis/unignore',
    'POST',
    JSON.stringify({ filter }),
  )
}
