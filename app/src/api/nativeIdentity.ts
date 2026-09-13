import { request } from '@/api/client'
import type { Identity } from '@/api/nativeSystem'

export type SignerType = 'nip07' | 'nip46' | 'passkey' | 'unknown'

export type IdentityEvent = {
  id: string
  pubkey: string
  kind: number
  created_at: number
  content: string
  tags: string[][]
  sig: string
}

export type LinkIdentityInput = {
  username: string
  pubkeyOrNpub: string
  signerType: SignerType
  label?: string
  enabled?: boolean
}

export function resolveIdentity(value: string) {
  return request<Identity | Identity[] | null>(
    `/identity/resolve/${encodeURIComponent(value)}`,
    'GET',
  )
}

export function linkIdentity(input: LinkIdentityInput) {
  return request<IdentityEvent>(
    '/package/identity/link',
    'POST',
    JSON.stringify({
      username: input.username,
      pubkey_or_npub: input.pubkeyOrNpub,
      signer_type: input.signerType,
      label: input.label || null,
      enabled: input.enabled ?? true,
    }),
  )
}

export function revokeIdentity(pubkeyOrNpub: string) {
  return request<IdentityEvent>(
    '/package/identity/revoke',
    'POST',
    JSON.stringify({ pubkey_or_npub: pubkeyOrNpub }),
  )
}
