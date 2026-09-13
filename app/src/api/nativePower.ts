import { request } from '@/api/client'

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function reboot() {
  return request<LifecycleOperation>(
    '/package/system/reboot',
    'POST',
    JSON.stringify({}),
  )
}

export function shutdown() {
  return request<LifecycleOperation>(
    '/package/system/shutdown',
    'POST',
    JSON.stringify({}),
  )
}
