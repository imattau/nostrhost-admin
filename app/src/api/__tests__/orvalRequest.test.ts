import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/useSigner', () => ({
  refreshSession: vi.fn().mockResolvedValue({
    authenticated: true,
    username: 'alice',
    pubkey: 'abc123',
    admin: true,
    csrf_token: 'test-csrf',
  }),
  csrfToken: { value: 'test-csrf' },
}))

import { orvalRequest } from '@/api/orvalRequest'

describe('orvalRequest (A1 generated-client mutator)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('maps a generated GET onto the authenticated request() wrapper', async () => {
    await orvalRequest('https://host/package/system/version', { method: 'GET' })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/package/system/version')
    expect(init?.method).toBe('GET')
  })

  it('serialises a generated POST body and keeps the method', async () => {
    await orvalRequest('https://host/package/domain/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(String(init?.body)).toContain('example.com')
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}