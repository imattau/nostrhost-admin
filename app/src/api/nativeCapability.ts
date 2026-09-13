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

// Kind-31100 capability grants are parameterized-replaceable, keyed by the
// subject's pubkey: granting an empty scope list republishes over the same
// `d` tag and relays keep only the latest, so it doubles as revoke — there
// is no separate delete endpoint or read-back listing for grants.
export function grantCapability(pubkey: string, scopes: string[]) {
  return request<CapabilityEvent>(
    '/capability/grant',
    'POST',
    JSON.stringify({ pubkey, scopes, type: 'agent' }),
  )
}

export function revokeCapability(pubkey: string) {
  return grantCapability(pubkey, [])
}
