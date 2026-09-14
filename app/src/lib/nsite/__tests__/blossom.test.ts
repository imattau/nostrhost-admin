import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadToBlossom, encodeAuthHeader, BUD_AUTH_KIND } from '../blossom'
import type { ManifestItem } from '../manifest'

const ITEMS: ManifestItem[] = [
  {
    path: '/index.html',
    sha256: 'aa'.repeat(32),
  },
  {
    path: '/about.html',
    sha256: 'bb'.repeat(32),
  },
]

function jsonResponse(ok: boolean, status = 200) {
  return {
    ok,
    status,
    text: async () => '',
    json: async () => ({}),
  } as Response
}

function b64urlDecode(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
  return atob(padded)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encodeAuthHeader', () => {
  it('produces a URL-safe base64 event', () => {
    const event = { kind: BUD_AUTH_KIND, tags: [] }
    const header = encodeAuthHeader(event)
    expect(header).not.toMatch(/[+/=]/)
    expect(JSON.parse(b64urlDecode(header))).toEqual(event)
  })
})

describe('uploadToBlossom', () => {
  it('skips present blobs and uploads the rest with one 24242 auth event per batch', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'HEAD') {
        // /about.html is already present, /index.html is not
        return jsonResponse(String(url).includes('bb'.repeat(32)))
      }
      return jsonResponse(true)
    })
    vi.stubGlobal('fetch', fetchMock)

    const signEvent = vi.fn(async (event) => ({
      id: 'signed',
      sig: 'sig',
      ...event,
    }))
    const blobBytes = vi.fn(async (path: string) =>
      new TextEncoder().encode(path),
    )

    const result = await uploadToBlossom(
      'https://blossom.test',
      ITEMS,
      blobBytes,
      {
        pubkey: 'pk',
        signEvent,
      },
    )

    expect(result.ok).toBe(true)
    expect(result.skipped).toEqual(['bb'.repeat(32)])
    expect(result.uploaded).toEqual(['aa'.repeat(32)])

    // the PUT for /index.html carried a kind-24242 auth header with an x tag
    const putCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/upload?sha256='),
    )
    expect(putCall).toBeTruthy()
    const headers = (putCall![1] as RequestInit).headers as Record<
      string,
      string
    >
    expect(headers.Authorization).toMatch(/^Nostr /)
    const authEvent = JSON.parse(
      b64urlDecode(headers.Authorization.replace(/^Nostr /, '')),
    )
    expect(authEvent.kind).toBe(BUD_AUTH_KIND)
    expect(authEvent.tags).toEqual([['x', 'aa'.repeat(32)]])
  })

  it('retries a failed PUT and reports the blob as failed when it never lands', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return jsonResponse(false)
      return jsonResponse(false, 500)
    })
    vi.stubGlobal('fetch', fetchMock)
    const signEvent = vi.fn(async (event) => ({
      id: 'signed',
      sig: 'sig',
      ...event,
    }))

    const result = await uploadToBlossom(
      'https://blossom.test',
      ITEMS,
      async () => new TextEncoder().encode('x'),
      {
        pubkey: 'pk',
        signEvent,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.failed).toHaveLength(2)
    // two attempts per blob
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/upload'))
        .length,
    ).toBe(4)
  })

  it('passes per-file progress callbacks', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return jsonResponse(false)
      return jsonResponse(true)
    })
    vi.stubGlobal('fetch', fetchMock)
    const progress = vi.fn()
    await uploadToBlossom(
      'https://blossom.test',
      ITEMS,
      async () => new TextEncoder().encode('x'),
      {
        pubkey: 'pk',
        signEvent: async (event) => ({ id: 'signed', sig: 'sig', ...event }),
        onProgress: progress,
      },
    )
    expect(progress).toHaveBeenCalledTimes(2)
  })
})
