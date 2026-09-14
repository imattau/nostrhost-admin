import { request } from '@/api/client'

export type CapabilityEvent = {
  id: string
  pubkey: string
  kind: number
  created_at: number
  content: string
  tags: string[][]
  sig: string
}

export type CapabilityGrant = {
  pubkey: string
  type: string
  scopes: string[]
  granted_at: number
  event_id: string
}

export type CapabilityListResult = {
  grants: CapabilityGrant[]
}

// Kind-31100 capability grants are parameterized-replaceable, keyed by the
// subject's pubkey: granting an empty scope list republishes over the same
// `d` tag and relays keep only the latest, so it doubles as revoke.
export function grantCapability(pubkey: string, scopes: string[]) {
  return request<CapabilityEvent>(
    '/package/capability/grant',
    'POST',
    JSON.stringify({ pubkey, scopes, type: 'agent' }),
  )
}

export function revokeCapability(pubkey: string) {
  return grantCapability(pubkey, [])
}

// Reads back the live grants (newest per subject; an empty-scope revoke is
// already excluded server-side), newest-granted first.
export function listCapabilities() {
  return request<CapabilityListResult>('/package/capability/list', 'GET')
}
