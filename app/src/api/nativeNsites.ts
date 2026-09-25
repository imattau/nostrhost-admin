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
  local?: GatewayBlossomLocalConfig
}

export type GatewayBlossomLocalConfig = {
  enabled: boolean
  listen: string
  data_dir: string
  quota_bytes: number
  max_blob_bytes: number
  retention_days: number
  allow_pubkeys: string[]
}

export type GatewayNpkConfig = {
  enabled: boolean
  cache_path: string
  release_ttl_seconds: number
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
  npk?: GatewayNpkConfig
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
  mode?: 'hosted' | 'open'
  lookup_relays?: string[]
  extra_relays?: string[]
  fallback_servers?: string[]
  allow_http?: boolean
  npk_enabled?: boolean
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

// -- local Blossom server (Phase 5, D4) -------------------------------------

export type NsiteBlossomStatus = {
  enabled: boolean
  listen: string
  data_dir: string
  quota_bytes: number | null
  max_blob_bytes: number | null
  retention_days: number | null
  allow_pubkeys: string[]
  health: 'ok' | 'degraded'
  health_detail: string
}

export type NsiteBlossomStatusEnvelope = { blossom: NsiteBlossomStatus }

export type NsiteBlossomInput = {
  listen?: string
  data_dir?: string
  quota_bytes?: number
  max_blob_bytes?: number
  retention_days?: number
  allow_pubkeys?: string[]
}

export function getNsiteBlossomStatus() {
  return request<NsiteBlossomStatusEnvelope>(
    '/package/nsite/blossom/status',
    'GET',
  )
}

export function enableNsiteBlossom(input: NsiteBlossomInput) {
  return request<LifecycleOperation>(
    '/package/nsite/blossom/enable',
    'POST',
    JSON.stringify(input),
  )
}

export function configureNsiteBlossom(input: NsiteBlossomInput) {
  return request<LifecycleOperation>(
    '/package/nsite/blossom/configure',
    'POST',
    JSON.stringify(input),
  )
}

export function disableNsiteBlossom() {
  return request<LifecycleOperation>(
    '/package/nsite/blossom/disable',
    'POST',
    JSON.stringify({}),
  )
}

// -- Phase 3a: site registry + publishing ----------------------------------

export type NsiteSite = {
  pubkey: string
  kind: number
  d: string
  title?: string
  status?: 'registered' | 'published'
  last_event_id?: string
  aggregate_hash?: string
  paths?: { path: string; sha256: string }[]
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
  npk?: NsiteNpkPlan
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

// -- nsite discovery (catalogue Browse) ------------------------------------

export type NsiteDiscoveredSite = {
  label: string
  pubkey: string
  kind: number
  d: string
  title: string
  servers: string[]
  relays: string[]
  event_id: string
  created_at: number
  paths_count: number
  app: string
  registered: boolean
  blobs_ok: boolean | null
  blobs_checked: number
}

export type NsiteBlobCheckSummary = {
  checked: number
  ok: number
  unknown: number
  excluded: number
  blocked: number
  truncated: boolean
}

export type NsiteDiscoverEnvelope = {
  sites: NsiteDiscoveredSite[]
  relays_queried: string[]
  count: number
  truncated: boolean
  blob_check: NsiteBlobCheckSummary
  cached: boolean
  cached_at: number | null
}

export function discoverNsites(refresh = false) {
  return request<NsiteDiscoverEnvelope>(
    `/package/nsite/discover${refresh ? '?refresh=1' : ''}`,
    'GET',
  )
}

export type NsiteBlockListEnvelope = {
  pubkeys: string[]
  count: number
}

export function nsiteBlockList() {
  return request<NsiteBlockListEnvelope>('/package/nsite/block/list', 'GET')
}

export function nsiteBlockAdd(pubkey: string) {
  return request<LifecycleOperation>(
    '/package/nsite/block/add',
    'POST',
    JSON.stringify({ pubkey }),
  )
}

export function nsiteBlockRemove(pubkey: string) {
  return request<LifecycleOperation>(
    '/package/nsite/block/remove',
    'POST',
    JSON.stringify({ pubkey }),
  )
}

export function planNsitePublish(input: {
  pubkey: string
  kind: number
  d?: string
  items: { path: string; sha256: string }[]
  servers?: string[]
  relays?: string[]
  app?: string
  npk?: boolean
  npk_version?: string
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
  npk_release_event?: unknown
  npk_sha256?: string
}) {
  return request<LifecycleOperation>(
    '/package/nsite/publish',
    'POST',
    JSON.stringify(input),
  )
}

export type NsitePublishPlanInput = {
  pubkey: string
  kind: number
  d?: string
  items?: { path: string; sha256: string }[]
  site?: string
  servers?: string[]
  relays?: string[]
  copy_of?: string
  app?: string
  npk?: boolean
  npk_version?: string
}

export type NsiteNpkPlan = {
  name: string
  version: string
  artifact_sha256: string
  kind: number
  d: string
  servers?: string[]
  release_event: {
    kind: number
    pubkey: string
    created_at: number
    tags: string[][]
    content: string
  }
}

export type NsitePublishPlan = {
  pubkey: string
  kind: number
  d: string
  items: { path: string; sha256: string }[]
  servers: string[]
  relays: string[]
  copy_of: string
  app: string
  unsigned_event: {
    kind: number
    pubkey: string
    created_at: number
    tags: string[][]
    content: string
  }
  plan_sha256: string
}

export function getNsitePublishPlan(input: NsitePublishPlanInput) {
  return request<{ plan: NsitePublishPlan }>(
    '/package/nsite/publish/plan',
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

// -- Phase 4: custom domains -------------------------------------------------

export type NsiteCustomDomain = {
  fqdn: string
  pubkey: string
  d: string
  method: 'cname' | 'txt'
  verification: string
  verified_at: string
}

export type NsiteDomainListEnvelope = {
  domains: NsiteCustomDomain[]
  count: number
}

export function getNsiteDomainList() {
  return request<NsiteDomainListEnvelope>('/package/nsite/domain/list', 'GET')
}

export function attachNsiteDomain(input: {
  fqdn: string
  pubkey: string
  d?: string
  method: 'cname' | 'txt'
}) {
  return request<LifecycleOperation>(
    '/package/nsite/domain/attach',
    'POST',
    JSON.stringify(input),
  )
}

export function detachNsiteDomain(input: { fqdn: string }) {
  return request<LifecycleOperation>(
    '/package/nsite/domain/detach',
    'POST',
    JSON.stringify(input),
  )
}

// -- curated collections (kind 30004, NSITES-CURATED-LISTS.md) -------------

export type CollectionEntry = {
  kind: 'live-root' | 'live-named' | 'pinned'
  ref: string
  relay: string
}

export type NsiteCollection = {
  coordinate: string
  pubkey: string
  d: string
  title: string
  description: string
  image: string
  event_id: string
  created_at: number
  entries: number
}

export type NsiteCollectionDiscoverEnvelope = {
  collections: NsiteCollection[]
  relays_queried: string[]
  count: number
  truncated: boolean
  cached: boolean
  cached_at: number | null
}

export type ResolvedCollectionEntry = CollectionEntry & {
  site?: {
    event_id: string
    pubkey: string
    kind: number
    d: string
    label: string
    aggregate_hash: string
    paths: [string, string][]
  } | null
  available: boolean
}

export type NsiteCollectionGetEnvelope = {
  found: boolean
  relays_queried: string[]
  coordinate?: string
  d?: string
  pubkey?: string
  event_id?: string
  title?: string
  description?: string
  image?: string
  created_at?: number
  entries?: ResolvedCollectionEntry[]
  entries_total?: number
  blocked?: boolean
  collection?: NsiteCollection | null
}

export type NsiteCollectionPlanEnvelope = {
  plan: {
    pubkey: string
    d: string
    title: string
    description: string
    image: string
    entries: CollectionEntry[]
    relays: string[]
    copy_of: string
    unsigned_event: {
      kind: number
      pubkey: string
      created_at: number
      tags: string[][]
      content: string
    }
    plan_sha256: string
  }
}

export type NsiteCollectionValidateEnvelope = {
  valid: boolean
  errors: string[]
  coordinate?: string | null
  d?: string | null
  entries?: CollectionEntry[]
}

export function discoverCollections(refresh = false) {
  return request<NsiteCollectionDiscoverEnvelope>(
    `/package/nsite/collection/discover${refresh ? '?refresh=1' : ''}`,
    'GET',
  )
}

export function getCollection(input: {
  coordinate: string
  relays?: string[]
  limit?: number
}) {
  const params = new URLSearchParams({ coordinate: input.coordinate })
  if (input.relays?.length) params.set('relays', input.relays.join(','))
  if (input.limit) params.set('limit', String(input.limit))
  return request<NsiteCollectionGetEnvelope>(
    `/package/nsite/collection/get?${params}`,
    'GET',
  )
}

export function validateCollection(event: unknown) {
  return request<NsiteCollectionValidateEnvelope>(
    '/package/nsite/collection/validate',
    'POST',
    JSON.stringify({ event }),
  )
}

export function getCollectionPlan(input: {
  pubkey: string
  d: string
  title?: string
  description?: string
  image?: string
  entries?: CollectionEntry[]
  relays?: string[]
  copy_of?: string
}) {
  return request<NsiteCollectionPlanEnvelope>(
    '/package/nsite/collection/publish/plan',
    'POST',
    JSON.stringify(input),
  )
}

export function publishCollection(input: {
  event: unknown
  plan_sha256: string
  relays?: string[]
}) {
  return request<LifecycleOperation>(
    '/package/nsite/collection/publish',
    'POST',
    JSON.stringify(input),
  )
}
