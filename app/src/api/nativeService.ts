import { request } from '@/api/client'

export type ServiceAction = 'start' | 'stop' | 'restart'

export type ServiceStatus = {
  status: string
  start_on_boot: string
  last_state_change: string
  description: string
  configuration: string
}

export type ServiceStatusMap = Record<string, ServiceStatus>

export function getServiceStatus() {
  return request<ServiceStatusMap>('/package/service/status', 'GET')
}

export function controlService(name: string, action: ServiceAction) {
  return request<{ service: string; action: ServiceAction; status: string }>(
    '/package/service/control',
    'POST',
    JSON.stringify({ name, action }),
  )
}
