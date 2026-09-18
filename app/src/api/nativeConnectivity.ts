import { request } from '@/api/client'

export type RelayPurpose = 'lookup' | 'publish' | 'catalogue' | 'nsite'

export type ConnectivityConfiguration = {
  version: 1
  default_relays: string[]
  default_blossom_servers: string[]
  additional_discovery_relays: string[]
  overrides: Record<RelayPurpose, string[] | null>
}

export type ConnectivityEffective = {
  relays: Record<RelayPurpose | 'nsite_lookup', string[]>
  blossom_servers: string[]
  sources: Record<RelayPurpose | 'blossom', 'system-default' | 'override'>
}

export type ConnectivityState = {
  configured: ConnectivityConfiguration
  effective: ConnectivityEffective
  control_relay: { url: string; editable: false }
}

export type ConnectivityPlan = {
  action: string
  risk: string
  reversibility: string
  before: ConnectivityConfiguration
  after: ConnectivityConfiguration
  effective: ConnectivityEffective
  affected_services: string[]
  plan_sha256: string
}

export type ConnectivityOperation = {
  ok: boolean
  error?: string
  request_id?: string
  state?: string
  result?: unknown
}

export function getConnectivity() {
  return request<ConnectivityState>('/package/nostr/connectivity', 'GET')
}

export function checkConnectivity(relays: string[], blossomServers: string[]) {
  return request<{ relays: unknown[]; servers: unknown[] }>(
    '/package/nostr/connectivity/check',
    'POST',
    JSON.stringify({ relays, blossom_servers: blossomServers }),
  )
}

export function planConnectivity(configuration: ConnectivityConfiguration) {
  return request<ConnectivityPlan>(
    '/package/nostr/connectivity/plan',
    'POST',
    JSON.stringify({ configuration }),
  )
}

export function applyConnectivity(
  configuration: ConnectivityConfiguration,
  planSha256: string,
) {
  return request<{
    operation: ConnectivityOperation
    effective: ConnectivityEffective
  }>(
    '/package/nostr/connectivity/apply',
    'POST',
    JSON.stringify({ configuration, plan_sha256: planSha256 }),
  )
}
