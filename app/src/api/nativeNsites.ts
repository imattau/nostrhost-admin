import { request } from '@/api/client'

// NIP-5A static-site gateway. Phase 1 surfaces only the gateway lifecycle
// (status/enable/disable/configure); site publishing and registration are
// Phase 3 and reuse the same typed client.

export type GatewayRelaysConfig = {
  lookup: string[]
  extra: string[]
  manifest_ttl_seconds: number
  negative_ttl_seconds: number
}

export type GatewayBlossomConfig = {
  fallback_servers: string[]
  allow_http: boolean
}

export type GatewayLimitsConfig = {
  max_blob_bytes: number
  fetch_timeout_seconds: number
  fetch_concurrency: number
  max_redirects: number
  cache_quota_bytes: number
  max_paths_per_manifest: number
  requests_per_second: number
  requests_burst: number
}

export type GatewayConfig = {
  domain: string
  mode: string
  public_listen: string
  internal_listen: string
  cache_path: string
  relays: GatewayRelaysConfig
  blossom: GatewayBlossomConfig
  limits: GatewayLimitsConfig
}

export type GatewayStatus = {
  enabled: boolean
  domain: string
  mode: string
  service_active: boolean
  config_path: string
  config_exists: boolean
  health: 'ok' | 'degraded'
  health_detail: string
  sites: number
  // The stored intent — empty {} while disabled, full config when enabled.
  config: Partial<GatewayConfig>
  internal?: { status: string; body: string }
}

export type GatewayStatusEnvelope = { gateway: GatewayStatus }

// Fields the gateway card lets the user configure; only present keys are
// sent, so configure() acts as a partial update.
export type GatewayInput = {
  domain: string
  lookup_relays?: string[]
  extra_relays?: string[]
  fallback_servers?: string[]
  allow_http?: boolean
  max_blob_bytes?: number
  cache_quota_bytes?: number
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function getNsiteGatewayStatus() {
  return request<GatewayStatusEnvelope>('/package/nsite/gateway/status', 'GET')
}

export function enableNsiteGateway(input: GatewayInput) {
  return request<LifecycleOperation>(
    '/package/nsite/gateway/enable',
    'POST',
    JSON.stringify(input),
  )
}

export function disableNsiteGateway() {
  return request<LifecycleOperation>(
    '/package/nsite/gateway/disable',
    'POST',
    JSON.stringify({}),
  )
}

export function configureNsiteGateway(input: GatewayInput) {
  return request<LifecycleOperation>(
    '/package/nsite/gateway/configure',
    'POST',
    JSON.stringify(input),
  )
}

// -- Phase 3a: site registry + publishing ----------------------------------

export type NsiteSite = {
  pubkey: string
  kind: number
  d: string
  title?: string
  last_event_id?: string
  aggregate_hash?: string
  servers?: string[]
  relays?: string[]
  snapshots?: string[]
}

export type NsiteListEnvelope = {
  mode: string
  sites: NsiteSite[]
  count: number
}

export type NsiteInspectEnvelope = { site: NsiteSite }

export type NsiteValidateEnvelope = {
  valid: boolean
  errors: string[]
  site_type?: string
  label?: string
  aggregate_hash?: string
}

export type NsitePlanEnvelope = {
  plan: {
    pubkey: string
    kind: number
    d: string
    items: { path: string; sha256: string }[]
    servers: string[]
    relays: string[]
    unsigned_event: unknown
    plan_sha256: string
  }
}

export type NsiteResolveEnvelope = {
  found: boolean
  relays_queried: string[]
  manifest: {
    event_id: string
    pubkey: string
    kind: number
    d: string
    label: string
    aggregate_hash: string
    paths: [string, string][]
  } | null
}

export function getNsiteList() {
  return request<NsiteListEnvelope>('/package/nsite/list', 'GET')
}

export function getNsiteInspect(input: { pubkey: string; d?: string }) {
  const params = new URLSearchParams({ pubkey: input.pubkey })
  if (input.d) params.set('d', input.d)
  return request<NsiteInspectEnvelope>(
    `/package/nsite/inspect?${params}`,
    'GET',
  )
}

export function resolveNsite(input: {
  label?: string
  pubkey?: string
  d?: string
  relays?: string[]
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input.label) params.set('label', input.label)
  if (input.pubkey) params.set('pubkey', input.pubkey)
  if (input.d) params.set('d', input.d)
  if (input.limit) params.set('limit', String(input.limit))
  return request<NsiteResolveEnvelope>(
    `/package/nsite/resolve?${params}`,
    'GET',
  )
}

export function validateNsiteManifest(event: unknown) {
  return request<NsiteValidateEnvelope>(
    '/package/nsite/validate',
    'POST',
    JSON.stringify({ event }),
  )
}

export function planNsitePublish(input: {
  pubkey: string
  kind: number
  d?: string
  items: { path: string; sha256: string }[]
  servers?: string[]
  relays?: string[]
}) {
  return request<NsitePlanEnvelope>(
    '/package/nsite/publish/plan',
    'POST',
    JSON.stringify(input),
  )
}

export function registerNsite(input: {
  pubkey: string
  kind: number
  d?: string
  title?: string
}) {
  return request<LifecycleOperation>(
    '/package/nsite/register',
    'POST',
    JSON.stringify(input),
  )
}

export function unregisterNsite(input: { pubkey: string; d?: string }) {
  return request<LifecycleOperation>(
    '/package/nsite/unregister',
    'POST',
    JSON.stringify(input),
  )
}

export function publishNsite(input: {
  event: unknown
  plan_sha256: string
  relays?: string[]
}) {
  return request<LifecycleOperation>(
    '/package/nsite/publish',
    'POST',
    JSON.stringify(input),
  )
}

export function snapshotNsite(input: {
  event: unknown
  plan_sha256?: string
  relays?: string[]
}) {
  return request<LifecycleOperation>(
    '/package/nsite/snapshot',
    'POST',
    JSON.stringify(input),
  )
}
