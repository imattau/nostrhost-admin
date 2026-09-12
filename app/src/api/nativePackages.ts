export type PackageOperation = {
  name: string
  resource: string
  risk?: 'low' | 'medium' | 'high'
  reversible?: boolean
  reverse?: string | null
  summary: string
  args?: Record<string, unknown>
  [field: string]: unknown
}

export type PackagePlan = {
  schema: number
  manifest_sha256: string
  plan_sha256: string
  package: { id: string; version: string }
  operations: PackageOperation[]
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: string,
): Promise<T> {
  const signer = window.nostr
  if (!signer) {
    throw new Error('Install or enable a NIP-07 Nostr signer to connect.')
  }

  const pubkey = await signer.getPublicKey()
  const url = new URL(path, window.location.origin)
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

  const signed = await signer.signEvent({
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
  const headers = new Headers({ Authorization: `Nostr ${encodedEvent}` })
  if (body) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'omit',
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

export function planPackageManifest(packageData: Record<string, unknown>) {
  return request<PackagePlan>(
    '/package/plan',
    'POST',
    JSON.stringify({ package: packageData }),
  )
}
