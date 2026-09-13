import { request } from '@/api/client'

export type UpgradablePackage = {
  name: string
  current_version: string
  new_version: string
  [field: string]: unknown
}

export type AppUpdateInfo = {
  id: string
  name?: string
  upgrade?: { status: string; [field: string]: unknown }
  [field: string]: unknown
}

export type Migration = {
  id: string
  number: number
  name: string
  mode: 'auto' | 'manual'
  state: 'pending' | 'done' | 'skipped'
  description: string
  disclaimer: string | null
}

export type AvailableUpdates = {
  system: Record<string, UpgradablePackage[]>
  apps: AppUpdateInfo[]
  important_yunohost_upgrade: boolean
  pending_migrations: Migration[]
  last_apt_update: number
  last_apps_catalog_update: number
}

export type MigrationsList = {
  migrations: Migration[]
  state: Record<string, unknown>
}

export type UpdateTarget = 'apps' | 'system' | 'all'

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function getAvailableUpdates() {
  return request<AvailableUpdates>('/package/system/updates', 'GET')
}

export function refreshUpdates(target: UpdateTarget = 'apps') {
  return request<AvailableUpdates>(
    '/package/system/updates/refresh',
    'POST',
    JSON.stringify({ target }),
  )
}

export function applyUpdates(target: 'apps' | 'system' = 'system') {
  return request<LifecycleOperation>(
    '/package/system/updates/apply',
    'POST',
    JSON.stringify({ target }),
  )
}

export function getMigrations(filter?: 'pending' | 'done') {
  const query =
    filter === 'pending'
      ? '?pending=true'
      : filter === 'done'
        ? '?done=true'
        : ''
  return request<MigrationsList>(`/package/system/migrations${query}`, 'GET')
}

export function runMigration(id: string, acceptDisclaimer: boolean) {
  return request<LifecycleOperation>(
    '/package/system/migrate',
    'POST',
    JSON.stringify({ targets: [id], accept_disclaimer: acceptDisclaimer }),
  )
}
