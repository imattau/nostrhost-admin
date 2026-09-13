import { request } from '@/api/client'

export type FirewallProtocol = 'tcp' | 'udp'

export type FirewallPortList = Partial<
  Record<FirewallProtocol, (number | string)[]>
>

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export type FirewallOpenInput = {
  port: string
  protocol: FirewallProtocol
  comment?: string
  upnp?: boolean
}

export type FirewallCloseInput = {
  port: string
  protocol: FirewallProtocol
  upnp_only?: boolean
}

export function getFirewallList(protocol: FirewallProtocol, forwarded = false) {
  return request<FirewallPortList>(
    `/package/firewall/list?protocol=${protocol}${forwarded ? '&forwarded=true' : ''}`,
    'GET',
  )
}

export function openFirewallPort(input: FirewallOpenInput) {
  return request<LifecycleOperation>(
    '/package/firewall/open',
    'POST',
    JSON.stringify(input),
  )
}

export function closeFirewallPort(input: FirewallCloseInput) {
  return request<LifecycleOperation>(
    '/package/firewall/close',
    'POST',
    JSON.stringify(input),
  )
}

export function reloadFirewall(skipUpnp = false) {
  return request<LifecycleOperation>(
    '/package/firewall/reload',
    'POST',
    JSON.stringify({ skip_upnp: skipUpnp }),
  )
}
