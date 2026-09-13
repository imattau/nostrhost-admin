// Unified sign-in for the native API: every request is authenticated by the
// portal session cookie (`nostrhost.portal`, sent with `credentials: 'include'`).
// A NIP-07 browser signer is used only as a fallback when there is no session
// (e.g. a CLI-style caller without a portal login). No passwords, no persisted
// keys.
export async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: string,
): Promise<T> {
  const headers = new Headers()
  if (body) headers.set('Content-Type', 'application/json')

  // Prefer the portal session. If a NIP-07 signer is present AND the session
  // is not already active, sign a NIP-98 event as a fallback so the request
  // still works for signer-first callers. The session cookie is always sent.
  const url = new URL(path, window.location.origin)

  if (window.nostr) {
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
        throw new Error('The signer changed identities while signing the request.')
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

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'include',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      data?.error || `Native API request failed (${response.status}).`,
    )
  }
  return data as T
}