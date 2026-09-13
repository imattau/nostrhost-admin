import type { SignerType } from '@/api/nativeIdentity'

export type IdentityMode = 'none' | 'existing' | 'generate'

export type IdentitySelection = {
  mode: IdentityMode
  pubkeyOrNpub: string
  signerType: SignerType
  label: string
  // False while the current mode has an unmet precondition (an "existing"
  // pubkey not yet entered, or a "generate"d key not yet acknowledged
  // saved) — callers gate their submit action on this rather than
  // re-deriving the same rule.
  ready: boolean
}

export function defaultIdentitySelection(): IdentitySelection {
  return {
    mode: 'none',
    pubkeyOrNpub: '',
    signerType: 'nip07',
    label: '',
    ready: true,
  }
}
