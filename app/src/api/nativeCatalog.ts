import { request } from '@/api/client'

// The trusted native catalogue: a projection of signed Nostr declaration
// events (kind 32267) for apps this node trusts, synced from the control
// relay. Browsing is read-only; the functions below cover the rest of the
// publishing/authoring surface (publish, verify, attest, trust, reverify,
// profile, announcements) that the backend already exposes as tools but
// this UI previously never called.
export type CatalogueDeclaration = {
  AppID: string
  Name: string
  Description: string
  Category: string
  Repository: string
  Version: string
  Commit: string
  ManifestHash: string
  ContentHash: string
  Architectures: string[]
  PackagePath: string
  Publisher: string
  [field: string]: unknown
}

export type CatalogueEntry = {
  declaration: CatalogueDeclaration
  event_id: string
  // Served portal logo URL when the app id has a YunoHost catalogue logo;
  // absent otherwise (the view renders an initials monogram).
  logo?: string | null
  // Phase 5: present when this kind-32267 app is also served as a registered
  // nsite — the catalogue annotates the entry with an "open nsite" link.
  nsite?: {
    url: string
    label: string
  }
}

export type CatalogueList = {
  entries: CatalogueEntry[]
}

export function getCatalogueList() {
  return request<CatalogueList>('/package/catalog/list', 'GET')
}

export function getCatalogueEntry(appId: string) {
  return request<CatalogueEntry>(
    `/package/catalog/get/${encodeURIComponent(appId)}`,
    'GET',
  )
}

type PublishOutcome = {
  published: number
  failed: number
  relays: { relay: string; error?: string }[]
}

export type CataloguePublishResult = {
  app_id: string
  publisher_pubkey: string
  event_id: string
  published: PublishOutcome
  ingested: unknown
}

export function publishCatalogueEntry(appId: string, relays?: string) {
  return request<CataloguePublishResult>(
    '/package/catalog/publish',
    'POST',
    JSON.stringify({ app_id: appId, relays }),
  )
}

export type CatalogueDeclareResult = {
  app_id: string
  publisher_pubkey: string
  event_id: string
  published: PublishOutcome
  ingested: unknown
}

// Declares a brand-new app in the catalogue from an authored native package
// manifest (the package-authoring screen's "publish" step) — distinct from
// publishCatalogueEntry, which only re-declares an *existing* trusted entry.
export function declareCatalogueEntry(
  packageData: Record<string, unknown>,
  repository: string,
  relays?: string,
) {
  return request<CatalogueDeclareResult>(
    '/package/catalog/declare',
    'POST',
    JSON.stringify({ package: packageData, repository, relays }),
  )
}

export type CatalogueVerifyResult = {
  app_id: string
  kind: number
  publisher: string
  event_id: string
  valid: boolean
}

export function verifyCatalogueEvent(eventJson: string) {
  return request<CatalogueVerifyResult>(
    '/package/catalog/verify',
    'POST',
    JSON.stringify({ event_or_naddr: eventJson }),
  )
}

export type CatalogueCandidate = {
  app_id: string
  publisher: string
  version?: string
  name: string
}

export function getCatalogueCandidates() {
  return request<{ candidates: CatalogueCandidate[] }>(
    '/package/catalog/candidates',
    'GET',
  )
}

export type CatalogueClaim = 'recommend' | 'tested'

export function attestCatalogueEntry(input: {
  appId: string
  publisher: string
  claim: CatalogueClaim
  comment?: string
  relays?: string
}) {
  return request<{
    app_id: string
    publisher: string
    event_id: string
    published: PublishOutcome
  }>(
    '/package/catalog/attest',
    'POST',
    JSON.stringify({
      app_id: input.appId,
      publisher: input.publisher,
      claim: input.claim,
      comment: input.comment ?? '',
      relays: input.relays,
    }),
  )
}

export type CatalogueHistoryRecord = {
  app_id: string
  publisher: string
  claim: CatalogueClaim
  comment: string
  event_id: string
  created_at: number
}

export function getCatalogueHistory() {
  return request<{ history: CatalogueHistoryRecord[] }>(
    '/package/catalog/history',
    'GET',
  )
}

export type AttestationPolicyMode = 'off' | 'prefer' | 'require'

export type CatalogueTrustEntry = {
  declaration: CatalogueDeclaration
  attestations: {
    Verifier: string
    CIProvider: string
    CIRef: string
    Result: string
    Checks: Record<string, string>
  }[]
  verified: boolean
  accepted: boolean
}

export function getCatalogueTrust(policy?: {
  mode?: AttestationPolicyMode
  minAttestations?: number
  requiredChecks?: string[]
  trustedVerifiers?: string[]
}) {
  const params = new URLSearchParams()
  if (policy?.mode) params.set('attestation_policy', policy.mode)
  if (policy?.minAttestations)
    params.set('min_attestations', String(policy.minAttestations))
  if (policy?.requiredChecks?.length)
    params.set('required_checks', policy.requiredChecks.join(','))
  if (policy?.trustedVerifiers?.length)
    params.set('trusted_verifiers', policy.trustedVerifiers.join(','))
  const query = params.toString()
  return request<{ entries: CatalogueTrustEntry[] }>(
    `/package/catalog/trust${query ? `?${query}` : ''}`,
    'GET',
  )
}

export type CatalogueReverifyResult = {
  app_id: string
  publisher: string
  commit: string
  repository: string
  ok: boolean
  error?: string
  manifest?: Record<string, unknown>
  branch?: string
}

export function reverifyCatalogueEntry(appId: string) {
  return request<CatalogueReverifyResult>(
    '/package/catalog/reverify',
    'POST',
    JSON.stringify({ app_id: appId }),
  )
}

export type CatalogueProfile = {
  name?: string
  about?: string
  picture?: string
  nip05?: string
  website?: string
}

export function getCatalogueProfile() {
  return request<{ profile: CatalogueProfile; self_publisher: string }>(
    '/package/catalog/profile',
    'GET',
  )
}

export function setCatalogueProfile(
  profile: CatalogueProfile & { relays?: string },
) {
  return request<{
    event_id: string
    published: PublishOutcome
    cached: boolean
  }>('/package/catalog/profile', 'POST', JSON.stringify(profile))
}

export type CatalogueAnnouncement = {
  app_id: string
  commit: string
  version: string
  event_id: string
  created_at: number
}

export function getCatalogueAnnouncements() {
  return request<{ announcements: CatalogueAnnouncement[] }>(
    '/package/catalog/announcements',
    'GET',
  )
}

export function announceCatalogueEntry(appId: string, relays?: string) {
  return request<{
    app_id: string
    event_id: string
    published: PublishOutcome
  }>(
    '/package/catalog/announce',
    'POST',
    JSON.stringify({ app_id: appId, relays }),
  )
}
