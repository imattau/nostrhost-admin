import { request } from '@/api/client'

export type SettingValue = string | number | boolean | null

export type SettingsList = {
  settings: Record<string, SettingValue>
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function getSettings(full = false) {
  return request<SettingsList>(
    `/package/settings/list${full ? '?full=true' : ''}`,
    'GET',
  )
}

export function getSetting(key: string) {
  return request<{ key: string; value: SettingValue }>(
    `/package/settings/get/${encodeURIComponent(key)}`,
    'GET',
  )
}

export function setSetting(key: string, value: SettingValue) {
  return request<LifecycleOperation>(
    '/package/settings/set',
    'POST',
    JSON.stringify({ key, value }),
  )
}

export function resetSetting(key: string) {
  return request<LifecycleOperation>(
    '/package/settings/reset',
    'POST',
    JSON.stringify({ key }),
  )
}

export function resetAllSettings() {
  return request<LifecycleOperation>(
    '/package/settings/reset_all',
    'POST',
    JSON.stringify({}),
  )
}
