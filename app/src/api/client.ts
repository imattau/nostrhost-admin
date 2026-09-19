import { refreshSession, csrfToken } from '@/composables/useSigner'

// A request that failed at the HTTP layer (4xx/5xx) — status + the backend's
// own error code (from _json_error in api.py), not just a message string, so
// callers can branch on `code` without parsing prose.
export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const REQUEST_TIMEOUT_MS = 30_000

// A lifecycle write resolved with HTTP 200 but `ok: false` in the body — the
// policy chain rejected, failed, or parked the operation for approval. Thrown
// instead of returned so callers can't accidentally treat it as a success.
export class OperationError extends Error {
  state?: string
  reason?: string
  error?: string
  request_id?: string
  pending_approval: boolean

  constructor(data: {
    state?: string
    reason?: string
    error?: string
    request_id?: string
    pending_approval?: boolean
  }) {
    super(
      data.pending_approval
        ? 'This operation is pending approval.'
        : data.error || data.reason || 'The operation was rejected.',
    )
    this.state = data.state
    this.reason = data.reason
    this.error = data.error
    this.request_id = data.request_id
    this.pending_approval = Boolean(data.pending_approval)
  }
}

// Unified sign-in for the native API: every request is authenticated by the
// portal session cookie (`nostrhost.portal`, sent with `credentials: 'include'`).
// A NIP-07 browser signer is used only as a fallback when there is no session
// (e.g. a CLI-style caller without a portal login). No passwords, no persisted
// keys.
export async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: string,
): Promise<T> {
  const headers = new Headers()
  if (body) {
    headers.set('Content-Type', 'application/json')
    // Lets the backend dedupe a write that the browser retries (flaky
    // network, double-submit) instead of applying it twice.
    headers.set('Idempotency-Key', crypto.randomUUID())
  }

  // Prefer the portal session. Probe it first: a NIP-07 signer is only used
  // when there is no session, otherwise an unrelated browser signer pubkey
  // would be sent and rejected as "not a linked identity". The session cookie
  // is always sent.
  const url = new URL(path, window.location.origin)
  const sessionActive = await sessionProbe()

  if (sessionActive) {
    // H4: cookie-authenticated requests must echo the per-session CSRF token
    // the /package/session probe returned. A cross-origin attacker cannot read
    // it (same-origin probe, no CORS) and cannot set the custom header, so a
    // subdomain XSS can no longer drive the admin API via the SSO cookie.
    const csrf = csrfToken.value
    if (csrf) headers.set('X-Nostrhost-CSRF', csrf)
  }

  if (!sessionActive && window.nostr) {
    try {
      const pubkey = await window.nostr.getPublicKey()
      const tags = [
        ['u', url.href],
        ['method', method],
      ]
      if (body) {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(body),
        )
        const payload = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('')
        tags.push(['payload', payload])
      }

      const signed = await window.nostr.signEvent({
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 27235,
        tags,
        content: '',
      })
      if (signed.pubkey !== pubkey) {
        throw new Error(
          'The signer changed identities while signing the request.',
        )
      }
      const eventBytes = new TextEncoder().encode(JSON.stringify(signed))
      const encodedEvent = btoa(
        Array.from(eventBytes, (byte) => String.fromCharCode(byte)).join(''),
      )
      headers.set('Authorization', `Nostr ${encodedEvent}`)
    } catch {
      // A signer is present but unusable (e.g. locked); fall through to the
      // session cookie and let the API decide.
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new ApiError(
        0,
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
        'timeout',
      )
    }
    throw cause
  } finally {
    clearTimeout(timeout)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      // The session cookie died mid-use (expired, revoked). Force a fresh
      // (uncached) probe; if it's really gone, send the user back through
      // the connect gate rather than surfacing a bare 401 on this screen.
      const info = await refreshSession(true)
      if (!info.authenticated) {
        window.location.hash = `#/connect?redirect=${encodeURIComponent(
          window.location.hash.replace(/^#/, ''),
        )}`
      }
    }
    throw new ApiError(
      response.status,
      data?.error || `Native API request failed (${response.status}).`,
      data?.code,
    )
  }
  // Lifecycle writes return HTTP 200 even when the policy chain rejected,
  // failed, or parked the operation for approval — `ok: false` in the body is
  // the real signal. `ok` is absent from plain reads (e.g. /package/session),
  // so only writes with a body carry it.
  if (
    method === 'POST' &&
    data &&
    typeof data === 'object' &&
    data.ok === false
  ) {
    throw new OperationError(data)
  }
  return data as T
}

// Probe whether a portal session is active (session cookie only). Shares
// useSigner's cached /package/session result instead of re-fetching it on
// every request — the router guard and every view's sync() already keep that
// cache warm, so this is normally free.
async function sessionProbe(): Promise<boolean> {
  try {
    const info = await refreshSession()
    return info.authenticated === true
  } catch {
    return false
  }
}
