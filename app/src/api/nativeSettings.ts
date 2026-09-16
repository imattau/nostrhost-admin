import { request } from '@/api/client'

export type SettingValue = string | number | boolean | null

export type SettingsList = {
  settings: Record<string, SettingValue>
}

export type FullSettingOption = {
  id: string
  name?: string | Record<string, string>
  type: 'boolean' | 'number' | 'integer' | 'string' | 'select' | string
  current_value?: SettingValue
  value?: SettingValue
  default?: SettingValue
  ask?: string | Record<string, string>
  help?: string | Record<string, string>
  choices?: Array<string | { value: string; label?: string }>
}

export type FullSettingSection = {
  id: string
  name?: string | Record<string, string>
  options?: FullSettingOption[]
}

export type FullSettingPanel = {
  id: string
  name?: string | Record<string, string>
  sections?: FullSettingSection[]
}

export type SettingsFullList = {
  settings: {
    panels?: FullSettingPanel[]
    [field: string]: unknown
  }
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function getSettings(full: true): Promise<SettingsFullList>
export function getSettings(full?: false): Promise<SettingsList>
export function getSettings(full = false) {
  return request<SettingsList | SettingsFullList>(
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
