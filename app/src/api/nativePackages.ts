export type PackageDiagnostic = {
  code: string
  path: Array<string | number>
  message: string
  hint?: string
}

export type PackageValidation = {
  schema: number
  valid: boolean
  package: { id: string; version: string } | null
  diagnostics: PackageDiagnostic[]
}

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
  package?: { id: string; version: string }
  valid?: boolean
  operation_count?: number
  operations?: PackageOperation[]
  diagnostics?: PackageDiagnostic[]
}

export type NativeIdentity = {
  pubkey: string
  username: string
  signer_type: string
  label: string | null
  enabled: boolean
  authority: 'admin'
}

type SchemaDocument = Record<string, unknown>

const API_PREFIX = '/api/v1'

export class NativeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'NativeApiError'
  }
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
  const url = new URL(`${API_PREFIX}${path}`, window.location.origin)
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
    throw new NativeApiError(
      data?.error || `Native API request failed (${response.status}).`,
      response.status,
      data?.code || 'request_failed',
    )
  }
  return data as T
}

export function getPackageSchema() {
  return request<SchemaDocument>('/packages/schema', 'GET')
}

export function getCurrentIdentity() {
  return request<NativeIdentity>('/identity/me', 'GET')
}

export function validatePackageManifest(manifest: string) {
  return request<PackageValidation>(
    '/packages/validate',
    'POST',
    JSON.stringify({ manifest }),
  )
}

export function planPackageManifest(manifest: string) {
  return request<PackagePlan>(
    '/packages/plan',
    'POST',
    JSON.stringify({ manifest }),
  )
}
