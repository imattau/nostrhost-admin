import { request } from '@/api/client'

// The trusted native catalogue: a projection of signed Nostr declaration
// events (kind 32267) for apps this node trusts, synced from the control
// relay. Read-only — publishing/verifying a declaration is a separate,
// operator-signed action this UI does not expose.
export type CatalogueDeclaration = {
  AppID: string
  Repository: string
  Version: string
  Commit: string
  ManifestHash: string
  ContentHash: string
  Architectures: string[]
  PackagePath: string
  [field: string]: unknown
}

export type CatalogueEntry = {
  declaration: CatalogueDeclaration
  event_id: string
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
