import { request } from '@/api/client'

export type DnsProviderType =
  | 'manual'
  | 'cloudflare'
  | 'duckdns'
  | 'dynu'
  | 'desec'
  | 'dynette'

export const DNS_PROVIDER_TYPES: DnsProviderType[] = [
  'manual',
  'cloudflare',
  'duckdns',
  'dynu',
  'desec',
  'dynette',
]

export type DomainResource = {
  name: string
  primary: boolean
  provider: {
    type: DnsProviderType
    zone: string | null
    credential: string | null
    [field: string]: unknown
  }
  exposure: { ipv4: boolean; ipv6: boolean; wildcard: boolean }
  tls: { mode: string; caa: string[] }
  nostr: { nip05: boolean }
}

export type DnsRecord = {
  type: string
  [field: string]: unknown
}

export type DnsChange = {
  action: 'create' | 'update' | 'delete'
  record: DnsRecord
  [field: string]: unknown
}

export type DnsPlanBlock = {
  mode?: string
  summary?: Record<string, number>
  changes?: DnsChange[]
  preserved?: DnsRecord[]
  records?: DnsRecord[]
}

export type DriftReport = {
  in_sync: boolean | null
  note?: string
  summary?: Record<string, number>
  to_create?: string[]
  to_update?: string[]
  to_delete?: string[]
  preserved?: string[]
}

export type DomainList = { domains: string[] }

export type DomainInspect = {
  domain: DomainResource
  zone: string
  provider: {
    type: string
    zone: string
    credential: string | null
    capabilities?: Record<string, unknown>
  }
  mode: 'full_zone' | 'dynamic'
  desired: DnsRecord[]
  actual: DnsRecord[]
  plan: DnsPlanBlock
  drift: DriftReport
  state: string
}

export type DnsPlanResult = {
  domain: string
  zone: string
  mode: 'full_zone' | 'dynamic'
  plan: DnsPlanBlock
  drift: DriftReport
}

export type DnsVerifyResult = {
  domain: string
  zone: string
  verify: unknown[]
}

export type DnsWatchStatus = {
  ipv4: string | null
  ipv6: string | null
  last_update: number | string | null
  dynamic_domains: string[]
  state: string
}

export type PublicIp = { ipv4: string | null; ipv6: string | null }

export type CredentialRef = { ref: string }
export type CredentialList = { credentials: CredentialRef[] }

export type FreeHostnameSubscription = {
  hostname: string
  zone: string
  provider: string
  pubkey: string
  claim_id: string | null
  secret_ref: string
  created_at: number | string | null
}
export type SubscriptionsList = { subscriptions: FreeHostnameSubscription[] }

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export type PrimaryDomainStatus = {
  current: string
  candidates: { domain: string; ready: boolean; reasons: string[] }[]
}

export type PrimaryDomainPlan = {
  action: string
  risk: 'high'
  reversibility: string
  current_domain: string
  target_domain: string
  old_admin_url: string
  new_admin_url: string
  new_portal_url: string
  changes: string[]
  unchanged: string[]
  sign_in_again: boolean
  plan_sha256: string
}

export type DomainAddInput = {
  domain: string
  provider_type?: DnsProviderType
  provider_zone?: string | null
  credential?: string | null
  primary?: boolean
  ipv4?: boolean
  ipv6?: boolean
  wildcard?: boolean
  nip05?: boolean
  tls_caa?: string[] | null
  apply_dns?: boolean
  verify?: boolean
}

export function getDomains() {
  return request<DomainList>('/package/domain/list', 'GET')
}

export function getPrimaryDomain() {
  return request<PrimaryDomainStatus>('/package/domain/primary', 'GET')
}

export function planPrimaryDomain(domain: string) {
  return request<PrimaryDomainPlan>(
    '/package/domain/primary/plan',
    'POST',
    JSON.stringify({ domain }),
  )
}

export function applyPrimaryDomain(domain: string, planSha256: string) {
  return request<{ operation: unknown; admin_url: string; portal_url: string }>(
    '/package/domain/primary/apply',
    'POST',
    JSON.stringify({ domain, plan_sha256: planSha256 }),
  )
}

export function getDomainInspect(domain: string) {
  return request<DomainInspect>(
    `/package/domain/${encodeURIComponent(domain)}/inspect`,
    'GET',
  )
}

export function addDomain(input: DomainAddInput) {
  return request<LifecycleOperation>(
    '/package/domain/add',
    'POST',
    JSON.stringify(input),
  )
}

export function removeDomain(domain: string, force = false) {
  return request<LifecycleOperation>(
    '/package/domain/remove',
    'POST',
    JSON.stringify({ domain, force }),
  )
}

export function getDnsPlan(domain: string) {
  return request<DnsPlanResult>(
    `/package/dns/plan/${encodeURIComponent(domain)}`,
    'GET',
  )
}

export function applyDns(domain: string) {
  return request<LifecycleOperation>(
    '/package/dns/apply',
    'POST',
    JSON.stringify({ domain }),
  )
}

export function verifyDns(domain: string) {
  return request<DnsVerifyResult>(
    `/package/dns/verify/${encodeURIComponent(domain)}`,
    'GET',
  )
}

export function getDnsWatch() {
  return request<DnsWatchStatus>('/package/dns/watch', 'GET')
}

export function subscribeFreeHostname(
  hostname: string,
  options: { secret?: string; rotate?: boolean } = {},
) {
  return request<LifecycleOperation>(
    '/package/dns/subscribe',
    'POST',
    JSON.stringify({
      hostname,
      secret: options.secret,
      rotate: options.rotate ?? false,
    }),
  )
}

export function getFreeHostnameSubscriptions() {
  return request<SubscriptionsList>('/package/dns/subscriptions', 'GET')
}

export function unsubscribeFreeHostname(hostname: string) {
  return request<LifecycleOperation>(
    '/package/dns/unsubscribe',
    'POST',
    JSON.stringify({ hostname }),
  )
}

export function getPublicIp() {
  return request<PublicIp>('/package/network/public-ip', 'GET')
}

export function getCredentials() {
  return request<CredentialList>('/package/credential/list', 'GET')
}

export function setCredential(provider: string, name: string, value: string) {
  return request<LifecycleOperation>(
    '/package/credential/set',
    'POST',
    JSON.stringify({ provider, name, value }),
  )
}

export function removeCredential(provider: string, name: string) {
  return request<LifecycleOperation>(
    '/package/credential/remove',
    'POST',
    JSON.stringify({ provider, name }),
  )
}
