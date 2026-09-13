import { computed, ref } from 'vue'

// Shared module-level state: every caller of `useSigner()` sees the same
// session-derived identity, so the app shell header and individual views
// agree on whether the user is signed in without prop-drilling.
//
// The admin console uses the portal session (single sign-in): once the user
// signs in at /nostrhost/sso/login, the nostrhost.portal cookie authenticates
// every native API request. A NIP-07 browser signer remains a fallback for
// callers without a portal session.
const publicKey = ref<string | null>(null)
const username = ref<string | null>(null)
const admin = ref(false)
const busy = ref(false)
const error = ref('')

const sessionChecked = ref(false)

const signerAvailable = computed(
  () => Boolean(window.nostr) || sessionChecked.value,
)

export type SessionInfo = {
  authenticated: boolean
  username: string | null
  pubkey: string | null
  admin: boolean
}

// Probe the native API's public /session endpoint (session cookie only — no
// NIP-98 needed) to learn who is signed in.
export async function refreshSession(): Promise<SessionInfo> {
  try {
    const response = await fetch('/package/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`session probe failed (${response.status})`)
    const info = (await response.json()) as SessionInfo
    publicKey.value = info.pubkey
    username.value = info.username
    admin.value = info.admin
    sessionChecked.value = true
    return info
  } catch (cause) {
    publicKey.value = null
    username.value = null
    admin.value = false
    sessionChecked.value = true
    error.value =
      cause instanceof Error ? cause.message : 'Could not reach the session endpoint.'
    return { authenticated: false, username: null, pubkey: null, admin: false }
  }
}

// The portal is the single sign-in: connect() sends the user to the portal
// login with a redirect back to this console. When already signed in it first
// clears the portal session cookie (so "Sign out" actually signs out instead of
// bouncing back to the portal still authenticated).
async function connect() {
  const target = `${window.location.origin}/nostrhost/sso/login?r=${btoa(
    window.location.pathname + window.location.hash,
  )}`
  if (publicKey.value || admin.value) {
    try {
      await fetch('/nostrhost/portalapi/logout', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
    } catch {
      // Session cookie may already be gone; the login redirect below still
      // applies.
    }
    publicKey.value = null
    admin.value = false
  }
  window.location.assign(target)
}

// Re-reads the session. If a portal session exists it is authoritative; a
// NIP-07 signer is only consulted when there is no session.
async function sync() {
  const info = await refreshSession()
  if (info.authenticated) {
    if (publicKey.value && info.pubkey && publicKey.value !== info.pubkey) {
      throw new Error('The session account changed. Review the account before continuing.')
    }
    return
  }
  if (window.nostr) {
    const current = await window.nostr.getPublicKey()
    if (!current) {
      publicKey.value = null
      throw new Error('The Nostr signer is no longer available.')
    }
    publicKey.value = current
    return
  }
  publicKey.value = null
  throw new Error('Not signed in. Connect the portal session to continue.')
}

export function useSigner() {
  return {
    publicKey,
    username,
    admin,
    busy,
    error,
    signerAvailable,
    connect,
    sync,
    refreshSession,
  }
}