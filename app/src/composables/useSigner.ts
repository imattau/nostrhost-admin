import { computed, ref } from 'vue'

import { toErrorMessage } from '@/utils/errors'

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

// Per-session CSRF token (H4). Returned by the native API's public
// /package/session probe and required on every cookie-authenticated request:
// a cross-origin page — even a same-site subdomain XSS — cannot read it and
// cannot set the custom header, so the domain-wide SSO cookie can no longer
// be ridden to drive the admin API.
export const csrfToken = ref('')

// Every view calls sync() on load and before each write, and the router
// guard probes on every navigation — without a cache that's a
// /package/session round-trip per action. 30s is short enough that a
// sign-out or role change elsewhere is picked up quickly, long enough that a
// single screen full of actions costs one probe, not a dozen.
const SESSION_TTL_MS = 30_000
let lastCheckedAt = 0
let inFlight: Promise<SessionInfo> | null = null

const signerAvailable = computed(
  () => Boolean(window.nostr) || sessionChecked.value,
)

export type SessionInfo = {
  authenticated: boolean
  username: string | null
  pubkey: string | null
  admin: boolean
  csrf_token?: string | null
}

// Probe the native API's public /session endpoint (session cookie only — no
// NIP-98 needed) to learn who is signed in. Cached for SESSION_TTL_MS; pass
// `force` to bypass the cache (e.g. right after sign-in/out).
export async function refreshSession(force = false): Promise<SessionInfo> {
  if (!force && sessionChecked.value && Date.now() - lastCheckedAt < SESSION_TTL_MS) {
    return {
      authenticated: publicKey.value !== null,
      username: username.value,
      pubkey: publicKey.value,
      admin: admin.value,
    }
  }
  if (inFlight) return inFlight
  inFlight = _refreshSession()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

async function _refreshSession(): Promise<SessionInfo> {
  try {
    const response = await fetch('/package/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok)
      throw new Error(`session probe failed (${response.status})`)
    const info = (await response.json()) as SessionInfo
    publicKey.value = info.pubkey
    username.value = info.username
    admin.value = info.admin
    csrfToken.value = info.csrf_token ?? ''
    sessionChecked.value = true
    lastCheckedAt = Date.now()
    return info
  } catch (cause) {
    publicKey.value = null
    username.value = null
    admin.value = false
    sessionChecked.value = true
    lastCheckedAt = Date.now()
    error.value = toErrorMessage(cause, 'Could not reach the session endpoint.')
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
      throw new Error(
        'The session account changed. Review the account before continuing.',
      )
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
    csrfToken,
    busy,
    error,
    signerAvailable,
    connect,
    sync,
    refreshSession,
  }
}
