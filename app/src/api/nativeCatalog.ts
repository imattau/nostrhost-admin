import { request } from '@/api/client'

// The trusted native catalogue: a projection of signed Nostr declaration
// events (kind 32267, and kind 9900 npack releases ingested the same way)
// for apps/releases this node trusts, synced from the control relay.
// Browsing is read-only; the functions below cover the rest of the
// curation surface (attest, trust, attest-release, profile, announcements)
// the backend exposes. The git-repository authoring path (declare, publish,
// verify, reverify, fetch_manifest) was retired - npack is now the sole
// distribution/publishing mechanism and has no HTTP surface here.
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

// The npack-release counterpart to getCatalogueTrust: the trust/curation/
// attestation picture for one npack release, fetched live from the relay
// rather than the local relay-synced projection - used to surface trust
// informationally at install-npk time (Phase 3a).
export function getCatalogueAttestRelease(
  release: { publisher: string; name: string; version: string; arch?: string },
  policy?: {
    mode?: AttestationPolicyMode
    minAttestations?: number
    requiredChecks?: string[]
    trustedVerifiers?: string[]
  },
) {
  const params = new URLSearchParams()
  params.set('publisher', release.publisher)
  params.set('name', release.name)
  params.set('version', release.version)
  if (release.arch) params.set('arch', release.arch)
  if (policy?.mode) params.set('attestation_policy', policy.mode)
  if (policy?.minAttestations)
    params.set('min_attestations', String(policy.minAttestations))
  if (policy?.requiredChecks?.length)
    params.set('required_checks', policy.requiredChecks.join(','))
  if (policy?.trustedVerifiers?.length)
    params.set('trusted_verifiers', policy.trustedVerifiers.join(','))
  return request<CatalogueTrustEntry>(
    `/package/catalog/attest-release?${params.toString()}`,
    'GET',
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

// WP4 operator-owned people-set: the pubkeys npack will install .npk
// releases from without a manual override. Read is the effective projected
// view (`/etc/nostrhost/lists.json`); publish republishes the full desired
// membership as a signed kind-30000 people-set event.
export const TRUSTED_PUBLISHERS_FAMILY = 'trusted-publishers'

export function getTrustedPublishers() {
  return request<{ family: string; entries: string[] }>(
    `/package/list/${TRUSTED_PUBLISHERS_FAMILY}`,
    'GET',
  )
}

export function publishTrustedPublishers(values: string[]) {
  return request<{ event_id: string }>(
    '/package/list/publish',
    'POST',
    JSON.stringify({ family: TRUSTED_PUBLISHERS_FAMILY, values }),
  )
}
