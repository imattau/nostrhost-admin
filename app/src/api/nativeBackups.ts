import { request } from '@/api/client'

export type BackupArchiveInfo = {
  path: string
  created_at: string
  description: string
  size: number | string
  [field: string]: unknown
}

export type BackupList = {
  archives: Record<string, BackupArchiveInfo>
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export type BackupCreateInput = {
  name?: string
  description?: string
  apps?: string[]
  system?: string[]
  output_directory?: string
}

export type BackupRestoreInput = {
  name: string
  apps?: string[]
  system?: string[]
  force?: boolean
}

export function getBackups() {
  return request<BackupList>('/package/backup/list?with_info=true', 'GET')
}

export type BackupArchiveDetail = {
  path: string
  created_at: string
  description: string
  size: number | string
  apps?: Record<string, { size?: number | string; [field: string]: unknown }>
  system?: Record<string, { paths?: string[]; size?: number | string }>
  from_yunohost_version?: string | null
}

export function getBackupInfo(name: string) {
  return request<BackupArchiveDetail>(
    `/package/backup/${encodeURIComponent(name)}?with_details=true`,
    'GET',
  )
}

export function createBackup(input: BackupCreateInput) {
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

export function deleteBackup(name: string) {
  return request<LifecycleOperation>(
    '/package/backup/delete',
    'POST',
    JSON.stringify({ name }),
  )
}
