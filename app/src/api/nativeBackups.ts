import { request } from '@/api/client'

// Restic restore points. The backup surface is Restic-backed: snapshots live
// in the encrypted, deduplicated repository configured in restic.toml, not in
// the retired YunoHost archive format.

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  pending_approval?: boolean
  state?: string
  [field: string]: unknown
}

export type RestorePoint = {
  id: string
  short_id?: string
  time?: string
  hostname?: string
  paths?: string[]
  tags?: string[] | null
  [field: string]: unknown
}

export type RestorePointList = {
  snapshots: RestorePoint[]
}

export type BackupRetention = Record<string, number>

export type BackupPolicy = {
  retention: BackupRetention
  schedule: { enabled: boolean; calendar: string }
  repo: string
  paths: string[]
  host: string
  tag: string
}

export type BackupSchedule = {
  enabled: boolean
  calendar: string
  active_state: string
  sub_state: string
  last_trigger: string
  next_elapse: string
}

export type BackupStats = {
  stats: {
    total_size?: number
    total_file_count?: number
    snapshots_count?: number
    [field: string]: unknown
  }
}

export type BackupCreateInput = {
  tag?: string
  paths?: string[]
  host?: string
}

export type BackupRestoreInput = {
  snapshot: string
  target?: string
  include?: string[]
}

export type BackupDeleteInput = {
  snapshot?: string
  apply_retention?: boolean
  prune?: boolean
}

export type BackupPolicySetInput = {
  retention?: BackupRetention
  schedule_enabled?: boolean
  schedule_calendar?: string
}

export function getRestorePoints(tag = '', host = '') {
  const params = new URLSearchParams()
  if (tag) params.set('tag', tag)
  if (host) params.set('host', host)
  const query = params.toString()
  return request<RestorePointList>(
    `/package/backup/list${query ? `?${query}` : ''}`,
    'GET',
  )
}

export function getRestorePoint(snapshot: string) {
  return request<RestorePoint>(
    `/package/backup/${encodeURIComponent(snapshot)}`,
    'GET',
  )
}

export function getBackupPolicy() {
  return request<BackupPolicy>('/package/backup/policy', 'GET')
}

export function getBackupSchedule() {
  return request<BackupSchedule>('/package/backup/schedule', 'GET')
}

export function getBackupStats() {
  return request<BackupStats>('/package/backup/stats', 'GET')
}

export function checkBackup() {
  return request<{ ok: boolean }>('/package/backup/check', 'POST')
}

export function createBackup(input: BackupCreateInput = {}) {
  return request<LifecycleOperation>(
    '/package/backup/create',
    'POST',
    JSON.stringify(input),
  )
}

export function restoreBackup(input: BackupRestoreInput) {
  return request<LifecycleOperation>(
    '/package/backup/restore',
    'POST',
    JSON.stringify(input),
  )
}

export function deleteBackup(input: BackupDeleteInput) {
  return request<LifecycleOperation>(
    '/package/backup/delete',
    'POST',
    JSON.stringify(input),
  )
}

export function setBackupPolicy(input: BackupPolicySetInput) {
  return request<LifecycleOperation>(
    '/package/backup/policy',
    'POST',
    JSON.stringify(input),
  )
}
